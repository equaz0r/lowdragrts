import * as THREE from 'three';
import { WorldManager } from '../world/WorldManager';
import { ProjectileConfig } from '../combat/Projectile';
import { ProjectileManager } from '../combat/ProjectileManager';
import { CommandVisualizer } from './CommandVisualizer';
import { CHUNK_SIZE } from '../voxel/Chunk';
import { MaterialManager } from '../graphics/MaterialManager';

export enum UnitType {
    WORKER = 'worker',
    SOLDIER = 'soldier',
    TANK = 'tank',
    BASIC_ROBOT = 'basic_robot',
    HARVESTER = 'harvester',
    BUILDER = 'builder'
}

interface UnitStats {
    maxHealth: number;
    moveSpeed: number;
    turnSpeed: number;
    size: THREE.Vector3;
    supply: number;
    attackRange: number;
    attackDamage: number;
    attackSpeed: number;
    projectileSpeed: number;
}

const UNIT_STATS: Record<UnitType, UnitStats> = {
    [UnitType.WORKER]: {
        maxHealth: 100,
        moveSpeed: 5,
        turnSpeed: 3,
        size: new THREE.Vector3(1, 1, 1),
        supply: 1,
        attackRange: 0,
        attackDamage: 0,
        attackSpeed: 0,
        projectileSpeed: 0
    },
    [UnitType.SOLDIER]: {
        maxHealth: 150,
        moveSpeed: 4,
        turnSpeed: 2,
        size: new THREE.Vector3(1, 1, 1),
        supply: 2,
        attackRange: 10,
        attackDamage: 20,
        attackSpeed: 1,
        projectileSpeed: 15
    },
    [UnitType.TANK]: {
        maxHealth: 300,
        moveSpeed: 3,
        turnSpeed: 1,
        size: new THREE.Vector3(1.5, 1, 1.5),
        supply: 4,
        attackRange: 15,
        attackDamage: 40,
        attackSpeed: 0.5,
        projectileSpeed: 20
    },
    [UnitType.BASIC_ROBOT]: {
        maxHealth: 120,
        moveSpeed: 4,
        turnSpeed: 2,
        size: new THREE.Vector3(1, 1, 1),
        supply: 1,
        attackRange: 8,
        attackDamage: 15,
        attackSpeed: 1,
        projectileSpeed: 12
    },
    [UnitType.HARVESTER]: {
        maxHealth: 80,
        moveSpeed: 3,
        turnSpeed: 2,
        size: new THREE.Vector3(1, 1, 1),
        supply: 1,
        attackRange: 0,
        attackDamage: 0,
        attackSpeed: 0,
        projectileSpeed: 0
    },
    [UnitType.BUILDER]: {
        maxHealth: 100,
        moveSpeed: 3,
        turnSpeed: 2,
        size: new THREE.Vector3(1, 1, 1),
        supply: 1,
        attackRange: 0,
        attackDamage: 0,
        attackSpeed: 0,
        projectileSpeed: 0
    }
};

export class Unit extends THREE.Object3D {
    private worldManager: WorldManager | null = null;
    private mesh: THREE.Mesh | null = null;
    private velocity: THREE.Vector3 = new THREE.Vector3();
    private isHovered: boolean = false;
    private stats: UnitStats;
    private targetPosition: THREE.Vector3 | null = null;
    private unitType: UnitType;
    private health: number;
    private isSelected: boolean = false;
    private currentAction: string | null = null;
    private unitId: number;

    constructor(type: UnitType, position: THREE.Vector3) {
        super();
        this.position.copy(position);
        this.unitType = type;
        this.stats = UNIT_STATS[type];
        this.health = this.stats.maxHealth;
        this.unitId = Math.floor(Math.random() * 1000000); // Simple ID generation
        this.initializeMesh(type);
    }

    public setWorldManager(worldManager: WorldManager): void {
        this.worldManager = worldManager;
    }

