import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GridSystem } from './terrain/GridSystem';
import { TerrainGenerator } from './terrain/TerrainGenerator';
import { LightingSystem } from './terrain/LightingSystem';
import { SunControl } from './ui/SunControl';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls | null = null;
    private gridSystem: GridSystem | null = null;
    private terrainGenerator: TerrainGenerator | null = null;
    private lightingSystem: LightingSystem | null = null;
    private sunControl: SunControl | null = null;
    private clock: THREE.Clock;
    private lastTime: number = 0;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            logarithmicDepthBuffer: true // Help with z-fighting
        });
        this.clock = new THREE.Clock();
        
        this.initialize();
        this.setupEventListeners();
        this.animate();
    }

    private initialize(): void {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        document.body.appendChild(this.renderer.domElement);

        // Store renderer in scene's userData for access by other systems
        this.scene.userData.renderer = this.renderer;

        // Setup camera with adjusted parameters for better sun visibility
        this.camera.position.set(200, 200, 200);
        this.camera.lookAt(0, 0, 0);
        this.camera.far = 500000;
        this.camera.updateProjectionMatrix();

        // Store camera in scene's userData
        this.scene.userData.camera = this.camera;

        // Setup controls with more relaxed limits
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 2000;
        this.controls.minDistance = 50;
        this.controls.maxPolarAngle = Math.PI * 0.65;
        this.controls.minPolarAngle = 0.1;

        // Initialize lighting first using singleton pattern
        this.lightingSystem = LightingSystem.getInstance(this.scene, this.camera);
        
        // Then initialize grid and terrain
        this.gridSystem = new GridSystem(this.scene);
        this.terrainGenerator = new TerrainGenerator(this.scene, this.gridSystem);
        
        // Finally initialize UI controls
        this.sunControl = new SunControl(this.lightingSystem);

        // Set initial sun height
        if (this.lightingSystem) {
            this.lightingSystem.setManualSunHeight(0.5);
        }
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    private animate(): void {
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
            this.lightingSystem.update(deltaTime);
        }

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }

    public dispose(): void {
        if (this.terrainGenerator) {
            this.terrainGenerator.dispose();
        }
        if (this.sunControl) {
            this.sunControl.dispose();
        }
        if (this.lightingSystem) {
            this.lightingSystem.dispose();
        }
        this.renderer.dispose();
        document.body.removeChild(this.renderer.domElement);
    }
} 