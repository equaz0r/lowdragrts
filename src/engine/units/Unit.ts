import * as THREE from 'three';
import { WorldManager } from '../voxel/WorldManager';
import { ProjectileConfig } from '../combat/Projectile';
import { ProjectileManager } from '../combat/ProjectileManager';
import { CommandVisualizer } from './CommandVisualizer';

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
    private healthBar: THREE.Group | null = null;
    private static readonly baseMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
    private static readonly robotMaterial = new THREE.MeshPhongMaterial({ color: 0x3366cc });
    private static readonly harvesterMaterial = new THREE.MeshPhongMaterial({ color: 0xcc6633 });
    private static readonly builderMaterial = new THREE.MeshPhongMaterial({ color: 0x33cc33 });
    private static readonly selectionRingMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide
    });
    private static readonly hoverRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    private static readonly healthBarFrameMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    private static readonly healthBarFillMaterial = new THREE.MeshPhongMaterial({
        transparent: true,
        opacity: 0.8
    });
    private static readonly explosionMaterial = new THREE.MeshPhongMaterial({
        color: 0xff6600,
        emissive: 0xff3300,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 1
    });

    // Static geometries for reuse
    private static readonly baseGeometry = new THREE.BoxGeometry(2, 0.5, 2);
    private static readonly robotBodyGeometry = new THREE.BoxGeometry(1, 1.5, 1);
    private static readonly robotHeadGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
    private static readonly harvesterBodyGeometry = new THREE.BoxGeometry(3, 1.5, 2);
    private static readonly harvesterCabGeometry = new THREE.BoxGeometry(1.5, 1.2, 1.8);
    private static readonly builderPyramidGeometry = new THREE.ConeGeometry(1, 2, 4);
    private static readonly explosionGeometry = new THREE.SphereGeometry(1, 8, 8);
    private static readonly healthBarFrameGeometry = new THREE.BoxGeometry(2, 2, 2);
    private static readonly healthBarFillGeometry = new THREE.BoxGeometry(1.8, 1.8, 1.8);

    // Cache for selection ring geometries
    private static readonly selectionRingGeometries = new Map<number, THREE.RingGeometry>();
    private static readonly hoverRingGeometries = new Map<number, THREE.RingGeometry>();

    // Static resources for disposal checks
    private static readonly staticGeometries = new Set([
        Unit.baseGeometry,
        Unit.robotBodyGeometry,
        Unit.robotHeadGeometry,
        Unit.harvesterBodyGeometry,
        Unit.harvesterCabGeometry,
        Unit.builderPyramidGeometry,
        Unit.explosionGeometry,
        Unit.healthBarFrameGeometry,
        Unit.healthBarFillGeometry
    ]);

    private static readonly staticMaterials = new Set<THREE.MeshPhongMaterial | THREE.MeshBasicMaterial | THREE.LineBasicMaterial>([
        Unit.baseMaterial,
        Unit.robotMaterial,
        Unit.harvesterMaterial,
        Unit.builderMaterial,
        Unit.selectionRingMaterial,
        Unit.healthBarFrameMaterial,
        Unit.healthBarFillMaterial,
        Unit.explosionMaterial
    ]);

    // Reusable vectors for calculations
    private static readonly tempDirection = new THREE.Vector3();
    private static readonly tempPosition = new THREE.Vector3();
    private static readonly tempScale = new THREE.Vector3();
    private static readonly tempColor = new THREE.Color();

    // Static projectile config
    private static readonly defaultProjectileConfig: ProjectileConfig = {
        size: 0.5,
        color: 0xff0000,
        trailLength: 15,
        hitEffectSize: 1.5,
        glowIntensity: 0.8,
        particleCount: 50,
        speed: 30,
        damage: 10
    };

    private static readonly defaultStats: Record<UnitType, UnitStats> = {
        [UnitType.BASIC_ROBOT]: {
            maxHealth: 100,
            moveSpeed: 5,
            turnSpeed: 3,
            size: new THREE.Vector3(3, 6, 3),
            supply: 1,
            attackRange: 10,
            attackDamage: 10,
            attackSpeed: 1,
            projectileSpeed: 20
        },
        [UnitType.HARVESTER]: {
            maxHealth: 150,
            moveSpeed: 4,
            turnSpeed: 2,
            size: new THREE.Vector3(4, 4, 6),
            supply: 2,
            attackRange: 10,
            attackDamage: 10,
            attackSpeed: 1,
            projectileSpeed: 5
        },
        [UnitType.BUILDER]: {
            maxHealth: 120,
            moveSpeed: 4,
            turnSpeed: 2.5,
            size: new THREE.Vector3(4, 6, 4),
            supply: 2,
            attackRange: 10,
            attackDamage: 10,
            attackSpeed: 1,
            projectileSpeed: 5
        }
    };

    // Make all THREE.Object3D properties public to match parent class
    public declare position: THREE.Vector3;
    public declare rotation: THREE.Euler;
    public declare scale: THREE.Vector3;
    public declare matrix: THREE.Matrix4;
    public declare matrixWorld: THREE.Matrix4;

    protected velocity: THREE.Vector3;
    protected targetPosition: THREE.Vector3 | null;
    private health: number;
    protected stats: UnitStats;
    protected worldManager: WorldManager;
    protected target: Unit | null = null;
    private lastAttackTime: number;
    protected projectileManager: ProjectileManager;
    private commandVisualizer: CommandVisualizer;
    private attackRangeSquared: number;
    private lastGroundHeight: number | null = null;

    private healthBarFillCube: THREE.Mesh | null = null;
    private unitMaterials: Set<THREE.MeshPhongMaterial> = new Set();

    private hoverRing: THREE.Mesh | null = null;
    private isHovered: boolean = false;

    constructor(
        id: number, 
        type: UnitType, 
        scene: THREE.Scene,
        worldManager: WorldManager,
        projectileManager: ProjectileManager,
        commandVisualizer: CommandVisualizer
    ) {
        super();
        this.unitId = id;
        this.unitType = type;
        this.scene = scene;
        this.selected = false;
        this.mesh = this.createMesh();
        this.add(this.mesh);
        this.position.set(0, 0, 0);
        this.rotation.set(0, 0, 0);
        this.velocity = new THREE.Vector3();
        this.targetPosition = null;
        this.worldManager = worldManager;
        this.stats = this.getDefaultStats();
        this.health = this.stats.maxHealth;
        this.projectileManager = projectileManager;
        this.commandVisualizer = commandVisualizer;
        this.lastAttackTime = 0;
        this.attackRangeSquared = this.stats.attackRange * this.stats.attackRange;

        // Add selection ring, hover ring, and health bar
        const selectionRing = this.createSelectionRing();
        this.mesh.add(selectionRing);
        this.hoverRing = this.createHoverRing();
        this.mesh.add(this.hoverRing);
        const healthBar = this.createHealthBar();
        this.mesh.add(healthBar);
    }

    protected getDefaultStats(): UnitStats {
        return Unit.defaultStats[this.unitType] || Unit.defaultStats[UnitType.BASIC_ROBOT];
    }

    protected createMesh(): THREE.Group {
        const group = new THREE.Group();
        
        // Create base for all units
        const base = new THREE.Mesh(Unit.baseGeometry, Unit.baseMaterial);
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
        // Body
        const body = new THREE.Mesh(Unit.robotBodyGeometry, Unit.robotMaterial);
        body.position.y = 1.25;
        group.add(body);

        // Head
        const head = new THREE.Mesh(Unit.robotHeadGeometry, Unit.robotMaterial);
        head.position.y = 2.3;
        group.add(head);
    }

    private addHarvesterMesh(group: THREE.Group): void {
        // Main body
        const body = new THREE.Mesh(Unit.harvesterBodyGeometry, Unit.harvesterMaterial);
        body.position.y = 1.25;
        group.add(body);

        // Cab
        const cab = new THREE.Mesh(Unit.harvesterCabGeometry, Unit.harvesterMaterial);
        cab.position.set(-0.75, 2, 0);
        group.add(cab);
    }

    private addBuilderMesh(group: THREE.Group): void {
        // Pyramid body
        const body = new THREE.Mesh(Unit.builderPyramidGeometry, Unit.builderMaterial);
        body.position.y = 1;
        group.add(body);
    }

    protected createSelectionRing(): THREE.Mesh {
        const size = Math.max(this.stats.size.x, this.stats.size.z);
        let geometry = Unit.selectionRingGeometries.get(size);
        if (!geometry) {
            geometry = new THREE.RingGeometry(size * 0.5, size * 0.6, 32);
            Unit.selectionRingGeometries.set(size, geometry);
        }

        const ring = new THREE.Mesh(geometry, Unit.selectionRingMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        return ring;
    }

    protected createHoverRing(): THREE.Mesh {
        const size = Math.max(this.stats.size.x, this.stats.size.z);
        let geometry = Unit.hoverRingGeometries.get(size);
        if (!geometry) {
            geometry = new THREE.RingGeometry(size * 0.5, size * 0.6, 32);
            Unit.hoverRingGeometries.set(size, geometry);
        }

        const ring = new THREE.Mesh(geometry, Unit.hoverRingMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.visible = false;
        return ring;
    }

    protected createHealthBar(): THREE.Group {
        const group = new THREE.Group();
        group.position.y = this.stats.size.y + 0.5;

        // Frame
        const frame = new THREE.LineSegments(
            new THREE.EdgesGeometry(Unit.healthBarFrameGeometry),
            Unit.healthBarFrameMaterial
        );
        group.add(frame);

        // Fill
        this.healthBarFillCube = new THREE.Mesh(
            Unit.healthBarFillGeometry,
            (Unit.healthBarFillMaterial as THREE.MeshPhongMaterial).clone()
        );
        this.healthBarFillCube.material = (this.healthBarFillCube.material as THREE.MeshPhongMaterial).clone();
        (this.healthBarFillCube.material as THREE.MeshPhongMaterial).color.setHex(0x00ff00);
        group.add(this.healthBarFillCube);

        return group;
    }

    public update(delta: number): void {
        if (this.targetPosition) {
            this.moveToTarget(delta);
        }
        if (this.target) {
            this.updateCombat(delta);
        }
        this.updateHealthBar();
    }

    protected moveToTarget(delta: number): void {
        if (!this.targetPosition) return;

        // Calculate direction to target
        Unit.tempDirection.copy(this.targetPosition).sub(this.position);
        const distance = Unit.tempDirection.length();

        // Check if we've reached the target
        if (distance < 0.1) {
            this.targetPosition = null;
            this.velocity.set(0, 0, 0);
            return;
        }

        // Normalize direction and apply speed
        Unit.tempDirection.normalize();
        this.velocity.copy(Unit.tempDirection).multiplyScalar(this.stats.moveSpeed);

        // Update position
        Unit.tempPosition.copy(this.velocity).multiplyScalar(delta);
        this.position.add(Unit.tempPosition);

        // Update rotation to face movement direction
        this.rotation.y = Math.atan2(Unit.tempDirection.x, Unit.tempDirection.z);
    }

    protected updateHealthBar(): void {
        if (!this.healthBarFillCube) return;

        const healthPercent = this.health / this.stats.maxHealth;
        const material = this.healthBarFillCube.material as THREE.MeshPhongMaterial;

        // Update color based on health percentage
        if (healthPercent > 0.6) {
            material.color.setHex(0x00ff00);
        } else if (healthPercent > 0.3) {
            material.color.setHex(0xffff00);
        } else {
            material.color.setHex(0xff0000);
        }

        // Update scale
        Unit.tempScale.set(healthPercent, 1, 1);
        this.healthBarFillCube.scale.copy(Unit.tempScale);
    }

    public moveTo(target: THREE.Vector3): void {
        this.targetPosition = target;
        this.target = null;
        this.commandVisualizer.showMoveCommand(this, target);
    }

    public setSelected(selected: boolean): void {
        this.selected = selected;
        const selectionRing = this.mesh.children.find(child => 
            child instanceof THREE.Mesh && 
            child.material === Unit.selectionRingMaterial
        ) as THREE.Mesh;
        if (selectionRing) {
            selectionRing.visible = selected;
        }
    }

    public getMesh(): THREE.Group {
        return this.mesh;
    }

    public isSelected(): boolean {
        return this.selected;
    }

    public dispose(): void {
        // Remove from scene
        this.parent?.remove(this);

        // Clean up materials
        this.unitMaterials.forEach(material => {
            if (!Unit.staticMaterials.has(material)) {
                material.dispose();
            }
        });
        this.unitMaterials.clear();

        // Clean up geometries
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
                if (!Unit.staticGeometries.has(child.geometry)) {
                    child.geometry.dispose();
                }
            }
        });

        // Clean up health bar
        if (this.healthBarFillCube) {
            const material = this.healthBarFillCube.material as THREE.MeshPhongMaterial;
            if (!Unit.staticMaterials.has(material)) {
                material.dispose();
            }
        }

        // Clean up hover ring
        if (this.hoverRing) {
            this.hoverRing.geometry.dispose();
            if (Array.isArray(this.hoverRing.material)) {
                this.hoverRing.material.forEach(material => material.dispose());
            } else {
                this.hoverRing.material.dispose();
            }
            this.hoverRing = null;
        }
    }

    public attack(target: Unit): void {
        this.target = target;
        this.targetPosition = null;
        this.commandVisualizer.showAttackCommand(this.unitId, this.position, target.position);
    }

    protected updateCombat(delta: number): void {
        if (!this.target || this.target.getHealth() <= 0) {
            this.target = null;
            return;
        }

        // Calculate distance to target
        Unit.tempDirection.copy(this.target.position).sub(this.position);
        const distanceSquared = Unit.tempDirection.lengthSq();

        // Check if target is in range and has line of sight
        if (distanceSquared <= this.attackRangeSquared && this.hasLineOfSight(this.target)) {
            // Face the target
            this.rotation.y = Math.atan2(Unit.tempDirection.x, Unit.tempDirection.z);

            // Check if we can attack
            const currentTime = performance.now();
            if (currentTime - this.lastAttackTime >= 1000 / this.stats.attackSpeed) {
                this.fireProjectile(this.target);
                this.lastAttackTime = currentTime;
            }
        }
    }

    private hasLineOfSight(target: Unit): boolean {
        // Create a ray from the unit to the target
        const ray = new THREE.Ray();
        ray.origin.copy(this.position);
        ray.direction.copy(target.position).sub(this.position).normalize();

        // Get the height of both units
        const sourceHeight = this.position.y + this.stats.size.y / 2;
        const targetHeight = target.position.y + target.getSize().y / 2;

        // Adjust ray origin to be at the unit's "eyes" (upper part of the unit)
        ray.origin.y = sourceHeight;

        // Check for obstacles between the units
        const raycaster = new THREE.Raycaster(ray.origin, ray.direction, 0.1, this.position.distanceTo(target.position));
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        // If there are no intersections, we have line of sight
        if (intersects.length === 0) {
            return true;
        }

        // Check if the first intersection is the target
        const firstIntersect = intersects[0];
        if (firstIntersect.object === target || firstIntersect.object.parent === target) {
            return true;
        }

        // If the first intersection is below the target's height, we might still have line of sight
        if (firstIntersect.point.y < targetHeight) {
            return true;
        }

        return false;
    }

    protected fireProjectile(target: Unit): void {
        const config: ProjectileConfig = {
            ...Unit.defaultProjectileConfig,
            speed: this.stats.projectileSpeed,
            damage: this.stats.attackDamage,
            color: this.selected ? 0x00ff00 : 0xff0000 // Green for selected units, red for others
        };
        this.projectileManager.createProjectile(this, target, config);
    }

    public takeDamage(amount: number): void {
        this.health = Math.max(0, this.health - amount);
        if (this.health <= 0) {
            this.die();
        }
    }

    protected die(): void {
        // Create explosion effect
        const explosion = new THREE.Mesh(Unit.explosionGeometry, Unit.explosionMaterial);
        explosion.position.copy(this.position);
        this.scene.add(explosion);

        // Create scrap pile
        const scrapPile = this.createScrapPile();
        scrapPile.position.copy(this.position);
        this.scene.add(scrapPile);

        // Animate explosion
        let scale = 1;
        let opacity = 1;
        const animate = () => {
            scale += 0.1;
            opacity -= 0.05;
            if (opacity <= 0) {
                this.scene.remove(explosion);
                explosion.geometry.dispose();
                explosion.material.dispose();
            } else {
                explosion.scale.set(scale, scale, scale);
                (explosion.material as THREE.MeshPhongMaterial).opacity = opacity;
                requestAnimationFrame(animate);
            }
        };
        animate();

        // Remove from scene
        this.dispose();
    }

    private createScrapPile(): THREE.Group {
        const group = new THREE.Group();
        const scrapCount = Math.floor(Math.random() * 5) + 3; // 3-7 pieces of scrap

        for (let i = 0; i < scrapCount; i++) {
            const size = Math.random() * 0.5 + 0.5; // 0.5-1.0 units
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshPhongMaterial({
                color: 0x333333,
                shininess: 30,
                specular: 0x444444
            });
            const scrap = new THREE.Mesh(geometry, material);
            
            // Random position within a small radius
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.5;
            scrap.position.set(
                Math.cos(angle) * radius,
                size / 2,
                Math.sin(angle) * radius
            );
            
            // Random rotation
            scrap.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            group.add(scrap);
        }

        return group;
    }

    public collectScrap(): void {
        // Implementation for collecting scrap
        // This will be called when a unit moves over a scrap pile
    }

    public getType(): UnitType {
        return this.unitType;
    }

    public stop(): void {
        this.targetPosition = null;
        this.target = null;
        this.velocity.set(0, 0, 0);
        this.commandVisualizer.showMoveCommand(this, this.position);
    }

    public getBoundingBox(): THREE.Box3 {
        return new THREE.Box3().setFromCenterAndSize(this.position, this.stats.size);
    }

    public getSize(): THREE.Vector3 {
        return this.stats.size;
    }

    public getId(): number {
        return this.unitId;
    }

    public getHealth(): number {
        return this.health;
    }

    public getMaxHealth(): number {
        return this.stats.maxHealth;
    }

    public getVelocity(): THREE.Vector3 {
        return this.velocity.clone();
    }

    public getTarget(): Unit | null {
        return this.target;
    }

    public isInRange(other: Unit): boolean {
        Unit.tempDirection.copy(other.position).sub(this.position);
        return Unit.tempDirection.lengthSq() <= this.attackRangeSquared;
    }

    public getPosition(): THREE.Vector3 {
        return this.position;
    }

    public hold(): void {
        // Implementation for hold action
    }

    public cancelAction(): void {
        // Implementation for canceling current action
    }

    public setTarget(target: Unit | null): void {
        this.target = target;
    }

    public setHovered(hovered: boolean): void {
        this.isHovered = hovered;
        if (this.hoverRing) {
            this.hoverRing.visible = hovered;
        }
    }

    public isHoveredOver(): boolean {
        return this.isHovered;
    }
} 