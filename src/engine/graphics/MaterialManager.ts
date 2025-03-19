import * as THREE from 'three';

export class MaterialManager {
    private static materials: Map<string, THREE.Material> = new Map();
    private static shaders: Map<string, THREE.ShaderMaterial> = new Map();

    public static getMaterial(type: string, factory?: () => THREE.Material): THREE.Material {
        if (!this.materials.has(type)) {
            if (factory) {
                this.materials.set(type, factory());
            } else {
                this.materials.set(type, this.createMaterial(type));
            }
        }
        return this.materials.get(type)!;
    }

    public static getShader(type: string): THREE.ShaderMaterial {
        if (!this.shaders.has(type)) {
            this.shaders.set(type, this.createShader(type));
        }
        return this.shaders.get(type)!;
    }

    public static updateShaderUniform(type: string, name: string, value: any): void {
        const shader = this.shaders.get(type);
        if (shader) {
            shader.uniforms[name].value = value;
        }
    }

    private static createShader(type: string): THREE.ShaderMaterial {
        switch (type) {
            case 'terrain':
                return new THREE.ShaderMaterial({
                    uniforms: {
                        color: { value: new THREE.Color(0x1a1a2a) },
                        time: { value: 0 },
                        fogColor: { value: new THREE.Color(0x87CEEB) },
                        fogNear: { value: 100 },
                        fogFar: { value: 500 },
                        edgeColor: { value: new THREE.Color(0x00ff00) },
                        edgeStrength: { value: 0.3 }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        varying vec3 vWorldPosition;
                        varying vec2 vUv;
                        
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vPosition = position;
                            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 color;
                        uniform float time;
                        uniform vec3 fogColor;
                        uniform float fogNear;
                        uniform float fogFar;
                        uniform vec3 edgeColor;
                        uniform float edgeStrength;
                        
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        varying vec3 vWorldPosition;
                        varying vec2 vUv;

                        void main() {
                            // Basic lighting
                            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                            float diff = max(dot(vNormal, lightDir), 0.0);
                            
                            // Edge detection
                            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                            float edge = 1.0 - max(dot(vNormal, viewDir), 0.0);
                            edge = pow(edge, 0.5);
                            
                            // Wireframe effect
                            float gridSize = 5.0;
                            float lineWidth = 0.1;
                            vec2 grid = fract(vUv * gridSize);
                            float wireframe = 1.0;
                            if (grid.x < lineWidth || grid.y < lineWidth || 
                                grid.x > 1.0 - lineWidth || grid.y > 1.0 - lineWidth) {
                                wireframe = 0.0;
                            }
                            
                            // Base color with lighting
                            vec3 baseColor = color * (0.7 + diff * 0.3);
                            
                            // Combine effects
                            float finalEdge = edge * edgeStrength;
                            finalEdge = max(finalEdge, wireframe * 0.5);
                            
                            // Final color
                            vec3 finalColor = mix(baseColor, edgeColor, finalEdge);
                            
                            // Fog
                            float fogFactor = smoothstep(fogNear, fogFar, length(vPosition));
                            finalColor = mix(finalColor, fogColor, fogFactor);
                            
                            // Alpha
                            float alpha = max(finalEdge, 0.9);
                            
                            gl_FragColor = vec4(finalColor, alpha);
                        }
                    `,
                    side: THREE.DoubleSide,
                    transparent: true,
                    depthWrite: true,
                    depthTest: true,
                    blending: THREE.NormalBlending,
                    alphaTest: 0.5
                });

            case 'grid':
                return new THREE.ShaderMaterial({
                    uniforms: {
                        color: { value: new THREE.Color(0xff6600) },
                        glowIntensity: { value: 1.0 },
                        time: { value: 0 }
                    },
                    vertexShader: `
                        void main() {
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 color;
                        uniform float glowIntensity;
                        uniform float time;

                        void main() {
                            float glow = glowIntensity * (0.7 + 0.3 * sin(time));
                            gl_FragColor = vec4(color, glow);
                        }
                    `,
                    transparent: true,
                    depthWrite: false,
                    depthTest: false
                });

            case 'unit':
                return new THREE.ShaderMaterial({
                    uniforms: {
                        color: { value: new THREE.Color(0xffffff) },
                        emissive: { value: new THREE.Color(0x00ffff) },
                        emissiveIntensity: { value: 1.0 },
                        time: { value: 0 },
                        pulseSpeed: { value: 2.0 },
                        pulseIntensity: { value: 0.3 }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vPosition = position;
                            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 color;
                        uniform vec3 emissive;
                        uniform float emissiveIntensity;
                        uniform float time;
                        uniform float pulseSpeed;
                        uniform float pulseIntensity;
                        
                        varying vec3 vNormal;
                        varying vec3 vPosition;
                        varying vec3 vWorldPosition;
                        
                        void main() {
                            // Calculate lighting
                            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                            float diff = max(dot(vNormal, lightDir), 0.0);
                            
                            // Calculate view direction for fresnel effect
                            vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                            float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);
                            
                            // Calculate pulse effect
                            float pulse = sin(time * pulseSpeed) * pulseIntensity;
                            
                            // Combine all effects
                            vec3 finalColor = color * (0.7 + diff * 0.3);
                            finalColor += emissive * (emissiveIntensity + fresnel * 0.8 + pulse);
                            
                            // Add stronger glow
                            float glow = 1.0 + fresnel * 0.5;
                            finalColor *= glow;
                            
                            // Calculate alpha with minimum visibility
                            float alpha = max(0.8, fresnel * 0.5 + glow * 0.3);
                            
                            gl_FragColor = vec4(finalColor, alpha);
                        }
                    `,
                    side: THREE.DoubleSide,
                    transparent: true,
                    depthWrite: true,
                    depthTest: true,
                    blending: THREE.NormalBlending,
                    alphaTest: 0.1
                });

            default:
                return new THREE.ShaderMaterial({
                    uniforms: {
                        color: { value: new THREE.Color(0xffffff) }
                    },
                    vertexShader: `
                        void main() {
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 color;
                        void main() {
                            gl_FragColor = vec4(color, 1.0);
                        }
                    `
                });
        }
    }

    private static createMaterial(type: string): THREE.Material {
        // Remove duplicate material definitions since we're using shaders
        return new THREE.MeshPhongMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });
    }

    public static dispose(): void {
        this.materials.forEach(material => material.dispose());
        this.shaders.forEach(shader => shader.dispose());
        this.materials.clear();
        this.shaders.clear();
    }
} 