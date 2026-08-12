import { Color } from 'three';

const WORLD_SIZE = 8000;
const BUILD_CELL_SIZE = 64;
const HEIGHT_SAMPLE_SPACING = 64;

/**
 * Spatial constants have one meaning each. Counts are derived so world size,
 * build placement, the rendered grid, and height samples cannot silently drift.
 *
 * The build grid and height samples currently align one-to-one. They are named
 * separately because terrain deformation may later need denser height samples
 * without changing building footprints or navigation cells.
 */
export const GridParameters = {
    WORLD_SIZE,
    BUILD_CELL_SIZE,
    BUILD_CELL_COUNT: WORLD_SIZE / BUILD_CELL_SIZE,
    HEIGHT_SAMPLE_SPACING,
    HEIGHT_SAMPLE_COUNT: WORLD_SIZE / HEIGHT_SAMPLE_SPACING + 1,
} as const;

/**
 * Building footprint sizes, in grid cells (see GridSystem.worldToCell/cellToWorld).
 * 1 cell = BUILD_CELL_SIZE world units = 64, so SMALL = 64×64, LARGE = 192×192.
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

export const EDGE_LAYER_MIN_GAP = 0.01;

/** Keep shader ramp thresholds finite, bounded, and strictly low-to-high. */
export function normalizeEdgeLayerHeights(layers: EdgeColorLayer[]): void {
    const lastIndex = layers.length - 1;
    let previous = -EDGE_LAYER_MIN_GAP;

    layers.forEach((layer, index) => {
        const fallback = lastIndex > 0 ? index / lastIndex : 0;
        const requested = Number.isFinite(layer.heightFraction)
            ? layer.heightFraction
            : fallback;
        const min = Math.max(index * EDGE_LAYER_MIN_GAP, previous + EDGE_LAYER_MIN_GAP);
        const max = 1 - (lastIndex - index) * EDGE_LAYER_MIN_GAP;
        layer.heightFraction = Math.min(max, Math.max(min, requested));
        previous = layer.heightFraction;
    });
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
// a screenshot isn't reliably readable back to an exact hex value. The first
// two thresholds are ordered 8% then 10%; reversed thresholds make smoothstep
// transitions overlap and produce misleading colour bands.
export const EdgeParameters = {
    layers: [
        { heightFraction: 0.08, color: new Color(0x0a0518), intensity: 1.80 },
        { heightFraction: 0.10, color: new Color(0x2a0f70), intensity: 2.90 },
        { heightFraction: 0.50, color: new Color(0x7a12c8), intensity: 3.10 },
        { heightFraction: 0.62, color: new Color(0xff1f95), intensity: 3.30 },
        { heightFraction: 0.89, color: new Color(0xff7a00), intensity: 5.00 },
    ] as EdgeColorLayer[],
    pulseSpeed:     0.11,
    pulseIntensity: 1.6,
    pulseWidth:     0.04,
};
