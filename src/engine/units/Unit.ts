import * as THREE from 'three';
import { WorldManager } from '../voxel/WorldManager';
import { CommandVisuals } from './CommandVisuals';
import { Projectile } from '../projectiles/Projectile';
import { ProjectileManager, ProjectileConfig } from '../combat/ProjectileManager';
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
    attackSpeed: number;
    projectileSpeed: number;
}

export class Unit {
    protected mesh: THREE.Group;
    protected position: THREE.Vector3;
    protected rotation: THREE.Euler;
    protected velocity: THREE.Vector3;
    protected targetPosition: THREE.Vector3 | null;
    protected selected: boolean;
    protected health: number;
    protected stats: UnitStats;
    protected type: UnitType;
    protected worldManager: WorldManager;
    protected target: Unit | null = null;
    protected lastAttackTime: number = 0;
    protected commandVisuals: CommandVisuals;
    protected projectileManager?: ProjectileManager;
    private static nextId: number = 0;
    private id: number;
    private commandVisualizer: CommandVisualizer;

    constructor(type: UnitType, position: THREE.Vector3, worldManager: WorldManager, commandVisualizer: CommandVisualizer) {
        this.id = Unit.nextId++;
        this.commandVisualizer = commandVisualizer;
        this.type = type;
        this.position = position.clone();
        this.rotation = new THREE.Euler();
        this.velocity = new THREE.Vector3();
        this.targetPosition = null;
        this.selected = false;
        this.worldManager = worldManager;
        this.stats = this.getDefaultStats();
        this.health = this.stats.maxHealth;

        this.mesh = this.createMesh();
        this.updateMeshPosition();
        this.commandVisuals = new CommandVisuals();
    }

    protected getDefaultStats(): UnitStats {
        switch (this.type) {
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
                    projectileSpeed: 5
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

        // Create basic unit mesh
        const geometry = new THREE.BoxGeometry(
            this.stats.size.x,
            this.stats.size.y,
            this.stats.size.z
        );
        const material = new THREE.MeshPhongMaterial({ color: 0x3366cc });
        const mainBody = new THREE.Mesh(geometry, material);
        mainBody.castShadow = true;
        mainBody.receiveShadow = true;
        group.add(mainBody);

        // Add selection indicator (hidden by default)
        const selectionRing = this.createSelectionRing();
        selectionRing.visible = false;
        group.add(selectionRing);

        // Add health bar
        const healthBar = this.createHealthBar();
        healthBar.position.y = this.stats.size.y + 1;
        group.add(healthBar);

        return group;
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
        this.updateMeshPosition();
        this.updateHealthBar();
        this.updateCombat(Date.now());
    }

    protected moveToTarget(delta: number): void {
        if (!this.targetPosition) return;

        const direction = this.targetPosition.clone().sub(this.position);
        const distance = direction.length();

        if (distance < 0.1) {
            this.targetPosition = null;
            this.velocity.set(0, 0, 0);
            return;
        }

        direction.normalize();
        
        // Check ground height at new position
        const nextPosition = this.position.clone().add(direction.multiplyScalar(this.stats.moveSpeed * delta));
        const groundHeight = this.worldManager.getHeightAt(nextPosition.x, nextPosition.z);
        
        if (groundHeight !== undefined) {
            nextPosition.y = groundHeight + (this.stats.size.y / 2); // Keep unit on ground
            this.position.copy(nextPosition);
        }

        // Update rotation
        const targetRotation = Math.atan2(direction.x, direction.z);
        const currentRotation = this.rotation.y;
        
        const rotationDiff = Math.atan2(
            Math.sin(targetRotation - currentRotation),
            Math.cos(targetRotation - currentRotation)
        );
        
        this.rotation.y += rotationDiff * this.stats.turnSpeed * delta;
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
            this.id,
            CommandType.MOVE,
            this.position,
            target,
            this.stats.moveSpeed
        );
    }

    public setSelected(selected: boolean): void {
        this.selected = selected;
        const selectionRing = this.mesh.children[1];
        selectionRing.visible = selected;
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
        this.commandVisualizer.showCommand(
            this.id,
            CommandType.ATTACK,
            this.position,
            target.getPosition()
        );
    }

    protected updateCombat(time: number): void {
        if (this.target) {
            const distance = this.position.distanceTo(this.target.getPosition());
            
            if (distance <= this.stats.attackRange) {
                if (time - this.lastAttackTime >= 1000 / this.stats.attackSpeed) {
                    this.fireProjectile(this.target);
                    this.lastAttackTime = time;
                }
            } else {
                // Move towards target
                this.setTarget(this.target.getPosition());
            }
        }
    }

    protected fireProjectile(target: Unit): void {
        if (!this.projectileManager) return;

        const projectileConfig: ProjectileConfig = {
            speed: this.stats.projectileSpeed,
            damage: this.stats.attackDamage,
            color: 0xff0000, // Can be customized per unit type
            size: 0.3,
            trailLength: 10
        };

        this.projectileManager.createProjectile(this, target, projectileConfig);
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
} 