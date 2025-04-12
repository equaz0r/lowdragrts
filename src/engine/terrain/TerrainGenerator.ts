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
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise';
import { TerrainParameters, ReflectionParameters, CoordinateMarkerParameters } from '../config/GameParameters';
import { ReflectionControls } from '../ui/ReflectionControls';
import { LightingSystem } from './LightingSystem';

// Define the shader parameter type that Three.js uses
interface WebGLProgramParametersWithUniforms {
    uniforms: { [uniform: string]: { value: any } };
    vertexShader: string;
    fragmentShader: string;
}

export class TerrainGenerator {
    private readonly gridSystem: GridSystem;
    private readonly camera: PerspectiveCamera;
    private readonly scene: Scene;
    private material: Material | null = null;
    private terrainMesh: Mesh | null = null;
    private markerGroup: Object3D | null = null;
    private readonly noise: SimplexNoise;
    private bufferPool: {
        vertex: Float32Array | null;
        color: Float32Array | null;
        uv: Float32Array | null;
        index: Uint32Array | null;
        height: Float32Array | null;
    };
    private bufferSizes: {
        vertex: number;
        color: number;
        uv: number;
        index: number;
        height: number;
    };
    private shaderMaterial: WebGLProgramParametersWithUniforms | null = null;
    private geometry: BufferGeometry | null = null;
    private reflectionControls: ReflectionControls;

    constructor(scene: Scene, gridSystem: GridSystem, camera: PerspectiveCamera, lightingSystem: LightingSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.camera = camera;
        this.noise = new SimplexNoise();
        
        // Initialize buffer pool with null values
        this.bufferPool = {
            vertex: null,
            color: null,
            uv: null,
            index: null,
            height: null
        };

        // Initialize buffer sizes
        this.bufferSizes = {
            vertex: 0,
            color: 0,
            uv: 0,
            index: 0,
            height: 0
        };

        // Initialize reflection controls with lighting system
        this.reflectionControls = new ReflectionControls((params) => {
            if (this.shaderMaterial?.uniforms) {
                this.shaderMaterial.uniforms.reflectionParams.value.copy(params);
                
                // Mark the material as needing an update
                if (this.material) {
                    this.material.needsUpdate = true;
                }
            }
        }, lightingSystem);
        
        this.initialize();
    }

    private ensureBufferSize(type: keyof typeof this.bufferPool, requiredSize: number): void {
        if (!this.bufferPool[type] || this.bufferSizes[type] < requiredSize) {
            // Release old buffer if it exists
            if (this.bufferPool[type]) {
                this.bufferPool[type] = null;
            }

            try {
                // Allocate new buffer with required size
                switch (type) {
                    case 'vertex':
                    case 'color':
                    case 'height':
                        this.bufferPool[type] = new Float32Array(requiredSize);
                        break;
                    case 'uv':
                        this.bufferPool[type] = new Float32Array(requiredSize);
                        break;
                    case 'index':
                        this.bufferPool[type] = new Uint32Array(requiredSize);
                        break;
                }
                this.bufferSizes[type] = requiredSize;
            } catch (error: any) {
                console.error(`Failed to allocate buffer of type ${type} with size ${requiredSize}:`, error);
                throw new Error(`Buffer allocation failed: ${error.message}`);
            }
        }
    }

