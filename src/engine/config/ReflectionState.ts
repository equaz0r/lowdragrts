import { Vector2, Vector4 } from 'three';
import { ReflectionParameters } from './LightingConfig';

export const DEFAULT_GLITTER_REACH = 2500;
export const DEFAULT_GLITTER_WIDTH_MULTIPLIER = 1.0;

/**
 * The single live source of truth for terrain-reflection controls.
 *
 * Terrain materials keep references to `params` and `glitterReach`, so UI
 * changes reach the existing shader without recompiling it. A regenerated
 * material receives these same objects and therefore preserves the current
 * scene rather than silently restoring configuration defaults.
 *
 * Debug mode persists across a terrain regeneration in the current session,
 * but remains intentionally excluded from exported scene settings.
 */
export interface TerrainReflectionState {
    params: Vector4;
    /** x = reach in world units; y = multiplier on automatic width. */
    glitterReach: Vector2;
    debugShowGlitter: boolean;
}

export function createTerrainReflectionState(): TerrainReflectionState {
    return {
        params: ReflectionParameters.REFLECTION_PARAMS.clone(),
        glitterReach: new Vector2(DEFAULT_GLITTER_REACH, DEFAULT_GLITTER_WIDTH_MULTIPLIER),
        debugShowGlitter: false,
    };
}
