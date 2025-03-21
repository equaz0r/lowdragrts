import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GridSystem } from './terrain/GridSystem';
import { TerrainGenerator } from './terrain/TerrainGenerator';
import { LightingSystem } from './terrain/LightingSystem';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls | null = null;
    private gridSystem: GridSystem | null = null;
    private terrainGenerator: TerrainGenerator | null = null;
    private lightingSystem: LightingSystem | null = null;
    private clock: THREE.Clock;
    private lastTime: number = 0;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        this.initialize();
        this.setupEventListeners();
        this.animate();
    }

    private initialize(): void {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(100, 100, 100);
        this.camera.lookAt(0, 0, 0);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Initialize systems
        this.gridSystem = new GridSystem(this.scene);
        this.terrainGenerator = new TerrainGenerator(this.scene, this.gridSystem);
        this.lightingSystem = new LightingSystem(this.scene, this.camera);
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
        if (this.lightingSystem) {
            this.lightingSystem.dispose();
        }
        this.renderer.dispose();
        document.body.removeChild(this.renderer.domElement);
    }
} 