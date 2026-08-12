import * as THREE from 'three';
import { LightingParameters } from '../config/LightingConfig';

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

        // Flat, camera-facing circle — NOT a 3D sphere. A sphere's surface has
        // real depth (bulges toward the camera at centre, recedes at the
        // limb), so under perspective projection a geometrically-flat
        // slicing plane through it still projects to a slightly curved line.
        // A flat billboard has no such bulge — same technique the halo
        // (PlaneGeometry, always .quaternion.copy(camera.quaternion)) already
        // uses successfully below, just circular instead of square.
        const sunGeometry = new THREE.CircleGeometry(LightingParameters.SUN_GEOMETRY_SIZE, 64);
        const sunMaterial = new THREE.ShaderMaterial({
            uniforms: {
                // Overwritten almost immediately by updateSunPosition() (called once
                // at the end of the constructor) — these just avoid a one-frame flash
                // of stale colour, so keep them roughly matching LightingConfig's
                // SUN_GRADIENT_* values.
                bottomColor: { value: new THREE.Color(0x5c0010) },
                middleColor: { value: new THREE.Color(0xd42200) },
                topColor: { value: new THREE.Color(0xffb020) },
                sunHeight: { value: 0.5 },
                useGradient: { value: 0.0 },
                opacity: { value: LightingParameters.SUN_OPACITY }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying vec3 vViewPosition;
                varying float vLocalY;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = mvPosition.xyz;
                    // Untransformed local Y (object space) — for a sphere, x/y in its
                    // own local space already form a flat 2D disc parameterisation
                    // (z is just how far a point bulges toward/away from camera).
                    // Bands built from this stay straight; bands built from the
                    // surface NORMAL curve with the sphere (that was the bug).
                    vLocalY = position.y;
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
                varying float vLocalY;

                void main() {
                    vec3 viewNormal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float viewDot = dot(viewNormal, -viewDir);

                    // Flat disc coordinate: 0 = bottom of the sphere, 1 = top.
                    // Deliberately NOT the surface normal (see vertex shader note) —
                    // this is what keeps both the colour gradient and the scanlines
                    // as straight horizontal bands instead of curving with the sphere.
                    float discT = clamp(vLocalY / ${LightingParameters.SUN_GEOMETRY_SIZE.toFixed(1)}, -1.0, 1.0) * 0.5 + 0.5;

                    // Determine final color
                    vec3 finalColor;
                    if (useGradient > 0.5) {
                        // Three-way gradient
                        if (discT < 0.5) {
                            // Bottom half: blend bottom to middle
                            float t = discT * 2.0;
                            finalColor = mix(bottomColor, middleColor, t);
                        } else {
                            // Top half: blend middle to top
                            float t = (discT - 0.5) * 2.0;
                            finalColor = mix(middleColor, topColor, t);
                        }
                    } else {
                        finalColor = middleColor;
                    }

                    // Apply limb darkening
                    float limbDarkening = pow(max(viewDot, 0.0), 0.5);
                    finalColor *= mix(0.7, 1.0, limbDarkening);

                    // Retro-sun horizontal scanlines — gaps cut through the disc
                    // (alpha, not colour), upper half only. Within that half:
                    // packed tight + thick near the equator (upperT=0), spreading
                    // out and thinning toward the very top (upperT=1).
                    float upperT = clamp((discT - 0.5) / 0.5, 0.0, 1.0);
                    float warped = pow(upperT, 0.4); // small exponent: dense repeats near 0, sparse near 1
                    float scanBands = fract(warped * 22.0);
                    float cutWidth = mix(0.40, 0.06, upperT); // thick cuts near equator, thin near pole
                    float gapMask = step(cutWidth, scanBands); // 0 = inside a cut/gap, 1 = visible sun
                    // Fade the cuts in gradually from the equator instead of a hard
                    // on/off switch at discT==0.5 — that read as lines abruptly
                    // stopping rather than a deliberate transition.
                    float cutStrength = smoothstep(0.0, 0.18, upperT);
                    float scanline = mix(1.0, gapMask, cutStrength);

                    // Create sharp disc with slight edge softness
                    float disc = smoothstep(0.0, 0.1, viewDot);

                    gl_FragColor = vec4(finalColor, disc * opacity * scanline);
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
        // Was 3.2498987347469224 — that put the lowest sun position at
        // y=-865 (BELOW the horizon plane, computed from
        // sin(angle)*SUN_ORBIT_RADIUS). This value instead lands the minimum
        // at y=+350 — same orbit radius/distance, sun just doesn't sink
        // underground. x barely changes (cos near 180° is flat), so the
        // "setting in the west" direction is unaffected.
        const minAngle = 3.0978286848490466;
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
        // SUN_TERRAIN_LIGHT_SCALE here only — this assignment is what actually
        // reaches the DirectionalLight each frame (updateSunIntensity() sets
        // sunLight.intensity too, earlier in this same call chain, but this
        // line overwrites it). Sun disc/halo brightness elsewhere are untouched.
        this.sunLight.intensity = this.currentSunIntensity * heightFactor * LightingParameters.SUN_TERRAIN_LIGHT_SCALE;
        
        // Calculate ambient intensity using the defined range
        const [minAmbient, maxAmbient] = LightingParameters.AMBIENT_INTENSITY_RANGE;
        this.ambientLight.intensity = LightingParameters.AMBIENT_BASE_INTENSITY * 
            (minAmbient + (maxAmbient - minAmbient) * heightFactor);
    }

    public setSunHeight(height: number): void {
        this.targetSunHeight = Math.max(LightingParameters.SUN_MIN_HEIGHT, 
            Math.min(LightingParameters.SUN_MAX_HEIGHT, height));
    }

    /** Smoothed, currently-animating height — what to render with. */
    public getSunHeight(): number {
        return this.currentSunHeight;
    }

    /** The configured target height, NOT smoothed — what setSunHeight() was
     *  last called with. Use this (not getSunHeight()) for anything that
     *  wants "what was actually configured" immediately, e.g. a UI slider's
     *  initial value read right after construction, before the smoothing in
     *  updateSunPosition() has had any frames to ease currentSunHeight toward it. */
    public getTargetSunHeight(): number {
        return this.targetSunHeight;
    }

    /** Smoothed sun height normalised to 0 (SUN_MIN_HEIGHT) .. 1 (SUN_MAX_HEIGHT)
     *  — same normalisation updateSunPosition() already does internally for the
     *  sun's size/colour curves, just exposed for other systems. Added for
     *  TerrainMaterial.ts's glint width, which needs to auto-scale with how
     *  big/low the sun currently is (12 Aug 2026). */
    public getSunHeightNormalized(): number {
        return (this.currentSunHeight - LightingParameters.SUN_MIN_HEIGHT)
            / (LightingParameters.SUN_MAX_HEIGHT - LightingParameters.SUN_MIN_HEIGHT);
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

    /** Raw sun world position (NOT normalized) — for anything computing a
     *  direction relative to a specific point (camera, a fragment) rather
     *  than "the direction from the origin", which is what getSunDirection()
     *  gives. Needed for the reflection shader's screen-space sun glint. */
    public getSunPosition(): THREE.Vector3 {
        return this.sunLight.position.clone();
    }

    /** Current representative sun colour (the shader's mid-tone stop) — for
     *  other systems (e.g. TerrainMaterial's reflection tint) that want to
     *  track the sun's actual current colour instead of a fixed one.
     *  Was previously reading a uniform key ('color') that doesn't exist on
     *  this material — dead code, would have thrown if ever called. */
    public getSunColor(): THREE.Color {
        return (this.lightSphere.material as THREE.ShaderMaterial).uniforms.middleColor.value.clone();
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

    /** Configured intensity target, before smoothing. Used by controls and
     * settings export so save files contain the live value, not a constant. */
    public getTargetSunIntensity(): number {
        return this.targetSunIntensity;
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
