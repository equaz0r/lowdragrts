import { describe, expect, it } from 'vitest';
import {
    normalizeSceneSettings,
    SceneSettings,
} from '../../src/engine/config/SceneSettings';

const fallback: SceneSettings = {
    version: 1,
    seed: 42,
    terrain: {
        heightScale: 1400,
        persistence: 0.5,
        basePeakBlend: 0.35,
        baseFrequency: 0.00035,
        peakFrequency: 0.0009,
        warpAmplitude: 500,
        warpFrequency: 0.00018,
        peakThreshold: 0.32,
        baseOctaves: 5,
        peakOctaves: 7,
        valleyEnabled: true,
        valleyWidth: 0.14,
        valleyDepth: 0.85,
        valleyAngle: 90,
        plateauEnabled: false,
        plateauCount: 0,
        plateauRadius: 500,
        plateauEdge: 0.6,
        regionMaskEnabled: true,
        regionMaskFrequency: 0.00004,
        regionFlatAmplitude: 0.1,
        regionMountainAmplitude: 1.15,
    },
    edge: {
        layers: Array.from({ length: 5 }, (_, index) => ({
            heightFraction: index * 0.2,
            color: '#112233',
            intensity: 1,
        })),
        pulseSpeed: 0.1,
        pulseIntensity: 1.5,
        pulseWidth: 0.04,
    },
    reflection: {
        metalness: 1,
        roughness: 0.32,
        positionFactor: 2.7,
        reflectionPower: 1.5,
        sunIntensity: 2,
        sunHeight: -0.8,
        glitterReach: 2500,
        glitterWidth: 1,
    },
};

describe('normalizeSceneSettings', () => {
    it('migrates a partial versionless export using live fallbacks', () => {
        const result = normalizeSceneSettings({
            seed: 99,
            terrain: { heightScale: 1800 },
            edge: {},
            reflection: { roughness: 0.5 },
        }, fallback);

        expect(result.version).toBe(1);
        expect(result.seed).toBe(99);
        expect(result.terrain.heightScale).toBe(1800);
        expect(result.terrain.persistence).toBe(fallback.terrain.persistence);
        expect(result.edge.layers).toEqual(fallback.edge.layers);
        expect(result.reflection.roughness).toBe(0.5);
    });

    it('clamps ranges and rejects invalid scalar values', () => {
        const result = normalizeSceneSettings({
            version: 1,
            seed: Number.POSITIVE_INFINITY,
            terrain: { heightScale: 9999, persistence: Number.NaN },
            edge: {
                layers: [{ heightFraction: -10, color: 'not-a-colour', intensity: 99 }],
                pulseWidth: 0,
            },
            reflection: { sunHeight: 10, glitterWidth: 1200 },
        }, fallback);

        expect(result.seed).toBe(fallback.seed);
        expect(result.terrain.heightScale).toBe(3000);
        expect(result.terrain.persistence).toBe(fallback.terrain.persistence);
        expect(result.edge.layers[0]).toEqual({
            heightFraction: 0,
            color: fallback.edge.layers[0].color,
            intensity: 4,
        });
        expect(result.edge.pulseWidth).toBe(0.01);
        expect(result.reflection.sunHeight).toBe(0.65);
        expect(result.reflection.glitterWidth).toBe(3);
    });

    it('rejects settings from a newer unsupported version', () => {
        expect(() => normalizeSceneSettings({ version: 2 }, fallback))
            .toThrow('newer than this build supports');
    });

    it('supports the full unsigned 32-bit terrain-seed range', () => {
        expect(normalizeSceneSettings({ seed: 4294967295 }, fallback).seed)
            .toBe(4294967295);
        expect(normalizeSceneSettings({ seed: 4294967296 }, fallback).seed)
            .toBe(4294967295);
    });
});
