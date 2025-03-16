import * as THREE from 'three';
import { Unit } from '../units/Unit';

export interface ProjectileConfig {
    speed: number;
    damage: number;
    size?: number;
    color?: number;
    trailLength?: number;
}

export class Projectile {
    private mesh: THREE.Group;
    private velocity: THREE.Vector3;
    private target: Unit;
    private source: Unit;
    private config: ProjectileConfig;
    private trail: THREE.Points;
    private trailPositions: Float32Array;
    private alive: boolean = true;

    constructor(source: Unit, target: Unit, config: ProjectileConfig) {
        this.source = source;
        this.target = target;
        this.config = {
            size: 0.3,
            color: 0xff0000,
            trailLength: 10,
            ...config
        };

        this.mesh = this.createProjectileMesh();
        this.velocity = new THREE.Vector3();
        this.updateVelocity();
    }

    private createProjectileMesh(): THREE.Group {
        const group = new THREE.Group();

        // Create projectile core
        const geometry = new THREE.SphereGeometry(this.config.size);
        const material = new THREE.MeshPhongMaterial({
            color: this.config.color,
            emissive: this.config.color,
            emissiveIntensity: 0.5
        });
        const core = new THREE.Mesh(geometry, material);
        group.add(core);

        // Create trail
        this.trailPositions = new Float32Array(this.config.trailLength! * 3);
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', 
            new THREE.Float32BufferAttribute(this.trailPositions, 3));

        const trailMaterial = new THREE.PointsMaterial({
            color: this.config.color,
            size: this.config.size! * 0.8,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });

        this.trail = new THREE.Points(trailGeometry, trailMaterial);
        group.add(this.trail);

        return group;
    }

    private updateVelocity(): void {
        const direction = this.target.getPosition()
            .clone()
            .sub(this.mesh.position)
            .normalize();
        
        this.velocity.copy(direction).multiplyScalar(this.config.speed);
    }

    public update(delta: number): boolean {
        if (!this.alive) return false;

        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));

        // Update trail
        for (let i = this.trailPositions.length - 3; i >= 3; i -= 3) {
            this.trailPositions[i] = this.trailPositions[i - 3];
            this.trailPositions[i + 1] = this.trailPositions[i - 2];
            this.trailPositions[i + 2] = this.trailPositions[i - 1];
        }
        this.trailPositions[0] = this.mesh.position.x;
        this.trailPositions[1] = this.mesh.position.y;
        this.trailPositions[2] = this.mesh.position.z;
        
        this.trail.geometry.attributes.position.needsUpdate = true;

        // Check collision with target
        const distance = this.mesh.position.distanceTo(this.target.getPosition());
        if (distance < 1) {
            this.hit();
            return false;
        }

        // Check if projectile has traveled too far
        if (this.mesh.position.distanceTo(this.source.getPosition()) > 100) {
            this.alive = false;
            return false;
        }

        return true;
    }

    private hit(): void {
        this.alive = false;
        this.target.takeDamage(this.config.damage);
        this.createHitEffect();
    }

    private createHitEffect(): void {
        // Create particle explosion effect
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities: THREE.Vector3[] = [];

        for (let i = 0; i < particleCount * 3; i += 3) {
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            velocities.push(velocity);

            positions[i] = this.mesh.position.x;
            positions[i + 1] = this.mesh.position.y;
            positions[i + 2] = this.mesh.position.z;
        }

        geometry.setAttribute('position', 
            new THREE.Float32BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: this.config.color,
            size: this.config.size! * 0.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(geometry, material);
        this.mesh.parent?.add(particles);

        // Animate particles
        const animate = () => {
            const positions = particles.geometry.attributes.position.array as Float32Array;
            
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += velocities[i/3].x * 0.1;
                positions[i + 1] += velocities[i/3].y * 0.1;
                positions[i + 2] += velocities[i/3].z * 0.1;
            }

            particles.geometry.attributes.position.needsUpdate = true;
            material.opacity *= 0.95;

            if (material.opacity > 0.01) {
                requestAnimationFrame(animate);
            } else {
                particles.parent?.remove(particles);
                particles.geometry.dispose();
                particles.material.dispose();
            }
        };

        animate();
    }

    public getMesh(): THREE.Group {
        return this.mesh;
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
} 