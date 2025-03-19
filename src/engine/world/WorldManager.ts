import * as THREE from 'three';
import { Chunk } from '../voxel/Chunk';
import { VoxelType } from '../voxel/VoxelTypes';
import { MaterialManager } from '../graphics/MaterialManager';
import { SimplexNoise } from 'simplex-noise-esm';

export class WorldManager {
    protected scene: THREE.Scene;
    private chunks: Map<string, Chunk> = new Map();
    private noise: SimplexNoise;
    private basePlane: THREE.Mesh | null = null;
    private chunkSize: number = 16;
    private worldWidth: number = 16;
    private worldLength: number = 16;
    private grid: THREE.LineSegments | null = null;
    private gridOffset: number = 0.1;
    private gridSize: number;
    private gridDivisions: number;
    private gridMaterial: THREE.LineBasicMaterial;
    private gridAnimationFrame: number = 0;
    private isInitialized: boolean = false;
    private materialManager: typeof MaterialManager;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.noise = new SimplexNoise();
        this.materialManager = MaterialManager;
        this.gridSize = this.chunkSize * 16;
        this.gridDivisions = 32;
        this.gridMaterial = new THREE.LineBasicMaterial({
            color: 0xff6600,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        this.initialize();
    }

    private initialize(): void {
        this.initializeGrid();
        this.createBasePlane();
        console.log('WorldManager initialized with enhanced grid visibility');
        this.isInitialized = true;
    }

    private createBasePlane(): void {
        const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
        const planeMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            side: THREE.DoubleSide
        });
        this.basePlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.basePlane.rotation.x = -Math.PI / 2;
        this.basePlane.position.y = 0;
        this.scene.add(this.basePlane);
    }

    private initializeGrid(): void {
        const gridSize = this.chunkSize * 16;
        const divisions = 16;
        const gridOffset = 0.1;

        // Get grid shader from material manager
        const material = this.materialManager.getShader('grid');
        if (!material) {
            console.error('Grid shader not found');
            return;
        }

        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const indices: number[] = [];

        // Create horizontal lines
        for (let i = 0; i <= divisions; i++) {
            const z = (i * gridSize / divisions) - gridSize / 2;
            vertices.push(-gridSize / 2, gridOffset, z, gridSize / 2, gridOffset, z);
            indices.push(vertices.length / 3 - 2, vertices.length / 3 - 1);
        }

        // Create vertical lines
        for (let i = 0; i <= divisions; i++) {
            const x = (i * gridSize / divisions) - gridSize / 2;
            vertices.push(x, gridOffset, -gridSize / 2, x, gridOffset, gridSize / 2);
            indices.push(vertices.length / 3 - 2, vertices.length / 3 - 1);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);

        this.grid = new THREE.LineSegments(geometry, material);
        this.grid.renderOrder = 9999;
        this.scene.add(this.grid);

        // Animate grid
        const animate = () => {
            if (this.grid) {
                const time = Date.now() * 0.001;
                this.materialManager.updateShaderUniform('grid', 'time', time);
            }
            requestAnimationFrame(animate);
        };
        animate();
    }

    public getChunk(x: number, z: number): Chunk {
        const key = `${x},${z}`;
        if (!this.chunks.has(key)) {
            this.chunks.set(key, this.createChunk(x, z));
        }
        return this.chunks.get(key)!;
    }

    private createChunk(x: number, z: number): Chunk {
        const chunk = new Chunk(x, z, this.chunkSize);
        const material = this.materialManager.getShader('terrain');
        chunk.setMaterial(material);
        
        // Generate terrain first
        this.generateChunkTerrain(chunk);
        
        // Get the mesh and ensure it's properly initialized
        const mesh = chunk.getMesh();
        if (mesh) {
            // Ensure proper positioning
            mesh.position.set(x * this.chunkSize, 0, z * this.chunkSize);
            
            // Add to scene
            this.scene.add(mesh);
            
            // Force an update to ensure geometry is generated
            chunk.update();
        }
        
        return chunk;
    }

    public update(): void {
        // Update shader uniforms
        const time = Date.now() * 0.001;
        this.materialManager.updateShaderUniform('terrain', 'time', time);

        // Update chunks
        this.chunks.forEach(chunk => chunk.update());
    }

    public dispose(): void {
        this.chunks.forEach(chunk => chunk.dispose());
        this.chunks.clear();
        
        // Remove base plane if it exists
        if (this.basePlane) {
            this.scene.remove(this.basePlane);
            this.basePlane = null;
        }

        // Remove grid if it exists
        if (this.grid) {
            this.grid.geometry.dispose();
            if (this.grid.material instanceof THREE.Material) {
                this.grid.material.dispose();
            }
            this.scene.remove(this.grid);
            this.grid = null;
        }
    }

    public generateInitialChunks(radius: number): void {
        console.log('Generating initial chunks with radius:', radius);
        
        // Clear existing chunks first
        this.dispose();
        
        // Generate chunks in a square pattern
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                const chunk = this.getChunk(x, z);
                
                // Force mesh update
                const mesh = chunk.getMesh();
                if (mesh) {
                    chunk.update();
                }
            }
        }
    }

    private generateChunkTerrain(chunk: Chunk): void {
        // Generate terrain for the chunk with finer detail
        for (let x = 0; x < chunk.size; x++) {
            for (let z = 0; z < chunk.size; z++) {
                const worldX = x + chunk.position.x * chunk.size;
                const worldZ = z + chunk.position.z * chunk.size;
                
                // More detailed terrain generation
                const baseNoise = this.noise.noise2D(worldX * 0.03, worldZ * 0.03);
                const detailNoise = this.noise.noise2D(worldX * 0.1, worldZ * 0.1) * 0.2;
                const height = Math.floor((baseNoise + detailNoise + 1) * 8) + 4;

                for (let y = 0; y < chunk.size; y++) {
                    if (y <= height) {
                        // Add different voxel types based on height
                        if (y === height) {
                            chunk.setVoxel(x, y, z, VoxelType.GRASS);
                        } else if (y > height - 4) {
                            chunk.setVoxel(x, y, z, VoxelType.DIRT);
                        } else {
                            chunk.setVoxel(x, y, z, VoxelType.STONE);
                        }
                    }
                }
            }
        }
        
        // Force mesh update after terrain generation
        chunk.update();
    }

    private getVoxelType(x: number, y: number, z: number, height: number, featureNoise: number): VoxelType {
        // Surface layer is grass
        if (y === height) {
            return VoxelType.GRASS;
        }
        
        // Below surface is stone
        if (y < height) {
            return VoxelType.STONE;
        }
        
        return VoxelType.AIR;
    }

    public getHeightAt(x: number, z: number): number {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkZ = Math.floor(z / this.chunkSize);
        const localX = x % this.chunkSize;
        const localZ = z % this.chunkSize;
        
        const chunk = this.getChunk(chunkX, chunkZ);
        if (!chunk) {
            return 0;
        }

        return chunk.getHighestPoint(localX, localZ);
    }

    private addRockFormations(chunk: Chunk): void {
        const chunkSize = this.chunkSize;
        const numFormations = Math.floor(Math.random() * 3) + 1; // 1-3 formations per chunk
        
        for (let i = 0; i < numFormations; i++) {
            const cx = Math.floor(Math.random() * (chunkSize - 4)) + 2;
            const cz = Math.floor(Math.random() * (chunkSize - 4)) + 2;
            const baseHeight = chunk.getHighestPoint(cx, cz);
            
            if (baseHeight > 0) {
                // Create a rock spire
                const spireHeight = Math.floor(Math.random() * 4) + 3; // 3-6 blocks tall
                for (let y = 0; y < spireHeight; y++) {
                    const radius = Math.max(1, Math.floor((spireHeight - y) * 0.7));
                    for (let ox = -radius; ox <= radius; ox++) {
                        for (let oz = -radius; oz <= radius; oz++) {
                            if (Math.random() > 0.3 && // 70% chance to place block
                                cx + ox >= 0 && cx + ox < chunkSize &&
                                cz + oz >= 0 && cz + oz < chunkSize) {
                                chunk.setVoxel(cx + ox, baseHeight + y, cz + oz, VoxelType.STONE);
                            }
                        }
                    }
                }
            }
        }
    }

    private addTerrainFeatures(chunk: Chunk): void {
        const chunkSize = this.chunkSize;
        
        // Add random rock formations
        const numRocks = Math.floor(Math.random() * 3); // 0-2 rock formations per chunk
        for (let i = 0; i < numRocks; i++) {
            const rx = Math.floor(Math.random() * (chunkSize - 4)) + 2;
            const rz = Math.floor(Math.random() * (chunkSize - 4)) + 2;
            const height = chunk.getHighestPoint(rx, rz);
            
            if (height > 0) {
                // Create small rock formation
                for (let ox = -1; ox <= 1; ox++) {
                    for (let oz = -1; oz <= 1; oz++) {
                        const rockHeight = Math.floor(Math.random() * 2) + 1;
                        for (let y = 0; y < rockHeight; y++) {
                            if (Math.random() > 0.3) { // 70% chance to place rock
                                chunk.setVoxel(rx + ox, height + y, rz + oz, VoxelType.STONE);
                            }
                        }
                    }
                }
            }
        }
        
        // Add random vegetation (trees, bushes, etc.)
        const numVegetation = Math.floor(Math.random() * 5); // 0-4 vegetation spots per chunk
        for (let i = 0; i < numVegetation; i++) {
            const vx = Math.floor(Math.random() * (chunkSize - 2)) + 1;
            const vz = Math.floor(Math.random() * (chunkSize - 2)) + 1;
            const height = chunk.getHighestPoint(vx, vz);
            
            if (height > 0 && chunk.getVoxel(vx, height - 1, vz) === VoxelType.GRASS) {
                // 50% chance for tree, 50% for bush
                if (Math.random() > 0.5) {
                    this.generateTree(chunk, vx, height, vz);
                } else {
                    this.generateBush(chunk, vx, height, vz);
                }
            }
        }
    }

    private generateTree(chunk: Chunk, x: number, y: number, z: number): void {
        const treeHeight = Math.floor(Math.random() * 3) + 4; // 4-6 blocks tall
        
        // Generate trunk
        for (let i = 0; i < treeHeight; i++) {
            chunk.setVoxel(x, y + i, z, VoxelType.WOOD);
        }
        
        // Generate leaves
        for (let ox = -2; ox <= 2; ox++) {
            for (let oz = -2; oz <= 2; oz++) {
                for (let oy = 0; oy <= 2; oy++) {
                    const lx = x + ox;
                    const ly = y + treeHeight - 1 + oy;
                    const lz = z + oz;
                    
                    if (Math.random() > 0.3) { // 70% chance to place leaf
                        chunk.setVoxel(lx, ly, lz, VoxelType.LEAVES);
                    }
                }
            }
        }
    }

    private generateBush(chunk: Chunk, x: number, y: number, z: number): void {
        // Generate bush (2-3 blocks tall)
        const bushHeight = Math.floor(Math.random() * 2) + 2;
        for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
                for (let oy = 0; oy < bushHeight; oy++) {
                    if (Math.random() > 0.3) { // 70% chance to place leaf
                        chunk.setVoxel(x + ox, y + oy, z + oz, VoxelType.LEAVES);
                    }
                }
            }
        }
    }

    public getTotalChunks(): number {
        return this.chunks.size;
    }

    public getActiveChunks(): number {
        return this.chunks.size;
    }

    public getChunksInView(): number {
        return this.chunks.size;
    }

    public getWorldSize(): { width: number; length: number } {
        return { width: this.worldWidth, length: this.worldLength };
    }
} 