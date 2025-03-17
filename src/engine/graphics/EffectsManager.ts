import * as THREE from 'three';
import {
    BloomEffect,
    EffectComposer,
    EffectPass,
    RenderPass,
    SMAAEffect
} from 'postprocessing';

export class EffectsManager {
    private composer: EffectComposer;
    private bloomEffect: BloomEffect;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) {
        // Create effect composer
        this.composer = new EffectComposer(renderer);

        // Add render pass
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // Add bloom effect
        this.bloomEffect = new BloomEffect({
            luminanceThreshold: 0.2,
            luminanceSmoothing: 0.5,
            intensity: 2.0,
            radius: 0.8
        });

        // Add SMAA (anti-aliasing)
        const smaaEffect = new SMAAEffect();

        // Combine effects
        const effectPass = new EffectPass(camera, this.bloomEffect, smaaEffect);
        effectPass.renderToScreen = true;
        this.composer.addPass(effectPass);
    }

    public render(): void {
        this.composer.render();
    }

    public setSize(width: number, height: number): void {
        this.composer.setSize(width, height);
    }
} 