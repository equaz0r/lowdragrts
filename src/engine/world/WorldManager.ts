import * as THREE from 'three';
import { Chunk } from '../voxel/Chunk';
import { VoxelType } from '../voxel/VoxelTypes';
const SimplexNoise = require('simplex-noise-esm');

export class WorldManager {
    private scene: THREE.Scene;
    private chunks: Map<string, Chunk>;
    private noise: any;
    private basePlane: THREE.Mesh | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.noise = new SimplexNoise();
        
        // Create base plane
        this.createBasePlane();
        
        // Force terrain regeneration
        this.dispose();
        this.generateInitialChunks(8);
    }

    private createBasePlane() {
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

    public dispose() {
        // Remove all existing chunks
        this.chunks.forEach(chunk => {
            chunk.dispose();
        });
        this.chunks.clear();
        
        // Remove base plane if it exists
        if (this.basePlane) {
            this.scene.remove(this.basePlane);
            this.basePlane = null;
        }
    }

    public generateInitialChunks(radius: number) {
        // Generate chunks in a radius around the origin
        for (let x = -radius; x <= radius; x++) {
            for (let z = -radius; z <= radius; z++) {
                const chunk = new Chunk(x, 0, z);
                this.generateChunkTerrain(chunk);
                this.chunks.set(`${x},${z}`, chunk);
            }
        }
    }

    private generateChunkTerrain(chunk: Chunk) {
        const size = 16;
        const baseHeight = 0; // Start from the base plane
        
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                const worldX = chunk.position.x * size + x;
                const worldZ = chunk.position.z * size + z;
                
                // Generate terrain features using noise
                const heightNoise = this.noise.noise2D(worldX * 0.05, worldZ * 0.05);
                const featureNoise = this.noise.noise2D(worldX * 0.1, worldZ * 0.1);
                
                // Only generate terrain if noise indicates a feature should be here
                if (Math.abs(heightNoise) > 0.3 || Math.abs(featureNoise) > 0.5) {
                    // Calculate height based on noise
                    const height = Math.floor((heightNoise + 1) * 5); // Scale noise to 0-10 height
                    
                    // Generate terrain layers
                    for (let y = 0; y <= height; y++) {
                        const voxelType = this.getVoxelType(worldX, y, worldZ, height, featureNoise);
                        if (voxelType !== VoxelType.AIR) {
                            chunk.setVoxel(x, y, z, voxelType);
                        }
                    }
                }
            }
        }
        chunk.updateMesh();
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

    public update() {
        // Update any dynamic terrain features here
    }
} 