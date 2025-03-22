import * as THREE from 'three';
import { GridSystem } from './GridSystem';

export class TerrainGenerator {
    private scene: THREE.Scene;
    private gridSystem: GridSystem;
    private noiseTexture: THREE.DataTexture | null = null;
    private terrainMesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private seed: number = Math.random() * 1000000;
    private readonly noiseSize: number = 4096;
    private readonly cellsPerChunk: number = 32;
    private readonly chunkSize: number;
    private p: number[] = [];  // Permutation table for noise generation
    private sunLightPosition: THREE.Vector3;

    constructor(scene: THREE.Scene, gridSystem: GridSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.chunkSize = gridSystem.getCellSize();
        this.sunLightPosition = new THREE.Vector3(100, 100, -100);
        
        // Get camera from scene's userData
        const camera = this.scene.userData.camera as THREE.Camera;
        if (camera) {
            camera.layers.enable(0);  // Terrain layer
            console.log('Using camera from scene userData:', {
                layers: camera.layers,
                camera: camera
            });
        } else {
            console.warn('No camera found in scene userData');
        }
        
        this.initialize();
    }

    private initialize(): void {
        // Create noise texture first
        this.createNoiseTexture();
        
        // Create terrain material
        this.createTerrainMaterial();
        
        // Generate terrain
        this.generateTerrain();
    }

    private createNoiseTexture(): void {
        const data = new Float32Array(this.noiseSize * this.noiseSize);
        
        // Simple Perlin-like noise implementation
        const noise = (x: number, y: number): number => {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;
            
            x -= Math.floor(x);
            y -= Math.floor(y);
            
            const u = this.fade(x);
            const v = this.fade(y);
            
            const A = this.p[X] + Y;
            const B = this.p[X + 1] + Y;
            
            return this.lerp(
                v,
                this.lerp(
                    u,
                    this.grad(this.p[A], x, y),
                    this.grad(this.p[B], x - 1, y)
                ),
                this.lerp(
                    u,
                    this.grad(this.p[A + 1], x, y - 1),
                    this.grad(this.p[B + 1], x - 1, y - 1)
                )
            );
        };
        
        // Generate permutation table
        this.p = new Array(512);
        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
        for (let i = 0; i < 256; i++) {
            this.p[i + 256] = this.p[i];
        }
        
        // Generate noise data with multiple octaves
        for (let i = 0; i < this.noiseSize; i++) {
            for (let j = 0; j < this.noiseSize; j++) {
                let value = 0;
                let amplitude = 1;
                let frequency = 1;
                
                // Add multiple octaves of noise
                for (let octave = 0; octave < 4; octave++) {
                    const x = (i / this.noiseSize) * 8 * frequency;
                    const y = (j / this.noiseSize) * 8 * frequency;
                    value += noise(x, y) * amplitude;
                    amplitude *= 0.5;
                    frequency *= 2;
                }
                
                // Normalize and scale the value
                value = (value + 1) / 2;
                value = Math.pow(value, 1.5); // Add some contrast
                data[i * this.noiseSize + j] = value;
            }
        }

        this.noiseTexture = new THREE.DataTexture(
            data,
            this.noiseSize,
            this.noiseSize,
            THREE.RedFormat,
            THREE.FloatType
        );
        this.noiseTexture.needsUpdate = true;
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number): number {
        const h = hash & 7;
        const grad = 1 + (h & 3);
        return ((h & 4) ? -grad : grad) * x + ((h & 4) ? -grad : grad) * y;
    }

