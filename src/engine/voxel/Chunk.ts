import * as THREE from 'three';
import { VoxelType, VoxelMaterials } from './VoxelTypes';
import { SimplexNoise } from 'simplex-noise-esm';

export const CHUNK_SIZE = 16;

export class Chunk extends THREE.Object3D {
    private voxels: Uint8Array;
    protected mesh: THREE.Mesh | null = null;
    private geometry: THREE.BufferGeometry | null = null;
    protected isDirty: boolean = true;
    private material: THREE.Material | null = null;
    public readonly size: number;

    constructor(x: number, z: number, size: number) {
        super();
        this.position.set(x * size, 0, z * size);
        this.size = size;
        this.voxels = new Uint8Array(size * size * size);
        this.generateTerrain();
        this.isDirty = true;
    }

    public setMaterial(material: THREE.Material): void {
        this.material = material;
        if (this.mesh) {
            this.mesh.material = material;
        }
    }

    private generateTerrain(): void {
        const noise = new SimplexNoise();
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = this.position.x + x;
                const worldZ = this.position.z + z;
                
                const baseNoise = noise.noise2D(worldX * 0.015, worldZ * 0.015);
                const detailNoise = noise.noise2D(worldX * 0.05, worldZ * 0.05) * 0.2;
                const height = Math.floor((baseNoise + detailNoise + 1) * 6) + 4;

                for (let y = 0; y < CHUNK_SIZE; y++) {
                    if (y <= height) {
                        this.setVoxel(x, y, z, VoxelType.STONE);
                    }
                }
            }
        }
    }

    public setVoxel(x: number, y: number, z: number, type: VoxelType): void {
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
        this.voxels[index] = type;
        this.isDirty = true;
    }

    public getVoxel(x: number, y: number, z: number): VoxelType {
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
        return this.voxels[index];
    }

    public getHighestPoint(x: number, z: number): number {
        for (let y = CHUNK_SIZE - 1; y >= 0; y--) {
            if (this.getVoxel(x, y, z) !== VoxelType.AIR) {
                return y;
            }
        }
        return 0;
    }

    public getMesh(): THREE.Mesh | null {
        if (this.isDirty) {
            this.updateMesh();
        }
        return this.mesh;
    }

    private updateMesh(): void {
        if (this.geometry) {
            this.geometry.dispose();
        }

        const vertices: number[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];
        let vertexCount = 0;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const voxelType = this.getVoxel(x, y, z);
                    if (voxelType === VoxelType.AIR) continue;

                    // Add cube vertices with original size
                    const baseIndex = vertexCount;
                    const size = 0.5; // Original size
                    
                    // Front face
                    vertices.push(
                        x - size, y - size, z + size,
                        x + size, y - size, z + size,
                        x + size, y + size, z + size,
                        x - size, y + size, z + size
                    );
                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                    
                    // Back face
                    vertices.push(
                        x - size, y - size, z - size,
                        x + size, y - size, z - size,
                        x + size, y + size, z - size,
                        x - size, y + size, z - size
                    );
                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                    
                    // Top face
                    vertices.push(
                        x - size, y + size, z - size,
                        x + size, y + size, z - size,
                        x + size, y + size, z + size,
                        x - size, y + size, z + size
                    );
                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                    
                    // Bottom face
                    vertices.push(
                        x - size, y - size, z - size,
                        x + size, y - size, z - size,
                        x + size, y - size, z + size,
                        x - size, y - size, z + size
                    );
                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                    
                    // Right face
                    vertices.push(
                        x + size, y - size, z - size,
                        x + size, y + size, z - size,
                        x + size, y + size, z + size,
                        x + size, y - size, z + size
                    );
                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
                    
                    // Left face
                    vertices.push(
                        x - size, y - size, z - size,
                        x - size, y + size, z - size,
                        x - size, y + size, z + size,
                        x - size, y - size, z + size
                    );
                    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

                    // Add indices for each face
                    for (let i = 0; i < 6; i++) {
                        const faceBase = baseIndex + i * 4;
                        indices.push(
                            faceBase, faceBase + 1, faceBase + 2,
                            faceBase, faceBase + 2, faceBase + 3
                        );
                    }

                    vertexCount += 24;
                }
            }
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.geometry.setIndex(indices);

        if (this.mesh) {
            this.mesh.geometry.dispose();
        }

        // Use only the terrain shader material
        if (!this.material) {
            console.error('Material not set for chunk');
            return;
        }
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(this.position);
        this.isDirty = false;
    }

    public update(): void {
        if (this.isDirty) {
            this.updateMesh();
        }
    }

    public dispose(): void {
        if (this.geometry) {
            this.geometry.dispose();
        }
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            }
            this.mesh = null;
        }
        this.geometry = null;
        this.material = null;
    }
} 