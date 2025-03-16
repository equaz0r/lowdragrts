import * as THREE from 'three';
import { VoxelType, VOXEL_MATERIALS } from './VoxelTypes';
import { ChunkMesher } from './ChunkMesher';

export const CHUNK_SIZE = 25; // 25x25x25 voxels per chunk

export class Chunk {
    private voxels: Uint8Array;
    private mesh: THREE.Mesh | null = null;
    private dirty: boolean = true;
    public readonly position: THREE.Vector3;

    constructor(x: number, y: number, z: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.voxels = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
        this.initializeVoxels();
    }

    private initializeVoxels(): void {
        // Initialize with air by default
        this.voxels.fill(VoxelType.AIR);
    }

    public getVoxel(x: number, y: number, z: number): VoxelType {
        if (this.isValidPosition(x, y, z)) {
            return this.voxels[this.getIndex(x, y, z)];
        }
        return VoxelType.AIR;
    }

    public setVoxel(x: number, y: number, z: number, type: VoxelType): boolean {
        if (this.isValidPosition(x, y, z)) {
            const index = this.getIndex(x, y, z);
            if (this.voxels[index] !== type) {
                this.voxels[index] = type;
                this.dirty = true;
                return true;
            }
        }
        return false;
    }

    private isValidPosition(x: number, y: number, z: number): boolean {
        return (
            x >= 0 && x < CHUNK_SIZE &&
            y >= 0 && y < CHUNK_SIZE &&
            z >= 0 && z < CHUNK_SIZE
        );
    }

    private getIndex(x: number, y: number, z: number): number {
        return (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public getMesh(): THREE.Mesh | null {
        return this.mesh;
    }

    public dispose(): void {
        if (this.mesh) {
            if (this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            }
        }
    }

    public updateMesh(): void {
        if (this.dirty) {
            // Dispose of old mesh if it exists
            this.dispose();
            
            // Generate new mesh
            this.mesh = ChunkMesher.generateMesh(this);
            
            // Update mesh position
            this.mesh.position.set(
                this.position.x * CHUNK_SIZE,
                this.position.y * CHUNK_SIZE,
                this.position.z * CHUNK_SIZE
            );
            
            this.dirty = false;
        }
    }
} 