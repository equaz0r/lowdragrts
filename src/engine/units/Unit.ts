import * as THREE from 'three';
import { WorldManager } from '../voxel/WorldManager';
import { CommandVisuals } from './CommandVisuals';
import { Projectile, ProjectileConfig } from '../combat/Projectile';
import { ProjectileManager } from '../combat/ProjectileManager';
import { CommandVisualizer, CommandType } from './CommandVisualizer';

export enum UnitType {
    BASIC_ROBOT = 'BASIC_ROBOT',
    HARVESTER = 'HARVESTER',
    BUILDER = 'BUILDER',
    // More unit types will be added later
}

export interface UnitStats {
    maxHealth: number;
    moveSpeed: number;
    turnSpeed: number;
    size: THREE.Vector3;  // Size in voxels
    supply: number;       // Supply cost
    attackRange: number;
    attackDamage: number;
    attackSpeed: number; // attacks per second
    projectileSpeed: number;
}

export class Unit extends THREE.Object3D {
    public readonly unitId: number;
    public readonly unitType: UnitType;
    private mesh: THREE.Group;
    private selected: boolean;
    private scene: THREE.Scene;

    // Make all THREE.Object3D properties public to match parent class
    public declare position: THREE.Vector3;
    public declare rotation: THREE.Euler;
    public declare scale: THREE.Vector3;
    public declare matrix: THREE.Matrix4;
    public declare matrixWorld: THREE.Matrix4;

    protected velocity: THREE.Vector3;
    protected targetPosition: THREE.Vector3 | null;
    protected health: number;
    protected stats: UnitStats;
    protected worldManager: WorldManager;
    protected target: Unit | null = null;
    protected lastAttackTime: number = 0;
    protected commandVisuals: CommandVisuals;
    protected projectileManager?: ProjectileManager;
    private commandVisualizer: CommandVisualizer;

    constructor(id: number, type: UnitType, scene: THREE.Scene) {
        super();
        this.unitId = id;
        this.unitType = type;
        this.scene = scene;
        this.selected = false;
        this.mesh = this.createMesh();
        this.add(this.mesh);
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.velocity = new THREE.Vector3();
        this.targetPosition = null;
        this.worldManager = new WorldManager();
        this.stats = this.getDefaultStats();
        this.health = this.stats.maxHealth;
        this.projectileManager = new ProjectileManager();
        this.commandVisuals = new CommandVisuals();
        this.commandVisualizer = new CommandVisualizer();
    }

    protected getDefaultStats(): UnitStats {
        switch (this.unitType) {
            case UnitType.BASIC_ROBOT:
                return {
                    maxHealth: 100,
                    moveSpeed: 5,
                    turnSpeed: 3,
                    size: new THREE.Vector3(3, 6, 3),
                    supply: 1,
                    attackRange: 10,
                    attackDamage: 10,
                    attackSpeed: 1,
                    projectileSpeed: 20
                };
            case UnitType.HARVESTER:
                return {
                    maxHealth: 150,
                    moveSpeed: 4,
                    turnSpeed: 2,
                    size: new THREE.Vector3(4, 4, 6),
                    supply: 2,
                    attackRange: 10,
                    attackDamage: 10,
                    attackSpeed: 1,
                    projectileSpeed: 5
                };
            case UnitType.BUILDER:
                return {
                    maxHealth: 120,
                    moveSpeed: 4,
                    turnSpeed: 2.5,
                    size: new THREE.Vector3(4, 6, 4),
                    supply: 2,
                    attackRange: 10,
                    attackDamage: 10,
                    attackSpeed: 1,
                    projectileSpeed: 5
                };
            default:
                return {
                    maxHealth: 100,
                    moveSpeed: 5,
                    turnSpeed: 3,
                    size: new THREE.Vector3(3, 6, 3),
                    supply: 1,
                    attackRange: 10,
                    attackDamage: 10,
                    attackSpeed: 1,
                    projectileSpeed: 5
                };
        }
    }

