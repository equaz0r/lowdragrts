import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

export class EdgeDetection {
    private composer: EffectComposer;
    private renderPass: RenderPass;
    private edgePass: ShaderPass;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private renderer: THREE.WebGLRenderer;

    constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Create composer
        this.composer = new EffectComposer(renderer);

        // Create render pass
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        // Create edge detection pass
        this.edgePass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 resolution;
                varying vec2 vUv;
                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    
                    // If this is the grid (orange color), preserve it and make it more visible
                    // More lenient check for orange color
                    if (color.r > 0.5 && color.g > 0.2 && color.b < 0.3) {
                        // Make the grid more visible by increasing its intensity and ensuring orange
                        gl_FragColor = vec4(1.0, 0.4, 0.0, 1.0); // Pure orange
                        return;
                    }
                    
                    // If this is a unit (cyan color) or projectile, preserve original color
                    if (color.g > 0.8 && color.b > 0.8 && color.r < 0.2) {
                        gl_FragColor = color;
                        return;
                    }
                    
                    // If this is a selection box or other UI element, preserve original color
                    if (color.r > 0.8 && color.g > 0.8 && color.b > 0.8) {
                        gl_FragColor = color;
                        return;
                    }
                    
                    vec2 offset = 1.0 / resolution;
                    
                    // Sample neighboring pixels
                    vec4 left = texture2D(tDiffuse, vUv - vec2(offset.x, 0.0));
                    vec4 right = texture2D(tDiffuse, vUv + vec2(offset.x, 0.0));
                    vec4 top = texture2D(tDiffuse, vUv + vec2(0.0, offset.y));
                    vec4 bottom = texture2D(tDiffuse, vUv - vec2(0.0, offset.y));
                    
                    // Calculate edge strength
                    float edgeStrength = length(color - left) + 
                                       length(color - right) + 
                                       length(color - top) + 
                                       length(color - bottom);
                    
                    // Apply black wireframe to terrain voxels
                    if (edgeStrength > 0.1) {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                    } else {
                        gl_FragColor = color;
                    }
                }
            `
        });
        this.composer.addPass(this.edgePass);
    }

    public render(): void {
        this.composer.render();
    }

    public setSize(width: number, height: number): void {
        this.composer.setSize(width, height);
        this.edgePass.uniforms.resolution.value.set(width, height);
    }
} 