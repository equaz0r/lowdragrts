import * as THREE from 'three';
import { LightingParameters } from '../config/GameParameters';

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

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
    private currentSunIntensity: number = LightingParameters.SUN_BASE_INTENSITY;
    private targetSunIntensity: number = LightingParameters.SUN_BASE_INTENSITY;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        if (LightingSystem.instance) {
            throw new Error('[LightingSystem] Instance already exists — use LightingSystem.getInstance()');
        }

        console.log('[LightingSystem] Creating new instance');
        this.scene = scene;
        this.mainCamera = camera;

        // Create a simple gradient skybox with dynamic colors
        const skyGeometry = new THREE.BoxGeometry(400000, 400000, 400000);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: LightingParameters.SKY_TOP_COLOR.clone() },
                middleColor: { value: LightingParameters.SKY_MIDDLE_COLOR.clone() },
                bottomColor: { value: LightingParameters.SKY_BOTTOM_COLOR.clone() },
                offset: { value: LightingParameters.SKY_GRADIENT_OFFSET },
                exponent: { value: LightingParameters.SKY_GRADIENT_EXPONENT },
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
                uniform vec3 middleColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                uniform float sunHeight;
                uniform float brightness;
                varying vec3 vWorldPosition;
                
                vec3 adjustColor(vec3 color, float factor) {
                    // Enhanced color adjustment with better blue preservation
                    float redShift = max(0.0, 0.3 - sunHeight) * 1.5;
                    float blueShift = max(0.0, sunHeight - 0.3);  // Increased blue shift
                    float skyBlueShift = max(0.0, sunHeight - 0.5) * 0.7;  // Added sky blue enhancement
                    return vec3(
                        min(1.0, color.r + redShift * (1.0 - sunHeight)),
                        color.g * (1.0 - redShift * 0.2) * (1.0 + blueShift * 0.4),
                        color.b * (1.0 + blueShift + skyBlueShift)  // Enhanced blue
                    ) * factor;
                }
                
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    float t = max(pow(max(h, 0.0), exponent), 0.0);
                    
                    // Enhanced sun height effects
                    float sunFactor = smoothstep(0.2, 0.8, sunHeight);
                    
                    // Dynamic color adjustment based on sun height
                    float highSunFactor = smoothstep(0.5, 0.8, sunHeight);
                    vec3 adjustedTopColor = adjustColor(topColor, 0.8 + 0.2 * sunHeight);
                    vec3 adjustedMiddleColor = adjustColor(middleColor, 0.9 + 0.1 * sunHeight);
                    vec3 adjustedBottomColor = adjustColor(bottomColor, 1.0);
                    
                    // Enhance blue tones when sun is high
                    adjustedTopColor = mix(adjustedTopColor, 
                        adjustedTopColor * vec3(0.7, 0.9, 1.2), 
                        highSunFactor);
                    adjustedMiddleColor = mix(adjustedMiddleColor, 
                        adjustedMiddleColor * vec3(0.8, 1.0, 1.1), 
                        highSunFactor);
                    
                    // Make sky darker when sun is below horizon with smoother transition
                    float darkFactor = smoothstep(-0.1, 0.3, sunHeight);
                    adjustedTopColor *= darkFactor;
                    adjustedMiddleColor *= darkFactor;
                    adjustedBottomColor *= darkFactor;
                    
                    // Smooth three-way gradient
                    vec3 finalColor;
                    float t1 = smoothstep(0.3, 0.7, t);  // Wider transition zone
                    float t2 = smoothstep(0.0, 0.4, t);  // Smoother bottom transition
                    
                    // Blend all three colors smoothly
                    vec3 upperBlend = mix(adjustedMiddleColor, adjustedTopColor, t1);
                    vec3 lowerBlend = mix(adjustedBottomColor, adjustedMiddleColor, t2);
                    finalColor = mix(lowerBlend, upperBlend, t1);
                    
                    // Enhanced horizon effect
                    float horizonEffect = 1.0 - abs(normalize(vWorldPosition).y);
                    float horizonGlow = smoothstep(0.5, 1.0, horizonEffect) * (1.0 - sunHeight * 0.7);
                    
                    // Horizon color varies with sun height
                    vec3 horizonColor = mix(
                        adjustedMiddleColor,
                        mix(adjustedBottomColor, 
                            mix(vec3(0.8, 0.3, 0.9), vec3(0.6, 0.8, 1.0), highSunFactor),  // Blue horizon at high sun
                            horizonEffect),
                        horizonEffect
                    );
                    finalColor = mix(finalColor, horizonColor, horizonGlow * 0.3);
                    
                    // Enhance colors based on sun height
                    float sunsetFactor = (1.0 - sunHeight) * 0.4;  // Reduced sunset effect
                    finalColor = mix(
                        finalColor,
                        finalColor * mix(
                            vec3(1.1, 0.9, 1.0),  // Sunset colors
                            vec3(0.9, 1.0, 1.2),  // Daytime colors
                            highSunFactor
                        ),
                        mix(sunsetFactor, 0.2, highSunFactor)  // Reduced color modification at high sun
                    );
                    
                    // Final brightness adjustment
                    float heightBrightness = mix(0.9, 1.3, sunHeight);  // Increased high sun brightness
                    gl_FragColor = vec4(finalColor * brightness * heightBrightness, 1.0);
                }
            `,
            side: THREE.BackSide
        });
        this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.skyMesh);

        // Create the sun sphere with improved depth testing
        const sunGeometry = new THREE.SphereGeometry(LightingParameters.SUN_GEOMETRY_SIZE, 32, 32);
        const sunMaterial = new THREE.ShaderMaterial({
            uniforms: {
                bottomColor: { value: new THREE.Color(0x330066) },
                middleColor: { value: new THREE.Color(0xff1133) },
                topColor: { value: new THREE.Color(0xff6600) },
                sunHeight: { value: 0.5 },
                useGradient: { value: 0.0 },
                opacity: { value: LightingParameters.SUN_OPACITY }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 bottomColor;
                uniform vec3 middleColor;
                uniform vec3 topColor;
                uniform float sunHeight;
                uniform float useGradient;
                uniform float opacity;
                
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                
                void main() {
                    vec3 viewNormal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float viewDot = dot(viewNormal, -viewDir);
                    
                    // Calculate vertical gradient factor
                    float gradientT = viewNormal.y * 0.5 + 0.5;
                    
                    // Determine final color
                    vec3 finalColor;
                    if (useGradient > 0.5) {
                        // Three-way gradient
                        if (gradientT < 0.5) {
                            // Bottom half: blend bottom to middle
                            float t = gradientT * 2.0;
                            finalColor = mix(bottomColor, middleColor, t);
                        } else {
                            // Top half: blend middle to top
                            float t = (gradientT - 0.5) * 2.0;
                            finalColor = mix(middleColor, topColor, t);
                        }
                    } else {
                        finalColor = middleColor;
                    }
                    
                    // Apply limb darkening
                    float limbDarkening = pow(max(viewDot, 0.0), 0.5);
                    finalColor *= mix(0.7, 1.0, limbDarkening);
                    
                    // Create sharp disc with slight edge softness
                    float disc = smoothstep(0.0, 0.1, viewDot);
                    
                    gl_FragColor = vec4(finalColor, disc * opacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            side: THREE.FrontSide
        });

        this.lightSphere = new THREE.Mesh(sunGeometry, sunMaterial);
        this.lightSphere.renderOrder = 2;
        this.lightSphere.layers.set(0);  // Changed to default layer
        this.scene.add(this.lightSphere);

        // Create sun halo with improved depth handling
        const haloGeometry = new THREE.PlaneGeometry(LightingParameters.HALO_SIZE, LightingParameters.HALO_SIZE);
        const haloMaterial = new THREE.ShaderMaterial({
            uniforms: {
                sunColor: { value: LightingParameters.SUN_HIGH_COLOR.clone() },
                sunHeight: { value: 0.5 },
                intensity: { value: LightingParameters.HALO_INTENSITY }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 sunColor;
                uniform float sunHeight;
                uniform float intensity;
                varying vec2 vUv;
                
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = length(vUv - center);
                    
                    // Improved radial gradient for halo
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    alpha = pow(alpha, 2.0) * intensity;  // Softer falloff
                    
                    // Height-based color adjustment
                    float heightFactor = smoothstep(0.25, 0.7, sunHeight);
                    vec3 finalColor = sunColor;
                    
                    // Add extra warmth for lower sun positions
                    if (sunHeight < 0.5) {
                        float warmth = (0.5 - sunHeight) * 2.0;
                        finalColor.r *= 1.0 + warmth * 0.5;
                        finalColor.g *= 0.7 + sunHeight * 0.3;
                        finalColor.b *= 0.5 + sunHeight * 0.5;
                    }
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            depthTest: true,  // Restored depth testing
            depthWrite: false,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending
        });

        this.haloGroup = new THREE.Group();
        this.frontHalo = new THREE.Mesh(haloGeometry, haloMaterial);
        this.backHalo = new THREE.Mesh(haloGeometry, haloMaterial.clone());
        this.frontHalo.position.z = 50;  // Reduced offset
        this.backHalo.position.z = -50;  // Reduced offset
        this.frontHalo.renderOrder = 2;
        this.backHalo.renderOrder = 1;
        this.frontHalo.layers.set(0);  // Changed to default layer
        this.backHalo.layers.set(0);   // Changed to default layer
        this.haloGroup.add(this.frontHalo, this.backHalo);
        this.scene.add(this.haloGroup);

        // Setup lights with adjusted intensities
        this.ambientLight = new THREE.AmbientLight(0xffffff, LightingParameters.AMBIENT_BASE_INTENSITY);
        this.sunLight = new THREE.DirectionalLight(0xffffff, LightingParameters.SUN_BASE_INTENSITY);
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

        // Update sun intensity with interpolation
        this.updateSunIntensity();

        // Smooth interpolation of sun height
        const smoothSpeed = 0.15;
        this.currentSunHeight += (this.targetSunHeight - this.currentSunHeight) * smoothSpeed;

        // Calculate normalized height for scaling
        const t = (this.currentSunHeight - LightingParameters.SUN_MIN_HEIGHT) / 
                 (LightingParameters.SUN_MAX_HEIGHT - LightingParameters.SUN_MIN_HEIGHT);
        
        // Dynamic size scaling based on height
        const minScale = LightingParameters.SUN_MIN_SCALE;
        const maxScale = LightingParameters.SUN_MAX_SCALE;
        const scaleCurve = 1.0 - Math.pow(t, LightingParameters.SUN_SCALE_POWER);
        const sizeScale = minScale + (maxScale - minScale) * scaleCurve;
        
        // Apply scale to sun and halo
        this.lightSphere.scale.setScalar(sizeScale);
        this.haloGroup.scale.setScalar(sizeScale);

        // Map slider range to angles that match the specified positions
        const distance = LightingParameters.SUN_ORBIT_RADIUS;
        const maxHeight = LightingParameters.SUN_MAX_HEIGHT;
        const minHeight = LightingParameters.SUN_MIN_HEIGHT;
        const normalizedHeight = (this.currentSunHeight - minHeight) / (maxHeight - minHeight);
        
        // Update sun position
        const maxAngle = 2.6451383319538957;
        const minAngle = 3.2498987347469224;
        const angle = minAngle - (normalizedHeight * (minAngle - maxAngle));
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        this.lightSphere.position.set(x, y, 0);
        
        // Make sun and halo always face the camera
        this.lightSphere.quaternion.copy(this.mainCamera.quaternion);
        
        // Position halo at sun position
        this.haloGroup.position.copy(this.lightSphere.position);
        this.haloGroup.quaternion.copy(this.mainCamera.quaternion);
        
        // Update directional light
        this.sunLight.position.copy(this.lightSphere.position);
        this.sunLight.target.position.set(0, 0, 0);
        this.sunLight.target.updateMatrixWorld();

        // Update sun shader uniforms
        const sunMaterial = this.lightSphere.material as THREE.ShaderMaterial;
        sunMaterial.uniforms.sunHeight.value = t;
        
        // Create gradient colors for sun sphere with smoother transitions
        const transitionStart = LightingParameters.SUN_TRANSITION_START;
        const transitionEnd = LightingParameters.SUN_TRANSITION_END;
        const transitionFactor = smoothstep(transitionStart, transitionEnd, t);
        
        // Calculate intensity with smoother curve
        const intensity = 0.8 + (t * 0.4);
        
        // Base colors for different height ranges
        const highSunColor = LightingParameters.SUN_HIGH_COLOR.clone();
        const bottomColor = LightingParameters.SUN_GRADIENT_BOTTOM.clone();
        const middleColor = LightingParameters.SUN_GRADIENT_MIDDLE.clone();
        const topColor = LightingParameters.SUN_GRADIENT_TOP.clone();
        
        // Interpolate between high sun and sunset colors
        if (t >= transitionStart) {
            // Pure high sun color
            sunMaterial.uniforms.bottomColor.value.copy(highSunColor);
            sunMaterial.uniforms.middleColor.value.copy(highSunColor);
            sunMaterial.uniforms.topColor.value.copy(highSunColor);
            sunMaterial.uniforms.useGradient.value = 0.0;
        } else if (t >= transitionEnd) {
            // Transition zone - smooth blend between high sun and sunset colors
            const blend = (t - transitionEnd) / (transitionStart - transitionEnd);
            const smoothBlend = smoothstep(0.0, 1.0, blend);
            
            const blendedBottom = new THREE.Color().lerpColors(bottomColor, highSunColor, smoothBlend);
            const blendedMiddle = new THREE.Color().lerpColors(middleColor, highSunColor, smoothBlend);
            const blendedTop = new THREE.Color().lerpColors(topColor, highSunColor, smoothBlend);
            
            sunMaterial.uniforms.bottomColor.value.copy(blendedBottom);
            sunMaterial.uniforms.middleColor.value.copy(blendedMiddle);
            sunMaterial.uniforms.topColor.value.copy(blendedTop);
            sunMaterial.uniforms.useGradient.value = smoothBlend < 0.5 ? 1.0 : 0.0;
        } else {
            // Full sunset gradient
            if (t < LightingParameters.SUN_LOW_DEPTH_THRESHOLD) {
                // Very low sun - deeper colors
                const depthFactor = 0.6 + (t / LightingParameters.SUN_LOW_DEPTH_THRESHOLD) * 0.4;
                bottomColor.multiplyScalar(depthFactor);
                middleColor.multiplyScalar(depthFactor + 0.2);
                topColor.multiplyScalar(depthFactor + 0.3);
            }
            
            sunMaterial.uniforms.bottomColor.value.copy(bottomColor);
            sunMaterial.uniforms.middleColor.value.copy(middleColor);
            sunMaterial.uniforms.topColor.value.copy(topColor);
            sunMaterial.uniforms.useGradient.value = 1.0;
        }
        
        // Update reflection colors with smooth transition
        const reflectionColor = t >= transitionStart ? 
            highSunColor.clone() :
            t >= transitionEnd ?
                new THREE.Color().lerpColors(
                    new THREE.Color().lerpColors(middleColor, topColor, 0.5),
                    highSunColor,
                    (t - transitionEnd) / (transitionStart - transitionEnd)
                ) :
                new THREE.Color().lerpColors(middleColor, topColor, 0.5);
                
        this.sunLight.color.copy(reflectionColor).multiplyScalar(intensity);

        // Update halo colors with smooth transition
        const frontHaloMaterial = this.frontHalo.material as THREE.ShaderMaterial;
        const backHaloMaterial = this.backHalo.material as THREE.ShaderMaterial;
        
        // Smoothly interpolate halo color
        const haloColor = t >= transitionStart ?
            highSunColor.clone() :
            t >= transitionEnd ?
                new THREE.Color().lerpColors(
                    new THREE.Color().lerpColors(middleColor, topColor, 0.3),
                    highSunColor,
                    (t - transitionEnd) / (transitionStart - transitionEnd)
                ) :
                new THREE.Color().lerpColors(middleColor, topColor, 0.3);
            
        frontHaloMaterial.uniforms.sunColor.value.copy(haloColor);
        backHaloMaterial.uniforms.sunColor.value.copy(haloColor);
        backHaloMaterial.uniforms.sunHeight.value = this.currentSunHeight;

        // Update sky material
        const skyMaterial = this.skyMesh.material as THREE.ShaderMaterial;
        skyMaterial.uniforms.sunHeight.value = this.currentSunHeight;

        // Update light intensities based on sun height
        const heightFactor = Math.max(0.3, this.currentSunHeight);
        this.sunLight.intensity = LightingParameters.SUN_BASE_INTENSITY * heightFactor;
        
        // Calculate ambient intensity using the defined range
        const [minAmbient, maxAmbient] = LightingParameters.AMBIENT_INTENSITY_RANGE;
        this.ambientLight.intensity = LightingParameters.AMBIENT_BASE_INTENSITY * 
            (minAmbient + (maxAmbient - minAmbient) * heightFactor);
    }

    public setSunHeight(height: number): void {
        this.targetSunHeight = Math.max(LightingParameters.SUN_MIN_HEIGHT, 
            Math.min(LightingParameters.SUN_MAX_HEIGHT, height));
    }

    public getSunHeight(): number {
        return this.currentSunHeight;
    }

    public setManualMode(manual: boolean): void {
        this.manualMode = manual;
    }

    public isManualMode(): boolean {
        return this.manualMode;
    }

    public update(): void {
        if (!this.manualMode) {
            // Automatic sun movement logic here if needed
            // For now, we'll keep it in manual mode
        }
        this.updateSunPosition();
    }

    public getSunDirection(): THREE.Vector3 {
        return this.sunLight.position.clone().normalize();
    }

    public getSunColor(): THREE.Color {
        return (this.lightSphere.material as THREE.ShaderMaterial).uniforms.color.value.clone();
    }

    public getSunIntensity(): number {
        return this.sunLight.intensity;
    }

    public getAmbientIntensity(): number {
        return this.ambientLight.intensity;
    }

    public setSunIntensity(intensity: number): void {
        this.targetSunIntensity = intensity;
    }

    private updateSunIntensity(): void {
        // Smooth interpolation of sun intensity
        const smoothSpeed = 0.15;
        this.currentSunIntensity += (this.targetSunIntensity - this.currentSunIntensity) * smoothSpeed;

        // Update sun material opacity
        const sunMaterial = this.lightSphere.material as THREE.ShaderMaterial;
        sunMaterial.uniforms.opacity.value = LightingParameters.SUN_OPACITY * this.currentSunIntensity;
        
        // Update sun light intensity
        this.sunLight.intensity = LightingParameters.SUN_BASE_INTENSITY * this.currentSunIntensity;
        
        // Update halo intensity
        const frontHaloMaterial = this.frontHalo.material as THREE.ShaderMaterial;
        const backHaloMaterial = this.backHalo.material as THREE.ShaderMaterial;
        frontHaloMaterial.uniforms.intensity.value = LightingParameters.HALO_INTENSITY * this.currentSunIntensity;
        backHaloMaterial.uniforms.intensity.value = LightingParameters.HALO_INTENSITY * this.currentSunIntensity;
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
        LightingSystem.instance = null;
    }
} 