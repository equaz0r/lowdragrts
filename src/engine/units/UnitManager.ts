import * as THREE from 'three';
import { Unit, UnitType } from './Unit';
import { WorldManager } from '../voxel/WorldManager';

export class UnitManager {
    private units: Unit[] = [];
    private scene: THREE.Scene;
    private worldManager: WorldManager;
    private selectionBox: THREE.Vector2[] = [];
    private selectedUnits: Unit[] = [];

    constructor(scene: THREE.Scene, worldManager: WorldManager) {
        this.scene = scene;
        this.worldManager = worldManager;
    }

    public createUnit(type: UnitType, position: THREE.Vector3): Unit {
        const unit = new Unit(type, position, this.worldManager);
        this.units.push(unit);
        this.scene.add(unit.getMesh());
        return unit;
    }

    public update(delta: number): void {
        this.units.forEach(unit => unit.update(delta));
    }

    public startSelection(x: number, y: number): void {
        this.selectionBox = [new THREE.Vector2(x, y)];
    }

    public updateSelection(x: number, y: number): void {
        if (this.selectionBox.length > 0) {
            this.selectionBox[1] = new THREE.Vector2(x, y);
        }
    }

    public endSelection(camera: THREE.Camera): void {
        if (this.selectionBox.length !== 2) return;

        // Deselect all units
        this.selectedUnits.forEach(unit => unit.setSelected(false));
        this.selectedUnits = [];

        // Calculate selection bounds
        const minX = Math.min(this.selectionBox[0].x, this.selectionBox[1].x);
        const maxX = Math.max(this.selectionBox[0].x, this.selectionBox[1].x);
        const minY = Math.min(this.selectionBox[0].y, this.selectionBox[1].y);
        const maxY = Math.max(this.selectionBox[0].y, this.selectionBox[1].y);

        // Check each unit
        this.units.forEach(unit => {
            const screenPosition = unit.getPosition().clone().project(camera);
            screenPosition.x = (screenPosition.x + 1) / 2 * window.innerWidth;
            screenPosition.y = (-screenPosition.y + 1) / 2 * window.innerHeight;

            if (screenPosition.x >= minX && screenPosition.x <= maxX &&
                screenPosition.y >= minY && screenPosition.y <= maxY) {
                unit.setSelected(true);
                this.selectedUnits.push(unit);
            }
        });

        this.selectionBox = [];
    }

    public moveSelectedUnits(target: THREE.Vector3): void {
        // Simple formation movement - can be improved later
        const spacing = 8; // Space between units
        const unitsPerRow = Math.ceil(Math.sqrt(this.selectedUnits.length));
        
        this.selectedUnits.forEach((unit, index) => {
            const row = Math.floor(index / unitsPerRow);
            const col = index % unitsPerRow;
            const offset = new THREE.Vector3(
                (col - (unitsPerRow - 1) / 2) * spacing,
                0,
                row * spacing
            );
            unit.setTarget(target.clone().add(offset));
        });
    }

    public dispose(): void {
        this.units.forEach(unit => {
            unit.dispose();
            this.scene.remove(unit.getMesh());
        });
        this.units = [];
        this.selectedUnits = [];
    }
} 