    protected createMesh(): THREE.Group {
        const group = new THREE.Group();
        
        // Create base for all units
        const baseGeometry = new THREE.BoxGeometry(2, 0.5, 2);
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.25;
        group.add(base);

        // Add unit-specific mesh
        switch (this.unitType) {
            case UnitType.BASIC_ROBOT:
                this.addRobotMesh(group);
                break;
            case UnitType.HARVESTER:
                this.addHarvesterMesh(group);
                break;
            case UnitType.BUILDER:
                this.addBuilderMesh(group);
                break;
        }

        return group;
    }

    private addRobotMesh(group: THREE.Group): void {
        const material = new THREE.MeshPhongMaterial({ color: 0x3366cc });
        
        // Body
        const bodyGeometry = new THREE.BoxGeometry(1, 1.5, 1);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 1.25;
        group.add(body);

        // Head
        const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.y = 2.3;
        group.add(head);
    }

    private addHarvesterMesh(group: THREE.Group): void {
        const material = new THREE.MeshPhongMaterial({ color: 0xcc6633 });
        
        // Main body
        const bodyGeometry = new THREE.BoxGeometry(3, 1.5, 2);
        const body = new THREE.Mesh(bodyGeometry, material);
        body.position.y = 1.25;
        group.add(body);

        // Cab
        const cabGeometry = new THREE.BoxGeometry(1.5, 1.2, 1.8);
        const cab = new THREE.Mesh(cabGeometry, material);
        cab.position.set(-0.75, 2, 0);
        group.add(cab);
    }

    private addBuilderMesh(group: THREE.Group): void {
        const material = new THREE.MeshPhongMaterial({ color: 0x33cc33 });
        
        // Pyramid body
        const pyramidGeometry = new THREE.ConeGeometry(1, 2, 4);
        const pyramid = new THREE.Mesh(pyramidGeometry, material);
        pyramid.position.y = 1.5;
        pyramid.rotation.y = Math.PI / 4;
        group.add(pyramid);
    }

    protected createSelectionRing(): THREE.Mesh {
        const geometry = new THREE.RingGeometry(
            this.stats.size.x + 1,
            this.stats.size.x + 1.5,
            32
        );
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        return ring;
    }

    protected createHealthBar(): THREE.Group {
        const group = new THREE.Group();
        
        // Create outer frame
        const frameGeometry = new THREE.BoxGeometry(2, 2, 2);
        const frameMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
        const frameWire = new THREE.LineSegments(
            new THREE.EdgesGeometry(frameGeometry),
            frameMaterial
        );
        group.add(frameWire);

        // Create fill cube
        const fillGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        const fillMaterial = new THREE.MeshPhongMaterial({
            transparent: true,
            opacity: 0.8
        });
        const fillCube = new THREE.Mesh(fillGeometry, fillMaterial);
        fillCube.scale.y = 0; // Start empty
        fillCube.position.y = -0.9; // Position at bottom
        group.add(fillCube);

        return group;
    }

    public update(delta: number): void {
        if (this.targetPosition) {
            this.moveToTarget(delta);
        }
        this.updateCombat(delta);
        this.updateHealthBar();
    }

    protected moveToTarget(delta: number): void {
        if (!this.targetPosition) return;

        const direction = this.targetPosition.clone().sub(this.position);
        const distance = direction.length();

        console.log('Moving unit:', {
            currentPosition: this.position.clone(),
            targetPosition: this.targetPosition.clone(),
            distance: distance
        });

        if (distance < 0.1) {
            this.targetPosition = null;
            this.velocity.set(0, 0, 0);
            return;
        }

        direction.normalize();
        
        // Calculate next position
        const nextX = this.position.x + direction.x * this.stats.moveSpeed * delta;
        const nextZ = this.position.z + direction.z * this.stats.moveSpeed * delta;
        
        // Get ground height at new position
        const groundHeight = this.worldManager.getHeightAt(nextX, nextZ);
        
        console.log('Ground height check:', {
            nextX, 
            nextZ, 
            groundHeight
        });

        if (groundHeight !== undefined) {
            // Move unit
            this.position.x = nextX;
            this.position.z = nextZ;
            // Keep unit on ground, offset by half its height
            this.position.y = groundHeight + (this.stats.size.y / 2);
            
            console.log('Updated position:', this.position.clone());
        }

        this.updateMeshPosition();
    }

