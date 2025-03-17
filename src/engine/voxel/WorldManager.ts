import * as THREE from 'three';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { VoxelType } from './VoxelTypes';
import { SimplexNoise } from 'simplex-noise-esm';

export class WorldManager {
    private chunks: Map<string, Chunk>;
    private scene: THREE.Scene;
    private noise: SimplexNoise;
    private readonly CHUNK_RADIUS = 8;
    private grid: THREE.Group;

    constructor(scene: THREE.Scene) {
        this.chunks = new Map();
        this.scene = scene;
        this.noise = new SimplexNoise();
        
        // Create a grid that matches chunk size
        const gridSize = CHUNK_SIZE * 16; // 16 chunks in each direction
        const divisions = 16; // One division per chunk
        const lineWidth = 0.1; // Width of grid lines
        const lineHeight = 0.1; // Height of grid lines
        const lineDepth = 0.1; // Depth of grid lines
        const gridOffset = -0.05; // Slightly below the surface
        
        // Create glowing material for grid lines
        const gridMaterial = new THREE.MeshPhongMaterial({
            color: 0xff6600,
            emissive: 0xff6600,
            emissiveIntensity: 2.0,
            shininess: 200,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            fog: false
        });
        
        // Create grid lines
        const gridGroup = new THREE.Group();
        
        // Create horizontal lines
        for (let i = -gridSize/2; i <= gridSize/2; i += gridSize/divisions) {
            const lineGeometry = new THREE.BoxGeometry(gridSize, lineHeight, lineDepth);
            const line = new THREE.Mesh(lineGeometry, gridMaterial);
            line.position.set(0, gridOffset, i);
            gridGroup.add(line);
        }
        
        // Create vertical lines
        for (let i = -gridSize/2; i <= gridSize/2; i += gridSize/divisions) {
            const lineGeometry = new THREE.BoxGeometry(lineWidth, lineHeight, gridSize);
            const line = new THREE.Mesh(lineGeometry, gridMaterial);
            line.position.set(i, gridOffset, 0);
            gridGroup.add(line);
        }
        
        this.grid = gridGroup;
        scene.add(this.grid);
        
        console.log('WorldManager initialized with custom glowing grid');
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
        // Don't create any terrain, just empty chunks
        this.chunks.set(key, chunk);
        
        // Generate mesh and add to scene
        chunk.updateMesh();
        const mesh = chunk.getMesh();
        if (mesh) {
            this.scene.add(mesh);
            console.log('Added chunk mesh to scene:', { chunkX, chunkY, chunkZ });
        }

        return chunk;
    }

    public generateInitialChunks(radius: number): void {
        console.log('Generating initial chunks with radius:', radius);
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                console.log('Creating chunk at:', x, 0, z);
                this.createChunk(x, 0, z);
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
        console.log('Disposing of all chunks');
        this.chunks.forEach(chunk => {
            chunk.dispose();
            const mesh = chunk.getMesh();
            if (mesh) {
                this.scene.remove(mesh);
            }
        });
        this.chunks.clear();
        
        // Remove grid
        if (this.grid) {
            this.scene.remove(this.grid);
        }
    }

    public getHeightAt(x: number, z: number): number {
        // Always return 0 since we want units to sit on the ground plane
        return 0;
    }
} 