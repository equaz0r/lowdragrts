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
        const material = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5,
            wireframe: true,
            side: THREE.DoubleSide
        });

        const vertices: number[] = [];
        const indices: number[] = [];
        let vertexCount = 0;

        // Generate mesh for each voxel
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const voxelType = chunk.getVoxel(x, y, z);
                    if (voxelType !== VoxelType.AIR) {
                        // Add cube vertices
                        const cubeVertices = this.getCubeVertices(x, y, z);
                        vertices.push(...cubeVertices);

                        // Add indices
                        for (let i = 0; i < 24; i++) {
                            indices.push(vertexCount + i);
                        }
                        vertexCount += 24;
                    }
                }
            }
        }

        // Set up geometry
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // Create and return mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(chunk.position).multiplyScalar(CHUNK_SIZE);
        return mesh;
    }

    private static getCubeVertices(x: number, y: number, z: number): number[] {
        const size = 0.5;
        return [
            // Front face
            x - size, y - size, z + size,
            x + size, y - size, z + size,
            x + size, y + size, z + size,
            x - size, y + size, z + size,
            // Back face
            x - size, y - size, z - size,
            x + size, y - size, z - size,
            x + size, y + size, z - size,
            x - size, y + size, z - size,
            // Top face
            x - size, y + size, z - size,
            x + size, y + size, z - size,
            x + size, y + size, z + size,
            x - size, y + size, z + size,
            // Bottom face
            x - size, y - size, z - size,
            x + size, y - size, z - size,
            x + size, y - size, z + size,
            x - size, y - size, z + size,
            // Right face
            x + size, y - size, z - size,
            x + size, y + size, z - size,
            x + size, y + size, z + size,
            x + size, y - size, z + size,
            // Left face
            x - size, y - size, z - size,
            x - size, y + size, z - size,
            x - size, y + size, z + size,
            x - size, y - size, z + size
        ];
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
        colors: number[],
        vertexOffset: number,
        indexOffset: number
    ): void {
        const material = chunk.getMaterialForVoxelType(voxelType) as THREE.MeshPhongMaterial;
        const color = new THREE.Color(material.color);

        // Check each face
        Object.entries(this.FACES).forEach(([face, faceVertices]) => {
            if (this.shouldRenderFace(chunk, x, y, z, face)) {
                const currentVertexOffset = vertexOffset + (Object.keys(this.FACES).indexOf(face) * 4);

                // Add face vertices
                faceVertices.forEach((vertex, i) => {
                    const idx = currentVertexOffset + i;
                    vertices[idx * 3] = x + vertex[0];
                    vertices[idx * 3 + 1] = y + vertex[1];
                    vertices[idx * 3 + 2] = z + vertex[2];
                    colors[idx * 3] = color.r;
                    colors[idx * 3 + 1] = color.g;
                    colors[idx * 3 + 2] = color.b;
                });

                // Add face normals
                const normal = this.NORMALS[face];
                for (let i = 0; i < 4; i++) {
                    const idx = currentVertexOffset + i;
                    normals[idx * 3] = normal[0];
                    normals[idx * 3 + 1] = normal[1];
                    normals[idx * 3 + 2] = normal[2];
                }

                // Add face indices
                const currentIndexOffset = indexOffset + (Object.keys(this.FACES).indexOf(face) * 2);
                indices[currentIndexOffset * 3] = currentVertexOffset;
                indices[currentIndexOffset * 3 + 1] = currentVertexOffset + 1;
                indices[currentIndexOffset * 3 + 2] = currentVertexOffset + 2;
                indices[currentIndexOffset * 3 + 3] = currentVertexOffset;
                indices[currentIndexOffset * 3 + 4] = currentVertexOffset + 2;
                indices[currentIndexOffset * 3 + 5] = currentVertexOffset + 3;
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