import * as THREE from 'three';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { VoxelType } from './VoxelTypes';
import { SimplexNoise } from 'simplex-noise-esm';

export class WorldManager {
    private chunks: Map<string, Chunk>;
    private scene: THREE.Scene;
    private noise: SimplexNoise;
    
    // World generation parameters
    private readonly TERRAIN_SCALE = 150.0;
    private readonly TERRAIN_HEIGHT = 20;
    private readonly BASE_HEIGHT = 10;
    private readonly ORE_DENSITY = 0.1;
    private readonly CRYSTAL_DENSITY = 0.05;
    private readonly CHUNK_RADIUS = 8;

    // Add biome noise parameters
    private readonly BIOME_SCALE = 300.0;
    private readonly MOISTURE_SCALE = 250.0;

    constructor(scene: THREE.Scene) {
        this.chunks = new Map();
        this.scene = scene;
        this.noise = new SimplexNoise();
    }

    private getChunkKey(x: number, y: number, z: number): string {
        return `${x},${y},${z}`;
    }

    public getChunk(x: number, y: number, z: number): Chunk | undefined {
        return this.chunks.get(this.getChunkKey(x, y, z));
    }

    public createChunk(chunkX: number, chunkY: number, chunkZ: number): Chunk {
        const key = this.getChunkKey(chunkX, chunkY, chunkZ);
        if (this.chunks.has(key)) {
            return this.chunks.get(key)!;
        }

        const chunk = new Chunk(chunkX, chunkY, chunkZ);
        this.generateChunkTerrain(chunk);
        this.chunks.set(key, chunk);
        
        // Generate mesh and add to scene
        chunk.updateMesh();
        const mesh = chunk.getMesh();
        if (mesh) {
            this.scene.add(mesh);
        }

        return chunk;
    }

