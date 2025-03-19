import * as THREE from 'three';

export class LightingSystem {
    private scene: THREE.Scene;
    private sunLight: THREE.DirectionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    private ambientLight: THREE.AmbientLight = new THREE.AmbientLight(0x404040, 0.5);
    private lightSphere: THREE.Mesh | null = null;
    private time: number = 0;
    private readonly dayLength: number = 3600; // Increased to 1 hour per day cycle
    private readonly maxIntensity: number = 1.0;
    private readonly minIntensity: number = 0.2;
    private readonly dawnColor: THREE.Color = new THREE.Color(0xff6600); // Orange
    private readonly dayColor: THREE.Color = new THREE.Color(0xffffff); // White
    private readonly duskColor: THREE.Color = new THREE.Color(0xff3300); // Red-orange
    private readonly nightColor: THREE.Color = new THREE.Color(0x4a0080); // Purple

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.initialize();
    }

    private initialize(): void {
        // Add ambient light
        this.scene.add(this.ambientLight);

        // Setup directional light (sun)
        this.sunLight.position.set(0, 1000, 0);
        this.scene.add(this.sunLight);

        // Create light sphere
        const sphereGeometry = new THREE.SphereGeometry(50, 32, 32);
        const sphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x4a0080) },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vViewDir = normalize(cameraPosition - worldPosition.xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                varying vec3 vNormal;
                varying vec3 vViewDir;

                void main() {
                    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);
                    vec3 glowColor = mix(color, vec3(1.0), fresnel * 0.5);
                    float pulse = sin(time * 2.0) * 0.1 + 0.9;
                    gl_FragColor = vec4(glowColor * pulse, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        this.lightSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.lightSphere);
    }

    public update(deltaTime: number): void {
        this.time += deltaTime;
        if (this.time >= this.dayLength) {
            this.time = 0;
        }

        // Calculate sun position in a circular arc
        const radius = 1000; // Increased radius for better visibility
        const x = Math.sin(this.time) * radius;
        const y = Math.cos(this.time) * radius * 0.5; // Flatten the arc
        const z = Math.cos(this.time) * radius;

        // Update sun light position
        this.sunLight.position.set(x, y, z);
        this.sunLight.lookAt(0, 0, 0);

        // Update light sphere position
        if (this.lightSphere) {
            this.lightSphere.position.set(x, y, z);
            
            // Update light sphere color based on time
            const baseColor = new THREE.Color(0x4a0080); // Deep purple
            const glowColor = new THREE.Color(0x0000ff); // Deep blue
            const t = (Math.sin(this.time) + 1) / 2; // Normalize to 0-1
            const color = baseColor.clone().lerp(glowColor, t);
            
            if (this.lightSphere.material instanceof THREE.ShaderMaterial) {
                this.lightSphere.material.uniforms.color.value = color;
            }
        }

        // Update ambient light intensity based on time
        const ambientIntensity = Math.max(0.2, Math.sin(this.time) * 0.3 + 0.5);
        this.ambientLight.intensity = ambientIntensity;

        // Update light intensity and color based on time
        const normalizedTime = this.time / this.dayLength;
        let intensity = 1.0;
        let lightColor = this.dayColor;
        
        if (normalizedTime < 0.25) {
            // Dawn
            const dawnProgress = normalizedTime * 4;
            intensity = this.minIntensity + dawnProgress * (this.maxIntensity - this.minIntensity);
            lightColor = this.dawnColor.clone().lerp(this.dayColor, dawnProgress);
        } else if (normalizedTime > 0.75) {
            // Dusk
            const duskProgress = (normalizedTime - 0.75) * 4;
            intensity = this.maxIntensity - duskProgress * (this.maxIntensity - this.minIntensity);
            lightColor = this.dayColor.clone().lerp(this.duskColor, duskProgress);
        } else if (normalizedTime > 0.5) {
            // Afternoon
            intensity = this.maxIntensity;
            lightColor = this.dayColor;
        } else {
            // Morning
            intensity = this.maxIntensity;
            lightColor = this.dayColor;
        }

        // Night phase
        if (normalizedTime > 0.5) {
            const nightProgress = (normalizedTime - 0.5) * 2;
            lightColor = this.duskColor.clone().lerp(this.nightColor, nightProgress);
            intensity *= (1 - nightProgress);
        }

        this.sunLight.intensity = intensity;
        this.sunLight.color = lightColor;
        
        // Update ambient light based on time
        this.ambientLight.intensity = ambientIntensity;
        this.ambientLight.color = lightColor.clone().multiplyScalar(0.5);
    }

    public setTime(time: number): void {
        this.time = time % this.dayLength;
    }

    public getTime(): number {
        return this.time;
    }

    public getDayLength(): number {
        return this.dayLength;
    }

    public dispose(): void {
        if (this.lightSphere) {
            this.scene.remove(this.lightSphere);
            this.lightSphere.geometry.dispose();
            if (this.lightSphere.material instanceof THREE.Material) {
                this.lightSphere.material.dispose();
            } else {
                this.lightSphere.material.forEach(material => material.dispose());
            }
            this.lightSphere = null;
        }
        this.scene.remove(this.sunLight);
        this.scene.remove(this.ambientLight);
        this.sunLight.dispose();
        this.ambientLight.dispose();
    }
} 