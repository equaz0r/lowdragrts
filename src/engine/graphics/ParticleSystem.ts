import * as THREE from 'three';

export class ParticleSystem {
    private particles: THREE.Points;
    private geometry: THREE.BufferGeometry;
    private material: THREE.PointsMaterial;
    private positions: Float32Array;
    private velocities: Float32Array;
    private particleCount: number;

    constructor(scene: THREE.Scene, color: THREE.Color, count: number = 1000) {
        this.particleCount = count;
        this.positions = new Float32Array(count * 3);
        this.velocities = new Float32Array(count * 3);

        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.PointsMaterial({
            color: color,
            size: 0.1,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        scene.add(this.particles);

        this.initParticles();
    }

    private initParticles(): void {
        for (let i = 0; i < this.particleCount * 3; i += 3) {
            this.positions[i] = 0;
            this.positions[i + 1] = 0;
            this.positions[i + 2] = 0;

            this.velocities[i] = (Math.random() - 0.5) * 0.1;
            this.velocities[i + 1] = Math.random() * 0.1;
            this.velocities[i + 2] = (Math.random() - 0.5) * 0.1;
        }

        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    }

    public update(): void {
        const positions = this.geometry.attributes.position.array as Float32Array;

        for (let i = 0; i < this.particleCount * 3; i += 3) {
            positions[i] += this.velocities[i];
            positions[i + 1] += this.velocities[i + 1];
            positions[i + 2] += this.velocities[i + 2];

            // Reset particles that go too far
            if (positions[i + 1] > 2) {
                positions[i] = 0;
                positions[i + 1] = 0;
                positions[i + 2] = 0;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
    }

    public setPosition(x: number, y: number, z: number): void {
        this.particles.position.set(x, y, z);
    }

    public dispose(): void {
        this.geometry.dispose();
        this.material.dispose();
    }
} 