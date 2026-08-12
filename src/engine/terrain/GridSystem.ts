import { GridParameters } from '../config/TerrainConfig';

/** Fixed world/build-grid coordinate conversion. Configuration lives in TerrainConfig. */
export class GridSystem {
    private readonly cellSize = GridParameters.BUILD_CELL_SIZE;
    private readonly worldSize = GridParameters.WORLD_SIZE;
    private readonly cellCount = GridParameters.BUILD_CELL_COUNT;

    constructor() {
        if (!Number.isInteger(this.cellCount)) {
            throw new Error('WORLD_SIZE must be divisible by BUILD_CELL_SIZE.');
        }
    }

    public getCellSize(): number {
        return this.cellSize;
    }

    public getWorldSize(): number {
        return this.worldSize;
    }

    // ─── World ↔ cell conversion ────────────────────────────────────────────
    // The logical placement grid — unit positioning and building footprints
    // (1x1/2x2/3x3, see BuildingFootprints in TerrainConfig.ts) snap to these
    // same cells. Only `+ - * / Math.floor`, so this is safe to reuse from
    // sim/ once the Phase-4 NavGrid needs the same conversion — no rework.

    /** Number of cells along one axis. 8000 / 64 = 125. */
    public getCellCount(): number {
        return this.cellCount;
    }

    /** World (x, z) → the cell containing it. */
    public worldToCell(worldX: number, worldZ: number): { cx: number; cz: number } {
        const half = this.worldSize / 2;
        return {
            cx: Math.floor((worldX + half) / this.cellSize),
            cz: Math.floor((worldZ + half) / this.cellSize),
        };
    }

    /** Cell (cx, cz) → world position of its min corner. */
    public cellToWorld(cx: number, cz: number): { x: number; z: number } {
        const half = this.worldSize / 2;
        return { x: cx * this.cellSize - half, z: cz * this.cellSize - half };
    }

    /** Cell (cx, cz) → world position of its centre. */
    public cellCenterWorld(cx: number, cz: number): { x: number; z: number } {
        const corner = this.cellToWorld(cx, cz);
        const half   = this.cellSize / 2;
        return { x: corner.x + half, z: corner.z + half };
    }
}
