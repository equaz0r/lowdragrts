import * as THREE from 'three';
import { SettingsButton } from './ui/SettingsButton';
import { SettingsManager, GameSettings } from './ui/SettingsManager';
import { ProjectileManager } from './engine/combat/ProjectileManager';
import { Unit } from './engine/units/Unit';

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private settingsButton: SettingsButton;
    private settingsManager: SettingsManager;
    private projectileManager: ProjectileManager;
    private units: Unit[] = [];
    private isRunning: boolean = false;
    private lastTime: number = 0;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.projectileManager = new ProjectileManager(this.scene);
        this.settingsManager = new SettingsManager(this.handleSettingsChange.bind(this));
        this.settingsButton = new SettingsButton(this.settingsManager);

        document.body.appendChild(this.settingsButton.getElement());
        document.body.appendChild(this.settingsManager.getElement());

        this.setupCamera();
        this.setupEventListeners();
    }

    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getProjectileManager(): ProjectileManager {
        return this.projectileManager;
    }

    private setupCamera(): void {
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    public handleResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private handleSettingsChange(settings: GameSettings): void {
        // Update projectile visuals based on settings
        this.projectileManager.updateProjectileSettings(settings);
    }

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animate();
    }

    public stop(): void {
        this.isRunning = false;
    }

    private animate(): void {
        if (!this.isRunning) return;

        requestAnimationFrame(this.animate.bind(this));
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();
    }

    private update(deltaTime: number): void {
        // Update game state
        this.projectileManager.update(deltaTime);
        this.units.forEach(unit => unit.update(deltaTime));
    }

    private render(): void {
        this.renderer.render(this.scene, this.camera);
    }

    public addUnit(unit: Unit): void {
        this.units.push(unit);
        this.scene.add(unit);
    }

    public removeUnit(unit: Unit): void {
        const index = this.units.indexOf(unit);
        if (index !== -1) {
            this.units.splice(index, 1);
            this.scene.remove(unit);
        }
    }

    public dispose(): void {
        this.stop();
        this.units.forEach(unit => unit.dispose());
        this.projectileManager.dispose();
        this.renderer.dispose();
        document.body.removeChild(this.renderer.domElement);
        document.body.removeChild(this.settingsButton.getElement());
        document.body.removeChild(this.settingsManager.getElement());
    }
} 