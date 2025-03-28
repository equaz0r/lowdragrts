import * as THREE from 'three';
import { GridParameters } from '../config/GameParameters';

export class GridSystem {
    private scene: THREE.Scene;
    private readonly gridSize: number;
    private readonly cellSize: number;
    private readonly totalSize: number;
    private readonly divisions: number;
    private camera: THREE.PerspectiveCamera;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;
        this.cellSize = GridParameters.CELL_SIZE;
        this.divisions = GridParameters.DIVISIONS;
        this.gridSize = this.divisions;
        this.totalSize = GridParameters.TOTAL_SIZE;
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