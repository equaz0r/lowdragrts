import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import {
    EDGE_LAYER_MIN_GAP,
    EdgeColorLayer,
    normalizeEdgeLayerHeights,
} from '../../src/engine/config/TerrainConfig';

function layers(heights: number[]): EdgeColorLayer[] {
    return heights.map((heightFraction, index) => ({
        heightFraction,
        color: new Color(index),
        intensity: index + 1,
    }));
}

describe('normalizeEdgeLayerHeights', () => {
    it('makes invalid thresholds finite, bounded, and strictly ascending', () => {
        const input = layers([0.99, -1, Number.NaN, 2, 0.2]);
        normalizeEdgeLayerHeights(input);

        input.forEach((layer, index) => {
            expect(Number.isFinite(layer.heightFraction)).toBe(true);
            expect(layer.heightFraction).toBeGreaterThanOrEqual(0);
            expect(layer.heightFraction).toBeLessThanOrEqual(1);
            if (index > 0) {
                expect(layer.heightFraction - input[index - 1].heightFraction)
                    .toBeGreaterThanOrEqual(EDGE_LAYER_MIN_GAP - Number.EPSILON);
            }
        });
    });

    it('does not reorder colours or intensities', () => {
        const input = layers([0.5, 0.1, 0.9]);
        const colors = input.map(layer => layer.color);
        const intensities = input.map(layer => layer.intensity);
        normalizeEdgeLayerHeights(input);
        expect(input.map(layer => layer.color)).toEqual(colors);
        expect(input.map(layer => layer.intensity)).toEqual(intensities);
    });
});
