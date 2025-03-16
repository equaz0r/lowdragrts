import * as THREE from 'three';
import { Chunk, CHUNK_SIZE } from './Chunk';
import { VoxelType, VOXEL_MATERIALS } from './VoxelTypes';

interface VoxelFace {
    vertices: number[];
    normals: number[];
    indices: number[];
    uvs: number[];
}

export class ChunkMesher {
    private static readonly FACES: { [key: string]: number[][] } = {
        top: [
            [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]
        ],
        bottom: [
            [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]
        ],
        left: [
            [0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]
        ],
        right: [
            [1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]
        ],
        front: [
            [0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]
        ],
        back: [
            [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 0]
        ]
    };

    private static readonly NORMALS: { [key: string]: number[] } = {
        top: [0, 1, 0],
        bottom: [0, -1, 0],
        left: [-1, 0, 0],
        right: [1, 0, 0],
        front: [0, 0, 1],
        back: [0, 0, -1]
    };

    public static generateMesh(chunk: Chunk): THREE.Mesh {
        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const normals: number[] = [];
        const indices: number[] = [];
        const colors: number[] = [];

        // Iterate through all voxels in the chunk
        for (let y = 0; y < CHUNK_SIZE; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const voxelType = chunk.getVoxel(x, y, z);
                    if (voxelType === VoxelType.AIR) continue;

                    this.addVoxelToMesh(
                        chunk,
                        x, y, z,
                        voxelType,
                        vertices,
                        normals,
                        indices,
                        colors
                    );
                }
            }
        }

        // Set geometry attributes
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);

        // Create material
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            transparent: true,
            side: THREE.DoubleSide
        });

        return new THREE.Mesh(geometry, material);
    }

    private static addVoxelToMesh(
        chunk: Chunk,
        x: number,
        y: number,
        z: number,
        voxelType: VoxelType,
        vertices: number[],
        normals: number[],
        indices: number[],
        colors: number[]
    ): void {
        const material = VOXEL_MATERIALS[voxelType];
        const color = new THREE.Color(material.color);

        // Check each face
        Object.entries(this.FACES).forEach(([face, faceVertices]) => {
            if (this.shouldRenderFace(chunk, x, y, z, face)) {
                const vertexOffset = vertices.length / 3;

                // Add face vertices
                faceVertices.forEach(vertex => {
                    vertices.push(
                        x + vertex[0],
                        y + vertex[1],
                        z + vertex[2]
                    );
                    colors.push(color.r, color.g, color.b);
                });

                // Add face normals
                const normal = this.NORMALS[face];
                for (let i = 0; i < 4; i++) {
                    normals.push(...normal);
                }

                // Add face indices
                indices.push(
                    vertexOffset,
                    vertexOffset + 1,
                    vertexOffset + 2,
                    vertexOffset,
                    vertexOffset + 2,
                    vertexOffset + 3
                );
            }
        });
    }

    private static shouldRenderFace(
        chunk: Chunk,
        x: number,
        y: number,
        z: number,
        face: string
    ): boolean {
        let nx = x, ny = y, nz = z;

        switch (face) {
            case 'top': ny++; break;
            case 'bottom': ny--; break;
            case 'left': nx--; break;
            case 'right': nx++; break;
            case 'front': nz++; break;
            case 'back': nz--; break;
        }

        // Check if neighbor is outside chunk bounds
        if (nx < 0 || nx >= CHUNK_SIZE || 
            ny < 0 || ny >= CHUNK_SIZE || 
            nz < 0 || nz >= CHUNK_SIZE) {
            return true;
        }

        // Only render face if neighbor is air or transparent
        const neighborType = chunk.getVoxel(nx, ny, nz);
        return neighborType === VoxelType.AIR || 
               VOXEL_MATERIALS[neighborType].transparent;
    }
} 