    private disposeGeometry(): void {
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
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
        // Clear buffer pool references
        Object.keys(this.bufferPool).forEach(key => {
            this.bufferPool[key as keyof typeof this.bufferPool] = null;
        });
        // Reset buffer sizes
        Object.keys(this.bufferSizes).forEach(key => {
            this.bufferSizes[key as keyof typeof this.bufferSizes] = 0;
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

        let minHeight = Infinity;
        let maxHeight = -Infinity;

        // First pass: Generate heights and find min/max
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const index = x + z * (divisions + 1);
                const xPos = (x - divisions / 2) * segmentSize;
                const zPos = (z - divisions / 2) * segmentSize;
                
                const baseHeight = this.generateBaseHeight(this.noise, xPos * TerrainParameters.BASE_NOISE_FREQUENCY, zPos * TerrainParameters.BASE_NOISE_FREQUENCY);
                const peakHeight = this.generatePeakHeight(this.noise, xPos, zPos);
                const rawHeight = baseHeight * 0.3 + peakHeight * 0.7;
                const height = this.angularizeHeight(rawHeight) * TerrainParameters.HEIGHT_SCALE;
                
                if (this.bufferPool.height) {
                    this.bufferPool.height[index] = height;
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
                const height = this.bufferPool.height ? this.bufferPool.height[index] : 0;
                
                const normalizedHeight = Math.pow((height - minHeight) / heightRange, 1.2);
                
                // Set vertex position
                if (this.bufferPool.vertex) {
                    this.bufferPool.vertex[vertexIdx++] = xPos;
                    this.bufferPool.vertex[vertexIdx++] = height;
                    this.bufferPool.vertex[vertexIdx++] = zPos;
                }
                
                // Set vertex color (darker base color for better contrast)
                const color = new Color();
                color.copy(TerrainParameters.BASE_COLOR)
                    .multiplyScalar(0.3) // Darken the base color
                    .lerp(TerrainParameters.PEAK_COLOR, normalizedHeight);
                
                if (this.bufferPool.color) {
                    this.bufferPool.color[colorIdx++] = color.r;
                    this.bufferPool.color[colorIdx++] = color.g;
                    this.bufferPool.color[colorIdx++] = color.b;
                }
                
                // Set UV coordinates
                if (this.bufferPool.uv) {
                    this.bufferPool.uv[uvIdx++] = x / divisions;
                    this.bufferPool.uv[uvIdx++] = z / divisions;
                }
            }
        }

        // Generate indices
        let indexIdx = 0;
        if (this.bufferPool.index) {
            for (let z = 0; z < divisions; z++) {
                for (let x = 0; x < divisions; x++) {
                    const a = x + (divisions + 1) * z;
                    const b = x + (divisions + 1) * (z + 1);
                    const c = (x + 1) + (divisions + 1) * z;
                    const d = (x + 1) + (divisions + 1) * (z + 1);

                    this.bufferPool.index[indexIdx++] = a;
                    this.bufferPool.index[indexIdx++] = b;
                    this.bufferPool.index[indexIdx++] = c;
                    this.bufferPool.index[indexIdx++] = c;
                    this.bufferPool.index[indexIdx++] = b;
                    this.bufferPool.index[indexIdx++] = d;
                }
            }
        }

        // Set geometry attributes using buffer pool
        if (this.bufferPool.vertex) {
            this.geometry.setAttribute('position', new Float32BufferAttribute(this.bufferPool.vertex, 3));
        }
        if (this.bufferPool.color) {
            this.geometry.setAttribute('color', new Float32BufferAttribute(this.bufferPool.color, 3));
        }
        if (this.bufferPool.uv) {
            this.geometry.setAttribute('uv', new Float32BufferAttribute(this.bufferPool.uv, 2));
        }
        if (this.bufferPool.index) {
            this.geometry.setIndex(new BufferAttribute(this.bufferPool.index, 1));
        }
        this.geometry.computeVertexNormals();

        // Create main terrain mesh with material
        const material = this.createTerrainMaterial(totalSize);
        const mesh = new Mesh(this.geometry, material);

        // Create edge wireframe
        const baseEdgeGeometry = new EdgesGeometry(this.geometry, 0.1);
        const baseEdgeMaterial = new LineBasicMaterial({ 
            vertexColors: true,
            transparent: true,
            opacity: TerrainParameters.EDGE_OPACITY,
            blending: AdditiveBlending,
            depthWrite: false
        });

        // Create color array for edge vertices based on height
        const edgeColors: number[] = [];
        const edgePositions = baseEdgeGeometry.attributes.position.array;
        const edgeColor = new Color();
        const whiteColor = new Color(0xffffff);

        for (let i = 0; i < edgePositions.length; i += 6) {
            const y1 = edgePositions[i + 1];
            const y2 = edgePositions[i + 4];
            const avgHeight = (y1 + y2) / 2;
            
            // Normalize height and create color gradient
            const normalizedHeight = (avgHeight - minHeight) / heightRange;
            
            if (normalizedHeight < TerrainParameters.LOW_HEIGHT_THRESHOLD) {
                // Low terrain - orange color
                edgeColor.copy(TerrainParameters.LOW_EDGE_COLOR);
                // Adjust opacity based on grid alignment
                const x1 = edgePositions[i];
                const z1 = edgePositions[i + 2];
                const x2 = edgePositions[i + 3];
                const z2 = edgePositions[i + 5];
                const isAligned = Math.abs(x1 - x2) < 0.1 || Math.abs(z1 - z2) < 0.1;
                const intensity = isAligned ? TerrainParameters.ALIGNED_EDGE_INTENSITY : TerrainParameters.NON_ALIGNED_EDGE_INTENSITY;
                edgeColor.multiplyScalar(intensity);
            } else if (normalizedHeight < TerrainParameters.TRANSITION_THRESHOLD) {
                // Transition zone - blend between orange and green
                const t = (normalizedHeight - TerrainParameters.LOW_HEIGHT_THRESHOLD) / 
                         (TerrainParameters.TRANSITION_THRESHOLD - TerrainParameters.LOW_HEIGHT_THRESHOLD);
                edgeColor.copy(TerrainParameters.LOW_EDGE_COLOR).lerp(TerrainParameters.HIGH_EDGE_COLOR, t);
                const intensity = TerrainParameters.HEIGHT_INTENSITY_MIN + 
                                (t * (TerrainParameters.HEIGHT_INTENSITY_MAX - TerrainParameters.HEIGHT_INTENSITY_MIN));
                edgeColor.multiplyScalar(intensity);
            } else {
                // Higher terrain - green with increasing intensity
                const heightFactor = (normalizedHeight - TerrainParameters.TRANSITION_THRESHOLD) / 
                                   (1 - TerrainParameters.TRANSITION_THRESHOLD);
                const intensity = TerrainParameters.HEIGHT_INTENSITY_MIN + 
                                (heightFactor * (TerrainParameters.HEIGHT_INTENSITY_MAX - TerrainParameters.HEIGHT_INTENSITY_MIN));
                edgeColor.copy(TerrainParameters.HIGH_EDGE_COLOR).multiplyScalar(intensity);
                
                // Add white blend for higher elevations
                if (heightFactor > 0.5) {
                    const whiteBlend = (heightFactor - 0.5) * 0.4;
                    edgeColor.lerp(whiteColor, whiteBlend);
                }
            }
            
            // Add colors for both vertices of the edge
            edgeColors.push(
                edgeColor.r, edgeColor.g, edgeColor.b,
                edgeColor.r, edgeColor.g, edgeColor.b
            );
        }

        // Apply colors to edge geometry
        baseEdgeGeometry.setAttribute('color', new Float32BufferAttribute(edgeColors, 3));
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

    /**
     * Common noise generation method used by both base and peak height generation
     */
    private generateNoise(
        noise: SimplexNoise,
        x: number,
        z: number,
        baseFrequency: number,
        octaves: number,
        noiseConfigs: ReadonlyArray<{
            frequencyMultiplier: number,
            offset?: number,
            useAbsolute?: boolean
        }>,
        weights: readonly number[],
        amplitudeFalloff: number,
        frequencyIncrease: number
    ): number {
        let height = 0;
        let amplitude = 1;
        let frequency = baseFrequency;
        let maxAmplitude = 0;

        for (let i = 0; i < octaves; i++) {
            // Generate noise samples with different frequencies and offsets
            const noiseSamples = noiseConfigs.map(config => {
                const sampleX = x * frequency * config.frequencyMultiplier + (config.offset || 0);
                const sampleZ = z * frequency * config.frequencyMultiplier + (config.offset || 0);
                const noiseValue = noise.noise(sampleX, sampleZ);
                return config.useAbsolute ? Math.abs(noiseValue) : noiseValue;
            });

            // Weighted blend of noise samples
            const noiseValue = noiseSamples.reduce((sum, sample, index) => 
                sum + sample * weights[index], 0);
            
            height += noiseValue * amplitude;
            maxAmplitude += amplitude;
            amplitude *= amplitudeFalloff;
            frequency *= frequencyIncrease;
        }

        return height / maxAmplitude;
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

    /**
     * Generate base terrain height (angular plateaus)
     */
    private generateBaseHeight(noise: SimplexNoise, x: number, z: number): number {
        return this.generateNoise(
            noise,
            x,
            z,
            TerrainParameters.NOISE_SCALE,
            TerrainParameters.BASE_NOISE_OCTAVES,
            [
                { frequencyMultiplier: 1.0 },
                { frequencyMultiplier: 1.1, useAbsolute: true },
                { frequencyMultiplier: 0.7 }
            ],
            TerrainParameters.BASE_NOISE_WEIGHTS,
            TerrainParameters.BASE_AMPLITUDE_FALLOFF,
            TerrainParameters.BASE_FREQUENCY_INCREASE
        );
    }

    /**
     * Generate mountain peak height
     */
    private generatePeakHeight(noise: SimplexNoise, x: number, z: number): number {
        // Use the noise configurations directly from TerrainParameters
        const height = this.generateNoise(
            noise,
            x,
            z,
            TerrainParameters.NOISE_SCALE * TerrainParameters.PEAK_NOISE_FREQUENCY_MULTIPLIER,
            TerrainParameters.NOISE_OCTAVES,
            TerrainParameters.PEAK_NOISE_CONFIGS,
            TerrainParameters.PEAK_NOISE_WEIGHTS,
            TerrainParameters.PERSISTENCE,
            TerrainParameters.LACUNARITY
        );

        // Multi-stage threshold with broader transition
        const normalizedHeight = (height - TerrainParameters.PEAK_LOW_THRESHOLD) / 
            (TerrainParameters.PEAK_HIGH_THRESHOLD - TerrainParameters.PEAK_LOW_THRESHOLD);
        
        if (normalizedHeight <= 0) return 0;
        if (normalizedHeight >= 1) return 1;
        
        // Smoother transition using double smoothstep
        return this.smoothstep(this.smoothstep(normalizedHeight));
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
        if (this.shaderMaterial?.uniforms) {
            // Update camera-dependent uniforms
            this.shaderMaterial.uniforms.cameraDirection.value.copy(this.camera.position).normalize();
        }
        // Update any time-based animations or effects
        if (this.material && (this.material as any).customShader) {
            const shader = (this.material as any).customShader;
            if (shader.uniforms) {
                shader.uniforms.time = { value: time };
            }
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
} 