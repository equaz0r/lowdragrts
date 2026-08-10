import { Color, Vector4 } from 'three';

export const LightingParameters = {
    SKY_TOP_COLOR:    new Color(0x0033cc),
    SKY_MIDDLE_COLOR: new Color(0x6699ff),
    SKY_BOTTOM_COLOR: new Color(0xff9966),
    SKY_GRADIENT_OFFSET:   400,
    SKY_GRADIENT_EXPONENT: 0.6,

    SUN_GEOMETRY_SIZE: 900,
    SUN_OPACITY:       0.9,
    SUN_LOW_COLOR:     new Color(0xff0033),
    SUN_HIGH_COLOR:    new Color(0xffffee),
    SUN_ORBIT_RADIUS:  8000,
    SUN_MAX_HEIGHT:    0.65,
    SUN_MIN_HEIGHT:    -0.8,
    SUN_BASE_INTENSITY: 1.1,

    SUN_MIN_SCALE:   0.4,
    SUN_MAX_SCALE:   4.0,
    SUN_SCALE_POWER: 0.2,

    SUN_TRANSITION_START:    0.85,
    SUN_TRANSITION_END:      0.7,
    SUN_LOW_DEPTH_THRESHOLD: 0.3,

    SUN_GRADIENT_BOTTOM: new Color(0x000066),
    SUN_GRADIENT_MIDDLE: new Color(0xff1133),
    SUN_GRADIENT_TOP:    new Color(0xff6600),

    HALO_SIZE:         6000,
    HALO_INTENSITY:    0.4,
    HALO_FRONT_OFFSET: 50,
    HALO_BACK_OFFSET:  -50,

    AMBIENT_BASE_INTENSITY:  0.3,
    SUN_INTENSITY_RANGE:     [0.7, 1.0],
    AMBIENT_INTENSITY_RANGE: [0.3, 0.5],

    SUN_HEIGHT_SMOOTH_SPEED: 0.15,
} as const;

export const ReflectionParameters = {
    REFLECTION_PARAMS: new Vector4(0.4, 0.6, 1.0, 0.4),
    SUN_INTENSITY:     0.5,

    VIEW_FACTOR_WEIGHT:     1.5,
    SUN_FACTOR_WEIGHT:      1.2,
    POSITION_FACTOR_WEIGHT: 0.6,
    PANEL_FACTOR_WEIGHT:    0.2,
    GRAZING_FACTOR_WEIGHT:  1.0,

    SUN_FACTOR_POWER:     0.6,
    VIEW_FACTOR_POWER:    1.0,
    HEIGHT_FACTOR_POWER:  0.3,
    GRAZING_FACTOR_POWER: 0.8,

    MIN_REFLECTION:    0.1,
    REFLECTION_BLEND:  1.2,

    WEST_FALLOFF_START:  -4000,
    WEST_FALLOFF_LENGTH:  8000,
} as const;
