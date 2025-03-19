import * as THREE from 'three';
import { MaterialManager } from '../graphics/MaterialManager';

export enum VoxelType {
    AIR = 0,
    DIRT = 1,
    STONE = 2,
    GRASS = 3,
    WOOD = 4,
    LEAVES = 5
}

export interface Voxel {
    type: VoxelType;
    // Additional properties like damage state could be added later
}

export interface VoxelMaterialProps {
    color: number;
    emissive: number;
    emissiveIntensity: number;
    transparent: boolean;
    opacity: number;
    side: THREE.Side;
}

export const VOXEL_MATERIALS: { [key in VoxelType]?: VoxelMaterialProps } = {
    [VoxelType.GRASS]: {
        color: 0x4CAF50,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide
    },
    [VoxelType.DIRT]: {
        color: 0x8B4513,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide
    },
    [VoxelType.STONE]: {
        color: 0x808080,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide
    }
};

export class VoxelMaterials {
    public static getMaterial(type: VoxelType): THREE.Material {
        const materialProps = VOXEL_MATERIALS[type];
        if (!materialProps) {
            return new THREE.MeshBasicMaterial({ visible: false });
        }

        // Use the terrain shader for all voxel types
        return MaterialManager.getShader('terrain');
    }
} 