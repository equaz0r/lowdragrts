import type { TerrainConfig } from '../terrain/TerrainGenerator';
import type { EdgeSettings } from '../ui/EdgeControls';
import type { ReflectionSettings } from '../ui/ReflectionControls';

export const CURRENT_SCENE_SETTINGS_VERSION = 1 as const;

export interface SceneSettings {
    version: typeof CURRENT_SCENE_SETTINGS_VERSION;
    seed: number;
    terrain: TerrainConfig;
    edge: EdgeSettings;
    reflection: ReflectionSettings;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
    return value !== null && typeof value === 'object' ? value as UnknownRecord : {};
}

function numberIn(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
}

function integerIn(value: unknown, fallback: number, min: number, max: number): number {
    return Math.round(numberIn(value, fallback, min, max));
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function colorOr(value: unknown, fallback: string): string {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
        ? value
        : fallback;
}

/**
 * Validates untrusted/legacy JSON and fills missing fields from the live scene.
 * Version 0 means an old export without an explicit version. Future versions
 * are rejected so new semantics are never guessed silently.
 */
export function normalizeSceneSettings(input: unknown, fallback: SceneSettings): SceneSettings {
    const root = record(input);
    const rawVersion = root.version ?? 0;
    if (!Number.isInteger(rawVersion) || Number(rawVersion) < 0) {
        throw new Error('Settings version must be a non-negative integer.');
    }
    if (Number(rawVersion) > CURRENT_SCENE_SETTINGS_VERSION) {
        throw new Error(`Settings version ${rawVersion} is newer than this build supports.`);
    }

    const terrain = record(root.terrain);
    const edge = record(root.edge);
    const reflection = record(root.reflection);
    const rawLayers = Array.isArray(edge.layers) ? edge.layers : [];

    return {
        version: CURRENT_SCENE_SETTINGS_VERSION,
        seed: integerIn(root.seed, fallback.seed, -2147483648, 2147483647),
        terrain: {
            heightScale: numberIn(terrain.heightScale, fallback.terrain.heightScale, 200, 3000),
            persistence: numberIn(terrain.persistence, fallback.terrain.persistence, 0.2, 0.8),
            basePeakBlend: numberIn(terrain.basePeakBlend, fallback.terrain.basePeakBlend, 0, 1),
            baseFrequency: numberIn(terrain.baseFrequency, fallback.terrain.baseFrequency, 0.0001, 0.002),
            peakFrequency: numberIn(terrain.peakFrequency, fallback.terrain.peakFrequency, 0.0002, 0.003),
            warpAmplitude: numberIn(terrain.warpAmplitude, fallback.terrain.warpAmplitude, 0, 800),
            warpFrequency: numberIn(terrain.warpFrequency, fallback.terrain.warpFrequency, 0.00005, 0.0006),
            peakThreshold: numberIn(terrain.peakThreshold, fallback.terrain.peakThreshold, 0.1, 0.75),
            baseOctaves: integerIn(terrain.baseOctaves, fallback.terrain.baseOctaves, 2, 8),
            peakOctaves: integerIn(terrain.peakOctaves, fallback.terrain.peakOctaves, 2, 8),
            valleyEnabled: booleanOr(terrain.valleyEnabled, fallback.terrain.valleyEnabled),
            valleyWidth: numberIn(terrain.valleyWidth, fallback.terrain.valleyWidth, 0.05, 0.5),
            valleyDepth: numberIn(terrain.valleyDepth, fallback.terrain.valleyDepth, 0, 1),
            valleyAngle: numberIn(terrain.valleyAngle, fallback.terrain.valleyAngle, 0, 360),
            plateauEnabled: booleanOr(terrain.plateauEnabled, fallback.terrain.plateauEnabled),
            plateauCount: integerIn(terrain.plateauCount, fallback.terrain.plateauCount, 0, 8),
            plateauRadius: numberIn(terrain.plateauRadius, fallback.terrain.plateauRadius, 200, 1200),
            plateauEdge: numberIn(terrain.plateauEdge, fallback.terrain.plateauEdge, 0.1, 0.95),
            regionMaskEnabled: booleanOr(terrain.regionMaskEnabled, fallback.terrain.regionMaskEnabled),
            regionMaskFrequency: numberIn(terrain.regionMaskFrequency, fallback.terrain.regionMaskFrequency, 0.00001, 0.0001),
            regionFlatAmplitude: numberIn(terrain.regionFlatAmplitude, fallback.terrain.regionFlatAmplitude, 0, 0.6),
            regionMountainAmplitude: numberIn(terrain.regionMountainAmplitude, fallback.terrain.regionMountainAmplitude, 0.5, 1.5),
        },
        edge: {
            layers: fallback.edge.layers.map((fallbackLayer, index) => {
                const layer = record(rawLayers[index]);
                return {
                    heightFraction: numberIn(layer.heightFraction, fallbackLayer.heightFraction, 0, 1),
                    color: colorOr(layer.color, fallbackLayer.color),
                    intensity: numberIn(layer.intensity, fallbackLayer.intensity, 0, 4),
                };
            }),
            pulseSpeed: numberIn(edge.pulseSpeed, fallback.edge.pulseSpeed, 0, 1),
            pulseIntensity: numberIn(edge.pulseIntensity, fallback.edge.pulseIntensity, 0, 12),
            pulseWidth: numberIn(edge.pulseWidth, fallback.edge.pulseWidth, 0.01, 0.4),
        },
        reflection: {
            metalness: numberIn(reflection.metalness, fallback.reflection.metalness, 0, 1),
            roughness: numberIn(reflection.roughness, fallback.reflection.roughness, 0, 1),
            positionFactor: numberIn(reflection.positionFactor, fallback.reflection.positionFactor, 0.1, 5),
            reflectionPower: numberIn(reflection.reflectionPower, fallback.reflection.reflectionPower, 0, 2),
            sunIntensity: numberIn(reflection.sunIntensity, fallback.reflection.sunIntensity, 0.3, 2),
            sunHeight: numberIn(reflection.sunHeight, fallback.reflection.sunHeight, -0.8, 0.65),
            glitterReach: numberIn(reflection.glitterReach, fallback.reflection.glitterReach, 500, 12000),
            glitterWidth: numberIn(reflection.glitterWidth, fallback.reflection.glitterWidth, 0.2, 3),
        },
    };
}
