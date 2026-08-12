import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshPhysicalMaterial,
} from 'three';

/**
 * The chunk extends below the lowest generated point, rather than ending at a
 * fixed world Y. This keeps every seed/config visually closed even if terrain
 * generation later permits negative heights.
 */
const CHUNK_DEPTH_WORLD_FRACTION = 0.15;
const MIN_CHUNK_DEPTH = 512;

const WALL_TOP_COLOR = new Color(0x6432a6);
const WALL_BOTTOM_COLOR = new Color(0x16062b);
const BOTTOM_COLOR = new Color(0x020006);
const WALL_GRID_COLOR = new Color(0xa14cff);
const WALL_GRID_OFFSET = 0.75;

type Point = readonly [x: number, y: number, z: number];

function pushVertex(
    positions: number[],
    colors: number[],
    point: Point,
    color: Color,
): void {
    positions.push(point[0], point[1], point[2]);
    colors.push(color.r, color.g, color.b);
}

function pushLine(positions: number[], a: Point, b: Point): void {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
}

/** Adds the visible part of a horizontal grid line below a sloping wall rim. */
function pushClippedHorizontalLine(
    positions: number[],
    y: number,
    alongA: number,
    topA: number,
    alongB: number,
    topB: number,
    pointAt: (along: number, height: number) => Point,
): void {
    if (y > Math.max(topA, topB)) return;

    let clippedA = alongA;
    let clippedB = alongB;
    if (y > Math.min(topA, topB) && topA !== topB) {
        const crossing = alongA + (alongB - alongA) * ((y - topA) / (topB - topA));
        if (topA < y) clippedA = crossing;
        else clippedB = crossing;
    }
    pushLine(positions, pointAt(clippedA, y), pointAt(clippedB, y));
}

function validateHeightfield(heights: Float32Array, divisions: number): number {
    const stride = divisions + 1;
    if (!Number.isInteger(divisions) || divisions < 1) {
        throw new Error('Terrain chunk divisions must be a positive integer.');
    }
    if (heights.length < stride * stride) {
        throw new Error('Terrain chunk height buffer is smaller than the heightfield dimensions.');
    }
    return stride;
}

/** Pushes two outward-wound triangles: a-b-c and b-d-c. */
function pushQuad(
    positions: number[],
    colors: number[],
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    colorA: Color,
    colorB: Color,
    colorC: Color,
    colorD: Color,
): void {
    pushVertex(positions, colors, a, colorA);
    pushVertex(positions, colors, b, colorB);
    pushVertex(positions, colors, c, colorC);
    pushVertex(positions, colors, b, colorB);
    pushVertex(positions, colors, d, colorD);
    pushVertex(positions, colors, c, colorC);
}

export function calculateTerrainChunkBaseY(minimumSurfaceHeight: number, worldSize: number): number {
    const depth = Math.max(MIN_CHUNK_DEPTH, worldSize * CHUNK_DEPTH_WORLD_FRACTION);
    return minimumSurfaceHeight - depth;
}

/**
 * Builds four segmented walls and one flat underside around a square heightfield.
 *
 * Each wall's upper vertices are read directly from the height buffer's outer
 * samples, so the rim precisely meets the playable terrain surface. The walls
 * deliberately remain a separate child geometry: future deformation can update
 * the surface normally and only touch this small mesh when a dirty region reaches
 * the map boundary.
 */
