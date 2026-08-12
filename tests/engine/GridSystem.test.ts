import { describe, expect, it } from 'vitest';
import { GridParameters } from '../../src/engine/config/TerrainConfig';
import { GridSystem } from '../../src/engine/terrain/GridSystem';

describe('GridSystem', () => {
    it('derives the build-cell count from world and cell sizes', () => {
        const grid = new GridSystem();
        expect(grid.getCellCount()).toBe(125);
        expect(grid.getCellCount()).toBe(
            GridParameters.WORLD_SIZE / GridParameters.BUILD_CELL_SIZE,
        );
    });

    it('round-trips cell corners through world coordinates', () => {
        const grid = new GridSystem();
        for (const [cx, cz] of [[0, 0], [62, 31], [124, 124]]) {
            const world = grid.cellToWorld(cx, cz);
            expect(grid.worldToCell(world.x, world.z)).toEqual({ cx, cz });
        }
    });
});
