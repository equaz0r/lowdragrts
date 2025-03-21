import * as THREE from 'three';

export class GridSystem {
    private scene: THREE.Scene;
    private readonly gridSize: number = 64; // -32 to 32
    private readonly cellSize: number = 100;
    private readonly totalSize: number;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.totalSize = this.gridSize * this.cellSize;
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
} 