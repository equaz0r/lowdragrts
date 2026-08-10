import {
    BufferGeometry,
    Float32BufferAttribute,
    LineSegments,
} from 'three';
import { GridSystem } from './GridSystem';
import { HeightMap } from './HeightMap';

/** Tiny lift above the terrain surface — purely z-fighting insurance now.
 *  Grid corners coincide exactly with render-mesh vertices (same resolution,
 *  see TerrainGenerator.generate()), so this no longer papers over a real
 *  approximation gap; it only needs to survive float/rasterization precision. */
const GRID_LINE_LIFT = 0.25;
const DEFAULT_MAX_BUILD_SLOPE_RAD = 0.15;

export interface BuildableCells {
    flags: Uint8Array; // 1 = buildable, indexed cx + cz * n
    n: number;         // cells per axis (GridSystem.getCellCount())
}

export interface TerrainGridResult {
    /** Positions-only LineSegments — caller assigns the shared EdgeMaterial. */
    mesh: LineSegments;
    buildable: BuildableCells;
}

interface CornerHeights {
    heights: Float32Array; // (n+1) x (n+1), row-major: cx + cz * (n+1)
    n: number;
}

/** Height at every grid-CORNER (not render-mesh vertex), sampled once and
 *  shared by both line drawing and buildability below — one bilinear pass
 *  instead of two. */
function computeCornerHeights(gridSystem: GridSystem, heightMap: HeightMap): CornerHeights {
    const n = gridSystem.getCellCount();
    const stride = n + 1;
    const heights = new Float32Array(stride * stride);
    for (let cz = 0; cz <= n; cz++) {
        for (let cx = 0; cx <= n; cx++) {
            const corner = gridSystem.cellToWorld(cx, cz);
            heights[cx + cz * stride] = heightMap.getHeightAt(corner.x, corner.z);
        }
    }
    return { heights, n };
}

/**
 * Per-cell buildability derived from the 4 corner heights already sampled for
 * grid-line drawing — no extra HeightMap queries per cell. Slope comes from
 * the height gradient across the cell compared as tan(angle) (avoids acos);
 * flatness from the corner height spread. Cheap enough to run every
 * regenerate, including debounced slider tweaks.
 */
function deriveBuildableCells(corners: CornerHeights, cellSize: number, maxSlopeRad: number): BuildableCells {
    const { heights, n } = corners;
    const stride = n + 1;
    const flags = new Uint8Array(n * n);
    const maxSlopeTan = Math.tan(maxSlopeRad);

    for (let cz = 0; cz < n; cz++) {
        for (let cx = 0; cx < n; cx++) {
            const h00 = heights[cx     + cz       * stride];
            const h10 = heights[cx + 1 + cz       * stride];
            const h01 = heights[cx     + (cz + 1) * stride];
            const h11 = heights[cx + 1 + (cz + 1) * stride];

            const min = Math.min(h00, h10, h01, h11);
            const max = Math.max(h00, h10, h01, h11);
            const flat = (max - min) <= cellSize * 0.15;

            const slopeX = ((h10 + h11) - (h00 + h01)) / (2 * cellSize);
            const slopeZ = ((h01 + h11) - (h00 + h10)) / (2 * cellSize);
            const slope  = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);

            flags[cx + cz * n] = (flat && slope <= maxSlopeTan) ? 1 : 0;
        }
    }
    return { flags, n };
}

/** Standalone buildability query (e.g. for reuse without needing a mesh). */
export function computeBuildableCells(gridSystem: GridSystem, heightMap: HeightMap, maxSlopeRad: number = DEFAULT_MAX_BUILD_SLOPE_RAD): BuildableCells {
    const corners = computeCornerHeights(gridSystem, heightMap);
    return deriveBuildableCells(corners, gridSystem.getCellSize(), maxSlopeRad);
}

/**
 * True if every cell in an NxN footprint anchored at min-corner cell (cx, cz)
 * is individually buildable. Use with BuildingFootprints.SMALL/MEDIUM/LARGE.
 */
export function isFootprintBuildable(cells: BuildableCells, cx: number, cz: number, footprintCells: number): boolean {
    const { flags, n } = cells;
    if (cx < 0 || cz < 0 || cx + footprintCells > n || cz + footprintCells > n) return false;
    for (let dz = 0; dz < footprintCells; dz++) {
        for (let dx = 0; dx < footprintCells; dx++) {
            if (!flags[(cx + dx) + (cz + dz) * n]) return false;
        }
    }
    return true;
}

/**
 * THE terrain grid — one geometry, used for both the neon visual (fed into
 * the existing EdgeMaterial: height-ramp + electric pulse, completely
 * unchanged) and unit/building placement (the returned `buildable` flags).
 *
 * Deliberately NOT EdgesGeometry-derived: EdgesGeometry draws a line only
 * where adjacent mesh triangles bend past a threshold, so it drew nothing on
 * flat ground and, at a different resolution than the logical placement
 * grid, never aligned with it anyway. This instead walks logical grid cells
 * directly — clean squares, no diagonals, always present, exactly the cells
 * gameplay will snap to.
 */
export function createTerrainGridMesh(gridSystem: GridSystem, heightMap: HeightMap): TerrainGridResult {
    const corners = computeCornerHeights(gridSystem, heightMap);
    const { heights, n } = corners;
    const stride = n + 1;
    const cellSize = gridSystem.getCellSize();

    const positions: number[] = [];

    // Lines along X: one segment per cell, for every row of corners (0..n).
    for (let cz = 0; cz <= n; cz++) {
        for (let cx = 0; cx < n; cx++) {
            const corner = gridSystem.cellToWorld(cx, cz);
            const h0 = heights[cx     + cz * stride];
            const h1 = heights[cx + 1 + cz * stride];
            positions.push(corner.x,            h0 + GRID_LINE_LIFT, corner.z);
            positions.push(corner.x + cellSize,  h1 + GRID_LINE_LIFT, corner.z);
        }
    }

    // Lines along Z: one segment per cell, for every column of corners (0..n).
    for (let cx = 0; cx <= n; cx++) {
        for (let cz = 0; cz < n; cz++) {
            const corner = gridSystem.cellToWorld(cx, cz);
            const h0 = heights[cx + cz       * stride];
            const h1 = heights[cx + (cz + 1) * stride];
            positions.push(corner.x, h0 + GRID_LINE_LIFT, corner.z);
            positions.push(corner.x, h1 + GRID_LINE_LIFT, corner.z + cellSize);
        }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));

    // No material here — TerrainGenerator assigns the shared createEdgeMaterial()
    // output, same as the geometry it's replacing did.
    const mesh = new LineSegments(geometry);
    const buildable = deriveBuildableCells(corners, cellSize, DEFAULT_MAX_BUILD_SLOPE_RAD);

    return { mesh, buildable };
}
