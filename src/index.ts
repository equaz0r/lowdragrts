﻿import * as THREE from 'three';
import { WorldManager } from './engine/world/WorldManager';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectsManager } from './engine/graphics/EffectsManager';
import { ParticleSystem } from './engine/graphics/ParticleSystem';
import { DebugUI } from './engine/ui/DebugUI';
import { UnitManager } from './engine/units/UnitManager';
import { UnitType } from './engine/units/Unit';
import { SelectionBox } from './engine/ui/SelectionBox';
import { GameUI } from './engine/ui/GameUI';
import { ProjectileManager } from './engine/combat/ProjectileManager';
import { CommandVisualizer } from './engine/units/CommandVisualizer';
import { InputManager, ControlMode } from './engine/controls/InputManager';
import { GameInterface } from './engine/interfaces/GameInterface';
import { Unit } from './engine/units/Unit';
import { SettingsManager, GameSettings } from './ui/SettingsManager';
import { SettingsButton } from './ui/SettingsButton';
import { EdgeDetection } from './engine/graphics/EdgeDetection';
import { DayNightCycle } from './engine/environment/DayNightCycle';
import { DebugPanel } from './engine/debug/DebugPanel';
import { BloomEffect } from './engine/graphics/BloomEffect';

export class Game implements GameInterface {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private worldManager: WorldManager;
    private effectsManager: EffectsManager;
    private resourceParticles: Map<string, ParticleSystem>;
    private debugUI: DebugUI;
    private clock: THREE.Clock;
    private unitManager: UnitManager;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private isSelecting: boolean = false;
    private selectionBox: SelectionBox;
    private gameUI: GameUI;
    private selectionStart: THREE.Vector2 = new THREE.Vector2();
    private projectileManager: ProjectileManager;
    private commandVisualizer: CommandVisualizer;
    private inputManager: InputManager;
    private currentAction: string | null = null;
    private controlMode: ControlMode = ControlMode.UNIT_CONTROL;
    private isInitialized: boolean = false;
    private isDragging: boolean = false;
    private settingsManager: SettingsManager;
    private settingsButton: SettingsButton;
    private edgeDetection: EdgeDetection;
    private dayNightCycle: DayNightCycle;
    private spotlight: THREE.SpotLight;
    private ambientLight: THREE.AmbientLight;
    private debugPanel: DebugPanel;
    private bloomEffect: BloomEffect;
    private time: number = 0;
    private autoRotate: boolean = false;
    private useBloom: boolean = false;

    constructor() {
        console.log('Game constructor called');
        
        // Scene setup
        this.scene = new THREE.Scene();
        
        // Add fog with better visibility
        const fogColor = new THREE.Color(0x1a1a2a); // Darker blue instead of black
        const fogNear = 200; // Start fading further out
        const fogFar = 500; // Complete fade further out
        this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
        
        // Set background to match fog color
        this.scene.background = fogColor;
        
        // Create skybox with better visibility
        const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
        const skyboxMaterials = [
            new THREE.MeshBasicMaterial({ color: 0x1a1a2a }), // Match fog color
            new THREE.MeshBasicMaterial({ color: 0x1a1a2a }),
            new THREE.MeshBasicMaterial({ color: 0x1a1a2a }),
            new THREE.MeshBasicMaterial({ color: 0x1a1a2a }),
            new THREE.MeshBasicMaterial({ color: 0x1a1a2a }),
            new THREE.MeshBasicMaterial({ color: 0x1a1a2a }),
        ];
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
        this.scene.add(skybox);
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 1.0); // Increased intensity
        this.scene.add(ambientLight);
        
        // Add directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
        directionalLight.position.set(10, 10, 10);
        directionalLight.lookAt(0, 0, 0);
        this.scene.add(directionalLight);
        
        // Add hemisphere light for better overall illumination
        const hemisphereLight = new THREE.HemisphereLight(0x404040, 0x202020, 0.5); // Increased intensity
        hemisphereLight.position.set(0, 10, 0);
        this.scene.add(hemisphereLight);
        
        // Initialize day/night cycle
        this.dayNightCycle = new DayNightCycle(this.scene);
        
