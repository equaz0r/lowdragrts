import * as THREE from 'three';
import { Projectile, ProjectileConfig } from './Projectile';
import { Unit } from '../units/Unit';

export class ProjectileManager {
    private projectiles: Projectile[] = [];
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public createProjectile(source: Unit, target: Unit, config: ProjectileConfig): void {
        const projectile = new Projectile(source, target, config);
        this.projectiles.push(projectile);
        this.scene.add(projectile.getMesh());
    }

    public update(delta: number): void {
        // Update projectiles and remove dead ones
        this.projectiles = this.projectiles.filter(projectile => {
            const alive = projectile.update(delta);
            if (!alive) {
                this.scene.remove(projectile.getMesh());
                projectile.dispose();
            }
            return alive;
        });
    }

    public dispose(): void {
        this.projectiles.forEach(projectile => {
            this.scene.remove(projectile.getMesh());
            projectile.dispose();
        });
        this.projectiles = [];
    }
} 