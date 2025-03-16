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

    constructor() {
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
        
        this.init();
    }

    private init(): void {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue color
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

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
        this.controls.enabled = false; // Start in unit control mode

        // Configure controls
        this.controls.maxPolarAngle = Math.PI * 0.45; // Limit how low camera can go
        this.controls.minDistance = 20;
        this.controls.maxDistance = 500;

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
        this.unitManager = new UnitManager(this.scene, this.worldManager, this.projectileManager, this.commandVisualizer);

        // Add some test units
        this.unitManager.createUnit(UnitType.BASIC_ROBOT, new THREE.Vector3(0, 20, 0));
        this.unitManager.createUnit(UnitType.HARVESTER, new THREE.Vector3(10, 20, 0));
        this.unitManager.createUnit(UnitType.BUILDER, new THREE.Vector3(-10, 20, 0));

        // Setup event listeners
        this.setupEventListeners();

        // Update window resize handler
        window.addEventListener('resize', () => {
            this.onWindowResize();
            this.effectsManager.setSize(window.innerWidth, window.innerHeight);
        }, false);

        this.animate();
    }

    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.onWindowResize());
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        window.addEventListener('contextmenu', (e) => e.preventDefault());
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
        if (this.inputManager.getMode() === ControlMode.UNIT_CONTROL) {
            if (event.button === 0) { // Left click
                this.isSelecting = true;
                this.selectionStart.set(event.clientX, event.clientY);
                this.unitManager.startSelection(event.clientX, event.clientY);
                console.log('Started selection'); // Debug log
            }
        }
    }

    private onMouseMove(event: MouseEvent): void {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update cursor position display
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.gameUI.updateCursorPosition(point.x, point.y, point.z);
        }

        if (this.isSelecting) {
            this.selectionBox.update(
                this.selectionStart.x,
                this.selectionStart.y,
                event.clientX,
                event.clientY
            );
            this.unitManager.updateSelection(event.clientX, event.clientY);
        }

        this.gameUI.setMode(this.controlMode);
    }

    private onMouseUp(event: MouseEvent): void {
        if (this.inputManager.getMode() === ControlMode.UNIT_CONTROL) {
            if (event.button === 0) { // Left click
                this.isSelecting = false;
                this.unitManager.endSelection(this.camera);
                this.updateSelectedUnitsInfo();
                console.log('Ended selection'); // Debug log
            } else if (event.button === 2) { // Right click
                console.log('Right click - issuing command'); // Debug log
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObjects(this.scene.children, true);
                
                if (intersects.length > 0) {
                    const target = intersects[0].point;
                    console.log('Move target:', target); // Debug log
                    
                    if (this.currentAction === 'attack') {
                        const targetUnit = this.unitManager.getUnitAtPosition(target);
                        if (targetUnit) {
                            this.unitManager.attackTarget(targetUnit);
                            console.log('Attacking unit'); // Debug log
                        }
                    } else {
                        this.unitManager.moveSelectedUnits(target);
                        console.log('Moving units'); // Debug log
                    }
                }
            }
        }
    }

    private updateSelectedUnitsInfo(): void {
        const selectedUnits = this.unitManager.getSelectedUnits();
        const unitTypes = new Map<string, number>();
        
        selectedUnits.forEach(unit => {
            const type = unit.getType();
            unitTypes.set(type, (unitTypes.get(type) || 0) + 1);
        });

        this.gameUI.updateSelectedUnits(selectedUnits.length, unitTypes);
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // Update day/night cycle
        this.dayNightCycle.update(delta);
        if (this.dayNightCycle.getTime() !== this.debugUI.getCurrentTime()) {
            this.debugUI.updateTime(this.dayNightCycle.getTime());
        }
        
        // Update world
        this.worldManager.update();
        
        // Update particles
        this.resourceParticles.forEach(particles => particles.update());
        
        // Update controls
        this.controls.update();
        
        // Update unit manager
        this.unitManager.update(delta);
        
        // Update projectile manager
        this.projectileManager.update(delta);
        
        // Render with effects
        this.effectsManager.render();
    }

    // Public methods for InputManager
    public updateControlMode(mode: ControlMode): void {
        console.log("Switching to mode:", mode);
        this.controlMode = mode;
        if (mode === ControlMode.CAMERA) {
            this.unitManager.clearSelection();
        }
        this.gameUI.setMode(ControlMode[mode]);
        this.gameUI.updateModeIndicator();
    }

    // Implement GameInterface methods
    public getSelectedUnitIds(): number[] {
        return this.unitManager.getSelectedUnits().map(unit => unit.getId());
    }

    public selectUnitsById(ids: number[]): void {
        this.unitManager.selectUnitsById(ids);
        this.updateSelectedUnitsInfo();
    }

    public setCurrentAction(action: string): void {
        this.currentAction = action;
        this.gameUI.updateAction(action);
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

    private setControlMode(mode: ControlMode): void {
        this.controlMode = mode;
        if (mode === ControlMode.CAMERA) {
            this.unitManager.clearSelection();
        }
        // Convert ControlMode to string
        this.gameUI.setMode(ControlMode[mode]);
    }

    private onUnitSelected(unit: Unit): void {
        // Use getId() method
        console.log(`