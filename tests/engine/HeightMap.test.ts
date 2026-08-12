import { describe, expect, it } from 'vitest';
import { HeightMap } from '../../src/engine/terrain/HeightMap';

const heights = new Float32Array([
     0,  1,  2,
    10, 11, 12,
    20, 21, 22,
]);

function makeHeightMap(): HeightMap {
    return new HeightMap(heights, 2, 2);
}

describe('HeightMap world boundaries', () => {
    it.each([
        [-1, -1, 0],
        [ 1, -1, 2],
        [-1,  1, 20],
        [ 1,  1, 22],
    ])('returns the exact corner height at (%s, %s)', (x, z, expected) => {
        expect(makeHeightMap().getHeightAt(x, z)).toBe(expected);
    });

    it.each([
        [-100, -100, 0],
        [ 100, -100, 2],
        [-100,  100, 20],
        [ 100,  100, 22],
        [ 100,    0, 12],
        [   0, -100, 1],
    ])('clamps outside queries to the terrain edge at (%s, %s)', (x, z, expected) => {
        expect(makeHeightMap().getHeightAt(x, z)).toBe(expected);
    });

    it('keeps edge normals finite and normalized', () => {
        const map = makeHeightMap();
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const normal = map.getNormalAt(x, z);
            expect([normal.x, normal.y, normal.z].every(Number.isFinite)).toBe(true);
            expect(normal.length()).toBeCloseTo(1, 10);
        }
    });

    it('accepts boundary points and rejects points beyond them', () => {
        const map = makeHeightMap();
        expect(map.isInBounds(-1, 1)).toBe(true);
        expect(map.isInBounds(1, -1)).toBe(true);
        expect(map.isInBounds(-1.0001, 0)).toBe(false);
        expect(map.isInBounds(0, 1.0001)).toBe(false);
    });
});
