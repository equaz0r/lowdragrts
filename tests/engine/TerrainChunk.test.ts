import { describe, expect, it } from 'vitest';
import { BufferAttribute, Vector3 } from 'three';
import {
    calculateTerrainChunkBaseY,
    createTerrainChunkGeometry,
    createTerrainChunkGridGeometry,
} from '../../src/engine/terrain/TerrainChunk';

const heights = new Float32Array([
    10, 11, 12,
    20, 21, 22,
    30, 31, 32,
]);

function triangleNormal(position: BufferAttribute, vertexOffset: number): Vector3 {
    const a = new Vector3().fromBufferAttribute(position, vertexOffset);
    const b = new Vector3().fromBufferAttribute(position, vertexOffset + 1);
    const c = new Vector3().fromBufferAttribute(position, vertexOffset + 2);
    return b.sub(a).cross(c.sub(a)).normalize();
}

describe('TerrainChunk', () => {
    it('places its flat base below the lowest terrain point', () => {
        expect(calculateTerrainChunkBaseY(10, 8000)).toBe(-1190);
        expect(calculateTerrainChunkBaseY(-100, 1000)).toBe(-612);
    });

    it('builds four segmented walls and a closed bottom', () => {
        const geometry = createTerrainChunkGeometry(heights, 2, 2, 10);
        const position = geometry.getAttribute('position');

        // 4 walls x 2 segments x 2 triangles x 3 vertices, plus 2 bottom triangles.
        expect(position.count).toBe(54);
        expect(geometry.boundingBox?.min).toEqual(new Vector3(-1, -502, -1));
        expect(geometry.boundingBox?.max).toEqual(new Vector3(1, 32, 1));
    });

    it('winds every outside face outwards', () => {
        const geometry = createTerrainChunkGeometry(heights, 2, 2, 10);
        const position = geometry.getAttribute('position') as BufferAttribute;

        // The first segment of each direction is emitted in N/S/W/E order.
        expect(triangleNormal(position, 0).z).toBeLessThan(-0.99);  // north
        expect(triangleNormal(position, 6).z).toBeGreaterThan(0.99); // south
        expect(triangleNormal(position, 12).x).toBeLessThan(-0.99); // west
        expect(triangleNormal(position, 18).x).toBeGreaterThan(0.99); // east
        expect(triangleNormal(position, 48).y).toBeLessThan(-0.99); // bottom
    });

    it('rejects incomplete height buffers', () => {
        expect(() => createTerrainChunkGeometry(new Float32Array(8), 2, 2, 0))
            .toThrow(/height buffer/i);
    });

    it('adds side-grid outlines, bands, and vertical divisions', () => {
        const geometry = createTerrainChunkGridGeometry(heights, 2, 2, 10);
        const position = geometry.getAttribute('position');

        // 16 top/bottom + 24 intermediate + 8 vertical lines, two vertices each.
        expect(position.count).toBe(96);
        expect(geometry.boundingBox?.min.y).toBe(-502);
        expect(geometry.boundingBox?.max.y).toBe(32);
    });
});
