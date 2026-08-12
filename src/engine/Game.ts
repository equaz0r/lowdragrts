import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, BrightnessContrastEffect, VignetteEffect } from 'postprocessing';
import { GridSystem } from './terrain/GridSystem';
import { TerrainGenerator } from './terrain/TerrainGenerator';
import { LightingSystem } from './terrain/LightingSystem';
import { PerformanceMonitor } from './debug/PerformanceMonitor';
import { TerrainControls } from './ui/TerrainControls';
import { EdgeControls } from './ui/EdgeControls';
import { SettingsIO } from './ui/SettingsIO';
import { CameraParameters } from './config/CameraConfig';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer;
    private controls: OrbitControls | null = null;
    private gridSystem: GridSystem | null = null;
    private terrainGenerator: TerrainGenerator | null = null;
    private terrainControls: TerrainControls | null = null;
    private edgeControls: EdgeControls | null = null;
    private settingsIO: SettingsIO | null = null;
    private lightingSystem: LightingSystem | null = null;
    private clock: THREE.Clock = new THREE.Clock();
    private lastTime: number = 0;
    private performanceMonitor: PerformanceMonitor;
    private disposed: boolean = false;
    private resizeHandler: (() => void) | null = null;

    constructor() {
        // Initialize scene
        this.scene = new THREE.Scene();
        
        // Setup camera — see CameraConfig.ts for why far clip is 500000
        this.camera = new THREE.PerspectiveCamera(
            CameraParameters.FIELD_OF_VIEW,
            window.innerWidth / window.innerHeight,
            CameraParameters.NEAR_CLIP_PLANE,
            CameraParameters.FAR_CLIP_PLANE,
        );
        this.camera.position.copy(CameraParameters.INITIAL_POSITION);
        this.camera.lookAt(0, 0, 0);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true // Help with z-fighting
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // Tone mapping moves to a ToneMappingEffect in the composer chain below —
        // the postprocessing package requires NoToneMapping on the renderer itself,
        // otherwise HDR colour (our edge-glow intensities go up to 8+) gets clamped
        // to [0,1] before bloom ever sees it. Exposure now lives on that effect too.
        this.renderer.toneMapping = THREE.NoToneMapping;
        document.body.appendChild(this.renderer.domElement);

        // Post-processing: bloom for the neon edge-grid glow, feeding an HDR buffer
        // into ACES tone mapping, then LDR colour grading, as one composited pass
        // (replaces renderer.render()). multisampling reduced from 4 to 2 — the
        // composer bypasses the renderer's own `antialias: true` entirely, but 4x
        // was measurably heavy (contributing to the "jerky" pulse animation).
        this.composer = new EffectComposer(this.renderer, {
            frameBufferType: THREE.HalfFloatType,
            multisampling: 2,
        });
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // Threshold/intensity eased back up from the previous round — that
        // tuning was fighting an unbounded-reflectionStrength bug (fixed now,
        // see ReflectionParameters/TerrainMaterial.ts), not bloom itself, so
        // it was more conservative than it needs to be. Radius/levels stay
        // tight so this reads as crisp glow, not veiling haze.
        const bloomEffect = new BloomEffect({
            luminanceThreshold: 0.78,
            luminanceSmoothing: 0.15,
            intensity: 0.9,
            radius: 0.45,
            levels: 4,
            mipmapBlur: true,
        });
        const toneMappingEffect = new ToneMappingEffect({
            mode: ToneMappingMode.ACES_FILMIC, // matches the old renderer.toneMapping setting
        });
        // LDR grading, applied AFTER tone mapping (operates on the [0,1] output,
        // not the HDR buffer) — this is the actual "neon glow, not hazy" lever:
        // crush shadows toward true black, add contrast so blacks/highlights
        // separate cleanly, vignette to frame focus away from the edges.
        const gradingEffect = new BrightnessContrastEffect({ brightness: -0.2, contrast: 0.3 });
        const vignetteEffect = new VignetteEffect({ darkness: 0.5, offset: 0.35 });
        // All four in one EffectPass — order matters (bloom on HDR, then tonemap
        // HDR->LDR, then grade/vignette the LDR result) and one pass is cheaper
        // than several separate full-screen passes.
        this.composer.addPass(new EffectPass(this.camera, bloomEffect, toneMappingEffect, gradingEffect, vignetteEffect));

        // Initialize performance monitor
        this.performanceMonitor = PerformanceMonitor.getInstance(this.renderer);

        // Initialize controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 16000;
        this.controls.minDistance = 100;
        this.controls.maxPolarAngle = Math.PI * 0.65;
        this.controls.minPolarAngle = 0.1;

        // Initialize lighting first using singleton pattern
        this.lightingSystem = LightingSystem.getInstance(this.scene, this.camera);

        // Set initial sun height BEFORE constructing TerrainGenerator/
        // ReflectionControls below — ReflectionControls' Sun Height slider
        // reads the real current value at construction time (used to be
        // hardcoded to always display 0.5 regardless of reality; fixed in
        // ReflectionControls.ts), so this has to happen first or the slider
        // shows a stale value on load even though the light itself is correct.
        this.lightingSystem.setSunHeight(-0.80); // Simon's hand-tuned scene, 11 Aug 2026

        // Then initialize grid and terrain
        this.gridSystem = new GridSystem();
        this.terrainGenerator = new TerrainGenerator(this.scene, this.gridSystem, this.camera, this.lightingSystem);
        this.terrainControls = new TerrainControls(this.terrainGenerator, () => {
            this.camera.position.copy(CameraParameters.INITIAL_POSITION);
            this.camera.lookAt(0, 0, 0);
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
        });
        this.edgeControls = new EdgeControls(this.terrainGenerator);
        this.settingsIO = new SettingsIO(
            this.terrainGenerator,
            this.terrainControls,
            this.edgeControls,
            this.terrainGenerator.getReflectionControls(),
        );

        this.setupEventListeners();
        this.animate();
    }

    private setupEventListeners(): void {
        this.resizeHandler = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            // Sets the renderer's size too — see EffectComposer.setSize docs.
            this.composer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', this.resizeHandler);
    }

    private animate(): void {
        if (this.disposed) return;
        requestAnimationFrame(() => this.animate());

        const time = performance.now() * 0.001; // Convert to seconds
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        // Update terrain
        if (this.terrainGenerator) {
            this.terrainGenerator.update(time);
        }

        // Update lighting
        if (this.lightingSystem) {
            this.lightingSystem.update();
        }

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Update performance monitor
        this.performanceMonitor.update();

        this.composer.render(deltaTime);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }
        if (this.terrainControls) {
            this.terrainControls.dispose();
        }
        if (this.edgeControls) {
            this.edgeControls.dispose();
        }
        if (this.settingsIO) {
            this.settingsIO.dispose();
        }
        if (this.terrainGenerator) {
            this.terrainGenerator.dispose();
        }
        if (this.lightingSystem) {
            this.lightingSystem.dispose();
        }
        this.composer.dispose();
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        // Dispose of performance monitor
        this.performanceMonitor.dispose();
    }
}
