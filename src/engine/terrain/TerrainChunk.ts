import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Mesh,
    MeshStandardMaterial,
} from 'three';

/**
 * The chunk extends below the lowest generated point, rather than ending at a
 * fixed world Y. This keeps every seed/config visually closed even if terrain
 * generation later permits negative heights.
 */
const CHUNK_DEPTH_WORLD_FRACTION = 0.15;
const MIN_CHUNK_DEPTH = 512;

const WALL_TOP_COLOR = new Color(0x241040);
const WALL_BOTTOM_COLOR = new Color(0x05010c);
const BOTTOM_COLOR = new Color(0x020006);

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
    const stride = divisions + 1;
    if (!Number.isInteger(divisions) || divisions < 1) {
        throw new Error('Terrain chunk divisions must be a positive integer.');
    }
    if (heights.length < stride * stride) {
        throw new Error('Terrain chunk height buffer is smaller than the heightfield dimensions.');
    }

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

export function createTerrainChunkMesh(
    heights: Float32Array,
    divisions: number,
    worldSize: number,
    minimumSurfaceHeight: number,
): Mesh {
    const material = new MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.05,
        roughness: 0.9,
        flatShading: true,
    });
    const mesh = new Mesh(
        createTerrainChunkGeometry(heights, divisions, worldSize, minimumSurfaceHeight),
        material,
    );
    mesh.name = 'TerrainChunkWalls';
    return mesh;
}
