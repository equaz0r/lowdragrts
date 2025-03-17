import * as THREE from 'three';
import { Projectile, ProjectileConfig } from './Projectile';
import { Unit, UnitType } from '../units/Unit';
import { GameSettings } from '../../ui/SettingsManager';

export { ProjectileConfig };

export class ProjectileManager {
    private projectiles: Projectile[] = [];
    private scene: THREE.Scene;
    private static readonly maxProjectiles = 100;
    private static readonly projectilePool: Projectile[] = [];
    private pool: Projectile[] = [];

    // Static resources for disposal checks
    private static readonly staticGeometries = new Set<THREE.BufferGeometry>();
    private static readonly staticMaterials = new Set<THREE.Material>();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.projectiles = [];
    }

    public createProjectile(source: Unit, target: Unit, config: Partial<ProjectileConfig>): boolean {
        // Check if we've hit the maximum number of projectiles
        if (this.projectiles.length >= ProjectileManager.maxProjectiles) {
            console.warn('Maximum number of projectiles reached');
            return false;
        }

        // Validate source and target
        if (!source || !target || source === target) {
            console.warn('Invalid source or target for projectile');
            return false;
        }

        // Get or create projectile
        let projectile: Projectile;
        if (ProjectileManager.projectilePool.length > 0) {
            const pooledProjectile = ProjectileManager.projectilePool.pop();
            if (!pooledProjectile) return false;
            projectile = pooledProjectile;
            projectile.reset(source, target, config);
        } else {
            projectile = new Projectile(source, target, config);
        }

        this.scene.add(projectile);
        this.projectiles.push(projectile);
        return true;
    }

    public isValid(): boolean {
        return this.projectiles.length > 0;
    }

    public update(delta: number): void {
        // Update projectiles and remove dead ones
        this.projectiles = this.projectiles.filter(projectile => {
            projectile.update(delta);
            const isValid = projectile.isValid();
            if (!isValid) {
                this.scene.remove(projectile);
                if (ProjectileManager.projectilePool.length < ProjectileManager.maxProjectiles) {
                    ProjectileManager.projectilePool.push(projectile);
                } else {
                    projectile.dispose();
                }
            }
            return isValid;
        });
    }

    public getActiveProjectileCount(): number {
        return this.projectiles.length;
    }

    public isUnitTargeted(unit: Unit): boolean {
        return this.projectiles.some(projectile => 
            projectile.getTarget() === unit && projectile.isValid()
        );
    }

    public getProjectilesTargetingUnit(unit: Unit): Projectile[] {
        return this.projectiles.filter(projectile => 
            projectile.getTarget() === unit && projectile.isValid()
        );
    }

    public getProjectilesBySource(source: Unit): Projectile[] {
        return this.projectiles.filter(projectile => 
            projectile.getSource() === source && projectile.isValid()
        );
    }

    public getProjectilesByType(type: UnitType): Projectile[] {
        return this.projectiles.filter(projectile => 
            projectile.getSource().getType() === type && projectile.isValid()
        );
    }

    public getProjectilesByRange(minRange: number, maxRange: number): Projectile[] {
        return this.projectiles.filter(projectile => {
            if (!projectile.isValid()) return false;
            const range = projectile.getRange();
            return range >= minRange && range <= maxRange;
        });
    }

    public getProjectilesByDamage(minDamage: number, maxDamage: number): Projectile[] {
        return this.projectiles.filter(projectile => {
            if (!projectile.isValid()) return false;
            const damage = projectile.getDamage();
            return damage >= minDamage && damage <= maxDamage;
        });
    }

    public getProjectilesBySpeed(minSpeed: number, maxSpeed: number): Projectile[] {
        return this.projectiles.filter(projectile => {
            if (!projectile.isValid()) return false;
            const speed = projectile.getSpeed();
            return speed >= minSpeed && speed <= maxSpeed;
        });
    }

    public getProjectilesByTrailLength(minLength: number, maxLength: number): Projectile[] {
        return this.projectiles.filter(projectile => {
            if (!projectile.isValid()) return false;
            const length = projectile.getTrailLength();
            return length >= minLength && length <= maxLength;
        });
    }

    public getProjectilesByColor(color: number): Projectile[] {
        return this.projectiles.filter(projectile => 
            projectile.getColor() === color && projectile.isValid()
        );
    }

    public getProjectilesBySize(minSize: number, maxSize: number): Projectile[] {
        return this.projectiles.filter(projectile => {
            if (!projectile.isValid()) return false;
            const size = projectile.getSize();
            return size >= minSize && size <= maxSize;
        });
    }

    public clearProjectiles(): void {
        this.projectiles.forEach(projectile => {
            this.scene.remove(projectile.getMesh());
            if (ProjectileManager.projectilePool.length < ProjectileManager.maxProjectiles) {
                ProjectileManager.projectilePool.push(projectile);
            } else {
                projectile.dispose();
            }
        });
        this.projectiles = [];
    }

    public dispose(): void {
        this.clearProjectiles();
        // Clean up the pool
        ProjectileManager.projectilePool.forEach(projectile => projectile.dispose());
        ProjectileManager.projectilePool.length = 0;
    }

    public updateProjectileSettings(settings: GameSettings): void {
        this.projectiles.forEach(projectile => {
            projectile.updateSettings(settings);
        });
    }
} 