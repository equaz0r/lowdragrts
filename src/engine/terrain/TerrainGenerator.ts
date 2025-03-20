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

    constructor(scene: THREE.Scene, gridSystem: GridSystem) {
        this.scene = scene;
        this.gridSystem = gridSystem;
        this.chunkSize = gridSystem.getCellSize();
        this.initialize();
    }

    private initialize(): void {
        this.createNoiseTexture();
        this.createTerrainMaterial();
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
                faceColor: { value: new THREE.Color(0x1a1a2e) },
                edgeColorGround: { value: new THREE.Color(0xff8800) }, // Brighter orange for ground level
                edgeColorHeight: { value: new THREE.Color(0x00ff66) }, // Green for height
                coreColorGround: { value: new THREE.Color(0xffffff) }, // White core for ground
                coreColorHeight: { value: new THREE.Color(0xffffff) }, // White core for height
                glowIntensity: { value: 1.5 },
                groundGlowIntensity: { value: 2.5 }, // Separate intensity for ground
                cellSize: { value: this.chunkSize }, // Add cell size for grid calculation
                time: { value: 0.0 }
            },
            vertexShader: `
                attribute vec3 barycentric;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vBarycentric;
                
                void main() {
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    vBarycentric = barycentric;
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
                
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vBarycentric;
                
                float getGridEdge(vec3 pos) {
                    // Calculate distance to nearest grid line
                    vec2 grid = abs(mod(pos.xz, cellSize) - cellSize * 0.5) / cellSize;
                    float distToGrid = min(grid.x, grid.y);
                    
                    // Create sharp grid lines with glow
                    return 1.0 - smoothstep(0.0, 0.05, distToGrid);
                }
                
                void main() {
                    // Determine if we're at ground level (y = 5.0)
                    bool isGroundLevel = abs(vPosition.y - 5.0) < 0.1;
                    
                    vec3 finalColor = faceColor;
                    float pulse = 1.0 + 0.2 * sin(time * 2.0);
                    
                    if (isGroundLevel) {
                        // For ground level, use grid pattern
                        float gridEdge = getGridEdge(vPosition);
                        if (gridEdge > 0.0) {
                            // Enhanced glow for ground level
                            float groundPulse = 1.0 + 0.3 * sin(time * 2.0); // Stronger pulse
                            vec3 groundGlow = edgeColorGround * groundGlowIntensity * groundPulse;
                            float glowMix = min(gridEdge * 0.95, 0.95);
                            finalColor = mix(finalColor, groundGlow, glowMix);
                            
                            // Add extra bloom for ground edges
                            float bloomIntensity = gridEdge * 0.6 * groundGlowIntensity * groundPulse;
                            finalColor += edgeColorGround * bloomIntensity;
                        }
                    } else {
                        // For elevated terrain, use triangle edges
                        float minDist = min(min(vBarycentric.x, vBarycentric.y), vBarycentric.z);
                        
                        // Core white line (very thin)
                        float core = 1.0 - smoothstep(0.0, 0.005, minDist);
                        
                        // Main edge
                        float edge = 1.0 - smoothstep(0.005, 0.035, minDist);
                        
                        // Outer glow
                        float glow = 1.0 - smoothstep(0.035, 0.12, minDist);
                        glow = pow(glow, 1.6);
                        
                        // Enhanced lighting for faces
                        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                        float diffuse = max(dot(vNormal, lightDir), 0.2);
                        
                        // Metallic reflection
                        vec3 viewDir = normalize(cameraPosition - vPosition);
                        vec3 reflectDir = reflect(-lightDir, vNormal);
                        float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                        
                        // Face color with metallic sheen
                        finalColor = faceColor * (diffuse * 0.7 + 0.3) + vec3(0.3) * specular;
                        
                        // Add edge and glow
                        if (edge > 0.0) {
                            float coreIntensity = min(core * 0.3, 0.3);
                            vec3 edgeGlow = mix(edgeColorHeight, coreColorHeight, coreIntensity) * glowIntensity * pulse;
                            float edgeMix = min(edge * 0.9, 0.9);
                            finalColor = mix(finalColor, edgeGlow, edgeMix);
                        }
                        
                        if (glow > 0.0) {
                            float glowIntensityFalloff = glow * 0.4 * glowIntensity * pulse;
                            glowIntensityFalloff = min(glowIntensityFalloff, 0.5);
                            finalColor += edgeColorHeight * glowIntensityFalloff;
                        }
                    }
                    
                    // Enhanced brightness limit for ground level glow
                    finalColor = min(finalColor, vec3(1.6));
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        this.material = material;
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
            const maxHeight = cellSize * 3.2;  // Doubled from 1.6 to 3.2
            const baseHeight = 5.0;  // Keep the same base height
            
            // Sample noise at different frequencies
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

            // Sample at different frequencies for more interesting terrain
            const scale1 = 0.08;  // Large features
            const scale2 = 0.2;   // Medium features
            const scale3 = 0.6;   // Small features

            // Generate base terrain with more emphasis on lower values
            let baseNoise = 
                noise(x * scale1, z * scale1) * 0.65 +
                noise(x * scale2, z * scale2) * 0.25 +
                noise(x * scale3, z * scale3) * 0.1;

            // Normalize to [0, 1] range
            baseNoise = (baseNoise + 1) * 0.5;

            // Apply threshold for flat areas - if below 0.4, make it flat
            const threshold = 0.4;
            if (baseNoise < threshold) {
                return baseHeight;
            }

            // Remap the remaining range [threshold, 1] to [0, 1] for height variation
            const remappedNoise = (baseNoise - threshold) / (1 - threshold);

            // Add some quantization for more angular features
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
                // Create first triangle
                const v1 = addVertex(x, z, [1, 0, 0]);
                const v2 = addVertex(x + terrainGridSize, z, [0, 1, 0]);
                const v3 = addVertex(x, z + terrainGridSize, [0, 0, 1]);
                indices.push(v1, v2, v3);

                // Create second triangle
                const v4 = addVertex(x + terrainGridSize, z, [1, 0, 0]);
                const v5 = addVertex(x + terrainGridSize, z + terrainGridSize, [0, 1, 0]);
                const v6 = addVertex(x, z + terrainGridSize, [0, 0, 1]);
                indices.push(v4, v5, v6);
            }
        }

        terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        terrainGeometry.setAttribute('barycentric', new THREE.Float32BufferAttribute(barycentricCoords, 3));
        terrainGeometry.setIndex(indices);
        terrainGeometry.computeVertexNormals();

        // Create terrain mesh using the material
        if (!this.material) {
            this.material = new THREE.ShaderMaterial({
                uniforms: {
                    faceColor: { value: new THREE.Color(0x1a1a2e) },
                    edgeColorGround: { value: new THREE.Color(0xff8800) }, // Brighter orange for ground level
                    edgeColorHeight: { value: new THREE.Color(0x00ff66) }, // Green for height
                    coreColorGround: { value: new THREE.Color(0xffffff) }, // White core for ground
                    coreColorHeight: { value: new THREE.Color(0xffffff) }, // White core for height
                    glowIntensity: { value: 1.5 },
                    groundGlowIntensity: { value: 2.5 }, // Separate intensity for ground
                    cellSize: { value: cellSize }, // Add cell size for grid calculation
                    time: { value: 0.0 }
                },
                vertexShader: `
                    attribute vec3 barycentric;
                    varying vec3 vPosition;
                    varying vec3 vNormal;
                    varying vec3 vBarycentric;
                    
                    void main() {
                        vPosition = position;
                        vNormal = normalize(normalMatrix * normal);
                        vBarycentric = barycentric;
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
                    
                    varying vec3 vPosition;
                    varying vec3 vNormal;
                    varying vec3 vBarycentric;
                    
                    float getGridEdge(vec3 pos) {
                        // Calculate distance to nearest grid line
                        vec2 grid = abs(mod(pos.xz, cellSize) - cellSize * 0.5) / cellSize;
                        float distToGrid = min(grid.x, grid.y);
                        
                        // Create sharp grid lines with glow
                        return 1.0 - smoothstep(0.0, 0.05, distToGrid);
                    }
                    
                    void main() {
                        // Determine if we're at ground level (y = 5.0)
                        bool isGroundLevel = abs(vPosition.y - 5.0) < 0.1;
                        
                        vec3 finalColor = faceColor;
                        float pulse = 1.0 + 0.2 * sin(time * 2.0);
                        
                        if (isGroundLevel) {
                            // For ground level, use grid pattern
                            float gridEdge = getGridEdge(vPosition);
                            if (gridEdge > 0.0) {
                                // Enhanced glow for ground level
                                float groundPulse = 1.0 + 0.3 * sin(time * 2.0); // Stronger pulse
                                vec3 groundGlow = edgeColorGround * groundGlowIntensity * groundPulse;
                                float glowMix = min(gridEdge * 0.95, 0.95);
                                finalColor = mix(finalColor, groundGlow, glowMix);
                                
                                // Add extra bloom for ground edges
                                float bloomIntensity = gridEdge * 0.6 * groundGlowIntensity * groundPulse;
                                finalColor += edgeColorGround * bloomIntensity;
                            }
                        } else {
                            // For elevated terrain, use triangle edges
                            float minDist = min(min(vBarycentric.x, vBarycentric.y), vBarycentric.z);
                            
                            // Core white line (very thin)
                            float core = 1.0 - smoothstep(0.0, 0.005, minDist);
                            
                            // Main edge
                            float edge = 1.0 - smoothstep(0.005, 0.035, minDist);
                            
                            // Outer glow
                            float glow = 1.0 - smoothstep(0.035, 0.12, minDist);
                            glow = pow(glow, 1.6);
                            
                            // Enhanced lighting for faces
                            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                            float diffuse = max(dot(vNormal, lightDir), 0.2);
                            
                            // Metallic reflection
                            vec3 viewDir = normalize(cameraPosition - vPosition);
                            vec3 reflectDir = reflect(-lightDir, vNormal);
                            float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                            
                            // Face color with metallic sheen
                            finalColor = faceColor * (diffuse * 0.7 + 0.3) + vec3(0.3) * specular;
                            
                            // Add edge and glow
                            if (edge > 0.0) {
                                float coreIntensity = min(core * 0.3, 0.3);
                                vec3 edgeGlow = mix(edgeColorHeight, coreColorHeight, coreIntensity) * glowIntensity * pulse;
                                float edgeMix = min(edge * 0.9, 0.9);
                                finalColor = mix(finalColor, edgeGlow, edgeMix);
                            }
                            
                            if (glow > 0.0) {
                                float glowIntensityFalloff = glow * 0.4 * glowIntensity * pulse;
                                glowIntensityFalloff = min(glowIntensityFalloff, 0.5);
                                finalColor += edgeColorHeight * glowIntensityFalloff;
                            }
                        }
                        
                        // Enhanced brightness limit for ground level glow
                        finalColor = min(finalColor, vec3(1.6));
                        
                        gl_FragColor = vec4(finalColor, 1.0);
                    }
                `,
                side: THREE.DoubleSide
            });
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
        // Reinitialize the noise texture with new seed
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
        // Remove and dispose of all meshes
        const meshesToRemove = this.scene.children.filter(child => 
            child instanceof THREE.Mesh || 
            child instanceof THREE.LineSegments
        );
        
        for (const mesh of meshesToRemove) {
            this.scene.remove(mesh);
            if (mesh.geometry) {
                mesh.geometry.dispose();
            }
            if (mesh.material instanceof THREE.Material) {
                mesh.material.dispose();
            } else if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => mat.dispose());
            }
        }

        this.terrainMesh = null;
    }

    public getSeed(): number {
        return this.seed;
    }
} 