    private generateChunkTerrain(chunk: Chunk): void {
        const worldX = chunk.position.x * CHUNK_SIZE;
        const worldY = chunk.position.y * CHUNK_SIZE;
        const worldZ = chunk.position.z * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                // Generate base terrain height
                const nx = (worldX + x) / this.TERRAIN_SCALE;
                const nz = (worldZ + z) / this.TERRAIN_SCALE;
                
                // Generate biome value
                const biomeNoise = (this.noise.noise2D(
                    (worldX + x) / this.BIOME_SCALE, 
                    (worldZ + z) / this.BIOME_SCALE
                ) + 1) * 0.5;
                
                // Generate moisture value
                const moistureNoise = (this.noise.noise2D(
                    (worldX + x) / this.MOISTURE_SCALE, 
                    (worldZ + z) / this.MOISTURE_SCALE
                ) + 1) * 0.5;

                // Combine noise for height
                const baseNoise = (this.noise.noise2D(nx, nz) + 1) * 0.5;
                const height = Math.floor(
                    this.BASE_HEIGHT + (baseNoise * this.TERRAIN_HEIGHT)
                );

                for (let y = 0; y < CHUNK_SIZE; y++) {
                    const worldY = chunk.position.y * CHUNK_SIZE + y;
                    
                    if (worldY < height - 4) {
                        // Deep stone layer
                        chunk.setVoxel(x, y, z, VoxelType.STONE);
                        
                        // Generate ore veins
                        const oreNoise = this.noise.noise3D(
                            nx * 2, 
                            worldY / 20, 
                            nz * 2
                        );
                        
                        if (oreNoise > 1 - this.ORE_DENSITY) {
                            // Create larger ore veins
                            if (oreNoise > 1 - (this.ORE_DENSITY * 0.5)) {
                                chunk.setVoxel(x, y, z, VoxelType.SKIRULUM_ORE);
                            }
                        }
                    } else if (worldY < height) {
                        // Dirt layer
                        chunk.setVoxel(x, y, z, VoxelType.DIRT);
                    } else if (worldY === height) {
                        // Surface layer varies by biome
                        if (biomeNoise < 0.4) {
                            chunk.setVoxel(x, y, z, VoxelType.GRASS);
                        } else if (biomeNoise < 0.7) {
                            chunk.setVoxel(x, y, z, VoxelType.STONE);
                        } else {
                            chunk.setVoxel(x, y, z, VoxelType.DIRT);
                        }
                        
                        // Fredalite crystal generation
                        if (moistureNoise > 0.7 && this.noise.noise2D(nx * 4, nz * 4) > 1 - this.CRYSTAL_DENSITY) {
                            chunk.setVoxel(x, y + 1, z, VoxelType.FREDALITE_CRYSTAL);
                        }
                    } else {
                        chunk.setVoxel(x, y, z, VoxelType.AIR);
                    }
                    
                    if (worldY === 0) {
                        chunk.setVoxel(x, y, z, VoxelType.BEDROCK);
                    }
                }
            }
        }
    }

    public setVoxel(worldX: number, worldY: number, worldZ: number, type: VoxelType): void {
        const chunkX = Math.floor(worldX / CHUNK_SIZE);
        const chunkY = Math.floor(worldY / CHUNK_SIZE);
        const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
        
        const chunk = this.getChunk(chunkX, chunkY, chunkZ);
        if (chunk) {
            const localX = worldX - (chunkX * CHUNK_SIZE);
            const localY = worldY - (chunkY * CHUNK_SIZE);
            const localZ = worldZ - (chunkZ * CHUNK_SIZE);
            
            chunk.setVoxel(localX, localY, localZ, type);
            chunk.updateMesh();
        }
    }

    public getVoxel(worldX: number, worldY: number, worldZ: number): VoxelType {
        const chunkX = Math.floor(worldX / CHUNK_SIZE);
        const chunkY = Math.floor(worldY / CHUNK_SIZE);
        const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
        
        const chunk = this.getChunk(chunkX, chunkY, chunkZ);
        if (chunk) {
            const localX = worldX - (chunkX * CHUNK_SIZE);
            const localY = worldY - (chunkY * CHUNK_SIZE);
            const localZ = worldZ - (chunkZ * CHUNK_SIZE);
            
            return chunk.getVoxel(localX, localY, localZ);
        }
        return VoxelType.AIR;
    }

    public generateInitialChunks(radius: number): void {
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                for (let y = 0; y < 4; y++) { // Generate 4 chunks high
                    this.createChunk(x, y, z);
                }
            }
        }
    }

    public update(): void {
        // Update all chunks that need updating
        this.chunks.forEach(chunk => {
            if (chunk.isDirty()) {
                chunk.updateMesh();
            }
        });
    }

    public dispose(): void {
        this.chunks.forEach(chunk => {
            chunk.dispose();
            const mesh = chunk.getMesh();
            if (mesh) {
                this.scene.remove(mesh);
            }
        });
        this.chunks.clear();
    }

    public getHeightAt(x: number, z: number): number | undefined {
        // Convert world coordinates to chunk coordinates
        const chunkX = Math.floor(x / CHUNK_SIZE);
        const chunkZ = Math.floor(z / CHUNK_SIZE);
        
        console.log('Getting height at:', {
            worldX: x,
            worldZ: z,
            chunkX,
            chunkZ
        });
        
        // Convert to local coordinates within chunk
        const localX = Math.floor(x) % CHUNK_SIZE;
        const localZ = Math.floor(z) % CHUNK_SIZE;
        
        console.log('Local coordinates:', {
            localX,
            localZ
        });

        // Search from top to bottom for first non-air block
        for (let y = 4 * CHUNK_SIZE - 1; y >= 0; y--) {
            const chunk = this.getChunk(chunkX, Math.floor(y / CHUNK_SIZE), chunkZ);
            if (chunk) {
                const voxel = chunk.getVoxel(
                    localX >= 0 ? localX : CHUNK_SIZE + localX,
                    y % CHUNK_SIZE,
                    localZ >= 0 ? localZ : CHUNK_SIZE + localZ
                );
                if (voxel !== VoxelType.AIR) {
                    console.log('Found ground at height:', y + 1);
                    return y + 1;
                }
            }
        }
        console.log('No ground found, returning 0');
        return 0;
    }
} 