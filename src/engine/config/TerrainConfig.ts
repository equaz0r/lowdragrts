import { Color } from 'three';

export const GridParameters = {
    TOTAL_SIZE:    8000,
    DIVISIONS:     100,
    CELL_SIZE:     64,
    MIN_DIVISIONS: 1,
    MAX_DIVISIONS: 1000,
    MIN_CELL_SIZE: 16,
    MAX_CELL_SIZE: 256,
    MIN_TOTAL_SIZE: 1000,
    MAX_TOTAL_SIZE: 10000,
} as const;

export const TerrainParameters = {
    HEIGHT_SCALE: 1400,
    PERSISTENCE:  0.5,

    ANGULAR_STEPS:              6,
    MIN_ANGULAR_BLEND:          0.05,
    MAX_ANGULAR_BLEND:          0.15,
    ANGULAR_HEIGHT_FACTOR_POWER: 1.0,
    ANGULAR_BLEND_CURVE:        0.5,

    PANEL_BORDER_WIDTH: 0.95,
    PANEL_VARIATION:    0.1,

    BASE_COLOR: new Color(0x000033),
    PEAK_COLOR: new Color(0x3366ff),
    EDGE_OPACITY: 1.0,

    MATERIAL_METALNESS:          0.6,
    MATERIAL_ROUGHNESS:          0.4,
    MATERIAL_ENV_MAP_INTENSITY:  0.8,
    USE_WIREFRAME:               false,
    USE_FLAT_SHADING:            true,
} as const;

export const CoordinateMarkerParameters = {
    HEIGHT_OFFSET:      150,
    SCALE:              { x: 300, y: 150, z: 1 },
    CARDINAL_COLOR:     '#ff9933',
    CORNER_COLOR:       '#33ff33',
    OPACITY:            0.9,
    FONT_SIZE:          48,
    FONT_FAMILY:        'Arial',
    FONT_WEIGHT:        'bold',
    BACKGROUND_OPACITY: 0.3,
} as const;

export interface EdgeColorLayer {
    heightFraction: number;
    color: Color;
    intensity: number;
}

/**
 * Live edge appearance config — mutated directly by EdgeControls.
 * NOT as const so controls can modify values at runtime.
 */
export const EdgeParameters = {
    layers: [
        { heightFraction: 0.00, color: new Color(0x000000), intensity: 0.00 },
        { heightFraction: 0.18, color: new Color(0x3a0400), intensity: 0.35 },
        { heightFraction: 0.38, color: new Color(0xff4400), intensity: 0.90 },
        { heightFraction: 0.62, color: new Color(0x00ff44), intensity: 1.40 },
        { heightFraction: 0.82, color: new Color(0x44ffff), intensity: 3.00 },
    ] as EdgeColorLayer[],
    pulseSpeed:     0.22,
    pulseIntensity: 5.0,
    pulseWidth:     0.06,
};
