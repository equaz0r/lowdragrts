export enum VoxelType {
    AIR = 0,
    DIRT = 1,
    GRASS = 2,
    STONE = 3,
    SKIRULUM_ORE = 4,
    FREDALITE_CRYSTAL = 5,
    BEDROCK = 6
}

export interface Voxel {
    type: VoxelType;
    // Additional properties like damage state could be added later
}

export interface VoxelMaterial {
    color: number;      // Hex color
    transparent: boolean;
    emission?: number;  // For glowing materials like Fredalite
    destructible: boolean;
}

export const VOXEL_MATERIALS: { [key in VoxelType]: VoxelMaterial } = {
    [VoxelType.AIR]: {
        color: 0x000000,
        transparent: true,
        destructible: false
    },
    [VoxelType.DIRT]: {
        color: 0x8B4513,
        transparent: false,
        destructible: true
    },
    [VoxelType.GRASS]: {
        color: 0x567d46,
        transparent: false,
        destructible: true
    },
    [VoxelType.STONE]: {
        color: 0x808080,
        transparent: false,
        destructible: true
    },
    [VoxelType.SKIRULUM_ORE]: {
        color: 0x4B0082,
        transparent: false,
        emission: 1.0,
        destructible: true
    },
    [VoxelType.FREDALITE_CRYSTAL]: {
        color: 0x00FF00,
        transparent: true,
        emission: 2.0,
        destructible: true
    },
    [VoxelType.BEDROCK]: {
        color: 0x0A0A0A,
        transparent: false,
        destructible: false
    }
}; 