import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

export class BloomEffect {
    private composer: EffectComposer;
    private renderPass: RenderPass;
    private bloomPass: UnrealBloomPass;

    constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
        // Create render pass
        this.renderPass = new RenderPass(scene, camera);

        // Create bloom pass
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,  // strength
            0.4,  // radius
            0.85  // threshold
        );

        // Create composer
        this.composer = new EffectComposer(renderer);
        this.composer.addPass(this.renderPass);
        this.composer.addPass(this.bloomPass);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    public render(): void {
        this.composer.render();
    }

    public dispose(): void {
        this.composer.dispose();
    }
} 