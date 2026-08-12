import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
    cameraPathIntersectsTerrain,
    CameraTerrainCollision,
} from '../../src/engine/camera/CameraTerrainCollision';
import { HeightMap } from '../../src/engine/terrain/HeightMap';

function flatTerrain(height: number = 100): HeightMap {
    return new HeightMap(new Float32Array(9).fill(height), 2, 200);
}

describe('CameraTerrainCollision', () => {
    it('allows motion that remains above the terrain clearance', () => {
        const terrain = flatTerrain();
        expect(cameraPathIntersectsTerrain(
            new Vector3(0, 200, 0),
            new Vector3(50, 140, 0),
            terrain,
        )).toBe(false);
    });

    it('blocks zooming into the terrain and restores camera and target', () => {
        const terrain = flatTerrain();
        const position = new Vector3(0, 200, 0);
        const target = new Vector3(0, 100, 0);
        const collision = new CameraTerrainCollision(position, target);

        position.set(0, 110, 0);
        target.set(0, 10, 0);
        expect(collision.resolve(position, target, terrain)).toBe(true);
        expect(position).toEqual(new Vector3(0, 200, 0));
        expect(target).toEqual(new Vector3(0, 100, 0));
    });

    it('sweep-tests fast movement through the whole chunk', () => {
        const terrain = flatTerrain();
        const from = new Vector3(-150, 50, 0);
        const to = new Vector3(150, 50, 0);
        expect(cameraPathIntersectsTerrain(from, to, terrain)).toBe(true);
    });

    it('lifts a saved camera state buried by regenerated terrain', () => {
        const position = new Vector3(0, 150, 0);
        const target = new Vector3(0, 50, 0);
        const collision = new CameraTerrainCollision(position, target);

        expect(collision.resolve(position, target, flatTerrain(200))).toBe(true);
        expect(position.y).toBe(232);
        expect(target.y).toBe(132);
    });
});
