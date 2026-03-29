import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GridSystem } from './terrain/GridSystem';
import { TerrainGenerator } from './terrain/TerrainGenerator';
import { LightingSystem } from './terrain/LightingSystem';
import { PerformanceMonitor } from './debug/PerformanceMonitor';
import { TerrainControls } from './ui/TerrainControls';
import { EdgeControls } from './ui/EdgeControls';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls | null = null;
    private gridSystem: GridSystem | null = null;
    private terrainGenerator: TerrainGenerator | null = null;
    private terrainControls: TerrainControls | null = null;
    private edgeControls: EdgeControls | null = null;
    private lightingSystem: LightingSystem | null = null;
    private clock: THREE.Clock = new THREE.Clock();
    private lastTime: number = 0;
    private performanceMonitor: PerformanceMonitor;
    private disposed: boolean = false;
    private resizeHandler: (() => void) | null = null;

    constructor() {
        // Initialize scene
        this.scene = new THREE.Scene();
        
        // Setup camera with adjusted parameters for better sun visibility
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
        this.camera.position.set(4000, 3000, 4000);
        this.camera.lookAt(0, 0, 0);
        this.camera.far = 500000;
        this.camera.updateProjectionMatrix();

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            logarithmicDepthBuffer: true // Help with z-fighting
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        document.body.appendChild(this.renderer.domElement);

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
        
        // Then initialize grid and terrain
        this.gridSystem = new GridSystem(this.scene, this.camera);
        this.terrainGenerator = new TerrainGenerator(this.scene, this.gridSystem, this.camera, this.lightingSystem);
        this.terrainControls = new TerrainControls(this.terrainGenerator, () => {
            this.camera.position.set(4000, 3000, 4000);
            this.camera.lookAt(0, 0, 0);
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
        });
        this.edgeControls = new EdgeControls(this.terrainGenerator);

        // Set initial sun height
        if (this.lightingSystem) {
            this.lightingSystem.setSunHeight(0.5);
        }

        this.setupEventListeners();
        this.animate();
    }

    private setupEventListeners(): void {
        this.resizeHandler = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
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

        this.renderer.render(this.scene, this.camera);
    }

    public dispose(): void {
        this.disposed = true;
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        if (this.terrainControls) {
            this.terrainControls.dispose();
        }
        if (this.edgeControls) {
            this.edgeControls.dispose();
        }
        if (this.terrainGenerator) {
            this.terrainGenerator.dispose();
        }
        if (this.lightingSystem) {
            this.lightingSystem.dispose();
        }
        this.renderer.dispose();
        document.body.removeChild(this.renderer.domElement);

        // Dispose of performance monitor
        this.performanceMonitor.dispose();
    }
} 