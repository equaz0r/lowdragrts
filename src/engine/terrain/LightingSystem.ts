import * as THREE from 'three';

export class LightingSystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private sunLight: THREE.DirectionalLight = new THREE.DirectionalLight(0x6666ff, 0.3);
    private ambientLight: THREE.AmbientLight = new THREE.AmbientLight(0x000000, 0.1);
    private lightSphere: THREE.Mesh | null = null;
    private haloMesh: THREE.Mesh | null = null;
    private time: number = 0;
    private readonly dayLength: number = 3600;
    private readonly maxIntensity: number = 0.3;
    private readonly minIntensity: number = 0.1;
    private readonly dawnColor: THREE.Color = new THREE.Color(0x6666ff);
    private readonly dayColor: THREE.Color = new THREE.Color(0x6666ff);
    private readonly duskColor: THREE.Color = new THREE.Color(0xff66ff);
    private readonly nightColor: THREE.Color = new THREE.Color(0x4a0080);
    private readonly sunRadius: number = 1200; // Large sun size
    private readonly haloSize: number = 4800; // Large halo size
    private readonly orbitRadius: number = 8000; // Large orbit radius

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
        this.initialize();
    }

    private initialize(): void {
        // Add ambient light with reduced intensity
        this.scene.add(this.ambientLight);

        // Setup directional light (sun)
        this.sunLight.position.set(this.orbitRadius, this.sunRadius, 0);
        this.scene.add(this.sunLight);

        // Create sun sphere
        const sphereGeometry = new THREE.SphereGeometry(this.sunRadius, 32, 32);
        const sphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xff66ff) },
                time: { value: 0 },
                glowColor: { value: new THREE.Color(0xff99ff) }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;
                varying vec3 vWorldPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    vViewDir = normalize(cameraPosition - worldPosition.xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform vec3 glowColor;
                uniform float time;
                
                varying vec3 vNormal;
                varying vec3 vViewDir;
                varying vec3 vWorldPosition;

                void main() {
                    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);
                    vec3 baseColor = mix(color, glowColor, fresnel * 0.7);
                    float pulse = sin(time * 2.0) * 0.1 + 0.9;
                    
                    // Add radial gradient
                    vec2 center = vec2(0.5, 0.5);
                    vec2 uv = gl_FragCoord.xy / vec2(1000.0);
                    float dist = length(uv - center);
                    float radialGradient = 1.0 - smoothstep(0.0, 0.5, dist);
                    
                    // Combine effects
                    vec3 finalColor = mix(baseColor, glowColor, radialGradient * 0.5) * pulse;
                    finalColor += glowColor * fresnel * 0.5;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
        });

        this.lightSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.lightSphere.position.copy(this.sunLight.position);
        this.scene.add(this.lightSphere);

        // Create halo effect
        const haloGeometry = new THREE.PlaneGeometry(this.haloSize, this.haloSize);
        const haloMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xff99ff) },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                varying vec2 vUv;
                
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = length(vUv - center);
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    alpha *= 0.7; // Reduce overall opacity
                    
                    // Add pulsing effect
                    float pulse = sin(time * 1.5) * 0.1 + 0.9;
                    alpha *= pulse;
                    
                    // Add color variation
                    vec3 finalColor = mix(color, color * 1.5, 1.0 - dist);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        this.haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
        this.haloMesh.position.copy(this.sunLight.position);
        this.scene.add(this.haloMesh);
    }

    public update(deltaTime: number): void {
        this.time += deltaTime * 0.01;
        if (this.time >= this.dayLength) {
            this.time = 0;
        }

        // Calculate sun position in a circular arc
        const angle = this.time * 0.0001;
        const x = Math.sin(angle) * this.orbitRadius;
        const y = Math.max(0, Math.abs(Math.cos(angle)) * this.orbitRadius * 0.08);
        const z = Math.cos(angle) * this.orbitRadius;

        // Update positions
        const newPosition = new THREE.Vector3(x, y + this.sunRadius, z);
        
        // Update sun light position
        this.sunLight.position.copy(newPosition);
        this.sunLight.lookAt(0, 0, 0);

        // Update light sphere and halo position
        if (this.lightSphere) {
            this.lightSphere.position.copy(newPosition);
            this.lightSphere.lookAt(this.camera.position);
            
            if (this.lightSphere.material instanceof THREE.ShaderMaterial) {
                this.lightSphere.material.uniforms.time.value = this.time;
            }
        }

        if (this.haloMesh) {
            this.haloMesh.position.copy(newPosition);
            this.haloMesh.lookAt(this.camera.position);
            
            if (this.haloMesh.material instanceof THREE.ShaderMaterial) {
                this.haloMesh.material.uniforms.time.value = this.time;
            }
        }

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
        const ambientIntensity = Math.max(0.1, Math.sin(this.time * 0.0001) * 0.3 + 0.5);
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

        if (this.haloMesh) {
            this.scene.remove(this.haloMesh);
            this.haloMesh.geometry.dispose();
            if (this.haloMesh.material instanceof THREE.Material) {
                this.haloMesh.material.dispose();
            }
            this.haloMesh = null;
        }

        this.scene.remove(this.sunLight);
        this.scene.remove(this.ambientLight);
        this.sunLight.dispose();
        this.ambientLight.dispose();
    }
} 