    protected updateMeshPosition(): void {
        this.mesh.position.copy(this.position);
        this.mesh.rotation.copy(this.rotation);
    }

    protected updateHealthBar(): void {
        const healthBar = this.mesh.children[2] as THREE.Group;
        const fillCube = healthBar.children[1] as THREE.Mesh;
        const healthPercent = this.health / this.stats.maxHealth;

        // Update fill height
        fillCube.scale.y = healthPercent;
        fillCube.position.y = -0.9 + (healthPercent * 0.9);

        // Update color
        const material = fillCube.material as THREE.MeshPhongMaterial;
        if (healthPercent > 0.5) {
            // Green to Orange
            material.color.setHSL(0.3 * healthPercent, 1, 0.5);
        } else {
            // Orange to Red
            material.color.setHSL(0.1 * healthPercent, 1, 0.5);
        }
    }

    public setTarget(target: THREE.Vector3): void {
        this.targetPosition = target;
        this.commandVisualizer.showCommand(
            this.unitId,
            CommandType.MOVE,
            this.position,
            target,
            this.stats.moveSpeed
        );
    }

    public setSelected(selected: boolean): void {
        this.selected = selected;
        // Update visual feedback for selection
        if (this.mesh) {
            const material = this.mesh.children[0].material as THREE.MeshPhongMaterial;
            material.emissive.setHex(selected ? 0x333333 : 0x000000);
        }
    }

    public getMesh(): THREE.Group {
        return this.mesh;
    }

    public getPosition(): THREE.Vector3 {
        return this.position;
    }

    public isSelected(): boolean {
        return this.selected;
    }

    public dispose(): void {
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (child.material instanceof THREE.Material) {
                    child.material.dispose();
                }
            }
        });
    }

    public attack(target: Unit): void {
        this.target = target;
        // Show attack command visualization
        if (this.commandVisualizer) {
            this.commandVisualizer.showCommand(
                this.unitId,
                CommandType.ATTACK,
                this.position,
                target.getPosition()
            );
        }
    }

    protected updateCombat(delta: number): void {
        if (this.target) {
            const distance = this.position.distanceTo(this.target.getPosition());
            
            if (distance <= this.stats.attackRange) {
                const currentTime = performance.now();
                if (currentTime - this.lastAttackTime >= 1000 / this.stats.attackSpeed) {
                    this.fireProjectile();
                    this.lastAttackTime = currentTime;
                }
            } else {
                // Move towards target if out of range
                this.setTarget(this.target.getPosition());
            }
        }
    }

    protected fireProjectile(): void {
        if (!this.projectileManager) return;

        const projectileConfig: ProjectileConfig = {
            speed: this.stats.projectileSpeed,
            damage: this.stats.attackDamage,
            color: 0xff0000, // Can be customized per unit type
            size: 0.3,
            trailLength: 10
        };

        this.projectileManager.createProjectile(this, this.target, projectileConfig);
    }

    public takeDamage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
        if (this.health === 0) {
            this.die();
        }
    }

    protected die(): void {
        // Handle unit death
        // Create explosion effect
        // Remove from game
        this.dispose();
    }

    public getType(): string {
        return this.unitType;
    }

    public stop(): void {
        this.targetPosition = null;
        this.target = null;
        this.velocity.set(0, 0, 0);
    }

    public hold(): void {
        this.stop();
        // Additional hold position logic can be added here
    }

    public cancelAction(): void {
        this.stop();
        // Additional cleanup can be added here
    }

    public getBoundingBox(): THREE.Box3 {
        const box = new THREE.Box3();
        box.setFromObject(this.mesh);
        return box;
    }

    public getSize(): THREE.Vector3 {
        const box = this.getBoundingBox();
        return box.getSize(new THREE.Vector3());
    }

    public getId(): number {
        return this.unitId;
    }
} 