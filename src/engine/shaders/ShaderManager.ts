import * as THREE from 'three';

export class ShaderManager {
    private static instance: ShaderManager;
    private shaders: Map<string, THREE.ShaderMaterial>;

    private constructor() {
        this.shaders = new Map();
        this.initializeShaders();
    }

    public static getInstance(): ShaderManager {
        if (!ShaderManager.instance) {
            ShaderManager.instance = new ShaderManager();
        }
        return ShaderManager.instance;
    }

    private initializeShaders(): void {
        // Terrain shader
        this.shaders.set('terrain', new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x4CAF50) },
                ambientLight: { value: 0.5 },
                diffuseLight: { value: 0.8 },
                specularLight: { value: 0.2 },
                fogColor: { value: new THREE.Color(0x87CEEB) },
                fogDensity: { value: 0.002 },
                fogNear: { value: 1 },
                fogFar: { value: 1000 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec2 vUv;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float ambientLight;
                uniform float diffuseLight;
                uniform float specularLight;
                uniform vec3 fogColor;
                uniform float fogDensity;
                uniform float fogNear;
                uniform float fogFar;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec2 vUv;
                
                void main() {
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diff = max(dot(vNormal, lightDir), 0.0);
                    float spec = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0);
                    
                    vec3 finalColor = color * (ambientLight + diff * diffuseLight + spec * specularLight);
                    
                    float fogFactor = smoothstep(fogNear, fogFar, length(vPosition));
                    finalColor = mix(finalColor, fogColor, fogFactor);
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        }));

        // Grid shader
        this.shaders.set('grid', new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xff6600) },
                opacity: { value: 0.8 },
                glowIntensity: { value: 0.5 }
            },
            vertexShader: `
                varying vec3 vPosition;
                
                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                uniform float glowIntensity;
                
                varying vec3 vPosition;
                
                void main() {
                    float dist = length(vPosition.xz);
                    float glow = 1.0 - smoothstep(0.0, glowIntensity, dist);
                    gl_FragColor = vec4(color, opacity * glow);
                }
            `,
            transparent: true,
            depthWrite: false
        }));

        // Unit shader
        this.shaders.set('unit', new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffffff) },
                emissive: { value: new THREE.Color(0x000000) },
                emissiveIntensity: { value: 0.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform vec3 emissive;
                uniform float emissiveIntensity;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diff = max(dot(vNormal, lightDir), 0.0);
                    vec3 finalColor = color * (0.5 + diff * 0.5) + emissive * emissiveIntensity;
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        }));

        // Ore shader
        this.shaders.set('ore', new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffd700) },
                pulseSpeed: { value: 1.0 },
                pulseIntensity: { value: 0.2 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float pulseSpeed;
                uniform float pulseIntensity;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    float time = time * pulseSpeed;
                    float pulse = sin(time) * pulseIntensity;
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    float diff = max(dot(vNormal, lightDir), 0.0);
                    vec3 finalColor = color * (0.5 + diff * 0.5 + pulse);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        }));
    }

    public getShader(name: string): THREE.ShaderMaterial | undefined {
        return this.shaders.get(name);
    }

    public updateShaderUniform(name: string, uniform: string, value: any): void {
        const shader = this.shaders.get(name);
        if (shader && shader.uniforms[uniform]) {
            shader.uniforms[uniform].value = value;
        }
    }
} 