import { Vector3, Quaternion } from 'three';

/**
 * HeightMap — retained copy of terrain height data and all spatial queries.
 *
 * Stored independently of BufferPool so it survives terrain regeneration and
 * can be passed to any gameplay system (units, pathfinding, projectiles, LoS).
 *
 * World space: X and Z span [-totalSize/2, +totalSize/2], Y is height.
 * Grid space: integer indices [0, divisions] on each axis.
 */
export class HeightMap {
    private readonly heights: Float32Array;
    private readonly divisions: number;     // 200 render-mesh divisions
    private readonly segmentSize: number;   // world units per grid step (40)
    private readonly halfSize: number;      // totalSize / 2

    /**
     * @param heights   Flat row-major height buffer: index = x + z * (divisions + 1)
     * @param divisions Render mesh division count (NOT GridParameters.DIVISIONS — see TerrainGenerator)
     * @param totalSize World-space size of the terrain (8000)
     */
    constructor(heights: Float32Array, divisions: number, totalSize: number) {
        // Retain our own copy — the source buffer may be returned to the pool on regen.
        this.heights = new Float32Array(heights);
        this.divisions = divisions;
        this.segmentSize = totalSize / divisions;
        this.halfSize = totalSize / 2;
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    /**
     * Convert a world (x, z) to fractional grid position, returning the
     * integer grid cell (ix, iz) and the fractional offsets within it (fx, fz).
     * Clamps to grid bounds.
     */
    private worldToGrid(worldX: number, worldZ: number): { ix: number; iz: number; fx: number; fz: number } {
        const gx = (worldX + this.halfSize) / this.segmentSize;
        const gz = (worldZ + this.halfSize) / this.segmentSize;
        const ix = Math.max(0, Math.min(this.divisions - 1, Math.floor(gx)));
        const iz = Math.max(0, Math.min(this.divisions - 1, Math.floor(gz)));
        return { ix, iz, fx: gx - ix, fz: gz - iz };
    }

    /** Raw height at integer grid index, clamped to bounds. */
    private heightAtIndex(ix: number, iz: number): number {
        const cix = Math.max(0, Math.min(this.divisions, ix));
        const ciz = Math.max(0, Math.min(this.divisions, iz));
        return this.heights[cix + ciz * (this.divisions + 1)];
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Height of the terrain surface at any world (x, z).
     * Uses bilinear interpolation between the four surrounding grid vertices.
     */
    public getHeightAt(worldX: number, worldZ: number): number {
        const { ix, iz, fx, fz } = this.worldToGrid(worldX, worldZ);
        const h00 = this.heightAtIndex(ix,     iz);
        const h10 = this.heightAtIndex(ix + 1, iz);
        const h01 = this.heightAtIndex(ix,     iz + 1);
        const h11 = this.heightAtIndex(ix + 1, iz + 1);
        return h00 * (1 - fx) * (1 - fz)
             + h10 * fx       * (1 - fz)
             + h01 * (1 - fx) * fz
             + h11 * fx       * fz;
    }

    /**
     * Surface normal at world (x, z) via central differences.
     * Returns a unit vector pointing away from the terrain surface.
     * On flat ground this is (0, 1, 0).
     */
    public getNormalAt(worldX: number, worldZ: number): Vector3 {
        const d = this.segmentSize;
        const hl = this.getHeightAt(worldX - d, worldZ);
        const hr = this.getHeightAt(worldX + d, worldZ);
        const hb = this.getHeightAt(worldX, worldZ - d);
        const hf = this.getHeightAt(worldX, worldZ + d);
        // Cross product of the two tangent vectors gives the normal.
        // Tangent along X: (2d, hr-hl, 0)
        // Tangent along Z: (0,  hf-hb, 2d)
        // Cross product (simplified): (hl-hr, 2d, hb-hf) — un-normalised
        return new Vector3(hl - hr, 2 * d, hb - hf).normalize();
    }

    /**
     * Slope angle in radians at world (x, z).
     * 0 = perfectly flat, PI/2 = vertical cliff face.
     * Use this to gate unit traversal: most ground units stop around 0.5–0.7 rad (≈30–40°).
     */
    public getSlopeAngle(worldX: number, worldZ: number): number {
        const normal = this.getNormalAt(worldX, worldZ);
        // Angle between surface normal and world-up (0,1,0)
        return Math.acos(Math.max(-1, Math.min(1, normal.y)));
    }

    /**
     * Returns true if the slope at (x, z) is within the given max angle (radians).
     * Convenience wrapper for pathfinding and movement checks.
     */
    public isTraversable(worldX: number, worldZ: number, maxSlopeRad: number): boolean {
        return this.getSlopeAngle(worldX, worldZ) <= maxSlopeRad;
    }

    /**
     * Exact world position sitting on the terrain surface at (x, z).
     * Use this to place ground units and static objects.
     */
    public getGroundedPosition(worldX: number, worldZ: number): Vector3 {
        return new Vector3(worldX, this.getHeightAt(worldX, worldZ), worldZ);
    }

    /**
     * Full orientation quaternion for a ground unit at (x, z) facing a given heading.
     *
     * @param worldX       World X position
     * @param worldZ       World Z position
     * @param facingAngle  Heading in radians, measured clockwise from +Z (north).
     *                     0 = facing +Z, PI/2 = facing +X, PI = facing -Z, etc.
     *
     * The result tilts the unit to lie flat against the terrain slope AND
     * rotates it to face the requested direction.  A unit on a steep slope
     * will visibly angle up or down — no clipping into or floating above the ground.
     *
     * How it works:
     *   1. headingQuat — yaw around world Y for the desired facing direction.
     *   2. slopeTilt   — rotates world-up (0,1,0) to align with the surface normal.
     *   3. Combined as slopeTilt * headingQuat: heading is applied in world space
     *      first, then the whole unit is tilted with the slope.
     */
    public getGroundOrientation(worldX: number, worldZ: number, facingAngle: number): Quaternion {
        const headingQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), facingAngle);
        const surfaceNormal = this.getNormalAt(worldX, worldZ);
        const up = new Vector3(0, 1, 0);
        const slopeTilt = new Quaternion().setFromUnitVectors(up, surfaceNormal);
        return slopeTilt.multiply(headingQuat);
    }

    /**
     * Y world position for a flying unit above world (x, z).
     *
     * @param worldX         World X
     * @param worldZ         World Z
     * @param targetAltitude Desired height above terrain surface (e.g. 200)
     * @param minClearance   Minimum height above terrain regardless of target (e.g. 50).
     *                       Prevents flying units skimming through mountain peaks
     *                       when they are far above the local terrain average.
     *
     * Returns the Y coordinate the flying unit should occupy.
     * Flying units position at max(terrainY + minClearance, terrainY + targetAltitude).
     */
    public getFlyingY(worldX: number, worldZ: number, targetAltitude: number, minClearance: number = 50): number {
        const terrainY = this.getHeightAt(worldX, worldZ);
        return terrainY + Math.max(minClearance, targetAltitude);
    }

    // ─── Metadata ────────────────────────────────────────────────────────────

    /** Segment size (world units between height samples). Useful for nav grid resolution decisions. */
    public getSegmentSize(): number { return this.segmentSize; }

    /** Number of divisions along each axis. Total samples = (divisions+1)^2. */
    public getDivisions(): number { return this.divisions; }
}
