import { Vector3 } from 'three';

export const CameraParameters = {
    INITIAL_POSITION: new Vector3(4000, 3000, 4000),
    FAR_CLIP_PLANE:   100000,
    FIELD_OF_VIEW:    75,
} as const;
