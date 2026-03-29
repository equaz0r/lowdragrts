import { 
    BufferGeometry,
    Float32BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    Vector3,
    Color,
    DoubleSide,
    AdditiveBlending,
    LineSegments,
    EdgesGeometry,
    LineBasicMaterial,
    Sprite,
    SpriteMaterial,
    CanvasTexture,
    NearestFilter,
    Vector2,
    Camera,
    ShaderMaterial,
    PerspectiveCamera,
    Vector4,
    Material,
    WebGLRenderer,
    MeshBasicMaterial,
    FrontSide,
    Scene,
    Texture,
    BufferAttribute,
    Object3D
} from 'three';
import { GridSystem } from './GridSystem';
import { NoiseSampler } from '../utils/NoiseSampler';
import { TerrainParameters, ReflectionParameters, CoordinateMarkerParameters, EdgeParameters } from '../config/GameParameters';
import { ReflectionControls } from '../ui/ReflectionControls';
import { LightingSystem } from './LightingSystem';
import { BufferPool } from '../utils/BufferPool';

// Define the shader parameter type that Three.js uses
interface WebGLProgramParametersWithUniforms {
    uniforms: { [uniform: string]: { value: any } };
    vertexShader: string;
    fragmentShader: string;
}

export interface TerrainConfig {
    // Shape
    heightScale: number;
    persistence: number;      // fractal gain — roughness of both layers
    basePeakBlend: number;    // 0 = all peaks, 1 = all base rolling hills
    // Noise frequencies
    baseFrequency: number;    // scale of rolling hills (lower = bigger features)
    peakFrequency: number;    // scale of mountain ridges
    // Domain warp
    warpAmplitude: number;    // how far coordinates are displaced (0 = off)
    warpFrequency: number;    // scale of the warp itself
    // Peak shape
    peakThreshold: number;    // 0..1 — values below this are flat (fewer peaks = higher)
    // Octave detail
    baseOctaves: number;
    peakOctaves: number;
    // Valley
    valleyEnabled: boolean;
    valleyWidth: number;      // fraction of total map width (0.05 – 0.5)
    valleyDepth: number;      // 0 = no effect, 1 = flat floor
}

export class TerrainGenerator {
    public config: TerrainConfig = {
        heightScale:   TerrainParameters.HEIGHT_SCALE,
        persistence:   TerrainParameters.PERSISTENCE,
        basePeakBlend: 0.6,
        baseFrequency: 0.0004,
        peakFrequency: 0.0008,
        warpAmplitude: 350,
        warpFrequency: 0.0002,
        peakThreshold: 0.40,
        baseOctaves:   5,
        peakOctaves:   6,
        valleyEnabled: true,
        valleyWidth:   0.18,
        valleyDepth:   0.72,
    };

    private readonly gridSystem: GridSystem;
    private readonly camera: PerspectiveCamera;
    private readonly scene: Scene;
    private material: Material | null = null;
    private terrainMesh: Mesh | null = null;
    private markerGroup: Object3D | null = null;
    private seed: number;
    private bufferPool: BufferPool;
    private currentBuffers: {
        vertex: Float32Array | null;
        color: Float32Array | null;
        uv: Float32Array | null;
        index: Uint32Array | null;
        height: Float32Array | null;
    };
    private shaderMaterial: WebGLProgramParametersWithUniforms | null = null;
    private edgeUniforms: Record<string, { value: any }> | null = null;
    private geometry: BufferGeometry | null = null;
    private reflectionControls: ReflectionControls;

    constructor(scene: Scene, gridSystem: GridSystem, camera: PerspectiveCamera, lightingSystem: LightingSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.camera = camera;
        this.seed = Math.random() * 2147483647 | 0;
        this.bufferPool = BufferPool.getInstance();
        
        // Initialize current buffers with null values
        this.currentBuffers = {
            vertex: null,
            color: null,
            uv: null,
            index: null,
            height: null
        };

        // Initialize reflection controls with lighting system
        this.reflectionControls = new ReflectionControls((params) => {
            const shader = (this.material as any)?.customShader;
            if (shader?.uniforms) {
                shader.uniforms.reflectionParams.value.copy(params);
                if (this.material) {
                    this.material.needsUpdate = true;
                }
            }
        }, lightingSystem);
        
        this.initialize();
    }

