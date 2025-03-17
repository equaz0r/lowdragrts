import * as THREE from 'three';
import { Unit } from '../units/Unit';
import { GameSettings } from '../../ui/SettingsManager';

export interface ProjectileConfig {
    size: number;
    color: number;
    trailLength: number;
    hitEffectSize: number;
    glowIntensity: number;
    particleCount: number;
    speed: number;
    damage: number;
}

export class Projectile extends THREE.Object3D {
    private static readonly muzzleFlashGeometry = new THREE.PlaneGeometry(1, 1);
    private static readonly hitParticleGeometry = new THREE.BufferGeometry();
    private static readonly hitParticleMaterial = new THREE.PointsMaterial({
        color: 0xFF4500,
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    private static hitParticlePool: THREE.Points[] = [];

    private source: Unit;
    private target: Unit;
    private config: ProjectileConfig;
    private velocity: THREE.Vector3;
    private trailGeometry: THREE.BufferGeometry;
    private trailMaterial: THREE.ShaderMaterial;
    private muzzleFlashMaterial: THREE.MeshBasicMaterial;
    private muzzleFlash: THREE.Mesh;
    private isDead: boolean = false;

    constructor(source: Unit, target: Unit, config: Partial<ProjectileConfig>) {
        super();
        this.source = source;
        this.target = target;
        this.config = {
            size: 0.5,
            color: 0xFF4500,
            trailLength: 20,
            hitEffectSize: 2,
            glowIntensity: 1,
            particleCount: 50,
            speed: 30,
            damage: 10,
            ...config
        };
        this.velocity = new THREE.Vector3();
        this.trailGeometry = new THREE.BufferGeometry();
        this.trailMaterial = this.createTrailMaterial();
        this.muzzleFlashMaterial = this.createMuzzleFlashMaterial();
        this.muzzleFlash = new THREE.Mesh(Projectile.muzzleFlashGeometry, this.muzzleFlashMaterial);
        this.muzzleFlash.visible = false;
        this.add(this.muzzleFlash);
        this.createProjectileMesh();
        this.createTrail();
        
        // Set initial position to source unit's position
        this.position.copy(source.position);
        
        // Calculate initial velocity
        this.updateVelocity();
    }

    private createProjectileMesh(): THREE.Group {
        const group = new THREE.Group();

        // Create glowing projectile
        const projectileGeometry = new THREE.SphereGeometry(this.config.size, 8, 8);
        const projectileMaterial = new THREE.MeshPhongMaterial({
            color: this.config.color,
            emissive: this.config.color,
            emissiveIntensity: this.config.glowIntensity,
            shininess: 100
        });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        group.add(projectile);

        // Create trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = this.createTrailMaterial();
        const trail = new THREE.LineSegments(trailGeometry, trailMaterial);
        group.add(trail);

        // Create muzzle flash
        const flashGeometry = new THREE.SphereGeometry(this.config.size * 2, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: this.config.color,
            transparent: true,
            opacity: 1
        });
        const muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
        muzzleFlash.visible = false;
        group.add(muzzleFlash);

        return group;
    }

    private createTrailMaterial(): THREE.ShaderMaterial {
        return new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(this.config.color) },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                varying vec2 vUv;
                void main() {
                    float alpha = 1.0 - vUv.y;
                    alpha *= 0.7;
                    vec3 glowColor = color * (1.0 + sin(time * 2.0) * 0.2);
                    gl_FragColor = vec4(glowColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
    }

    private createMuzzleFlashMaterial(): THREE.MeshBasicMaterial {
        return new THREE.MeshBasicMaterial({
            color: this.config.color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
    }

    private createTrail(): void {
        const positions = new Float32Array(this.config.trailLength * 3);
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
        this.add(trail);
    }

    private updateVelocity(): void {
        const direction = new THREE.Vector3()
            .subVectors(this.target.position, this.source.position)
            .normalize();
        
        // Add a small upward angle to make projectiles more visible
        direction.y += 0.1;
        direction.normalize();
        
        this.velocity.copy(direction).multiplyScalar(this.config.speed);
    }

    public update(delta: number): void {
        if (!this.isDead) {
            // Update position
            this.position.add(this.velocity.clone().multiplyScalar(delta));

            // Update trail
            this.updateTrail();

            // Update muzzle flash
            if (this.muzzleFlash && this.muzzleFlash.visible) {
                const flashMaterial = this.muzzleFlash.material as THREE.MeshBasicMaterial;
                flashMaterial.opacity -= delta * 5;
                if (flashMaterial.opacity <= 0) {
                    this.muzzleFlash.visible = false;
                }
            }

            // Check for hit
            if (this.target) {
                const distance = this.position.distanceTo(this.target.position);
                if (distance < this.config.size * 4) {
                    this.hit();
                }
            }
        }
    }

    private updateTrail(): void {
        if (!this.trailGeometry) return;

        const positions = this.trailGeometry.attributes.position.array as Float32Array;
        const trailLength = this.config.trailLength;

        // Shift positions back
        for (let i = positions.length - 3; i >= 3; i -= 3) {
            positions[i] = positions[i - 3];
            positions[i + 1] = positions[i - 2];
            positions[i + 2] = positions[i - 1];
        }

        // Add current position
        positions[0] = this.position.x;
        positions[1] = this.position.y;
        positions[2] = this.position.z;

        this.trailGeometry.attributes.position.needsUpdate = true;
    }

    private hit(): void {
        if (!this.target) return;

        // Apply damage
        this.target.takeDamage(this.config.damage);

        // Create hit effect
        const hitEffect = new THREE.Points(
            new THREE.BufferGeometry(),
            new THREE.PointsMaterial({
                color: this.config.color,
                size: 0.2,
                transparent: true,
                opacity: 1
            })
        );

        const particles = new Float32Array(this.config.particleCount * 3);
        for (let i = 0; i < particles.length; i += 3) {
            particles[i] = (Math.random() - 0.5) * this.config.hitEffectSize;
            particles[i + 1] = (Math.random() - 0.5) * this.config.hitEffectSize;
            particles[i + 2] = (Math.random() - 0.5) * this.config.hitEffectSize;
        }

        hitEffect.geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
        hitEffect.position.copy(this.position);
        if (this.parent) {
            this.parent.add(hitEffect);
        }

        // Animate hit effect
        let opacity = 1;
        const animate = () => {
            opacity -= 0.05;
            if (opacity <= 0) {
                if (this.parent) {
                    this.parent.remove(hitEffect);
                }
                hitEffect.geometry?.dispose();
                hitEffect.material?.dispose();
            } else {
                const material = hitEffect.material as THREE.PointsMaterial;
                if (material) {
                    material.opacity = opacity;
                }
                requestAnimationFrame(animate);
            }
        };
        animate();

        // Deactivate projectile
        this.isDead = true;
        if (this.parent) {
            this.parent.remove(this);
        }
        this.dispose();
    }

    public updateSettings(settings: GameSettings): void {
        this.config.size = settings.projectileSize;
        this.config.trailLength = settings.trailLength;
        this.config.hitEffectSize = settings.hitEffectSize;
        this.config.glowIntensity = settings.glowIntensity;
        this.config.particleCount = settings.particleCount;
        this.config.color = new THREE.Color(settings.projectileColor).getHex();
        this.config.speed = settings.projectileSpeed;
        this.config.damage = settings.projectileDamage;

        // Update materials
        const core = this.children[1] as THREE.Mesh;
        const material = core.material as THREE.MeshPhongMaterial;
        material.color.set(settings.projectileColor);
        material.emissive.set(settings.projectileColor);

        this.trailMaterial.uniforms.color.value.set(settings.trailColor);
        this.muzzleFlashMaterial.color.set(settings.projectileColor);
        Projectile.hitParticleMaterial.color.set(settings.hitEffectColor);

        // Update trail geometry
        const positions = new Float32Array(settings.trailLength * 3);
        this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }

    public reset(source: Unit, target: Unit, config: Partial<ProjectileConfig>): void {
        this.source = source;
        this.target = target;
        this.config = {
            size: 0.5,
            color: 0xFF4500,
            trailLength: 20,
            hitEffectSize: 2,
            glowIntensity: 1,
            particleCount: 50,
            speed: 30,
            damage: 10,
            ...config
        };
        this.position.copy(source.position);
        this.isDead = false;
        this.updateVelocity();
        this.muzzleFlash.visible = true;
        this.muzzleFlashMaterial.opacity = 1;
        Projectile.hitParticleMaterial.opacity = 0.8;
    }

    public isValid(): boolean {
        return !this.isDead && this.source !== null && this.target !== null;
    }

    public getMesh(): THREE.Object3D {
        return this;
    }

    public getSource(): Unit {
        return this.source;
    }

    public getTarget(): Unit {
        return this.target;
    }

    public getRange(): number {
        return this.position.distanceTo(this.target.position);
    }

    public getDamage(): number {
        return this.config.damage;
    }

    public getSpeed(): number {
        return this.config.speed;
    }

    public getTrailLength(): number {
        return this.config.trailLength;
    }

    public getColor(): number {
        return this.config.color;
    }

    public getSize(): number {
        return this.config.size;
    }

    public dispose(): void {
        this.trailGeometry.dispose();
        this.trailMaterial.dispose();
        this.muzzleFlashMaterial.dispose();
        this.children.forEach(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }
} 