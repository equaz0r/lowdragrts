import { Color, Vector3, Vector4 } from 'three';

/**
 * Central configuration for all game parameters.
 * This file serves as the single source of truth for adjustable parameters across the game.
 */

export const GridParameters = {
    /** Base size of the grid in world units */
    TOTAL_SIZE: 4000,
    
    /** Number of grid divisions (lines) */
    DIVISIONS: 100,
    
    /** Size of individual grid cells */
    CELL_SIZE: 64,
    
    /** Grid line colors */
    MAIN_COLOR: 0x444444,
    SECONDARY_COLOR: 0x888888,
    
    /** Panel settings */
    PANEL_BORDER_WIDTH: 0.95,
    PANEL_VARIATION: 0.1
} as const;

export const TerrainParameters = {
    /** Base terrain generation parameters */
    HEIGHT_SCALE: 800,
    NOISE_SCALE: 0.001,
    NOISE_OCTAVES: 8,
    PERSISTENCE: 0.65,
    LACUNARITY: 1.6,
    
    /** Base terrain noise settings */
    BASE_NOISE_FREQUENCY: 0.3,
    BASE_NOISE_OCTAVES: 6,
    BASE_AMPLITUDE_FALLOFF: 0.7,
    BASE_FREQUENCY_INCREASE: 1.6,
    BASE_NOISE_WEIGHTS: [0.4, 0.4, 0.2],
    
    /** Peak generation settings */
    PEAK_NOISE_FREQUENCY_MULTIPLIER: 1.2,
    PEAK_NOISE_WEIGHTS: [0.2, 0.2, 0.3, 0.3],
    PEAK_LOW_THRESHOLD: 0.25,
    PEAK_HIGH_THRESHOLD: 0.6,
    
    /** Angular terrain settings */
    ANGULAR_STEPS: 20,
    MIN_ANGULAR_BLEND: 0.3,
    MAX_ANGULAR_BLEND: 0.5,
    
    /** Edge parameters */
    LOW_HEIGHT_THRESHOLD: 0.15,
    TRANSITION_THRESHOLD: 0.2,
    ALIGNED_EDGE_INTENSITY: 1.0,
    NON_ALIGNED_EDGE_INTENSITY: 0.15,
    HEIGHT_INTENSITY_MIN: 0.4,
    HEIGHT_INTENSITY_MAX: 1.6,
    
    /** Panel parameters */
    PANEL_BORDER_WIDTH: 0.95,
    PANEL_VARIATION: 0.1,
    
    /** Colors */
    BASE_COLOR: new Color(0x000033),
    PEAK_COLOR: new Color(0x3366ff),
    LOW_EDGE_COLOR: new Color(0xff6600),
    HIGH_EDGE_COLOR: new Color(0x00ff00),
    EDGE_OPACITY: 0.6,
    
    /** Material properties */
    MATERIAL_METALNESS: 0.6,
    MATERIAL_ROUGHNESS: 0.4,
    MATERIAL_ENV_MAP_INTENSITY: 0.8,
    USE_WIREFRAME: false,
    USE_FLAT_SHADING: true
} as const;

export const CoordinateMarkerParameters = {
    /** Marker positioning */
    HEIGHT_OFFSET: 150,
    SCALE: new Vector3(300, 150, 1),
    
    /** Appearance */
    CARDINAL_COLOR: '#ff9933',
    CORNER_COLOR: '#33ff33',
    OPACITY: 0.9,
    FONT_SIZE: 48,
    
    /** Text settings */
    FONT_FAMILY: 'Arial',
    FONT_WEIGHT: 'bold',
    BACKGROUND_OPACITY: 0.3
} as const;

export const LightingParameters = {
    /** Sky colors */
    SKY_TOP_COLOR: new Color(0x0033cc),
    SKY_MIDDLE_COLOR: new Color(0x6699ff),
    SKY_BOTTOM_COLOR: new Color(0xff9966),
    SKY_GRADIENT_OFFSET: 400,
    SKY_GRADIENT_EXPONENT: 0.6,
    
    /** Sun parameters */
    SUN_GEOMETRY_SIZE: 900,
    SUN_OPACITY: 0.9,
    SUN_LOW_COLOR: new Color(0xff0033),
    SUN_HIGH_COLOR: new Color(0xffffee),
    SUN_ORBIT_RADIUS: 8000,
    SUN_MAX_HEIGHT: 0.65,
    SUN_MIN_HEIGHT: -0.8,
    SUN_BASE_INTENSITY: 1.1,
    
    /** Sun scaling parameters */
    SUN_MIN_SCALE: 0.4,    // Sun is 40% size when highest
    SUN_MAX_SCALE: 4.0,    // Sun is 400% size when at horizon
    SUN_SCALE_POWER: 0.2,  // Power factor for size scaling curve
    
    /** Sun color transition parameters */
    SUN_TRANSITION_START: 0.85,  // Height at which sun starts transitioning from high to low colors
    SUN_TRANSITION_END: 0.7,     // Height at which sun completes transition to sunset colors
    SUN_LOW_DEPTH_THRESHOLD: 0.3, // Height below which deeper sunset colors are used
    
    /** Sun gradient colors */
    SUN_GRADIENT_BOTTOM: new Color(0x000066),  // Deep blue for bottom of sun
    SUN_GRADIENT_MIDDLE: new Color(0xff1133),  // Bright red for middle of sun
    SUN_GRADIENT_TOP: new Color(0xff6600),     // Orange for top of sun
    
    /** Halo effect */
    HALO_SIZE: 6000,
    HALO_INTENSITY: 0.4,
    HALO_FRONT_OFFSET: 50,   // Z-offset for front halo plane
    HALO_BACK_OFFSET: -50,   // Z-offset for back halo plane
    
    /** Light intensities */
    AMBIENT_BASE_INTENSITY: 0.3,
    SUN_INTENSITY_RANGE: [0.7, 1.0],
    AMBIENT_INTENSITY_RANGE: [0.3, 0.5],
    
    /** Sun animation */
    SUN_HEIGHT_SMOOTH_SPEED: 0.15  // Speed factor for smooth sun height transitions
} as const;

export const ReflectionParameters = {
    /** Base reflection settings */
    REFLECTION_PARAMS: new Vector4(0.7, 0.2, 2.0, 0.6),
    SUN_INTENSITY: 0.8,
    
    /** Factor weights */
    VIEW_FACTOR_WEIGHT: 2.5,
    SUN_FACTOR_WEIGHT: 2.0,
    POSITION_FACTOR_WEIGHT: 0.8,
    PANEL_FACTOR_WEIGHT: 0.2,
    GRAZING_FACTOR_WEIGHT: 1.5,
    
    /** Power settings */
    SUN_FACTOR_POWER: 0.4,
    VIEW_FACTOR_POWER: 0.8,
    HEIGHT_FACTOR_POWER: 0.2,
    GRAZING_FACTOR_POWER: 0.6,
    
    /** Thresholds */
    MIN_REFLECTION: 0.2,
    REFLECTION_BLEND: 2.0,
    
    /** Position-based settings */
    WEST_FALLOFF_START: -2000,
    WEST_FALLOFF_LENGTH: 4000
} as const;

export const CameraParameters = {
    /** Initial camera settings */
    INITIAL_POSITION: new Vector3(2000, 1500, 2000),
    FAR_CLIP_PLANE: 100000,
    FIELD_OF_VIEW: 75
} as const; 