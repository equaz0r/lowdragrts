import { Vector3 } from 'three';
import { HeightMap } from '../terrain/HeightMap';

export const CAMERA_TERRAIN_CLEARANCE = 32;

function pointIntersectsTerrain(
    x: number,
    y: number,
    z: number,
    heightMap: HeightMap,
    clearance: number,
): boolean {
    if (!heightMap.isInBounds(x, z)) return false;
    return y < heightMap.getHeightAt(x, z) + clearance;
}

function positionIntersectsTerrain(
    position: Vector3,
    heightMap: HeightMap,
    clearance: number,
): boolean {
    return pointIntersectsTerrain(position.x, position.y, position.z, heightMap, clearance);
}

/**
 * Sweeps the camera point between two frames instead of testing only its final
 * position. This prevents a fast wheel zoom or pan from tunnelling through a
 * narrow peak or completely across the terrain chunk in one update.
 */
export function cameraPathIntersectsTerrain(
    from: Vector3,
    to: Vector3,
    heightMap: HeightMap,
    clearance: number = CAMERA_TERRAIN_CLEARANCE,
): boolean {
    const distance = from.distanceTo(to);
    const stepLength = Math.max(1, heightMap.getSegmentSize() * 0.5);
    const steps = Math.max(1, Math.ceil(distance / stepLength));
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;

    for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        if (pointIntersectsTerrain(
            from.x + dx * t,
            from.y + dy * t,
            from.z + dz * t,
            heightMap,
            clearance,
        )) return true;
    }
    return false;
}

/**
 * Keeps the OrbitControls camera outside the terrain volume. Invalid motion is
 * rejected as one unit: both camera position and orbit target return to their
 * last safe state, so zoom, pan and rotation all stop cleanly at the surface.
 */
export class CameraTerrainCollision {
    private readonly safePosition = new Vector3();
    private readonly safeTarget = new Vector3();
    private followingTerrain = false;

    constructor(
        position: Vector3,
        target: Vector3,
        private readonly clearance: number = CAMERA_TERRAIN_CLEARANCE,
    ) {
        this.reset(position, target);
    }

    public reset(position: Vector3, target: Vector3): void {
        this.safePosition.copy(position);
        this.safeTarget.copy(target);
        this.followingTerrain = false;
    }

    private acceptTerrainSlide(position: Vector3, target: Vector3, heightMap: HeightMap): boolean {
        if (!heightMap.isInBounds(position.x, position.z)) return false;

        const surfaceY = heightMap.getHeightAt(position.x, position.z) + this.clearance;
        const heightAdjustment = surfaceY - position.y;
        position.y = surfaceY;
        target.y += heightAdjustment;
        this.safePosition.copy(position);
        this.safeTarget.copy(target);
        this.followingTerrain = true;
        return true;
    }

    /**
     * Returns true when collision handling changed the requested transform.
     * Orbit/zoom into terrain restores the prior safe state. Pan movement is
     * allowed to slide across the surface and follows its height up or down.
     */
    public resolve(position: Vector3, target: Vector3, heightMap: HeightMap): boolean {
        // Regeneration can raise terrain around a previously valid camera.
        // Lift that saved state (and its target by the same amount) before
        // considering new user motion, rather than trapping the camera inside.
        if (positionIntersectsTerrain(this.safePosition, heightMap, this.clearance)) {
            const safeHeight = heightMap.getHeightAt(this.safePosition.x, this.safePosition.z)
                + this.clearance;
            const lift = safeHeight - this.safePosition.y;
            this.safePosition.y = safeHeight;
            this.safeTarget.y += lift;
            position.copy(this.safePosition);
            target.copy(this.safeTarget);
            this.followingTerrain = true;
            return true;
        }

        const targetMoved = target.distanceToSquared(this.safeTarget) > 0.000001;
        const intersectsTerrain = cameraPathIntersectsTerrain(
            this.safePosition,
            position,
            heightMap,
            this.clearance,
        );

        // OrbitControls moves camera and target together when panning. Once
        // surface contact occurs, preserve that horizontal movement and adapt
        // camera height to the new terrain instead of rejecting every input.
        if (targetMoved && (intersectsTerrain || this.followingTerrain)) {
            if (this.acceptTerrainSlide(position, target, heightMap)) return true;
        }

        if (intersectsTerrain) {
            position.copy(this.safePosition);
            target.copy(this.safeTarget);
            this.followingTerrain = true;
            return true;
        }

        this.safePosition.copy(position);
        this.safeTarget.copy(target);
        // A free zoom/orbit away from the surface exits terrain-follow mode.
        if (!targetMoved) this.followingTerrain = false;
        return false;
    }
}
