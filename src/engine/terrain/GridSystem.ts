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
        this.createGridLines();
    }

    private createGridLines(): void {
        const gridSize = this.gridSize;
        const cellSize = this.cellSize;
        const totalSize = gridSize * cellSize;
        const halfSize = totalSize / 2;

        const vertices: number[] = [];
        const colors: number[] = [];
        const color = new THREE.Color(0xff6600); // Neon orange

        // Create grid lines
        for (let i = 0; i <= gridSize; i++) {
            const pos = (i * cellSize) - halfSize;

            // Vertical lines (along Z)
            vertices.push(pos, 0, -halfSize);
            vertices.push(pos, 0, halfSize);
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);

            // Horizontal lines (along X)
            vertices.push(-halfSize, 0, pos);
            vertices.push(halfSize, 0, pos);
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0xff6600,
            linewidth: 1,
            vertexColors: true,
            transparent: true,
            opacity: 1.0
        });

        this.gridLines = new THREE.LineSegments(geometry, material);
        this.gridLines.renderOrder = 1;
        this.scene.add(this.gridLines);
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
    }
} 