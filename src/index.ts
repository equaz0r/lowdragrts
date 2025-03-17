import * as THREE from 'three';
import { WorldManager } from './engine/voxel/WorldManager';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectsManager } from './engine/graphics/EffectsManager';
import { ParticleSystem } from './engine/graphics/ParticleSystem';
import { DayNightCycle } from './engine/environment/DayNightCycle';
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

export class Game implements GameInterface {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private worldManager: WorldManager;
    private effectsManager: EffectsManager;
    private resourceParticles: Map<string, ParticleSystem>;
    private dayNightCycle: DayNightCycle;
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

    constructor() {
        console.log('Game constructor called');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        // Add orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        
        // Create world manager
        this.worldManager = new WorldManager(this.scene);
        
        this.resourceParticles = new Map();
        
        this.clock = new THREE.Clock();
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.selectionBox = new SelectionBox();
        this.gameUI = new GameUI();
        
        this.projectileManager = new ProjectileManager(this.scene);
        
        this.commandVisualizer = new CommandVisualizer(this.scene);
        
        this.inputManager = new InputManager(this);

        // Initialize settings
        this.settingsManager = new SettingsManager(this.handleSettingsChange.bind(this));
        this.settingsButton = new SettingsButton(this.settingsManager);
        document.body.appendChild(this.settingsButton.getElement());
        document.body.appendChild(this.settingsManager.getElement());

        // Initialize previously uninitialized properties
        this.effectsManager = new EffectsManager(this.scene, this.camera, this.renderer);
        this.dayNightCycle = new DayNightCycle(this.scene);
        this.debugUI = new DebugUI(
            (time) => this.dayNightCycle.updateSunPosition(time),
            (enabled) => this.dayNightCycle.setAutoRotate(enabled),
            () => this.regenerateWorld()
        );
        this.unitManager = new UnitManager(
            this.scene,
            this.worldManager,
            this.projectileManager,
            this.commandVisualizer,
            this.gameUI
        );
        
        this.init();
    }

    private handleSettingsChange(settings: GameSettings): void {
        this.projectileManager.updateProjectileSettings(settings);
    }

    private init(): void {
        console.log('Game init started');
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue color
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // Add camera to scene for unit selection
        this.scene.userData.camera = this.camera;

        // Setup lights
        const ambientLight = new THREE.AmbientLight(0x404040, 1.5); // Increased intensity
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);

        // Add hemisphere light for better ambient lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(hemisphereLight);

        // Setup camera
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);
        this.controls.enabled = false; // Start in unit control mode

        // Configure controls
        this.controls.maxPolarAngle = Math.PI * 0.45; // Limit how low camera can go
        this.controls.minDistance = 20;
        this.controls.maxDistance = 500;
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        // Generate more initial chunks
        this.worldManager.generateInitialChunks(8); // Increased radius

        // Setup post-processing
        this.effectsManager = new EffectsManager(this.scene, this.camera, this.renderer);

        // Add some particle systems for resources
        this.resourceParticles.set('skirulum', new ParticleSystem(
            this.scene,
            new THREE.Color(0x4B0082),
            500
        ));

        this.resourceParticles.set('fredalite', new ParticleSystem(
            this.scene,
            new THREE.Color(0x00FF00),
            300
        ));

        // Setup day/night cycle
        this.dayNightCycle = new DayNightCycle(this.scene);

        // Setup debug UI
        this.debugUI = new DebugUI(
            (time) => this.dayNightCycle.updateSunPosition(time),
            (enabled) => this.dayNightCycle.setAutoRotate(enabled),
            () => this.regenerateWorld()
        );

        // Setup unit manager
        this.unitManager = new UnitManager(
            this.scene,
            this.worldManager,
            this.projectileManager,
            this.commandVisualizer,
            this.gameUI
        );

        // Add some test units
        const unit1 = this.unitManager.createUnit(UnitType.BASIC_ROBOT, new THREE.Vector3(0, 20, 0));
        const unit2 = this.unitManager.createUnit(UnitType.HARVESTER, new THREE.Vector3(10, 20, 0));
        const unit3 = this.unitManager.createUnit(UnitType.BUILDER, new THREE.Vector3(-10, 20, 0));

        // Setup event listeners
        this.setupEventListeners();

        // Update window resize handler
        window.addEventListener('resize', () => {
            this.onWindowResize();
            this.effectsManager.setSize(window.innerWidth, window.innerHeight);
        }, false);

        this.animate();

        this.isInitialized = true;
        console.log('Game init completed');
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

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
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

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        if (!this.isInitialized) return;

        // Update day/night cycle
        this.dayNightCycle.update(delta);
        if (this.dayNightCycle.getTime() !== this.debugUI.getCurrentTime()) {
            this.debugUI.updateTime(this.dayNightCycle.getTime());
        }
        
        // Update managers
        this.unitManager.update(delta);
        this.projectileManager.update(delta);
        this.worldManager.update();

        // Update UI
        this.unitManager.updateSelectedUnitsInfo();
        this.unitManager.updateScrapCounter();

        // Update camera controls
        this.controls.update();

        // Render the scene
        this.renderer.render(this.scene, this.camera);
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
}