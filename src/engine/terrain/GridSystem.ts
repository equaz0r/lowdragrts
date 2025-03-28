import * as THREE from 'three';

export class GridSystem {
    private scene: THREE.Scene;
    private readonly gridSize: number = 64; // -32 to 32
    private readonly cellSize: number = 100;
    private readonly totalSize: number;
    private readonly divisions: number;
    private camera: THREE.PerspectiveCamera;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;
        this.totalSize = this.gridSize * this.cellSize;
        this.divisions = this.gridSize;
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

    public getGridDivisions(): number {
        return this.divisions;
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }
} 