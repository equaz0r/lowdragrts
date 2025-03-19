import * as THREE from 'three';
import { GridSystem } from './GridSystem';

export class TerrainGenerator {
    private scene: THREE.Scene;
    private gridSystem: GridSystem;
    private noiseTexture: THREE.DataTexture | null = null;
    private terrainMesh: THREE.Mesh | null = null;
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
                noiseTexture: { value: this.noiseTexture },
                baseColor: { value: new THREE.Color(0x1a1a2e) },
                metallicColor: { value: new THREE.Color(0x4a0080) },
                fresnelColor: { value: new THREE.Color(0x8000ff) },
                fresnelPower: { value: 2.5 },
                metallicFactor: { value: 0.8 },
                roughnessFactor: { value: 0.3 },
                time: { value: 0 }
            },
            vertexShader: `
                uniform sampler2D noiseTexture;
                uniform float time;
                varying vec3 vNormal;
                varying vec3 vViewDir;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying float vHeight;

                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    // Sample height from noise texture
                    float height = texture2D(noiseTexture, uv).r;
                    vHeight = height;
                    
                    // Calculate normal based on height
                    vec3 pos = position;
                    pos.y = height * 200.0; // Scale height to match the geometry
                    
                    // Calculate normal based on height differences
                    float leftHeight = texture2D(noiseTexture, vec2(uv.x - 0.001, uv.y)).r;
                    float rightHeight = texture2D(noiseTexture, vec2(uv.x + 0.001, uv.y)).r;
                    float topHeight = texture2D(noiseTexture, vec2(uv.x, uv.y + 0.001)).r;
                    float bottomHeight = texture2D(noiseTexture, vec2(uv.x, uv.y - 0.001)).r;
                    
                    vec3 normal = normalize(vec3(
                        (leftHeight - rightHeight) * 200.0,
                        1.0,
                        (bottomHeight - topHeight) * 200.0
                    ));
                    
                    // Transform to world space
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
                    vViewDir = normalize(cameraPosition - worldPosition.xyz);
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 baseColor;
                uniform vec3 metallicColor;
                uniform vec3 fresnelColor;
                uniform float fresnelPower;
                uniform float metallicFactor;
                uniform float roughnessFactor;
                uniform float time;
                
                varying vec3 vNormal;
                varying vec3 vViewDir;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying float vHeight;

                void main() {
                    // Calculate fresnel effect
                    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), fresnelPower);
                    
                    // Calculate metallic reflection
                    vec3 reflection = reflect(-vViewDir, vNormal);
                    float metallicReflection = pow(max(dot(reflection, vViewDir), 0.0), 32.0) * (1.0 - roughnessFactor);
                    
                    // Combine base color with metallic effect
                    vec3 metallicMix = mix(baseColor, metallicColor, metallicFactor * metallicReflection);
                    
                    // Add fresnel effect
                    vec3 finalColor = mix(metallicMix, fresnelColor, fresnel);
                    
                    // Add height-based variation
                    float heightFactor = vHeight * 0.3; // Increased height influence
                    finalColor += vec3(heightFactor);
                    
                    // Add subtle glow at edges
                    float edgeGlow = pow(fresnel, 2.0);
                    finalColor += fresnelColor * edgeGlow * 0.5;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        this.material = material;
    }

    private generateTerrain(): void {
        // Create base geometry with proper size to cover the entire grid
        const gridSize = this.gridSystem.getGridSize();
        const cellSize = this.gridSystem.getCellSize();
        const totalSize = gridSize * cellSize;
        
        // Create a plane geometry that covers the entire grid
        const geometry = new THREE.PlaneGeometry(
            totalSize,
            totalSize,
            gridSize * 2, // Double the grid size for better resolution
            gridSize * 2
        );

        // Generate UV coordinates for noise sampling
        const uvs = geometry.attributes.uv;
        for (let i = 0; i < uvs.count; i++) {
            const x = uvs.getX(i);
            const y = uvs.getY(i);
            // Scale UV coordinates to cover more of the noise texture
            uvs.setXY(i, x * 8, y * 8);
        }
        uvs.needsUpdate = true;

        // Apply height to vertices
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            const u = uvs.getX(i);
            const v = uvs.getY(i);
            
            // Get height from noise texture
            const height = this.getHeightAtUV(u, v);
            
            // Scale height and apply to vertex
            positions.setXYZ(i, x, height * 200.0, z);
        }
        positions.needsUpdate = true;

        // Recalculate normals
        geometry.computeVertexNormals();

        if (this.material) {
            const mesh = new THREE.Mesh(geometry, this.material);
            // Position the mesh at ground level
            mesh.position.y = 0;
            mesh.renderOrder = 0;
            this.terrainMesh = mesh;
            this.scene.add(mesh);
        }
    }

    private getHeightAtUV(u: number, v: number): number {
        if (this.noiseTexture) {
            // Wrap UV coordinates
            u = u % 1;
            v = v % 1;
            if (u < 0) u += 1;
            if (v < 0) v += 1;

            const x = Math.floor(u * this.noiseSize) % this.noiseSize;
            const y = Math.floor(v * this.noiseSize) % this.noiseSize;
            const index = y * this.noiseSize + x;
            const data = this.noiseTexture.image.data as Float32Array;
            return data[index];
        }
        return 0;
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
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            this.terrainMesh = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        if (this.noiseTexture) {
            this.noiseTexture.dispose();
            this.noiseTexture = null;
        }
    }

    public getSeed(): number {
        return this.seed;
    }
} 