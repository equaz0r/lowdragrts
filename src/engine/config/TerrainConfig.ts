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

/**
 * Building footprint sizes, in grid cells (see GridSystem.worldToCell/cellToWorld).
 * 1 cell = CELL_SIZE world units = 64, so SMALL = 64×64, LARGE = 192×192.
 * Placement/production (Phase 8) reads these; not wired to real building types yet.
 */
export const BuildingFootprints = {
    SMALL:  1, // most buildings
    MEDIUM: 2,
    LARGE:  3, // largest footprint in the design
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

    BASE_COLOR: new Color(0x0a0022),
    PEAK_COLOR: new Color(0x5a3fd6), // shifted violet, ties the surface to the grid's purple layers
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
 *
 * Synthwave ramp, low → high: black/deep-navy (invisible) → indigo → deep
 * purple → hot pink → warm orange peaks — peaks echo the sun's warm core
 * instead of a cool cyan, per reference. All still live-tunable in the
 * EdgeControls colour pickers — these are just the starting point.
 */
// Height%/intensity below are Simon's hand-tuned scene (11 Aug 2026), read off
// a screenshot. Colours kept as the prior defaults — a colour-picker swatch in
// a screenshot isn't reliably readable back to an exact hex value, and the
// swatches shown were the same hue family as these already, so not worth
// guessing precise hex over. Layer 1's height (10%) now sits ABOVE layer 2's
// (8%) — non-monotonic, presumably from live-dragging rather than deliberate
// — kept as shown, not "fixed".
export const EdgeParameters = {
    layers: [
        { heightFraction: 0.10, color: new Color(0x0a0518), intensity: 1.80 },
        { heightFraction: 0.08, color: new Color(0x2a0f70), intensity: 2.90 },
        { heightFraction: 0.50, color: new Color(0x7a12c8), intensity: 3.10 },
        { heightFraction: 0.62, color: new Color(0xff1f95), intensity: 3.30 },
        { heightFraction: 0.89, color: new Color(0xff7a00), intensity: 5.00 },
    ] as EdgeColorLayer[],
    pulseSpeed:     0.22,
    pulseIntensity: 5.6,
    pulseWidth:     0.090,
};
