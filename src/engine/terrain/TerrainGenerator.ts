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
        wireframe: false,
        metalness: 0.5,
        roughness: 0.7,
        flatShading: true,
        side: DoubleSide
    });

    // Add shader customization
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
        console.log('Compiling terrain shader...');
        
        // Add custom uniforms
        shader.uniforms.sunDirection = { value: new Vector3(-1, 0.3, 0).normalize() };
        shader.uniforms.cameraDirection = { value: new Vector3() };
        shader.uniforms.gridSize = { value: gridSize };
        shader.uniforms.reflectionParams = { value: new Vector4(0.9, 0.1, 2.0, 0.8) }; // Adjusted for stronger reflections
        shader.uniforms.sunColor = { value: new Color(1.0, 0.98, 0.9) };
        shader.uniforms.sunIntensity = { value: 1.0 };

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
                float border = step(0.95, max(frac.x, frac.y)); // Thinner borders
                float variation = fract(sin(dot(grid, vec2(12.9898, 78.233))) * 43758.5453);
                return mix(1.0, 0.7, border) * (0.9 + 0.1 * variation); // Less contrast between panels
            }

            float calculateReflection() {
                vec3 normalizedNormal = normalize(vWorldNormal);
                
                // Calculate how well this surface faces the sun
                float sunFactor = max(0.0, dot(normalizedNormal, sunDirection));
                sunFactor = pow(sunFactor, 0.3); // Reduced power for wider reflection spread
                
                // Calculate view alignment with sun reflection
                vec3 reflectionDir = reflect(-sunDirection, normalizedNormal); // Negate sun direction for correct reflection
                float viewFactor = max(0.0, dot(normalize(cameraDirection), reflectionDir));
                viewFactor = pow(viewFactor, 0.7); // Adjusted power for better visibility
                
                // Position-based falloff (stronger in west)
                float distanceFromWest = (vWorldPosition.x + 2000.0) / 4000.0;
                float positionFactor = smoothstep(0.0, reflectionParams.z, 1.0 - distanceFromWest);
                
                // Panel effect
                float panelFactor = getPanelFactor();
                
                // Height-based factor (stronger on flatter areas)
                float heightFactor = 1.0 - abs(normalizedNormal.y);
                heightFactor = pow(heightFactor, 0.1); // Reduced power for more consistent effect
                
                // Calculate grazing angle effect
                float grazingFactor = pow(1.0 - abs(dot(normalizedNormal, cameraDirection)), 0.5);
                
                // Combine all factors with adjusted weights
                float totalFactor = pow(
                    viewFactor * 3.0 + // Increased view factor weight
                    sunFactor * 2.5 +  // Increased sun factor weight
                    positionFactor * 1.0 + // Reduced position factor weight
                    panelFactor * 0.3 + // Slightly increased panel factor weight
                    grazingFactor * heightFactor * 2.0, // Increased grazing effect
                    reflectionParams.w
                );
                
                // Apply sun intensity with minimum threshold
                return max(0.4, totalFactor * sunIntensity); // Increased minimum threshold
            }`
        );

        // Modify material properties based on reflection
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float reflectionStrength = calculateReflection();
            
            // Add sun color to diffuse with panel variation
            vec3 reflectionColor = sunColor * reflectionStrength;
            diffuseColor.rgb = mix(diffuseColor.rgb, reflectionColor, reflectionStrength * 2.0); // Increased reflection blend`
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
    private readonly heightScale: number = 800;
    private readonly noiseScale: number = 0.001;
    private readonly noiseOctaves: number = 8;
    private readonly persistence: number = 0.65;
    private readonly lacunarity: number = 1.6;
    private mesh: Mesh | null = null;
    private camera: PerspectiveCamera;
    private scene: Scene;
    private material: Material | null = null;
    private noiseTexture: Texture | null = null;
    private terrainMesh: Mesh | null = null;

    // Color settings
    private readonly baseColor = new Color(0x000033);
    private readonly peakColor = new Color(0x3366ff);
    private readonly lowEdgeColor = new Color(0xff6600);  // Orange for low heights
    private readonly highEdgeColor = new Color(0x00ff00); // Green for high heights

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

    private createCoordinateSprite(text: string, color: string = '#ff6600'): Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');
        
        // Increased canvas size for better text resolution
        canvas.width = 256;
        canvas.height = 128;
        
        context.fillStyle = 'transparent';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add a semi-transparent background for better readability
        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Adjusted font settings
        context.font = 'bold 48px Arial';
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
            opacity: 0.9  // Slightly increased opacity
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
                const baseHeight = this.generateBaseHeight(noise, xPos * 0.3, zPos * 0.3);
                
                // Generate mountain peaks
                const peakHeight = this.generatePeakHeight(noise, xPos, zPos);
                
                // Combine heights with angular transition
                const rawHeight = baseHeight * 0.3 + peakHeight * 0.7;
                
                // Apply angular transformation
                const height = this.angularizeHeight(rawHeight) * this.heightScale;
                
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
                color.copy(this.baseColor).lerp(this.peakColor, normalizedHeight);
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
        const material = new MeshStandardMaterial({
            vertexColors: true,
            wireframe: false,
            metalness: 0.6,  // Reduced from 0.8
            roughness: 0.4,  // Increased from 0.2
            flatShading: true,
            side: DoubleSide,
            envMapIntensity: 0.8  // Reduced from 1.0
        });

        const mesh = new Mesh(geometry, material);
        let shaderReady = false;

        // Add shader customization
        material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
            console.log('Compiling terrain shader...');
            
            // Add custom uniforms
            shader.uniforms.sunDirection = { value: new Vector3(-1, 0.3, 0).normalize() };
            shader.uniforms.cameraDirection = { value: new Vector3() };
            shader.uniforms.gridSize = { value: totalSize };
            shader.uniforms.reflectionParams = { value: new Vector4(0.7, 0.2, 2.0, 0.6) };  // Adjusted reflection parameters
            shader.uniforms.sunColor = { value: new Color(1.0, 0.98, 0.9) };
            shader.uniforms.sunIntensity = { value: 0.8 };  // Reduced from 1.0

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
                    float border = step(0.95, max(frac.x, frac.y));
                    float variation = fract(sin(dot(grid, vec2(12.9898, 78.233))) * 43758.5453);
                    return mix(1.0, 0.7, border) * (0.9 + 0.1 * variation);
                }

                float calculateReflection() {
                    vec3 normalizedNormal = normalize(vWorldNormal);
                    
                    // Calculate how well this surface faces the sun
                    float sunFactor = max(0.0, dot(normalizedNormal, sunDirection));
                    sunFactor = pow(sunFactor, 0.4); // Increased power for more focused reflections
                    
                    // Calculate view alignment with sun reflection
                    vec3 reflectionDir = reflect(-sunDirection, normalizedNormal);
                    float viewFactor = max(0.0, dot(normalize(cameraDirection), reflectionDir));
                    viewFactor = pow(viewFactor, 0.8); // Increased power for sharper reflections
                    
                    // Position-based falloff (stronger in west)
                    float distanceFromWest = (vWorldPosition.x + 2000.0) / 4000.0;
                    float positionFactor = smoothstep(0.0, reflectionParams.z, 1.0 - distanceFromWest);
                    
                    // Panel effect
                    float panelFactor = getPanelFactor();
                    
                    // Height-based factor (stronger on flatter areas)
                    float heightFactor = 1.0 - abs(normalizedNormal.y);
                    heightFactor = pow(heightFactor, 0.2); // Increased power for more contrast
                    
                    // Calculate grazing angle effect
                    float grazingFactor = pow(1.0 - abs(dot(normalizedNormal, cameraDirection)), 0.6);
                    
                    // Combine all factors with adjusted weights
                    float totalFactor = pow(
                        viewFactor * 2.5 + // Reduced from 3.0
                        sunFactor * 2.0 +  // Reduced from 2.5
                        positionFactor * 0.8 + // Reduced from 1.0
                        panelFactor * 0.2 + // Reduced from 0.3
                        grazingFactor * heightFactor * 1.5, // Reduced from 2.0
                        reflectionParams.w
                    );
                    
                    // Apply sun intensity with lower minimum threshold
                    return max(0.2, totalFactor * sunIntensity); // Reduced minimum from 0.4
                }`
            );

            // Modify material properties based on reflection
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `#include <color_fragment>
                float reflectionStrength = calculateReflection();
                
                // Add sun color to diffuse with panel variation
                vec3 reflectionColor = sunColor * reflectionStrength;
                diffuseColor.rgb = mix(diffuseColor.rgb, reflectionColor, reflectionStrength * 2.0); // Increased reflection blend`
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
            shaderReady = true;
            console.log('Terrain shader compiled successfully');
        };

        // Base terrain edges with enhanced gradient
        const baseEdgeGeometry = new EdgesGeometry(geometry, 0.1);
        const baseEdgeMaterial = new LineBasicMaterial({ 
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
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
            
            if (normalizedHeight < 0.15) { // Reduced orange zone to just the flattest areas
                // Low terrain - orange color
                edgeColor.copy(this.lowEdgeColor);
                // Adjust opacity based on grid alignment
                const x1 = edgePositions[i];
                const z1 = edgePositions[i + 2];
                const x2 = edgePositions[i + 3];
                const z2 = edgePositions[i + 5];
                const isAligned = Math.abs(x1 - x2) < 0.1 || Math.abs(z1 - z2) < 0.1;
                const intensity = isAligned ? 1.0 : 0.15; // More contrast between aligned and non-aligned
                edgeColor.multiplyScalar(intensity);
            } else if (normalizedHeight < 0.2) { // Shorter transition zone
                // Quick transition zone - blend between orange and green
                const t = (normalizedHeight - 0.15) / 0.05;
                edgeColor.copy(this.lowEdgeColor).lerp(this.highEdgeColor, t);
                // Apply intensity based on height
                const intensity = 0.3 + (t * 0.7);
                edgeColor.multiplyScalar(intensity);
            } else {
                // Rest of terrain - green with increasing intensity
                const heightFactor = (normalizedHeight - 0.2) / 0.8; // Normalize remaining range
                const intensity = 0.4 + (heightFactor * 1.2); // Start at 0.4, go up to 1.6 intensity
                edgeColor.copy(this.highEdgeColor).multiplyScalar(intensity);
                
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

        // Add update method for reflection
        let lastDebugString = '';
        
        (mesh as any).updateReflection = (camera: Camera) => {
            if (!shaderReady) {
                return; // Skip update if shader isn't ready
            }

            if (!camera || !(material as any).customShader) {
                console.warn('Missing camera or shader in updateReflection');
                return;
            }
            
            const shader = (material as any).customShader;
            const cameraDirection = new Vector3();
            camera.getWorldDirection(cameraDirection);
            
            // Get sun direction from lighting system
            const lightingSystem = (window as any).game?.lightingSystem;
            if (lightingSystem) {
                const sunLight = lightingSystem.sunLight;
                const sunDirection = new Vector3();
                sunLight.getWorldDirection(sunDirection);
                // Don't negate the direction - we want the direction the light is coming FROM
                shader.uniforms.sunDirection.value.copy(sunDirection);
                
                // Update sun intensity
                shader.uniforms.sunIntensity.value = sunLight.intensity;
                
                // Update sun color
                shader.uniforms.sunColor.value.copy(sunLight.color);
            } else {
                console.warn('Lighting system not found');
            }
            
            shader.uniforms.cameraDirection.value.copy(cameraDirection);
            
            // Debug output
            const sunDirection = shader.uniforms.sunDirection.value;
            const reflectionParams = shader.uniforms.reflectionParams.value;
            
            const debugInfo = {
                camera: {
                    position: camera.position,
                    direction: cameraDirection,
                    facing: getCardinalDirection(cameraDirection),
                    dotWithSun: cameraDirection.dot(sunDirection).toFixed(3)
                },
                sun: {
                    direction: sunDirection,
                    height: sunDirection.y.toFixed(3),
                    intensity: shader.uniforms.sunIntensity.value.toFixed(3)
                },
                reflection: {
                    intensity: reflectionParams.x.toFixed(3),
                    falloff: reflectionParams.y.toFixed(3),
                    length: reflectionParams.z.toFixed(3)
                }
            };
            
            const debugString = JSON.stringify(debugInfo, null, 2);
            
            if (debugString !== lastDebugString) {
                console.clear();
                console.log('=== Reflection Debug ===');
                console.log(debugInfo);
                lastDebugString = debugString;
            }
        };

        // Helper function to get cardinal direction
        const getCardinalDirection = (dir: Vector3): string => {
            const x = dir.x;
            const z = dir.z;
            const absX = Math.abs(x);
            const absZ = Math.abs(z);
            
            if (absX > absZ) {
                return x > 0 ? 'East' : 'West';
            } else {
                return z > 0 ? 'South' : 'North';
            }
        };

        // Compute vertex normals for reflection calculations
        geometry.computeVertexNormals();

        // Add coordinate markers
        const halfSize = totalSize / 2;
        const markerOffset = 150; // Increased height offset for better visibility
        
        // Cardinal directions with coordinates
        const markers = [
            { pos: [halfSize, 0, 0], text: 'E\n(2000,0)', color: '#ff9933' },
            { pos: [-halfSize, 0, 0], text: 'W\n(-2000,0)', color: '#ff9933' },
            { pos: [0, 0, halfSize], text: 'S\n(0,2000)', color: '#ff9933' },
            { pos: [0, 0, -halfSize], text: 'N\n(0,-2000)', color: '#ff9933' },
            // Corner coordinates with line breaks for better readability
            { pos: [halfSize, 0, halfSize], text: 'SE\n(2000,2000)', color: '#33ff33' },
            { pos: [-halfSize, 0, halfSize], text: 'SW\n(-2000,2000)', color: '#33ff33' },
            { pos: [halfSize, 0, -halfSize], text: 'NE\n(2000,-2000)', color: '#33ff33' },
            { pos: [-halfSize, 0, -halfSize], text: 'NW\n(-2000,-2000)', color: '#33ff33' }
        ];

        markers.forEach(marker => {
            const sprite = this.createCoordinateSprite(marker.text, marker.color);
            const [x, y, z] = marker.pos;
            sprite.position.set(x, markerOffset, z);
            // Adjusted scale for better visibility while maintaining readability
            sprite.scale.set(300, 150, 1);
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
        let frequency = this.noiseScale;
        let maxAmplitude = 0;

        for (let i = 0; i < 6; i++) {
            // Use multiple noise patterns for smoother terrain
            const n1 = noise.noise(x * frequency, z * frequency);
            const n2 = Math.abs(noise.noise(x * frequency * 1.1, z * frequency * 1.1));
            const n3 = noise.noise(x * frequency * 0.7, z * frequency * 0.7);
            
            // Blend for smoother transitions while maintaining some angularity
            const noiseValue = (
                n1 * 0.4 +     // Regular noise for basic shape
                n2 * 0.4 +     // Absolute noise for angular features
                n3 * 0.2       // Lower frequency for broader variations
            );
            
            height += noiseValue * amplitude;
            maxAmplitude += amplitude;
            amplitude *= 0.7;  // Slower amplitude falloff
            frequency *= 1.6;  // Slower frequency increase
        }

        return (height / maxAmplitude);
    }

    /**
     * Generate mountain peak height
     */
    private generatePeakHeight(noise: SimplexNoise, x: number, z: number): number {
        let height = 0;
        let amplitude = 1;
        let frequency = this.noiseScale * 1.2; // Reduced for more gradual peaks
        let maxAmplitude = 0;

        for (let i = 0; i < this.noiseOctaves; i++) {
            // Use multiple noise patterns with broader frequency range
            const n1 = noise.noise(x * frequency + 1000, z * frequency + 1000);
            const n2 = Math.abs(noise.noise(x * frequency * 0.8, z * frequency * 0.8));
            const n3 = noise.noise(x * frequency * 0.4 + 2000, z * frequency * 0.4 + 2000);
            const n4 = Math.abs(noise.noise(x * frequency * 0.2 + 3000, z * frequency * 0.2 + 3000));
            
            // Weighted blend favoring broader features
            const noiseValue = (
                n1 * 0.2 +     // Medium frequency
                n2 * 0.2 +     // Medium-low frequency absolute
                n3 * 0.3 +     // Low frequency for broader features
                n4 * 0.3       // Very low frequency for gradual changes
            );
            
            height += noiseValue * amplitude;
            maxAmplitude += amplitude;
            amplitude *= this.persistence;
            frequency *= this.lacunarity;
        }

        // Multi-stage threshold with broader transition
        height = (height / maxAmplitude);
        const lowThreshold = 0.25;
        const highThreshold = 0.6;
        const normalizedHeight = (height - lowThreshold) / (highThreshold - lowThreshold);
        
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
        const steps = 20;
        const steppedHeight = Math.floor(height * steps) / steps;
        
        // Use smoothstep function for more natural transitions between steps
        const smoothstep = (x: number): number => {
            x = Math.max(0, Math.min(1, x));
            return x * x * (3 - 2 * x);
        };
        
        // Calculate blend factor based on height to vary angularity
        const heightFactor = smoothstep(height);
        const blend = 0.3 + heightFactor * 0.2; // More angular at peaks
        
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