    private createTerrainMaterial(): void {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                faceColor: { value: new THREE.Color(0x020205) },
                edgeColorGround: { value: new THREE.Color(0xff6600) },
                edgeColorHeight: { value: new THREE.Color(0x88ff22) },
                coreColorGround: { value: new THREE.Color(0xfff7b1) },
                coreColorHeight: { value: new THREE.Color(0xe8ffd8) },
                glowIntensity: { value: 0.4 },
                groundGlowIntensity: { value: 0.85 },
                cellSize: { value: this.chunkSize },
                time: { value: 0.0 },
                highlightColor: { value: new THREE.Color(0xff6600) },
                sheenColor: { value: new THREE.Color(0xff00ff) },
                sunPosition: { value: this.sunLightPosition.clone() },
                sunIntensity: { value: 12.0 },
                shadowSoftness: { value: 0.3 },
                shadowIntensity: { value: 0.95 },
                sheenIntensity: { value: 0.8 },
                glowFalloff: { value: 0.0001 },
                lightColor: { value: new THREE.Color(0xffffff) }
            },
            vertexShader: `
                attribute vec3 barycentric;
                uniform vec3 sunPosition;
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vBarycentric;
                varying vec3 vViewDir;
                varying vec3 vSunDir;
                varying float vSunDistance;
                varying float vHeight;
                varying vec3 vWorldNormal;
                
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vPosition = worldPosition.xyz;
                    vHeight = position.y;
                    
                    // Correctly transform normal to world space
                    mat3 normalMatrix = transpose(inverse(mat3(modelMatrix)));
                    vWorldNormal = normalize(normalMatrix * normal);
                    vNormal = vWorldNormal;  // Use world space normal
                    
                    vBarycentric = barycentric;
                    
                    // Calculate view direction in world space
                    vViewDir = normalize(cameraPosition - worldPosition.xyz);
                    
                    // Calculate sun direction in world space
                    vec3 toSun = sunPosition - worldPosition.xyz;
                    vSunDistance = length(toSun);
                    vSunDir = normalize(toSun);
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 faceColor;
                uniform vec3 edgeColorGround;
                uniform vec3 edgeColorHeight;
                uniform vec3 coreColorGround;
                uniform vec3 coreColorHeight;
                uniform float glowIntensity;
                uniform float groundGlowIntensity;
                uniform float cellSize;
                uniform float time;
                uniform vec3 highlightColor;
                uniform vec3 sheenColor;
                uniform vec3 sunPosition;
                uniform float sunIntensity;
                uniform float shadowSoftness;
                uniform float shadowIntensity;
                uniform float sheenIntensity;
                uniform float glowFalloff;
                uniform vec3 lightColor;
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vBarycentric;
                varying vec3 vViewDir;
                varying vec3 vSunDir;
                varying float vSunDistance;
                varying float vHeight;
                varying vec3 vWorldNormal;
                
                float getGridEdge(vec3 pos) {
                    vec2 grid = abs(mod(pos.xz, cellSize) - cellSize * 0.5) / cellSize;
                    float distToGrid = min(grid.x, grid.y);
                    return 1.0 - smoothstep(0.0, 0.035, distToGrid);
                }

                float getShadow(vec3 pos, vec3 normal) {
                    float shadow = 1.0;
                    // Use full sun direction vector instead of flattening to XZ
                    float shadowStrength = max(dot(normal, vSunDir), 0.0);
                    
                    shadow = smoothstep(0.0, shadowSoftness, shadowStrength);
                    shadow = pow(shadow, 1.2);
                    
                    return mix(1.0 - shadowIntensity, 1.0, shadow);
                }

                vec3 getMetallicSheen(vec3 baseColor, float specular) {
                    // Calculate half vector between sun and view directions
                    vec3 halfDir = normalize(vSunDir + vViewDir);
                    
                    // Calculate fresnel based on view angle
                    float fresnel = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 1.2);
                    fresnel = mix(0.2, 1.0, fresnel);
                    
                    // Calculate light attenuation with distance
                    float attenuation = sunIntensity / (1.0 + vSunDistance * glowFalloff);
                    
                    // Get shadow factor
                    float shadow = getShadow(vPosition, vWorldNormal);
                    
                    // Calculate specular highlight
                    float specPower = pow(max(dot(vWorldNormal, halfDir), 0.0), 32.0);  // Increased power for sharper highlight
                    vec3 sheenHighlight = mix(highlightColor, sheenColor, fresnel);
                    vec3 highlight = sheenHighlight * specPower * (fresnel + 0.7) * attenuation * shadow * sheenIntensity;
                    
                    // Calculate diffuse lighting
                    float diffuse = max(dot(vWorldNormal, vSunDir), 0.0) * 0.3 * attenuation * shadow;
                    
                    // Calculate rim lighting
                    float rim = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 2.5);
                    vec3 rimLight = mix(baseColor, sheenHighlight, 0.15) * rim * max(dot(vWorldNormal, vSunDir), 0.0);
                    
                    // Combine all lighting components
                    vec3 finalColor = baseColor * (0.01 + diffuse);  // Ambient + diffuse
                    finalColor += highlight * specular;  // Specular highlight
                    finalColor += rimLight * shadow;  // Rim lighting
                    finalColor += sheenHighlight * fresnel * 0.1;  // Additional sheen
                    
                    return finalColor * lightColor;
                }
                
                void main() {
                    vec3 finalColor = faceColor;
                    float shadow = getShadow(vPosition, vWorldNormal);
                    
                    finalColor = getMetallicSheen(faceColor, 0.8);
                    
                    // Calculate height-based blending factor
                    float heightFactor = 1.0 - smoothstep(31.0, 80.0, vHeight);
                    heightFactor = pow(heightFactor, 1.5);
                    
                    // Add height-based intensity boost for green color
                    float heightIntensity = smoothstep(31.0, 100.0, vHeight);
                    heightIntensity = pow(heightIntensity, 0.5);
                    
                    // Blend colors based on height
                    vec3 heightEdgeColor = mix(edgeColorGround, edgeColorHeight, heightIntensity);
                    
                    // Calculate pattern blend factor
                    float patternBlend = smoothstep(60.0, 90.0, vHeight);
                    
                    // Handle ground level patterns with gradient transition
                    if (vHeight < 90.0) {
                        float gridEdge = getGridEdge(vPosition);
                        if (gridEdge > 0.0) {
                            vec3 groundGlow = edgeColorGround * groundGlowIntensity;
                            float glowMix = min(gridEdge * 0.98, 0.98) * (1.0 - patternBlend);
                            finalColor = mix(finalColor, groundGlow, glowMix);
                            
                            float bloomIntensity = gridEdge * 0.9 * groundGlowIntensity * (1.0 - patternBlend);
                            finalColor += edgeColorGround * bloomIntensity;
                            
                            finalColor += edgeColorGround * gridEdge * 0.6 * (1.0 - patternBlend);
                        }
                    }
                    
                    // Handle higher terrain patterns with gradient transition
                    float minDist = min(min(vBarycentric.x, vBarycentric.y), vBarycentric.z);
                    float core = 1.0 - smoothstep(0.0, 0.005, minDist);
                    float edge = 1.0 - smoothstep(0.005, 0.035, minDist);
                    float glow = 1.0 - smoothstep(0.035, 0.12, minDist);
                    glow = pow(glow, 1.6);
                    
                    if (edge > 0.0) {
                        float coreIntensity = min(core * 0.3, 0.3);
                        vec3 edgeGlow = mix(heightEdgeColor, coreColorHeight, coreIntensity) * glowIntensity * (1.0 + heightIntensity * 2.0);
                        float edgeMix = min(edge * 0.9, 0.9) * patternBlend;
                        finalColor = mix(finalColor, edgeGlow, edgeMix);
                        
                        finalColor += heightEdgeColor * edge * 0.5 * patternBlend;
                    }
                    
                    if (glow > 0.0) {
                        float glowIntensityFalloff = glow * 0.5 * glowIntensity * (1.0 + heightIntensity * 2.0) * patternBlend;
                        glowIntensityFalloff = min(glowIntensityFalloff, 1.0);
                        finalColor += heightEdgeColor * glowIntensityFalloff;
                    }
                    
                    // Ensure darker unlit faces with proper light direction
                    finalColor = max(finalColor, vec3(0.001));
                    finalColor = pow(finalColor, vec3(0.85));
                    float exposure = 1.4;
                    finalColor = vec3(1.0) - exp(-finalColor * exposure);
                    finalColor = min(finalColor, vec3(0.9));
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            transparent: false,
            depthWrite: true,
            depthTest: true,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
            stencilZFail: THREE.KeepStencilOp,
            stencilFail: THREE.KeepStencilOp
        });

        this.material = material;
        this.material.needsUpdate = true;  // Ensure initial update
    }

    private generateTerrain(): void {
        this.dispose();

        const cellSize = this.gridSystem.getCellSize();
        const terrainGeometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const indices: number[] = [];
        const barycentricCoords: number[] = [];
        let vertexIndex = 0;

        // Helper function to get height using Perlin noise
        const getHeight = (x: number, z: number): number => {
            const maxHeight = cellSize * 3.2;
            const baseHeight = 5.0;
            
            // Add micro-detail noise for ground level variation
            const getMicroDetail = (x: number, z: number): number => {
                const microScale1 = 0.8;
                const microScale2 = 1.2;
                
                let microNoise = 
                    noise(x * microScale1, z * microScale1) * 0.6 +
                    noise(x * microScale2, z * microScale2) * 0.4;
                
                microNoise = (microNoise + 1) * 0.5;
                
                // Increased height variation to 0-15 units
                return microNoise * 15.0;
            };
            
            // Sample noise at different frequencies for terrain features
            const noise = (sx: number, sz: number): number => {
                const X = Math.floor(sx) & 255;
                const Z = Math.floor(sz) & 255;
                
                sx -= Math.floor(sx);
                sz -= Math.floor(sz);
                
                const u = this.fade(sx);
                const v = this.fade(sz);
                
                const A = this.p[X] + Z;
                const B = this.p[X + 1] + Z;
                
                return this.lerp(
                    v,
                    this.lerp(
                        u,
                        this.grad(this.p[A], sx, sz),
                        this.grad(this.p[B], sx - 1, sz)
                    ),
                    this.lerp(
                        u,
                        this.grad(this.p[A + 1], sx, sz - 1),
                        this.grad(this.p[B + 1], sx - 1, sz - 1)
                    )
                );
            };

            // Generate base terrain
            const scale1 = 0.08;
            const scale2 = 0.2;
            const scale3 = 0.6;

            let baseNoise = 
                noise(x * scale1, z * scale1) * 0.65 +
                noise(x * scale2, z * scale2) * 0.25 +
                noise(x * scale3, z * scale3) * 0.1;

            baseNoise = (baseNoise + 1) * 0.5;

            const threshold = 0.4;
            if (baseNoise < threshold) {
                // For flat areas, add subtle height variation (0-5 units)
                return baseHeight + getMicroDetail(x, z);
            }

            // For higher terrain, proceed as before
            const remappedNoise = (baseNoise - threshold) / (1 - threshold);
            const quantizeLevel = cellSize * 0.25;
            const heightAboveBase = Math.round(remappedNoise * maxHeight / quantizeLevel) * quantizeLevel;
            
            return baseHeight + heightAboveBase;
        };

        // Generate terrain with smaller triangles
        const terrainGridSize = 0.5;
        const terrainSize = 32;
        
        // Helper function to add a vertex with its position and barycentric coordinates
        const addVertex = (x: number, z: number, bary: number[]) => {
            const height = getHeight(x, z);
            vertices.push(x * cellSize, height, z * cellSize);
            barycentricCoords.push(...bary);
            return vertexIndex++;
        };

        for (let x = -terrainSize; x < terrainSize; x += terrainGridSize) {
            for (let z = -terrainSize; z < terrainSize; z += terrainGridSize) {
                // Create triangles with correct winding order (counter-clockwise)
                const v1 = addVertex(x, z, [1, 0, 0]);
                const v2 = addVertex(x + terrainGridSize, z, [0, 1, 0]);
                const v3 = addVertex(x, z + terrainGridSize, [0, 0, 1]);
                indices.push(v1, v2, v3);  // Counter-clockwise winding

                const v4 = addVertex(x + terrainGridSize, z + terrainGridSize, [1, 0, 0]);
                const v5 = addVertex(x, z + terrainGridSize, [0, 1, 0]);
                const v6 = addVertex(x + terrainGridSize, z, [0, 0, 1]);
                indices.push(v4, v5, v6);  // Counter-clockwise winding
            }
        }

        terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        terrainGeometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(barycentricCoords, 3));
        terrainGeometry.setIndex(indices);
        terrainGeometry.computeVertexNormals();

        // Force correct normal orientation
        const normals = terrainGeometry.attributes.normal.array;
        for (let i = 0; i < normals.length; i += 3) {
            if (normals[i + 1] < 0) {  // If normal is pointing down
                normals[i + 1] *= -1;   // Flip it up
            }
        }
        terrainGeometry.attributes.normal.needsUpdate = true;

        // Ensure material exists before creating mesh
        if (!this.material) {
            this.createTerrainMaterial();
        }

        if (!this.material) {
            throw new Error('Failed to create terrain material');
        }

        // Create terrain mesh using the material
        const newMesh = new THREE.Mesh(terrainGeometry, this.material);
        newMesh.position.y = 0;
        newMesh.renderOrder = 2;
        this.terrainMesh = newMesh as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
        this.scene.add(newMesh);
    }

    public update(time: number): void {
        if (this.material) {
            this.material.uniforms.time.value = time;
        }
    }

    public setSeed(newSeed: number): void {
        this.seed = newSeed;
        if (this.noiseTexture) {
            this.noiseTexture.dispose();
            this.noiseTexture = null;
        }
        this.createNoiseTexture();
        this.regenerateTerrain();
    }

    public regenerateTerrain(): void {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            this.terrainMesh = null;
        }
        this.generateTerrain();
    }

    public dispose(): void {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            if (this.terrainMesh.geometry) {
                this.terrainMesh.geometry.dispose();
            }
            if (this.terrainMesh.material) {
                this.terrainMesh.material.dispose();
            }
            this.terrainMesh = null;
        }
    }

    public getSeed(): number {
        return this.seed;
    }
} 