    private initializeMesh(type: UnitType): void {
        const geometry = new THREE.BoxGeometry(
            this.stats.size.x,
            this.stats.size.y,
            this.stats.size.z
        );
        const material = MaterialManager.getShader('unit');
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.add(this.mesh);
    }

    public update(delta: number): void {
        this.updatePosition();
        this.checkCollision();
        if (this.targetPosition) {
            this.moveToTarget(delta);
        }
    }

    private moveToTarget(delta: number): void {
        if (!this.targetPosition) return;

        const direction = this.targetPosition.clone().sub(this.position);
        const distance = direction.length();

        if (distance < 0.1) {
            this.targetPosition = null;
            this.velocity.set(0, 0, 0);
            return;
        }

        direction.normalize();
        this.velocity.copy(direction.multiplyScalar(this.stats.moveSpeed));
    }

    private updatePosition(): void {
        if (!this.worldManager || !this.mesh) return;

        const newX = this.position.x + this.velocity.x;
        const newZ = this.position.z + this.velocity.z;

        // Check if we're moving to a new chunk
        const currentChunkX = Math.floor(this.position.x / CHUNK_SIZE);
        const currentChunkZ = Math.floor(this.position.z / CHUNK_SIZE);
        const newChunkX = Math.floor(newX / CHUNK_SIZE);
        const newChunkZ = Math.floor(newZ / CHUNK_SIZE);

        if (currentChunkX !== newChunkX || currentChunkZ !== newChunkZ) {
            // Ensure the new chunk exists
            this.worldManager.getChunk(newChunkX, newChunkZ);
        }

        this.position.x = newX;
        this.position.z = newZ;
        this.mesh.position.copy(this.position);
    }

    private checkCollision(): void {
        if (!this.worldManager || !this.mesh) return;

        const currentChunkX = Math.floor(this.position.x / CHUNK_SIZE);
        const currentChunkZ = Math.floor(this.position.z / CHUNK_SIZE);
        const chunk = this.worldManager.getChunk(currentChunkX, currentChunkZ);

        if (!chunk) return;

        // Check collision with terrain
        const localX = Math.floor(this.position.x % CHUNK_SIZE);
        const localZ = Math.floor(this.position.z % CHUNK_SIZE);
        const height = chunk.getHighestPoint(localX, localZ);

        if (this.position.y <= height) {
            this.position.y = height;
            this.velocity.y = 0;
            this.mesh.position.copy(this.position);
        }
    }

    public dispose(): void {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            }
            this.remove(this.mesh);
            this.mesh = null;
        }
    }

    public getMesh(): THREE.Mesh | null {
        return this.mesh;
    }

    public setVelocity(velocity: THREE.Vector3): void {
        this.velocity.copy(velocity);
    }

    public setHovered(hovered: boolean): void {
        this.isHovered = hovered;
    }

    public isHoveredOver(): boolean {
        return this.isHovered;
    }

    public setTargetPosition(position: THREE.Vector3): void {
        this.targetPosition = position;
    }

    public getId(): number {
        return this.unitId;
    }

    public getType(): UnitType {
        return this.unitType;
    }

    public getHealth(): number {
        return this.health;
    }

    public getMaxHealth(): number {
        return this.stats.maxHealth;
    }

    public takeDamage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
    }

    public setSelected(selected: boolean): void {
        this.isSelected = selected;
        if (this.mesh) {
            this.mesh.material = new THREE.MeshPhongMaterial({
                color: selected ? 0x00ffff : 0x00ff00
            });
        }
    }

    public isSelectedUnit(): boolean {
        return this.isSelected;
    }

    public moveTo(position: THREE.Vector3): void {
        this.targetPosition = position;
    }

    public stop(): void {
        this.targetPosition = null;
        this.velocity.set(0, 0, 0);
    }

    public hold(): void {
        this.stop();
        this.currentAction = 'hold';
    }

    public cancelAction(): void {
        this.currentAction = null;
    }

    public attack(target: Unit): void {
        this.currentAction = 'attack';
        // Attack logic will be implemented in UnitManager
    }

    public getPosition(): THREE.Vector3 {
        return this.position;
    }
} 