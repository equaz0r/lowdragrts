import * as THREE from 'three';

export class GridSystem {
    private scene: THREE.Scene;
    private gridLines: THREE.LineSegments | null = null;
    private material: THREE.ShaderMaterial | null = null;
    private gridMesh: THREE.Mesh | null = null;
    private readonly gridSize: number = 64; // -32 to 32
    private readonly cellSize: number = 100;
    private readonly totalSize: number;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.totalSize = this.gridSize * this.cellSize;
        this.initialize();
    }

    private initialize(): void {
        this.createGridMaterial();
        this.createGridLines();
        this.createGridMesh();
    }

    private createGridMaterial(): void {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xff6600) }, // Neon orange
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                varying vec2 vUv;

                void main() {
                    float gridSize = 64.0;
                    vec2 grid = fract(vUv * gridSize);
                    float lineWidth = 0.05;
                    
                    float xLine = step(1.0 - lineWidth, grid.x) + step(1.0 - lineWidth, 1.0 - grid.x);
                    float zLine = step(1.0 - lineWidth, grid.y) + step(1.0 - lineWidth, 1.0 - grid.y);
                    
                    float alpha = xLine + zLine;
                    alpha = min(alpha, 1.0);
                    
                    // Add subtle pulse
                    float pulse = sin(time * 2.0) * 0.1 + 0.9;
                    alpha *= pulse;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.material = material;
    }

    private createGridLines(): void {
        const points: number[] = [];
        const colors: number[] = [];
        const orange = new THREE.Color(0xff6600);

        // Create vertical lines
        for (let i = -this.gridSize / 2; i <= this.gridSize / 2; i++) {
            const x = i * this.cellSize;
            points.push(x, 0, -this.totalSize / 2);
            points.push(x, 0, this.totalSize / 2);
            colors.push(orange.r, orange.g, orange.b);
            colors.push(orange.r, orange.g, orange.b);
        }

        // Create horizontal lines
        for (let i = -this.gridSize / 2; i <= this.gridSize / 2; i++) {
            const z = i * this.cellSize;
            points.push(-this.totalSize / 2, 0, z);
            points.push(this.totalSize / 2, 0, z);
            colors.push(orange.r, orange.g, orange.b);
            colors.push(orange.r, orange.g, orange.b);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.LineBasicMaterial({ 
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            linewidth: 1
        });

        this.gridLines = new THREE.LineSegments(geometry, material);
        this.gridLines.renderOrder = 9999;
        this.scene.add(this.gridLines);
    }

    private createGridMesh(): void {
        if (this.material) {
            const gridGeometry = new THREE.PlaneGeometry(
                this.totalSize,
                this.totalSize,
                this.gridSize * 2,
                this.gridSize * 2
            );
            this.gridMesh = new THREE.Mesh(gridGeometry, this.material as THREE.Material);
            this.gridMesh.rotation.x = -Math.PI / 2;
            this.gridMesh.renderOrder = 9999;
            this.scene.add(this.gridMesh);
        }
    }

    public update(time: number): void {
        if (this.material) {
            this.material.uniforms.time.value = time;
        }
    }

    public getGridSize(): number {
        return this.gridSize;
    }

    public getCellSize(): number {
        return this.cellSize;
    }

    public getTotalSize(): number {
        return this.totalSize;
    }

    public dispose(): void {
        if (this.gridLines) {
            this.scene.remove(this.gridLines);
            this.gridLines.geometry.dispose();
            if (this.gridLines.material instanceof THREE.Material) {
                this.gridLines.material.dispose();
            } else {
                this.gridLines.material.forEach(material => material.dispose());
            }
            this.gridLines = null;
        }
        if (this.gridMesh) {
            this.scene.remove(this.gridMesh);
            this.gridMesh.geometry.dispose();
            this.gridMesh = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
    }
} 