export function createTerrainChunkGeometry(
    heights: Float32Array,
    divisions: number,
    worldSize: number,
    minimumSurfaceHeight: number,
): BufferGeometry {
    const stride = validateHeightfield(heights, divisions);

    const halfSize = worldSize / 2;
    const segmentSize = worldSize / divisions;
    const baseY = calculateTerrainChunkBaseY(minimumSurfaceHeight, worldSize);
    const positions: number[] = [];
    const colors: number[] = [];
    const heightAt = (x: number, z: number): number => heights[x + z * stride];

    for (let i = 0; i < divisions; i++) {
        const low = -halfSize + i * segmentSize;
        const high = low + segmentSize;

        // North wall (outward normal -Z).
        pushQuad(
            positions, colors,
            [low, heightAt(i, 0), -halfSize],
            [high, heightAt(i + 1, 0), -halfSize],
            [low, baseY, -halfSize],
            [high, baseY, -halfSize],
            WALL_TOP_COLOR, WALL_TOP_COLOR, WALL_BOTTOM_COLOR, WALL_BOTTOM_COLOR,
        );

        // South wall (outward normal +Z).
        pushQuad(
            positions, colors,
            [low, heightAt(i, divisions), halfSize],
            [low, baseY, halfSize],
            [high, heightAt(i + 1, divisions), halfSize],
            [high, baseY, halfSize],
            WALL_TOP_COLOR, WALL_BOTTOM_COLOR, WALL_TOP_COLOR, WALL_BOTTOM_COLOR,
        );

        // West wall (outward normal -X).
        pushQuad(
            positions, colors,
            [-halfSize, heightAt(0, i), low],
            [-halfSize, baseY, low],
            [-halfSize, heightAt(0, i + 1), high],
            [-halfSize, baseY, high],
            WALL_TOP_COLOR, WALL_BOTTOM_COLOR, WALL_TOP_COLOR, WALL_BOTTOM_COLOR,
        );

        // East wall (outward normal +X).
        pushQuad(
            positions, colors,
            [halfSize, heightAt(divisions, i), low],
            [halfSize, heightAt(divisions, i + 1), high],
            [halfSize, baseY, low],
            [halfSize, baseY, high],
            WALL_TOP_COLOR, WALL_TOP_COLOR, WALL_BOTTOM_COLOR, WALL_BOTTOM_COLOR,
        );
    }

    // Underside (outward normal -Y). Two triangles are sufficient because it
    // is deliberately flat and has no gameplay sampling or deformation detail.
    pushQuad(
        positions, colors,
        [-halfSize, baseY, -halfSize],
        [halfSize, baseY, -halfSize],
        [-halfSize, baseY, halfSize],
        [halfSize, baseY, halfSize],
        BOTTOM_COLOR, BOTTOM_COLOR, BOTTOM_COLOR, BOTTOM_COLOR,
    );

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

/**
 * Unlit side-wall grid. The horizontal bands interpolate between each local
 * rim height and the common base, so the pattern stays attached to uneven
 * terrain rather than crossing outside the wall. A tiny outward offset avoids
 * z-fighting with the wall surface.
 */
export function createTerrainChunkGridGeometry(
    heights: Float32Array,
    divisions: number,
    worldSize: number,
    minimumSurfaceHeight: number,
): BufferGeometry {
    const stride = validateHeightfield(heights, divisions);
    const halfSize = worldSize / 2;
    const segmentSize = worldSize / divisions;
    const baseY = calculateTerrainChunkBaseY(minimumSurfaceHeight, worldSize);
    const positions: number[] = [];
    const heightAt = (x: number, z: number): number => heights[x + z * stride];

    for (let i = 0; i < divisions; i++) {
        const low = -halfSize + i * segmentSize;
        const high = low + segmentSize;
        const northLowY = heightAt(i, 0);
        const northHighY = heightAt(i + 1, 0);
        const southLowY = heightAt(i, divisions);
        const southHighY = heightAt(i + 1, divisions);
        const westLowY = heightAt(0, i);
        const westHighY = heightAt(0, i + 1);
        const eastLowY = heightAt(divisions, i);
        const eastHighY = heightAt(divisions, i + 1);

        // Top and bottom outlines follow all four sides.
        pushLine(positions,
            [low, northLowY, -halfSize - WALL_GRID_OFFSET],
            [high, northHighY, -halfSize - WALL_GRID_OFFSET]);
        pushLine(positions,
            [low, southLowY, halfSize + WALL_GRID_OFFSET],
            [high, southHighY, halfSize + WALL_GRID_OFFSET]);
        pushLine(positions,
            [-halfSize - WALL_GRID_OFFSET, westLowY, low],
            [-halfSize - WALL_GRID_OFFSET, westHighY, high]);
        pushLine(positions,
            [halfSize + WALL_GRID_OFFSET, eastLowY, low],
            [halfSize + WALL_GRID_OFFSET, eastHighY, high]);

        pushLine(positions,
            [low, baseY, -halfSize - WALL_GRID_OFFSET],
            [high, baseY, -halfSize - WALL_GRID_OFFSET]);
        pushLine(positions,
            [low, baseY, halfSize + WALL_GRID_OFFSET],
            [high, baseY, halfSize + WALL_GRID_OFFSET]);
        pushLine(positions,
            [-halfSize - WALL_GRID_OFFSET, baseY, low],
            [-halfSize - WALL_GRID_OFFSET, baseY, high]);
        pushLine(positions,
            [halfSize + WALL_GRID_OFFSET, baseY, low],
            [halfSize + WALL_GRID_OFFSET, baseY, high]);

        // Horizontal subdivisions use the exact same world spacing as the
        // terrain grid. Lines are clipped against each sloping rim segment.
        const highestRim = Math.max(northLowY, northHighY, southLowY, southHighY,
            westLowY, westHighY, eastLowY, eastHighY);
        for (let y = baseY + segmentSize; y < highestRim; y += segmentSize) {
            pushClippedHorizontalLine(positions, y, low, northLowY, high, northHighY,
                (along, height) => [along, height, -halfSize - WALL_GRID_OFFSET]);
            pushClippedHorizontalLine(positions, y, low, southLowY, high, southHighY,
                (along, height) => [along, height, halfSize + WALL_GRID_OFFSET]);
            pushClippedHorizontalLine(positions, y, low, westLowY, high, westHighY,
                (along, height) => [-halfSize - WALL_GRID_OFFSET, height, along]);
            pushClippedHorizontalLine(positions, y, low, eastLowY, high, eastHighY,
                (along, height) => [halfSize + WALL_GRID_OFFSET, height, along]);
        }
    }

    // Every surface-grid division continues down the side at the same spacing.
    for (let i = 0; i <= divisions; i++) {
        const along = -halfSize + i * segmentSize;
        pushLine(positions,
            [along, heightAt(i, 0), -halfSize - WALL_GRID_OFFSET],
            [along, baseY, -halfSize - WALL_GRID_OFFSET]);
        pushLine(positions,
            [along, heightAt(i, divisions), halfSize + WALL_GRID_OFFSET],
            [along, baseY, halfSize + WALL_GRID_OFFSET]);
        pushLine(positions,
            [-halfSize - WALL_GRID_OFFSET, heightAt(0, i), along],
            [-halfSize - WALL_GRID_OFFSET, baseY, along]);
        pushLine(positions,
            [halfSize + WALL_GRID_OFFSET, heightAt(divisions, i), along],
            [halfSize + WALL_GRID_OFFSET, baseY, along]);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

export function createTerrainChunkMesh(
    heights: Float32Array,
    divisions: number,
    worldSize: number,
    minimumSurfaceHeight: number,
): Mesh {
    const material = new MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.3,
        roughness: 0.2,
        flatShading: true,
        emissive: new Color(0x260848),
        emissiveIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        sheen: 1.0,
        sheenColor: new Color(0xc05cff),
        sheenRoughness: 0.25,
    });
    const mesh = new Mesh(
        createTerrainChunkGeometry(heights, divisions, worldSize, minimumSurfaceHeight),
        material,
    );
    mesh.name = 'TerrainChunkWalls';

    const gridMaterial = new LineBasicMaterial({
        color: WALL_GRID_COLOR,
        transparent: true,
        opacity: 0.62,
    });
    const grid = new LineSegments(
        createTerrainChunkGridGeometry(heights, divisions, worldSize, minimumSurfaceHeight),
        gridMaterial,
    );
    grid.name = 'TerrainChunkGrid';
    mesh.add(grid);
    return mesh;
}
