import { describe, expect, it } from 'vitest';
import {
    decodeLightingCode,
    decodeSceneCode,
    encodeLightingCode,
    encodeSceneCode,
    LIGHTING_CODE_PREFIX,
    SCENE_CODE_PREFIX,
} from '../../src/engine/config/ShareCodes';
import type { SceneSettings } from '../../src/engine/config/SceneSettings';

const reflection = {
    metalness: 1,
    roughness: 0.32,
    positionFactor: 2.7,
    reflectionPower: 1.5,
    sunIntensity: 2,
    sunHeight: -0.8,
    glitterReach: 2500,
    glitterWidth: 1,
};

const scene: SceneSettings = {
    version: 1,
    seed: 4294967295,
    terrain: {
        heightScale: 1400, persistence: 0.5, basePeakBlend: 0.35,
        baseFrequency: 0.00035, peakFrequency: 0.0009,
        warpAmplitude: 500, warpFrequency: 0.00018,
        peakThreshold: 0.32, baseOctaves: 5, peakOctaves: 7,
        valleyEnabled: true, valleyWidth: 0.14, valleyDepth: 0.85, valleyAngle: 90,
        plateauEnabled: false, plateauCount: 0, plateauRadius: 500, plateauEdge: 0.6,
        regionMaskEnabled: true, regionMaskFrequency: 0.00004,
        regionFlatAmplitude: 0.1, regionMountainAmplitude: 1.15,
    },
    edge: {
        layers: [{ heightFraction: 0.1, color: '#abcdef', intensity: 1 }],
        pulseSpeed: 0.1,
        pulseIntensity: 1.5,
        pulseWidth: 0.04,
    },
    reflection,
};

describe('share codes', () => {
    it('round-trips a lighting code with a recognizable prefix', () => {
        const code = encodeLightingCode(reflection);
        expect(code.startsWith(LIGHTING_CODE_PREFIX)).toBe(true);
        expect(decodeLightingCode(code)).toEqual({ version: 1, reflection });
    });

    it('round-trips a full scene code, including the largest terrain seed', () => {
        const code = encodeSceneCode(scene);
        expect(code.startsWith(SCENE_CODE_PREFIX)).toBe(true);
        expect(decodeSceneCode(code)).toEqual(scene);
    });

    it('rejects the wrong type prefix and damaged payloads clearly', () => {
        const lightingCode = encodeLightingCode(reflection);
        expect(() => decodeSceneCode(lightingCode)).toThrow('Expected a code beginning');
        expect(() => decodeLightingCode(`${LIGHTING_CODE_PREFIX}%%%`))
            .toThrow('invalid characters');
    });
});
