import * as THREE from 'three';
import { GridParameters } from '../config/GameParameters';

export type GridChangeType = 'size' | 'divisions' | 'cellSize' | 'totalSize';

export class GridSystem {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private _gridSize: number;
    private _cellSize: number;
    private _totalSize: number;
    private _divisions: number;
    private listeners: Set<(type: GridChangeType) => void> = new Set();

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;
        this._cellSize = GridParameters.CELL_SIZE;
        this._divisions = GridParameters.DIVISIONS;
        this._gridSize = this._divisions;
        this._totalSize = GridParameters.TOTAL_SIZE;
    }

    // Getters
    public getGridSize(): number {
        return this._gridSize;
    }

    public getCellSize(): number {
        return this._cellSize;
    }

    public getTotalSize(): number {
        return this._totalSize;
    }

    public getGridDivisions(): number {
        return this._divisions;
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    // Setters with validation
    public setTotalSize(size: number): void {
        if (size < GridParameters.MIN_TOTAL_SIZE || size > GridParameters.MAX_TOTAL_SIZE) {
            throw new Error(`Total size must be between ${GridParameters.MIN_TOTAL_SIZE} and ${GridParameters.MAX_TOTAL_SIZE}`);
        }
        if (size % this._cellSize !== 0) {
            throw new Error('Total size must be divisible by cell size');
        }
        this._totalSize = size;
        this.notifyChange('totalSize');
    }

    public setCellSize(size: number): void {
        if (size < GridParameters.MIN_CELL_SIZE || size > GridParameters.MAX_CELL_SIZE) {
            throw new Error(`Cell size must be between ${GridParameters.MIN_CELL_SIZE} and ${GridParameters.MAX_CELL_SIZE}`);
        }
        if (this._totalSize % size !== 0) {
            throw new Error('Cell size must divide total size evenly');
        }
        this._cellSize = size;
        this._gridSize = Math.floor(this._totalSize / size);
        this.notifyChange('cellSize');
    }

    public setDivisions(divisions: number): void {
        if (divisions < GridParameters.MIN_DIVISIONS || divisions > GridParameters.MAX_DIVISIONS) {
            throw new Error(`Divisions must be between ${GridParameters.MIN_DIVISIONS} and ${GridParameters.MAX_DIVISIONS}`);
        }
        this._divisions = divisions;
        this._gridSize = divisions;
        this.notifyChange('divisions');
    }

    // Change notification system
    public addChangeListener(listener: (type: GridChangeType) => void): void {
        this.listeners.add(listener);
    }

    public removeChangeListener(listener: (type: GridChangeType) => void): void {
        this.listeners.delete(listener);
    }

    private notifyChange(type: GridChangeType): void {
        this.listeners.forEach(listener => listener(type));
    }

    // Validation methods
    public validateParameters(): boolean {
        try {
            // Check total size constraints
            if (this._totalSize < GridParameters.MIN_TOTAL_SIZE || 
                this._totalSize > GridParameters.MAX_TOTAL_SIZE) {
                return false;
            }

            // Check cell size constraints
            if (this._cellSize < GridParameters.MIN_CELL_SIZE || 
                this._cellSize > GridParameters.MAX_CELL_SIZE) {
                return false;
            }

            // Check divisions constraints
            if (this._divisions < GridParameters.MIN_DIVISIONS || 
                this._divisions > GridParameters.MAX_DIVISIONS) {
                return false;
            }

            // Check divisibility
            if (this._totalSize % this._cellSize !== 0) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    // Reset to default values
    public resetToDefaults(): void {
        this._cellSize = GridParameters.CELL_SIZE;
        this._divisions = GridParameters.DIVISIONS;
        this._gridSize = this._divisions;
        this._totalSize = GridParameters.TOTAL_SIZE;
        this.notifyChange('size');
    }
} 