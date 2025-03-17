import * as THREE from 'three';

export enum VoxelType {
    AIR = 'AIR',
    GRASS = 'GRASS',
    DIRT = 'DIRT',
    STONE = 'STONE',
    IRON = 'IRON',
    COPPER = 'COPPER',
    CRYSTAL = 'CRYSTAL',
    WATER = 'WATER'
}

export interface Voxel {
    type: VoxelType;
    // Additional properties like damage state could be added later
}

export interface VoxelMaterial {
    color: number;
    transparent: boolean;
    opacity: number;
    emissive: number;
    emissiveIntensity: number;
    wireframe: boolean;
}

export const VOXEL_MATERIALS: { [key in VoxelType]: {
    color: number;
    transparent: boolean;
    opacity: number;
    emissive: number;
    emissiveIntensity: number;
    wireframe: boolean;
} } = {
    [VoxelType.AIR]: {
        color: 0x000000,
        transparent: true,
        opacity: 0,
        emissive: 0x000000,
        emissiveIntensity: 0,
        wireframe: false
    },
    [VoxelType.GRASS]: {
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        emissive: 0x00ff00,
        emissiveIntensity: 0.2,
        wireframe: true
    },
    [VoxelType.DIRT]: {
        color: 0x8B4513,
        transparent: true,
        opacity: 0.3,
        emissive: 0x8B4513,
        emissiveIntensity: 0.2,
        wireframe: true
    },
    [VoxelType.STONE]: {
        color: 0x808080,
        transparent: true,
        opacity: 0.3,
        emissive: 0x808080,
        emissiveIntensity: 0.2,
        wireframe: true
    },
    [VoxelType.IRON]: {
        color: 0xC0C0C0,
        transparent: true,
        opacity: 0.3,
        emissive: 0xC0C0C0,
        emissiveIntensity: 0.2,
        wireframe: true
    },
    [VoxelType.COPPER]: {
        color: 0xB87333,
        transparent: true,
        opacity: 0.3,
        emissive: 0xB87333,
        emissiveIntensity: 0.2,
        wireframe: true
    },
    [VoxelType.CRYSTAL]: {
        color: 0x00FFFF,
        transparent: true,
        opacity: 0.3,
        emissive: 0x00FFFF,
        emissiveIntensity: 0.2,
        wireframe: true
    },
    [VoxelType.WATER]: {
        color: 0x0000ff,
        transparent: true,
        opacity: 0.3,
        emissive: 0x0000ff,
        emissiveIntensity: 0.2,
        wireframe: true
    }
};

export class VoxelMaterials {
    private static materials: Map<VoxelType, THREE.Material> = new Map();

    public static getMaterial(type: VoxelType): THREE.Material {
        if (this.materials.has(type)) {
            return this.materials.get(type)!;
        }

        let material: THREE.Material;
        switch (type) {
            case VoxelType.GRASS:
                material = new THREE.MeshBasicMaterial({
                    color: 0x00ff00,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });
                break;
            case VoxelType.STONE:
                material = new THREE.MeshBasicMaterial({
                    color: 0x808080,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });
                break;
            case VoxelType.WATER:
                material = new THREE.MeshBasicMaterial({
                    color: 0x0000ff,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });
                break;
            default:
                material = new THREE.MeshBasicMaterial({
                    color: 0x808080,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });
        }

        this.materials.set(type, material);
        return material;
    }

    public static dispose(): void {
        this.materials.forEach(material => {
            material.dispose();
        });
        this.materials.clear();
    }
} 