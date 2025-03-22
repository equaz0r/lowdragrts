import * as THREE from 'three';

export class LightingSystem {
    private static instance: LightingSystem | null = null;
    private scene!: THREE.Scene;
    private mainCamera!: THREE.PerspectiveCamera;
    private sunLight!: THREE.DirectionalLight;
    private ambientLight!: THREE.AmbientLight;
    private lightSphere!: THREE.Mesh;
    private haloGroup!: THREE.Group;
    private frontHalo!: THREE.Mesh;
    private backHalo!: THREE.Mesh;
    private skyMesh!: THREE.Mesh;
    private manualMode: boolean = true;
    private currentSunHeight: number = 0.5;
    private targetSunHeight: number = 0.5;
    private lastUpdateTime: number = 0;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        if (LightingSystem.instance) {
            console.warn('[LightingSystem] Instance already exists, returning existing instance');
            return LightingSystem.instance;
        }

        console.log('[LightingSystem] Creating new instance');
        this.scene = scene;
        this.mainCamera = camera;

        // Create a simple gradient skybox with dynamic colors
        const skyGeometry = new THREE.BoxGeometry(400000, 400000, 400000);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xff9999) },
                offset: { value: 33 },
                exponent: { value: 0.6 },
                sunHeight: { value: 0.5 },
                brightness: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                uniform float sunHeight;
                uniform float brightness;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    float t = max(pow(max(h, 0.0), exponent), 0.0);
                    
                    // Adjust colors based on sun height
                    vec3 adjustedTopColor = topColor * (0.3 + 0.7 * sunHeight);
                    vec3 adjustedBottomColor = bottomColor * (0.3 + 0.7 * sunHeight);
                    
                    // Make sky darker when sun is below horizon
                    float darkFactor = smoothstep(-0.2, 0.2, sunHeight);
                    adjustedTopColor *= darkFactor;
                    adjustedBottomColor *= darkFactor;
                    
                    vec3 finalColor = mix(adjustedBottomColor, adjustedTopColor, t);
                    gl_FragColor = vec4(finalColor * brightness, 1.0);
                }
            `,
            side: THREE.BackSide
        });
        this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.skyMesh);

        // Create the sun sphere with improved depth testing
        const sunGeometry = new THREE.SphereGeometry(2400, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd66,
            transparent: false,
            side: THREE.FrontSide,
            depthTest: true,
            depthWrite: true
        });
        this.lightSphere = new THREE.Mesh(sunGeometry, sunMaterial);
        this.lightSphere.renderOrder = 2; // Higher render order to ensure it renders after terrain
        this.lightSphere.layers.set(1); // Put sun in a different layer
        this.scene.add(this.lightSphere);

        // Create sun halo with improved depth handling
        const haloGeometry = new THREE.PlaneGeometry(9600, 9600);
        const haloMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffdd66) },
                sunHeight: { value: 0.5 }
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
                uniform float sunHeight;
                varying vec2 vUv;
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = length(vUv - center);
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    alpha = pow(alpha, 2.0) * 0.4;
                    
                    // Reduce halo intensity when sun is below horizon
                    float intensity = smoothstep(0.3, 0.65, sunHeight);
                    alpha *= intensity;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        this.haloGroup = new THREE.Group();
        this.frontHalo = new THREE.Mesh(haloGeometry, haloMaterial);
        this.backHalo = new THREE.Mesh(haloGeometry, haloMaterial.clone());
        this.frontHalo.position.z = 100;
        this.backHalo.position.z = -100;
        this.frontHalo.renderOrder = 2;
        this.backHalo.renderOrder = 2;
        this.haloGroup.renderOrder = 2;
        this.frontHalo.layers.set(1);
        this.backHalo.layers.set(1);
        this.haloGroup.layers.set(1);
        this.haloGroup.add(this.frontHalo, this.backHalo);
        this.scene.add(this.haloGroup);

        // Enable the sun layer on the camera
        this.mainCamera.layers.enable(1);

        // Setup lights with adjusted intensities
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.3);
        this.scene.add(this.ambientLight);
        this.scene.add(this.sunLight);

        // Store instance and set initial position
        LightingSystem.instance = this;
        this.updateSunPosition();
    }

    public static getInstance(scene: THREE.Scene, camera: THREE.PerspectiveCamera): LightingSystem {
        if (!LightingSystem.instance) {
            LightingSystem.instance = new LightingSystem(scene, camera);
        }
        return LightingSystem.instance;
    }

    private updateSunPosition(): void {
        const now = performance.now();
        if (now - this.lastUpdateTime < 16) {
            return;
        }
        this.lastUpdateTime = now;

        // Smooth interpolation of sun height
        const smoothSpeed = 0.15;
        this.currentSunHeight += (this.targetSunHeight - this.currentSunHeight) * smoothSpeed;

        // Map slider range (0.3 to 0.65) to angles that match the specified positions
        const distance = 24000;
        const maxHeight = 0.65;  // Maximum height from slider
        const minHeight = 0.3;   // Minimum height from slider
        const normalizedHeight = (this.currentSunHeight - minHeight) / (maxHeight - minHeight);
        
        // These angles correspond to the positions in the logs
        const maxAngle = 2.6451383319538957; // When height is 0.65
        const minAngle = 3.2498987347469224; // When height is 0.3
        
        const angle = minAngle - (normalizedHeight * (minAngle - maxAngle));
        
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        
        console.log(`[LightingSystem] Updating sun position:`, {
            height: this.currentSunHeight,
            targetHeight: this.targetSunHeight,
            angle,
            x,
            y,
            manualMode: this.manualMode
        });
        
        // Update sun and halo positions
        this.lightSphere.position.set(x, y, 0);
        this.haloGroup.position.copy(this.lightSphere.position);
        
        // Update materials based on height
        const normalizedSunHeight = (this.currentSunHeight - minHeight) / (maxHeight - minHeight);
        
        if (this.skyMesh.material instanceof THREE.ShaderMaterial) {
            this.skyMesh.material.uniforms.sunHeight.value = normalizedSunHeight;
            this.skyMesh.material.uniforms.brightness.value = 0.3 + Math.max(0, normalizedSunHeight) * 0.7;
        }

        if (this.frontHalo.material instanceof THREE.ShaderMaterial) {
            this.frontHalo.material.uniforms.sunHeight.value = normalizedSunHeight;
        }
        if (this.backHalo.material instanceof THREE.ShaderMaterial) {
            this.backHalo.material.uniforms.sunHeight.value = normalizedSunHeight;
        }

        // Make sun and halo face the camera
        this.lightSphere.lookAt(this.mainCamera.position);
        this.haloGroup.lookAt(this.mainCamera.position);
        
        // Update directional light
        this.sunLight.position.copy(this.lightSphere.position);
        this.sunLight.lookAt(0, 0, 0);

        // Update sun color and intensity based on normalized height
        const sunColor = new THREE.Color();
        const lowColor = new THREE.Color(0xff4400);  // Orange-red for low sun
        const highColor = new THREE.Color(0xffdd66);  // Yellow-white for high sun
        sunColor.lerpColors(lowColor, highColor, normalizedSunHeight);
        
        if (this.lightSphere.material instanceof THREE.MeshBasicMaterial) {
            this.lightSphere.material.color = sunColor;
        }

        // Adjust light intensities based on normalized height
        this.sunLight.color = sunColor;
        this.sunLight.intensity = Math.max(0, 0.3 * normalizedSunHeight);
        this.ambientLight.intensity = Math.max(0.05, 0.1 * (normalizedSunHeight + 0.5));
    }

    public update(deltaTime: number): void {
        // Always update to handle smooth transitions
        if (Math.abs(this.currentSunHeight - this.targetSunHeight) > 0.001) {
            this.updateSunPosition();
        }
    }

    public setManualSunHeight(height: number): void {
        // Clamp height to our new min/max range
        height = Math.max(0.3, Math.min(0.65, height));
        
        console.log(`[LightingSystem] setManualSunHeight called:`, {
            previousHeight: this.currentSunHeight,
            newHeight: height,
            stack: new Error().stack,
            time: new Date().toISOString()
        });
        
        if (this.targetSunHeight !== height) {
            this.targetSunHeight = height;
            this.updateSunPosition();
        }
    }

    public dispose(): void {
        if (this.lightSphere) {
            this.scene.remove(this.lightSphere);
            this.lightSphere.geometry.dispose();
            if (this.lightSphere.material instanceof THREE.Material) {
                this.lightSphere.material.dispose();
            }
        }

        if (this.haloGroup) {
            this.scene.remove(this.haloGroup);
            if (this.frontHalo) {
                this.frontHalo.geometry.dispose();
                if (this.frontHalo.material instanceof THREE.Material) {
                    this.frontHalo.material.dispose();
                }
            }
            if (this.backHalo) {
                this.backHalo.geometry.dispose();
                if (this.backHalo.material instanceof THREE.Material) {
                    this.backHalo.material.dispose();
                }
            }
        }

        if (this.skyMesh) {
            this.scene.remove(this.skyMesh);
            this.skyMesh.geometry.dispose();
            if (this.skyMesh.material instanceof THREE.Material) {
                this.skyMesh.material.dispose();
            }
        }

        this.scene.remove(this.sunLight);
        this.scene.remove(this.ambientLight);
        this.sunLight.dispose();
        this.ambientLight.dispose();
    }
} 