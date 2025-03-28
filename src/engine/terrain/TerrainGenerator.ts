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
    Texture
} from 'three';
import { GridSystem } from './GridSystem';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise';
import { TerrainParameters, ReflectionParameters, CoordinateMarkerParameters } from '../config/GameParameters';

// Define the shader parameter type that Three.js uses
interface WebGLProgramParametersWithUniforms {
    uniforms: { [uniform: string]: { value: any } };
    vertexShader: string;
    fragmentShader: string;
}

// Create base material for the terrain
const createTerrainMaterial = (gridSize: number) => {
    const material = new MeshStandardMaterial({
        vertexColors: true,
        wireframe: TerrainParameters.USE_WIREFRAME,
        metalness: TerrainParameters.MATERIAL_METALNESS,
        roughness: TerrainParameters.MATERIAL_ROUGHNESS,
        flatShading: TerrainParameters.USE_FLAT_SHADING,
        side: DoubleSide
    });

    // Add shader customization
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
        console.log('Compiling terrain shader...');
        
        // Add custom uniforms
        shader.uniforms.sunDirection = { value: new Vector3(-1, 0.3, 0).normalize() };
        shader.uniforms.cameraDirection = { value: new Vector3() };
        shader.uniforms.gridSize = { value: gridSize };
        shader.uniforms.reflectionParams = { value: ReflectionParameters.REFLECTION_PARAMS };
        shader.uniforms.sunColor = { value: new Color(1.0, 0.98, 0.9) };
        shader.uniforms.sunIntensity = { value: ReflectionParameters.SUN_INTENSITY };

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
            uniform float sunIntensity;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec2 vGridPosition;

            float getPanelFactor() {
                vec2 grid = floor(vGridPosition);
                vec2 frac = fract(vGridPosition);
                float border = step(${TerrainParameters.PANEL_BORDER_WIDTH.toFixed(2)}, max(frac.x, frac.y));
                float variation = fract(sin(dot(grid, vec2(12.9898, 78.233))) * 43758.5453);
                return mix(1.0, 0.7, border) * (0.9 + ${TerrainParameters.PANEL_VARIATION.toFixed(2)} * variation);
            }

            float calculateReflection() {
                vec3 normalizedNormal = normalize(vWorldNormal);
                
                // Calculate how well this surface faces the sun
                float sunFactor = max(0.0, dot(normalizedNormal, sunDirection));
                sunFactor = pow(sunFactor, ${ReflectionParameters.SUN_FACTOR_POWER.toFixed(2)});
                
                // Calculate view alignment with sun reflection
                vec3 reflectionDir = reflect(-sunDirection, normalizedNormal);
                float viewFactor = max(0.0, dot(normalize(cameraDirection), reflectionDir));
                viewFactor = pow(viewFactor, ${ReflectionParameters.VIEW_FACTOR_POWER.toFixed(2)});
                
                // Position-based falloff (stronger in west)
                float distanceFromWest = (vWorldPosition.x + ${ReflectionParameters.WEST_FALLOFF_START.toFixed(1)}) / ${ReflectionParameters.WEST_FALLOFF_LENGTH.toFixed(1)};
                float positionFactor = smoothstep(0.0, reflectionParams.z, 1.0 - distanceFromWest);
                
                // Panel effect
                float panelFactor = getPanelFactor();
                
                // Height-based factor (stronger on flatter areas)
                float heightFactor = 1.0 - abs(normalizedNormal.y);
                heightFactor = pow(heightFactor, ${ReflectionParameters.HEIGHT_FACTOR_POWER.toFixed(2)});
                
                // Calculate grazing angle effect
                float grazingFactor = pow(1.0 - abs(dot(normalizedNormal, cameraDirection)), ${ReflectionParameters.GRAZING_FACTOR_POWER.toFixed(2)});
                
                // Combine all factors with adjusted weights
                float totalFactor = pow(
                    viewFactor * ${ReflectionParameters.VIEW_FACTOR_WEIGHT.toFixed(1)} +
                    sunFactor * ${ReflectionParameters.SUN_FACTOR_WEIGHT.toFixed(1)} +
                    positionFactor * ${ReflectionParameters.POSITION_FACTOR_WEIGHT.toFixed(1)} +
                    panelFactor * ${ReflectionParameters.PANEL_FACTOR_WEIGHT.toFixed(1)} +
                    grazingFactor * heightFactor * ${ReflectionParameters.GRAZING_FACTOR_WEIGHT.toFixed(1)},
                    reflectionParams.w
                );
                
                // Apply sun intensity with minimum threshold
                return max(${ReflectionParameters.MIN_REFLECTION.toFixed(2)}, totalFactor * sunIntensity);
            }`
        );

        // Modify material properties based on reflection
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float reflectionStrength = calculateReflection();
            
            // Add sun color to diffuse with panel variation
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
};

export class TerrainGenerator {
    private readonly gridSystem: GridSystem;
    private readonly camera: PerspectiveCamera;
    private readonly scene: Scene;
    private material: Material | null = null;
    private noiseTexture: Texture | null = null;
    private terrainMesh: Mesh | null = null;

    constructor(scene: Scene, gridSystem: GridSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.camera = gridSystem.getCamera();
        this.initialize();
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
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');
        
        // Increased canvas size for better text resolution
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = 'transparent';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add a semi-transparent background for better readability
        context.fillStyle = `rgba(0, 0, 0, ${CoordinateMarkerParameters.BACKGROUND_OPACITY})`;
        context.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Adjusted font settings
        context.font = `${CoordinateMarkerParameters.FONT_WEIGHT} ${CoordinateMarkerParameters.FONT_SIZE}px ${CoordinateMarkerParameters.FONT_FAMILY}`;
        context.fillStyle = color;
        context.strokeStyle = '#000000';
        context.lineWidth = 3;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Draw text with outline for better visibility
        context.strokeText(text, canvas.width/2, canvas.height/2);
        context.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new CanvasTexture(canvas);
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        
        const spriteMaterial = new SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: CoordinateMarkerParameters.OPACITY
        });
        
        return new Sprite(spriteMaterial);
    }

    /**
     * Generate terrain mesh
     */
    public async generate(): Promise<Mesh> {
        // Create geometry
        const geometry = new BufferGeometry();
        const totalSize = this.gridSystem.getTotalSize();
        const divisions = this.gridSystem.getGridDivisions() * 2; // Double the divisions
        const segmentSize = totalSize / divisions;

        // Generate vertices
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];
        const heightData: number[] = [];

        // Generate height data
        const noise = new SimplexNoise();
        let minHeight = Infinity;
        let maxHeight = -Infinity;

        // First pass: Generate heights and find min/max
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const xPos = (x - divisions / 2) * segmentSize;
                const zPos = (z - divisions / 2) * segmentSize;
                
                // Generate base terrain (angular plateaus)
                const baseHeight = this.generateBaseHeight(noise, xPos * TerrainParameters.BASE_NOISE_FREQUENCY, zPos * TerrainParameters.BASE_NOISE_FREQUENCY);
                
                // Generate mountain peaks
                const peakHeight = this.generatePeakHeight(noise, xPos, zPos);
                
                // Combine heights with angular transition
                const rawHeight = baseHeight * 0.3 + peakHeight * 0.7;
                
                // Apply angular transformation
                const height = this.angularizeHeight(rawHeight) * TerrainParameters.HEIGHT_SCALE;
                
                heightData.push(height);
                minHeight = Math.min(minHeight, height);
                maxHeight = Math.max(maxHeight, height);
            }
        }

        // Second pass: Generate vertices and colors with normalized heights
        let idx = 0;
        for (let z = 0; z <= divisions; z++) {
            for (let x = 0; x <= divisions; x++) {
                const xPos = (x - divisions / 2) * segmentSize;
                const zPos = (z - divisions / 2) * segmentSize;
                const height = heightData[idx];
                
                // Normalize height for color interpolation with increased contrast
                const normalizedHeight = Math.pow((height - minHeight) / (maxHeight - minHeight), 1.2);
                
                vertices.push(xPos, height, zPos);
                
                // Interpolate between base and peak color based on height
                const color = new Color();
                color.copy(TerrainParameters.BASE_COLOR).lerp(TerrainParameters.PEAK_COLOR, normalizedHeight);
                colors.push(color.r, color.g, color.b);
                uvs.push(x / divisions, z / divisions);
                idx++;
            }
        }

        // Generate indices for triangles
        for (let z = 0; z < divisions; z++) {
            for (let x = 0; x < divisions; x++) {
                const a = x + (divisions + 1) * z;
                const b = x + (divisions + 1) * (z + 1);
                const c = (x + 1) + (divisions + 1) * z;
                const d = (x + 1) + (divisions + 1) * (z + 1);

                indices.push(a, b, c);
                indices.push(c, b, d);
            }
        }

        // Add attributes to geometry
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
        geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);

        // Create main terrain mesh with standard material
        const material = createTerrainMaterial(totalSize);
        const mesh = new Mesh(geometry, material);

        // Base terrain edges with enhanced gradient
        const baseEdgeGeometry = new EdgesGeometry(geometry, 0.1);
        const baseEdgeMaterial = new LineBasicMaterial({ 
            vertexColors: true,
            transparent: true,
            opacity: TerrainParameters.EDGE_OPACITY,
            blending: AdditiveBlending,
            depthWrite: false
        });
        const baseEdges = new LineSegments(baseEdgeGeometry, baseEdgeMaterial);

        // Create color array for edge vertices based on height
        const edgeColors: number[] = [];
        const edgePositions = baseEdgeGeometry.attributes.position.array;
        for (let i = 0; i < edgePositions.length; i += 6) {
            const y1 = edgePositions[i + 1];
            const y2 = edgePositions[i + 4];
            const avgHeight = (y1 + y2) / 2;
            
            // Normalize height and create color gradient
            const normalizedHeight = (avgHeight - minHeight) / (maxHeight - minHeight);
            const edgeColor = new Color();
            
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
                // Quick transition zone - blend between orange and green
                const t = (normalizedHeight - TerrainParameters.LOW_HEIGHT_THRESHOLD) / (TerrainParameters.TRANSITION_THRESHOLD - TerrainParameters.LOW_HEIGHT_THRESHOLD);
                edgeColor.copy(TerrainParameters.LOW_EDGE_COLOR).lerp(TerrainParameters.HIGH_EDGE_COLOR, t);
                // Apply intensity based on height
                const intensity = TerrainParameters.HEIGHT_INTENSITY_MIN + (t * (TerrainParameters.HEIGHT_INTENSITY_MAX - TerrainParameters.HEIGHT_INTENSITY_MIN));
                edgeColor.multiplyScalar(intensity);
            } else {
                // Rest of terrain - green with increasing intensity
                const heightFactor = (normalizedHeight - TerrainParameters.TRANSITION_THRESHOLD) / (1 - TerrainParameters.TRANSITION_THRESHOLD);
                const intensity = TerrainParameters.HEIGHT_INTENSITY_MIN + (heightFactor * (TerrainParameters.HEIGHT_INTENSITY_MAX - TerrainParameters.HEIGHT_INTENSITY_MIN));
                edgeColor.copy(TerrainParameters.HIGH_EDGE_COLOR).multiplyScalar(intensity);
                
                // Add slight color shift towards white for higher elevations
                if (heightFactor > 0.5) {
                    const whiteBlend = (heightFactor - 0.5) * 0.4;
                    edgeColor.lerp(new Color(0xffffff), whiteBlend);
                }
            }
            
            // Add colors for both vertices of the edge
            edgeColors.push(
                edgeColor.r, edgeColor.g, edgeColor.b,
                edgeColor.r, edgeColor.g, edgeColor.b
            );
        }

        // Apply colors to base edges
        baseEdgeGeometry.setAttribute('color', new Float32BufferAttribute(edgeColors, 3));
        mesh.add(baseEdges);

        // Add coordinate markers
        const halfSize = totalSize / 2;
        const markerOffset = CoordinateMarkerParameters.HEIGHT_OFFSET;
        
        // Cardinal directions with coordinates
        const markers = [
            { pos: [halfSize, 0, 0], text: 'E\n(2000,0)', color: CoordinateMarkerParameters.CARDINAL_COLOR },
            { pos: [-halfSize, 0, 0], text: 'W\n(-2000,0)', color: CoordinateMarkerParameters.CARDINAL_COLOR },
            { pos: [0, 0, halfSize], text: 'S\n(0,2000)', color: CoordinateMarkerParameters.CARDINAL_COLOR },
            { pos: [0, 0, -halfSize], text: 'N\n(0,-2000)', color: CoordinateMarkerParameters.CARDINAL_COLOR },
            // Corner coordinates with line breaks for better readability
            { pos: [halfSize, 0, halfSize], text: 'SE\n(2000,2000)', color: CoordinateMarkerParameters.CORNER_COLOR },
            { pos: [-halfSize, 0, halfSize], text: 'SW\n(-2000,2000)', color: CoordinateMarkerParameters.CORNER_COLOR },
            { pos: [halfSize, 0, -halfSize], text: 'NE\n(2000,-2000)', color: CoordinateMarkerParameters.CORNER_COLOR },
            { pos: [-halfSize, 0, -halfSize], text: 'NW\n(-2000,-2000)', color: CoordinateMarkerParameters.CORNER_COLOR }
        ];

        markers.forEach(marker => {
            const sprite = this.createCoordinateSprite(marker.text, marker.color);
            const [x, y, z] = marker.pos;
            sprite.position.set(x, markerOffset, z);
            sprite.scale.copy(CoordinateMarkerParameters.SCALE);
            mesh.add(sprite);
        });

        return mesh;
    }

    /**
     * Generate base terrain height (angular plateaus)
     */
    private generateBaseHeight(noise: SimplexNoise, x: number, z: number): number {
        let height = 0;
        let amplitude = 1;
        let frequency = TerrainParameters.NOISE_SCALE;
        let maxAmplitude = 0;

        for (let i = 0; i < TerrainParameters.BASE_NOISE_OCTAVES; i++) {
            // Use multiple noise patterns for smoother terrain
            const n1 = noise.noise(x * frequency, z * frequency);
            const n2 = Math.abs(noise.noise(x * frequency * 1.1, z * frequency * 1.1));
            const n3 = noise.noise(x * frequency * 0.7, z * frequency * 0.7);
            
            // Blend for smoother transitions while maintaining some angularity
            const noiseValue = (
                n1 * TerrainParameters.BASE_NOISE_WEIGHTS[0] +
                n2 * TerrainParameters.BASE_NOISE_WEIGHTS[1] +
                n3 * TerrainParameters.BASE_NOISE_WEIGHTS[2]
            );
            
            height += noiseValue * amplitude;
            maxAmplitude += amplitude;
            amplitude *= TerrainParameters.BASE_AMPLITUDE_FALLOFF;
            frequency *= TerrainParameters.BASE_FREQUENCY_INCREASE;
        }

        return (height / maxAmplitude);
    }

    /**
     * Generate mountain peak height
     */
    private generatePeakHeight(noise: SimplexNoise, x: number, z: number): number {
        let height = 0;
        let amplitude = 1;
        let frequency = TerrainParameters.NOISE_SCALE * TerrainParameters.PEAK_NOISE_FREQUENCY_MULTIPLIER;
        let maxAmplitude = 0;

        for (let i = 0; i < TerrainParameters.NOISE_OCTAVES; i++) {
            // Use multiple noise patterns with broader frequency range
            const n1 = noise.noise(x * frequency + 1000, z * frequency + 1000);
            const n2 = Math.abs(noise.noise(x * frequency * 0.8, z * frequency * 0.8));
            const n3 = noise.noise(x * frequency * 0.4 + 2000, z * frequency * 0.4 + 2000);
            const n4 = Math.abs(noise.noise(x * frequency * 0.2 + 3000, z * frequency * 0.2 + 3000));
            
            // Weighted blend favoring broader features
            const noiseValue = (
                n1 * TerrainParameters.PEAK_NOISE_WEIGHTS[0] +
                n2 * TerrainParameters.PEAK_NOISE_WEIGHTS[1] +
                n3 * TerrainParameters.PEAK_NOISE_WEIGHTS[2] +
                n4 * TerrainParameters.PEAK_NOISE_WEIGHTS[3]
            );
            
            height += noiseValue * amplitude;
            maxAmplitude += amplitude;
            amplitude *= TerrainParameters.PERSISTENCE;
            frequency *= TerrainParameters.LACUNARITY;
        }

        // Multi-stage threshold with broader transition
        height = (height / maxAmplitude);
        const normalizedHeight = (height - TerrainParameters.PEAK_LOW_THRESHOLD) / (TerrainParameters.PEAK_HIGH_THRESHOLD - TerrainParameters.PEAK_LOW_THRESHOLD);
        
        if (normalizedHeight <= 0) return 0;
        if (normalizedHeight >= 1) return 1;
        
        // Smoother transition using double smoothstep
        const smoothstep = (x: number): number => {
            x = Math.max(0, Math.min(1, x));
            return x * x * (3 - 2 * x);
        };
        return smoothstep(smoothstep(normalizedHeight));
    }

    /**
     * Transform height value to create more angular terrain
     */
    private angularizeHeight(height: number): number {
        // Increased steps for more subtle transitions
        const steppedHeight = Math.floor(height * TerrainParameters.ANGULAR_STEPS) / TerrainParameters.ANGULAR_STEPS;
        
        // Use smoothstep function for more natural transitions between steps
        const smoothstep = (x: number): number => {
            x = Math.max(0, Math.min(1, x));
            return x * x * (3 - 2 * x);
        };
        
        // Calculate blend factor based on height to vary angularity
        const heightFactor = smoothstep(height);
        const blend = TerrainParameters.MIN_ANGULAR_BLEND + heightFactor * (TerrainParameters.MAX_ANGULAR_BLEND - TerrainParameters.MIN_ANGULAR_BLEND);
        
        return height * (1 - blend) + steppedHeight * blend;
    }

    public update(time: number): void {
        // Update any time-based animations or effects
        if (this.material && (this.material as any).customShader) {
            const shader = (this.material as any).customShader;
            if (shader.uniforms) {
                shader.uniforms.time = { value: time };
            }
        }
    }

    public dispose(): void {
        if (this.material instanceof Material) {
            this.material.dispose();
        }
        if (this.noiseTexture) {
            this.noiseTexture.dispose();
        }
        if (this.terrainMesh) {
            this.terrainMesh.geometry.dispose();
            if (this.terrainMesh.material instanceof Material) {
                this.terrainMesh.material.dispose();
            }
        }
    }
} 