    private ensureBufferSize(type: keyof typeof this.currentBuffers, requiredSize: number): void {
        // Release existing buffer if it exists
        if (this.currentBuffers[type]) {
            this.bufferPool.releaseBuffer(this.currentBuffers[type]!);
            this.currentBuffers[type] = null;
        }

        try {
            // Acquire new buffer from pool
            const bufferType = type === 'index' ? 'uint32' : 'float32';
            const newBuffer = this.bufferPool.acquireBuffer(requiredSize, bufferType);
            this.currentBuffers[type] = newBuffer as any; // Type assertion needed due to union type
        } catch (error: any) {
            console.error(`Failed to allocate buffer of type ${type} with size ${requiredSize}:`, error);
            throw new Error(`Buffer allocation failed: ${error.message}`);
        }
    }

    // newSeed=true (Regenerate button): randomises terrain topology
    // newSeed=false (slider change): rebuilds with same topology, new parameters
    public async regenerate(newSeed: boolean = true): Promise<void> {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            if (this.terrainMesh.material instanceof Material) {
                (this.terrainMesh.material as Material).dispose();
            }
            this.terrainMesh = null;
        }
        if (newSeed) {
            this.seed = Math.random() * 2147483647 | 0;
        }
        try {
            this.terrainMesh = await this.generate();
            this.scene.add(this.terrainMesh);
            if (this.terrainMesh.material instanceof Material) {
                this.material = this.terrainMesh.material;
            }
        } catch (error) {
            console.error('[TerrainGenerator] generate() threw:', error);
        }
    }

    public dispose(): void {
        this.disposeGeometry();
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh = null;
        }
        // Release all buffers back to the pool
        Object.values(this.currentBuffers).forEach(buffer => {
            if (buffer) {
                this.bufferPool.releaseBuffer(buffer);
            }
        });
        // Reset current buffers
        Object.keys(this.currentBuffers).forEach(key => {
            this.currentBuffers[key as keyof typeof this.currentBuffers] = null;
        });
        // Dispose reflection controls
        this.reflectionControls.dispose();
    }

    public async generate(): Promise<Mesh> {
        this.disposeGeometry();
        this.geometry = new BufferGeometry();
        const totalSize = this.gridSystem.getTotalSize();
        const divisions = this.gridSystem.getGridDivisions() * 2;
        const segmentSize = totalSize / divisions;

        // Calculate required buffer sizes
        const vertexCount = (divisions + 1) * (divisions + 1);
        const indexCount = divisions * divisions * 6;

        // Ensure buffers are properly sized
        this.ensureBufferSize('vertex', vertexCount * 3);
        this.ensureBufferSize('color', vertexCount * 3);
        this.ensureBufferSize('uv', vertexCount * 2);
        this.ensureBufferSize('index', indexCount);
        this.ensureBufferSize('height', vertexCount);

        const sampler = new NoiseSampler(this.seed, this.config);
        let minHeight = Infinity;
        let maxHeight = -Infinity;

        // First pass: Generate heights and find min/max
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const index = x + z * (divisions + 1);
                const xPos = (x - divisions / 2) * segmentSize;
                const zPos = (z - divisions / 2) * segmentSize;

                const baseH = sampler.getBaseHeight(xPos, zPos);
                const peakH = sampler.getPeakHeight(xPos, zPos);
                const rawHeight = baseH * this.config.basePeakBlend + peakH * (1 - this.config.basePeakBlend);
                let height = this.angularizeHeight(rawHeight) * this.config.heightScale;

                // Valley carving — Gaussian mask along X axis (valley runs through centre in Z direction)
                if (this.config.valleyEnabled) {
                    const sigma = this.config.valleyWidth * totalSize * 0.5;
                    const valleyMask = Math.exp(-(xPos * xPos) / (2 * sigma * sigma));
                    height = height * (1.0 - this.config.valleyDepth * valleyMask);
                }
                
                if (this.currentBuffers.height) {
                    this.currentBuffers.height[index] = height;
                }
                minHeight = Math.min(minHeight, height);
                maxHeight = Math.max(maxHeight, height);
            }
        }

        const heightRange = maxHeight - minHeight;

        // Second pass: Generate vertices and colors with normalized heights
        let vertexIdx = 0;
        let colorIdx = 0;
        let uvIdx = 0;
        
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const index = x + z * (divisions + 1);
                const xPos = (x - divisions / 2) * segmentSize;
                const zPos = (z - divisions / 2) * segmentSize;
                const height = this.currentBuffers.height ? this.currentBuffers.height[index] : 0;
                
                const normalizedHeight = Math.pow(Math.max(0, Math.min(1, height / this.config.heightScale)), 1.2);
                
                // Set vertex position
                if (this.currentBuffers.vertex) {
                    this.currentBuffers.vertex[vertexIdx++] = xPos;
                    this.currentBuffers.vertex[vertexIdx++] = height;
                    this.currentBuffers.vertex[vertexIdx++] = zPos;
                }
                
                // Set vertex color (darker base color for better contrast)
                const color = new Color();
                color.copy(TerrainParameters.BASE_COLOR)
                    .multiplyScalar(0.3) // Darken the base color
                    .lerp(TerrainParameters.PEAK_COLOR, normalizedHeight);
                
                if (this.currentBuffers.color) {
                    this.currentBuffers.color[colorIdx++] = color.r;
                    this.currentBuffers.color[colorIdx++] = color.g;
                    this.currentBuffers.color[colorIdx++] = color.b;
                }
                
                // Set UV coordinates
                if (this.currentBuffers.uv) {
                    this.currentBuffers.uv[uvIdx++] = x / divisions;
                    this.currentBuffers.uv[uvIdx++] = z / divisions;
                }
            }
        }

        // Generate indices
        let indexIdx = 0;
        if (this.currentBuffers.index) {
            for (let z = 0; z < divisions; z++) {
                for (let x = 0; x < divisions; x++) {
                    const a = x + (divisions + 1) * z;
                    const b = x + (divisions + 1) * (z + 1);
                    const c = (x + 1) + (divisions + 1) * z;
                    const d = (x + 1) + (divisions + 1) * (z + 1);

                    this.currentBuffers.index[indexIdx++] = a;
                    this.currentBuffers.index[indexIdx++] = b;
                    this.currentBuffers.index[indexIdx++] = c;
                    this.currentBuffers.index[indexIdx++] = c;
                    this.currentBuffers.index[indexIdx++] = b;
                    this.currentBuffers.index[indexIdx++] = d;
                }
            }
        }

        // Set geometry attributes using buffer pool
        if (this.currentBuffers.vertex) {
            this.geometry.setAttribute('position', new Float32BufferAttribute(this.currentBuffers.vertex, 3));
        }
        if (this.currentBuffers.color) {
            this.geometry.setAttribute('color', new Float32BufferAttribute(this.currentBuffers.color, 3));
        }
        if (this.currentBuffers.uv) {
            this.geometry.setAttribute('uv', new Float32BufferAttribute(this.currentBuffers.uv, 2));
        }
        if (this.currentBuffers.index) {
            this.geometry.setIndex(new BufferAttribute(this.currentBuffers.index, 1));
        }
        this.geometry.computeVertexNormals();

        // Create main terrain mesh with material
        const material = this.createTerrainMaterial(totalSize);
        const mesh = new Mesh(this.geometry, material);

        // Create edge wireframe — colour and animation handled entirely in shader
        const baseEdgeGeometry = new EdgesGeometry(this.geometry, 0.1);
        const baseEdgeMaterial = this.createEdgeMaterial(minHeight, maxHeight);
        const baseEdges = new LineSegments(baseEdgeGeometry, baseEdgeMaterial);
        mesh.add(baseEdges);

        return mesh;
    }

    /**
     * Utility function for smooth interpolation between 0 and 1
     */
    private smoothstep(x: number): number {
        x = Math.max(0, Math.min(1, x));
        return x * x * (3 - 2 * x);
    }

    private async initialize(): Promise<void> {
        try {
            this.terrainMesh = await this.generate();
            this.scene.add(this.terrainMesh);
            if (this.terrainMesh.material instanceof Material) {
                this.material = this.terrainMesh.material;
            }
        } catch (error) {
            console.error('Failed to generate terrain:', error);
        }
    }

    private createCoordinateSprite(text: string, color: string = CoordinateMarkerParameters.CARDINAL_COLOR): Sprite {
        // Create a new canvas with smaller dimensions
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Add semi-transparent background
        context.fillStyle = `rgba(0, 0, 0, ${CoordinateMarkerParameters.BACKGROUND_OPACITY})`;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Set up text rendering
        context.font = `${CoordinateMarkerParameters.FONT_WEIGHT} ${CoordinateMarkerParameters.FONT_SIZE/2}px ${CoordinateMarkerParameters.FONT_FAMILY}`;
        context.fillStyle = color;
        context.strokeStyle = '#000000';
        context.lineWidth = 2;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Split text into lines
        const lines = text.split('\n');
        const lineHeight = CoordinateMarkerParameters.FONT_SIZE/2;
        
        // Draw each line
        lines.forEach((line, index) => {
            const y = canvas.height/2 + (index - 0.5) * lineHeight;
            context.strokeText(line, canvas.width/2, y);
            context.fillText(line, canvas.width/2, y);
        });
        
        // Create texture
        const texture = new CanvasTexture(canvas);
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        
        // Create sprite with proper material settings
        const spriteMaterial = new SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: CoordinateMarkerParameters.OPACITY,
            depthTest: true,
            depthWrite: false,
            sizeAttenuation: true
        });
        
        return new Sprite(spriteMaterial);
    }

    private createTerrainMaterial(gridSize: number): MeshStandardMaterial {
        const material = new MeshStandardMaterial({
            vertexColors: true,
            wireframe: TerrainParameters.USE_WIREFRAME,
            metalness: TerrainParameters.MATERIAL_METALNESS,
            roughness: TerrainParameters.MATERIAL_ROUGHNESS,
            flatShading: TerrainParameters.USE_FLAT_SHADING,
            side: DoubleSide
        });

        // Add shader customization
        material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
            console.log('Compiling terrain shader...');
            this.shaderMaterial = shader;
            
            // Add custom uniforms
            shader.uniforms.sunDirection = { value: new Vector3(-1, 0.3, 0).normalize() };
            shader.uniforms.cameraDirection = { value: new Vector3() };
            shader.uniforms.gridSize = { value: gridSize };
            shader.uniforms.reflectionParams = { value: ReflectionParameters.REFLECTION_PARAMS };
            shader.uniforms.sunColor = { value: new Color(1.0, 0.98, 0.9) };

            // Add varying for world-space values and grid position
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                varying vec2 vGridPosition;`
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vWorldNormal = normalize(normalMatrix * normal);
                vGridPosition = position.xz / 100.0;`
            );

            // Add to fragment shader for panel effect and reflection
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform vec3 sunDirection;
                uniform vec3 cameraDirection;
                uniform vec4 reflectionParams;
                uniform vec3 sunColor;
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                varying vec2 vGridPosition;

                float getPanelFactor() {
                    vec2 grid = floor(vGridPosition);
                    vec2 frac = fract(vGridPosition);
                    float border = step(0.1, max(frac.x, frac.y));
                    float variation = fract(sin(dot(grid, vec2(12.9898, 78.233))) * 43758.5453);
                    return mix(1.0, 0.7, border) * (0.9 + 0.1 * variation);
                }

                float calculateReflection() {
                    vec3 normalizedNormal = normalize(vWorldNormal);
                    vec3 normalizedCameraDir = normalize(cameraDirection);
                    
                    float sunDot = max(0.0, dot(normalizedNormal, sunDirection));
                    float sunFactor = pow(sunDot, ${ReflectionParameters.SUN_FACTOR_POWER.toFixed(2)});
                    
                    vec3 reflectionDir = reflect(-sunDirection, normalizedNormal);
                    float viewDot = max(0.0, dot(normalizedCameraDir, reflectionDir));
                    float viewFactor = pow(viewDot, ${ReflectionParameters.VIEW_FACTOR_POWER.toFixed(2)});
                    
                    float distanceFromWest = (vWorldPosition.x + ${ReflectionParameters.WEST_FALLOFF_START.toFixed(1)}) / ${ReflectionParameters.WEST_FALLOFF_LENGTH.toFixed(1)};
                    float positionFactor = smoothstep(0.0, reflectionParams.z, 1.0 - distanceFromWest);
                    
                    float panelFactor = getPanelFactor();
                    
                    float heightFactor = 1.0 - abs(normalizedNormal.y);
                    heightFactor = pow(heightFactor, ${ReflectionParameters.HEIGHT_FACTOR_POWER.toFixed(2)});
                    
                    float grazingDot = 1.0 - abs(dot(normalizedNormal, normalizedCameraDir));
                    float grazingFactor = pow(grazingDot, ${ReflectionParameters.GRAZING_FACTOR_POWER.toFixed(2)});
                    
                    float totalFactor = pow(
                        viewFactor * ${ReflectionParameters.VIEW_FACTOR_WEIGHT.toFixed(1)} +
                        sunFactor * ${ReflectionParameters.SUN_FACTOR_WEIGHT.toFixed(1)} +
                        positionFactor * ${ReflectionParameters.POSITION_FACTOR_WEIGHT.toFixed(1)} +
                        panelFactor * ${ReflectionParameters.PANEL_FACTOR_WEIGHT.toFixed(1)} +
                        grazingFactor * heightFactor * ${ReflectionParameters.GRAZING_FACTOR_WEIGHT.toFixed(1)},
                        reflectionParams.w
                    );
                    
                    return max(${ReflectionParameters.MIN_REFLECTION.toFixed(2)}, totalFactor);
                }`
            );

            // Modify material properties based on reflection
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                float reflectionStrength = calculateReflection();
                
                vec3 reflectionColor = sunColor * reflectionStrength;
                diffuseColor.rgb = mix(diffuseColor.rgb, reflectionColor, reflectionStrength * ${ReflectionParameters.REFLECTION_BLEND.toFixed(1)});`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `#include <roughnessmap_fragment>
                roughnessFactor = mix(reflectionParams.y, 0.1, reflectionStrength);`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <metalnessmap_fragment>',
                `#include <metalnessmap_fragment>
                metalnessFactor = mix(reflectionParams.x, 1.0, reflectionStrength);`
            );

            // Store modified shader for updates
            (material as any).customShader = shader;
        };

        return material;
    }

    private createEdgeMaterial(minHeight: number, maxHeight: number): LineBasicMaterial {
        // Build live uniform value objects. These are stored in this.edgeUniforms so
        // EdgeControls can mutate them directly — no regen needed for appearance changes.
        const layers = EdgeParameters.layers;

        // Ensure layer heights are strictly ascending (prevents smoothstep divide-by-zero)
        const sortedHeights = layers.map((l, i) => Math.max(l.heightFraction, i * 0.001));

        const layerHeightsVal   = new Float32Array(sortedHeights);
        const layerColorsVal    = layers.map(l => l.color.clone());
        const layerIntensityVal = new Float32Array(layers.map(l => l.intensity));

        const timeVal         = { value: 0 };
        const pulseSpeedVal   = { value: EdgeParameters.pulseSpeed };
        const pulseIntVal     = { value: EdgeParameters.pulseIntensity };
        const pulseWidthVal   = { value: EdgeParameters.pulseWidth };
        const minHVal         = { value: minHeight };
        const maxHVal         = { value: maxHeight };

        this.edgeUniforms = {
            layerHeights:     { value: layerHeightsVal },
            layerColors:      { value: layerColorsVal },
            layerIntensities: { value: layerIntensityVal },
            time:             timeVal,
            pulseSpeed:       pulseSpeedVal,
            pulseIntensity:   pulseIntVal,
            pulseWidth:       pulseWidthVal,
            minTerrainHeight: minHVal,
            maxTerrainHeight: maxHVal,
        };

        const material = new LineBasicMaterial({
            transparent: true,
            opacity: 1.0,
            blending: AdditiveBlending,
            depthWrite: false,
        });

        const eu = this.edgeUniforms;
        material.onBeforeCompile = (shader) => {
            // Add uniforms
            Object.assign(shader.uniforms, eu);

            // ── Vertex: pass world Y and XZ to fragment ──────────────────────
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                varying float vWorldY;
                varying vec2  vWorldXZ;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vec4 _wpos = modelMatrix * vec4( transformed, 1.0 );
                vWorldY  = _wpos.y;
                vWorldXZ = _wpos.xz;`
            );

            // ── Fragment: 5-layer colour ramp + animated pulse ────────────────
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                varying float vWorldY;
                varying vec2  vWorldXZ;

                uniform float minTerrainHeight;
                uniform float maxTerrainHeight;
                uniform float layerHeights[5];
                uniform vec3  layerColors[5];
                uniform float layerIntensities[5];
                uniform float time;
                uniform float pulseSpeed;
                uniform float pulseIntensity;
                uniform float pulseWidth;

                // Hash 80-world-unit cells for per-edge timing variation
                float edgeHash( vec2 p ) {
                    vec2 ip = floor( p / 80.0 );
                    return fract( sin( dot( ip, vec2(127.1, 311.7) ) ) * 43758.5453 );
                }

                // Progressive smoothstep blend through 5 layers
                vec3 sampleLayers( float t ) {
                    vec3 c = layerColors[0] * layerIntensities[0];
                    c = mix( c, layerColors[1] * layerIntensities[1], smoothstep( layerHeights[0], max(layerHeights[0]+0.001, layerHeights[1]), t ) );
                    c = mix( c, layerColors[2] * layerIntensities[2], smoothstep( layerHeights[1], max(layerHeights[1]+0.001, layerHeights[2]), t ) );
                    c = mix( c, layerColors[3] * layerIntensities[3], smoothstep( layerHeights[2], max(layerHeights[2]+0.001, layerHeights[3]), t ) );
                    c = mix( c, layerColors[4] * layerIntensities[4], smoothstep( layerHeights[3], max(layerHeights[3]+0.001, layerHeights[4]), t ) );
                    return c;
                }

                // Single upward pulse: sharp leading edge, exponential trailing glow
                // pos is normalised [0,1] head position travelling upward
                float onePulse( float y, float pos, float w ) {
                    float d       = pos - y;           // >0 = above (not arrived), <0 = passed (trailing)
                    float trailing = exp( -max(0.0, -d) / w );
                    float leading  = exp( -max(0.0,  d) / (w * 0.12) );
                    return trailing * leading;
                }

                // Three overlapping pulses with independent speeds + per-edge phase offsets
                vec3 computePulse( float y, float eh ) {
                    float i1 = onePulse( y, fract(time*pulseSpeed          + eh),                pulseWidth );
                    float i2 = onePulse( y, fract(time*pulseSpeed*0.61     + eh*0.73 + 0.33),    pulseWidth*1.5  ) * 0.65;
                    float i3 = onePulse( y, fract(time*pulseSpeed*0.37     + eh*1.31 + 0.67),    pulseWidth*2.1  ) * 0.45;
                    float total = i1 + i2 + i3;
                    // Electric colour: warm orange-white at low heights → cool cyan at peaks
                    vec3 pColor = mix( vec3(1.0, 0.55, 0.05), vec3(0.25, 0.9, 1.0), y );
                    return pColor * total * pulseIntensity;
                }`
            );

            // Override diffuseColor with layer ramp + pulse overlay
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                float _range = max(1.0, maxTerrainHeight - minTerrainHeight);
                float _ny    = clamp((vWorldY - minTerrainHeight) / _range, 0.0, 1.0);
                float _eh    = edgeHash(vWorldXZ);
                diffuseColor.rgb = sampleLayers(_ny) + computePulse(_ny, _eh);`
            );

            (material as any).customShader = shader;
        };

        return material;
    }

    /** Allow EdgeControls to update edge uniforms directly without a full regen. */
    public getEdgeUniforms(): Record<string, { value: any }> | null {
        return this.edgeUniforms;
    }

    /**
     * Transform height value to create more angular terrain
     * Designed to be configurable via UI controls in the future
     */
    private angularizeHeight(height: number): number {
        // Calculate stepped height based on configurable steps
        const steppedHeight = Math.floor(height * TerrainParameters.ANGULAR_STEPS) / TerrainParameters.ANGULAR_STEPS;
        
        // Calculate blend factor based on height to vary angularity
        // This can be adjusted via UI in the future
        const heightFactor = Math.pow(this.smoothstep(height), TerrainParameters.ANGULAR_HEIGHT_FACTOR_POWER);
        const blend = TerrainParameters.MIN_ANGULAR_BLEND + 
            Math.pow(heightFactor, TerrainParameters.ANGULAR_BLEND_CURVE) * 
            (TerrainParameters.MAX_ANGULAR_BLEND - TerrainParameters.MIN_ANGULAR_BLEND);
        
        // Linear interpolation between smooth and stepped height
        // The blend factor controls how angular the terrain appears
        return height * (1 - blend) + steppedHeight * blend;
    }

    public update(time: number): void {
        const shader = (this.material as any)?.customShader;
        if (shader?.uniforms) {
            shader.uniforms.cameraDirection.value.copy(this.camera.position).normalize();
            shader.uniforms.time = { value: time };
        }
        if (this.edgeUniforms) {
            this.edgeUniforms.time.value = time;
        }
    }

    /**
     * Show coordinate markers
     */
    public showCoordinateMarkers(): void {
        if (this.markerGroup) {
            this.markerGroup.visible = true;
        }
    }

    /**
     * Hide coordinate markers
     */
    public hideCoordinateMarkers(): void {
        if (this.markerGroup) {
            this.markerGroup.visible = false;
        }
    }

    /**
     * Set coordinate markers visibility
     */
    public setCoordinateMarkersVisible(visible: boolean): void {
        if (this.markerGroup) {
            this.markerGroup.visible = visible;
        }
    }

    /**
     * Get current coordinate markers visibility state
     */
    public areCoordinateMarkersVisible(): boolean {
        return this.markerGroup ? this.markerGroup.visible : false;
    }

    private disposeGeometry(): void {
        if (this.geometry) {
            // Release all buffers back to the pool and null the references
            (Object.keys(this.currentBuffers) as Array<keyof typeof this.currentBuffers>).forEach(key => {
                if (this.currentBuffers[key]) {
                    this.bufferPool.releaseBuffer(this.currentBuffers[key]!);
                    this.currentBuffers[key] = null;
                }
            });

            this.geometry.dispose();
            this.geometry = null;
        }
    }
} 