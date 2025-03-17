import * as THREE from 'three';
import { VoxelType, VOXEL_MATERIALS } from './VoxelTypes';
import { ChunkMesher } from './ChunkMesher';

export const CHUNK_SIZE = 16; // 16x16x16 voxels per chunk

export class Chunk {
    private voxels: VoxelType[][][];
    private mesh: THREE.Mesh | null = null;
    private dirty: boolean = true;
    public position: THREE.Vector3;

    constructor(x: number, y: number, z: number) {
        this.position = new THREE.Vector3(x, y, z);
        this.voxels = Array(CHUNK_SIZE).fill(null).map(() =>
            Array(CHUNK_SIZE).fill(null).map(() =>
                Array(CHUNK_SIZE).fill(VoxelType.AIR)
            )
        );
    }

    public setVoxel(x: number, y: number, z: number, type: VoxelType): void {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
            return;
        }
        this.voxels[x][y][z] = type;
        this.dirty = true;
    }

    public getVoxel(x: number, y: number, z: number): VoxelType {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
            return VoxelType.AIR;
        }
        return this.voxels[x][y][z];
    }

    public updateMesh(): void {
        if (!this.dirty) return;

        // Remove old mesh if it exists
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            }
        }

        // Generate new mesh
        this.mesh = ChunkMesher.generateMesh(this);
        this.mesh.position.copy(this.position).multiplyScalar(CHUNK_SIZE);
        this.dirty = false;
    }

    public getMesh(): THREE.Mesh | null {
        return this.mesh;
    }

    public isDirty(): boolean {
        return this.dirty;
    }

    public dispose(): void {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
    }

    public getMaterialForVoxelType(type: VoxelType): THREE.Material {
        const materialDef = VOXEL_MATERIALS[type];
        return new THREE.MeshPhongMaterial({
            color: materialDef.color,
            transparent: materialDef.transparent,
            opacity: materialDef.opacity,
            emissive: materialDef.emissive,
            emissiveIntensity: materialDef.emissiveIntensity,
            wireframe: materialDef.wireframe,
            side: THREE.DoubleSide
        });
    }
} 