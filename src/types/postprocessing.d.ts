declare module 'postprocessing' {
    import { Camera, Scene, WebGLRenderer, Texture } from 'three';

    export class EffectComposer {
        constructor(renderer: WebGLRenderer);
        addPass(pass: Pass): void;
        render(): void;
        setSize(width: number, height: number): void;
    }

    export class Pass {
        enabled: boolean;
        needsSwap: boolean;
        renderToScreen: boolean;
    }

    export class RenderPass extends Pass {
        constructor(scene: Scene, camera: Camera);
    }

    export class EffectPass extends Pass {
        constructor(camera: Camera, ...effects: Effect[]);
    }

    export class Effect {
        constructor(options?: any);
    }

    export class BloomEffect extends Effect {
        constructor(options?: {
            luminanceThreshold?: number;
            luminanceSmoothing?: number;
            intensity?: number;
            radius?: number;
        });
    }

    export class SMAAEffect extends Effect {
        constructor();
    }
} 