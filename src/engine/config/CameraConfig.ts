import { Vector3 } from 'three';

export const CameraParameters = {
    INITIAL_POSITION: new Vector3(4000, 3000, 4000),
    // 500000, not the world diagonal (~11300) or the sun orbit radius (8000) —
    // LightingSystem's sky/halo geometry needs the extra headroom. Renderer uses
    // logarithmicDepthBuffer to keep precision sane at this near:far ratio.
    FAR_CLIP_PLANE:   500000,
    NEAR_CLIP_PLANE:  0.1,
    FIELD_OF_VIEW:    75,
} as const;