        // Renderer setup with adjusted settings
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            logarithmicDepthBuffer: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.LinearToneMapping;
        this.renderer.toneMappingExposure = 1.5; // Increased exposure
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.01, 2000);
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);
        
        // Controls setup
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;
        this.controls.maxPolarAngle = Math.PI; // Allow full vertical rotation
        this.controls.minPolarAngle = 0; // Allow looking straight down
        this.controls.target.set(0, 0, 0);
        
        // Add camera position constraint
        this.controls.addEventListener('change', () => {
            // Ensure camera doesn't go below ground
            if (this.camera.position.y < 0) {
                this.camera.position.y = 0;
            }
            // Ensure target doesn't go below ground
            if (this.controls.target.y < 0) {
                this.controls.target.y = 0;
            }
        });
        
        // Initialize managers
        this.worldManager = new WorldManager(this.scene);
        this.effectsManager = new EffectsManager(this.scene, this.camera, this.renderer);
        this.debugUI = new DebugUI(
            (time: number) => this.updateTime(time),
            (enabled: boolean) => this.setAutoRotate(enabled),
            () => this.regenerateWorld()
        );
        
        // Initialize other components
        this.resourceParticles = new Map();
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectionBox = new SelectionBox();
        this.gameUI = new GameUI();
        this.projectileManager = new ProjectileManager(this.scene);
        this.commandVisualizer = new CommandVisualizer(this.scene);
        
        // Initialize unit manager
        this.unitManager = new UnitManager(
            this.scene,
            this.worldManager,
            this.projectileManager,
            this.commandVisualizer,
            this.gameUI
        );
        
        // Initialize input manager
        this.inputManager = new InputManager(this);
        
        // Initialize settings
        this.settingsManager = new SettingsManager(this.handleSettingsChange.bind(this));
        this.settingsButton = new SettingsButton(this.settingsManager);
        document.body.appendChild(this.settingsButton.getElement());
        document.body.appendChild(this.settingsManager.getElement());
        
        // Initialize edge detection
        this.edgeDetection = new EdgeDetection(this.scene, this.camera, this.renderer);
        
        // Add camera to scene for unit selection
        this.scene.userData.camera = this.camera;
        
        // Generate initial world
        console.log('Generating initial world...');
        this.worldManager.generateInitialChunks(8);
        
        // Create test units
        console.log('Creating test units...');
        this.unitManager.createUnit(UnitType.WORKER, new THREE.Vector3(0, 0, 0));
        this.unitManager.createUnit(UnitType.SOLDIER, new THREE.Vector3(10, 0, 0));
        this.unitManager.createUnit(UnitType.TANK, new THREE.Vector3(-10, 0, 0));
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start animation loop
        console.log('Starting animation loop...');
        this.animate();
        
        this.isInitialized = true;
        console.log('Game initialization completed');

        // Add minimal ambient light
        this.ambientLight = new THREE.AmbientLight(0x000000, 0.1);
        this.scene.add(this.ambientLight);

        // Add spotlight for flashlight effect
        this.spotlight = new THREE.SpotLight(0xffffff, 2.0);
        this.spotlight.angle = Math.PI / 4; // 45 degrees
        this.spotlight.penumbra = 0.1;
        this.spotlight.decay = 1.5;
        this.spotlight.distance = 256; // Match fog distance
        this.spotlight.castShadow = true;
        this.scene.add(this.spotlight);
        this.scene.add(this.spotlight.target);

        // Update spotlight position in animation loop
        this.controls.addEventListener('change', () => {
            this.updateSpotlight();
        });

        // Initialize debug panel
        this.debugPanel = new DebugPanel(this.camera, this.worldManager);

        // Initialize bloom effect
        this.bloomEffect = new BloomEffect(this.scene, this.camera, this.renderer);
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('gameAction', ((e: Event) => {
            const customEvent = e as CustomEvent<{ action: string }>;
            this.handleGameAction(customEvent.detail.action);
        }) as EventListener);
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        if (!this.isInitialized) return;
        
        // Update managers
        this.unitManager.update(deltaTime);
        this.projectileManager.update(deltaTime);
        this.worldManager.update();
        this.inputManager.update();
        
        // Update day/night cycle
        const time = (this.clock.getElapsedTime() % 600) / 600; // 10 minutes per day cycle
        this.dayNightCycle.updateSunPosition(time);
        
        // Update UI
        this.unitManager.updateSelectedUnitsInfo();
        this.unitManager.updateScrapCounter();
        
        // Update camera controls
        this.controls.update();

        // Update spotlight
        this.updateSpotlight();

        // Update debug panel
        this.debugPanel.update(deltaTime);

        // Render with or without bloom effect
        if (this.useBloom) {
            this.bloomEffect.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    private handleSettingsChange(settings: GameSettings): void {
        this.projectileManager.updateProjectileSettings(settings);
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.edgeDetection.setSize(window.innerWidth, window.innerHeight);
    }

    private regenerateWorld(): void {
        this.worldManager.dispose();
        this.worldManager.generateInitialChunks(8);
    }

    private onMouseDown(event: MouseEvent): void {
        if (!this.isInitialized) return;
        if (this.controlMode === ControlMode.CAMERA) return;

        if (event.button === 0) { // Left click
            this.isDragging = true;
            this.unitManager.startSelection(event.clientX, event.clientY);
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isInitialized) return;

        // Update hover effects
        this.unitManager.updateHover(event.clientX, event.clientY);

        // Update selection box if dragging and in unit control mode
        if (this.isDragging && this.controlMode === ControlMode.UNIT_CONTROL) {
            this.unitManager.updateSelection(event.clientX, event.clientY);
        }

        // Update cursor coordinates display
        const coordinates = this.getWorldCoordinates(event.clientX, event.clientY);
        this.gameUI.updateCursorCoordinates(coordinates);
    }

    private onMouseUp(event: MouseEvent): void {
        if (!this.isInitialized) return;
        if (this.controlMode === ControlMode.CAMERA) return;

        if (event.button === 0) { // Left click
            this.isDragging = false;
            this.unitManager.endSelection();
            this.unitManager.updateSelectedUnitsInfo();
        } else if (event.button === 2) { // Right click
            const coordinates = this.getWorldCoordinates(event.clientX, event.clientY);
            const targetUnit = this.unitManager.getUnitAtPosition(coordinates);

            if (this.currentAction === 'attack' && targetUnit) {
                console.log('Found target unit at position:', targetUnit.getId());
                this.unitManager.attackTarget(targetUnit);
            } else {
                this.unitManager.moveSelectedUnits(coordinates);
            }
        }
    }

    private onMouseClick(event: MouseEvent): void {
        if (!this.isInitialized) return;
        if (this.controlMode === ControlMode.CAMERA) return;

        if (event.button === 0) { // Left click
            const coordinates = this.getWorldCoordinates(event.clientX, event.clientY);
            const clickedUnit = this.unitManager.getUnitAtPosition(coordinates);

            if (clickedUnit) {
                if (event.shiftKey) {
                    // Shift-click to add/remove from selection
                    this.unitManager.toggleUnitSelection(clickedUnit);
                } else {
                    // Regular click to select only this unit
                    this.unitManager.selectUnit(clickedUnit);
                }
                this.unitManager.updateSelectedUnitsInfo();
            } else {
                // Clicked empty space, clear selection
                this.unitManager.clearSelection();
                this.unitManager.updateSelectedUnitsInfo();
            }
        }
    }

    private onContextMenu(event: MouseEvent): void {
        event.preventDefault();
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (event.code === 'Space') {
            this.updateControlMode(
                this.controlMode === ControlMode.CAMERA 
                    ? ControlMode.UNIT_CONTROL 
                    : ControlMode.CAMERA
            );
        }
    }

    // Public methods for InputManager
    public updateControlMode(mode: ControlMode): void {
        console.log("Switching to mode:", mode);
        this.controlMode = mode;
        this.controls.enabled = mode === ControlMode.CAMERA;
        if (mode === ControlMode.CAMERA) {
            this.unitManager.clearSelection();
            this.selectionBox.hide();
        }
        this.gameUI.setMode(mode === ControlMode.CAMERA ? 'Camera' : 'Unit Control');
        this.gameUI.updateModeIndicator();
    }

    // Implement GameInterface methods
    public getSelectedUnitIds(): number[] {
        return this.unitManager.getSelectedUnits().map(unit => unit.getId());
    }

    public selectUnitsById(ids: number[]): void {
        this.unitManager.selectUnitsById(ids);
        this.unitManager.updateSelectedUnitsInfo();
    }

    public setCurrentAction(action: string): void {
        console.log('Setting current action:', action);
        this.currentAction = action;
        this.gameUI.updateAction(action);
        if (action === 'attack') {
            this.updateCursorStyle('crosshair');
        } else {
            this.updateCursorStyle('default');
        }
    }

    public cancelCurrentAction(): void {
        this.currentAction = null;
        this.gameUI.updateAction(null);
        this.unitManager.cancelCurrentAction();
    }

    public stopSelectedUnits(): void {
        this.unitManager.stopSelectedUnits();
    }

    public holdSelectedUnits(): void {
        this.unitManager.holdSelectedUnits();
    }

    public toggleHelp(): void {
        this.gameUI.toggleHotkeyDisplay();
    }

    private updateCursorStyle(cursorType: string): void {
        document.body.style.cursor = cursorType;
    }

    private getWorldCoordinates(clientX: number, clientY: number): THREE.Vector3 {
        // Convert screen coordinates to normalized device coordinates (-1 to +1)
        const mouse = new THREE.Vector2(
            (clientX / window.innerWidth) * 2 - 1,
            -(clientY / window.innerHeight) * 2 + 1
        );

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(mouse, this.camera);

        // Find intersection with the ground plane
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            return intersects[0].point;
        }

        // If no intersection found, return a point at the camera's height
        const distance = 100;
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        return this.camera.position.clone().add(direction.multiplyScalar(distance));
    }

    public getControlMode(): ControlMode {
        return this.controlMode;
    }

    public panCamera(direction: 'forward' | 'backward' | 'left' | 'right'): void {
        const speed = 0.5;
        const moveAmount = new THREE.Vector3();
        
        // Get camera's forward and right vectors
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        // Project forward vector onto the XZ plane (ground plane)
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(this.camera.up, forward).normalize();

        switch (direction) {
            case 'forward':
                moveAmount.copy(forward).multiplyScalar(speed);
                break;
            case 'backward':
                moveAmount.copy(forward).multiplyScalar(-speed);
                break;
            case 'left':
                moveAmount.copy(right).multiplyScalar(speed); // Swapped direction
                break;
            case 'right':
                moveAmount.copy(right).multiplyScalar(-speed); // Swapped direction
                break;
        }

        // Move camera and controls target
        const newCameraPos = this.camera.position.clone().add(moveAmount);
        const newTargetPos = this.controls.target.clone().add(moveAmount);

        // Ensure neither camera nor target goes below ground
        if (newCameraPos.y >= 0 && newTargetPos.y >= 0) {
            this.camera.position.copy(newCameraPos);
            this.controls.target.copy(newTargetPos);
            this.controls.update();
        }
    }

    private handleGameAction(action: string): void {
        console.log('Handling game action:', action);
        switch (action) {
            case 'attack':
                this.setCurrentAction('attack');
                break;
            case 'stop':
                this.stopSelectedUnits();
                this.cancelCurrentAction();
                break;
            case 'hold':
                this.holdSelectedUnits();
                break;
            case 'patrol':
                // TODO: Implement patrol
                break;
            case 'toggleMode':
                this.updateControlMode(
                    this.controlMode === ControlMode.CAMERA 
                        ? ControlMode.UNIT_CONTROL 
                        : ControlMode.CAMERA
                );
                break;
            case 'help':
                this.gameUI.toggleHotkeyDisplay();
                break;
        }
    }

    private updateSpotlight(): void {
        // Get camera direction
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        // Position spotlight slightly behind camera
        this.spotlight.position.copy(this.camera.position);
        
        // Set spotlight target to point where camera is looking
        const targetPosition = this.camera.position.clone().add(
            cameraDirection.multiplyScalar(10)
        );
        this.spotlight.target.position.copy(targetPosition);
    }

    private updateTime(time: number): void {
        this.time = time;
        // Update any time-based effects here
    }

    private setAutoRotate(enabled: boolean): void {
        this.autoRotate = enabled;
    }

    public dispose(): void {
        // ... existing dispose code ...
        this.bloomEffect.dispose();
        // ... rest of existing code ...
    }
}