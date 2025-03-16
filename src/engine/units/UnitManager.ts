import * as THREE from 'three';
import { Unit, UnitType } from './Unit';
import { WorldManager } from '../voxel/WorldManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { CommandVisualizer } from './CommandVisualizer';

export class UnitManager {
    private units: Unit[] = [];
    private selectedUnits: Set<Unit> = new Set();
    private scene: THREE.Scene;
    private worldManager: WorldManager;
    private projectileManager: ProjectileManager;
    private commandVisualizer: CommandVisualizer;
    private selectionBox: THREE.Mesh | null = null;
    private selectionStartX: number = 0;
    private selectionStartY: number = 0;

    constructor(
        scene: THREE.Scene, 
        worldManager: WorldManager,
        projectileManager: ProjectileManager,
        commandVisualizer: CommandVisualizer
    ) {
        this.scene = scene;
        this.worldManager = worldManager;
        this.projectileManager = projectileManager;
        this.commandVisualizer = commandVisualizer;
    }

    public createUnit(type: UnitType, position: THREE.Vector3): Unit {
        const unit = new Unit(type, position, this.worldManager, this.projectileManager, this.commandVisualizer);
        this.units.push(unit);
        this.scene.add(unit.getMesh());
        return unit;
    }

    public getSelectedUnits(): Unit[] {
        return Array.from(this.selectedUnits);
    }

    public selectUnitsById(ids: number[]): void {
        this.selectedUnits.forEach(unit => unit.setSelected(false));
        this.selectedUnits = new Set(this.units.filter(unit => ids.includes(unit.getId())));
        this.selectedUnits.forEach(unit => unit.setSelected(true));
    }

    public getUnitAtPosition(position: THREE.Vector3): Unit | null {
        // Find the closest unit within a threshold distance
        const threshold = 2;
        let closestUnit: Unit | null = null;
        let closestDistance = threshold;

        this.units.forEach(unit => {
            const distance = unit.getPosition().distanceTo(position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestUnit = unit;
            }
        });

        return closestUnit;
    }

    public attackTarget(target: Unit): void {
        this.selectedUnits.forEach(unit => {
            if (unit !== target) { // Prevent unit from attacking itself
                unit.attack(target);
            }
        });
    }

    public stopSelectedUnits(): void {
        this.selectedUnits.forEach(unit => unit.stop());
    }

    public holdSelectedUnits(): void {
        this.selectedUnits.forEach(unit => unit.hold());
    }

    public cancelCurrentAction(): void {
        this.selectedUnits.forEach(unit => unit.cancelAction());
    }

    public startSelection(x: number, y: number): void {
        this.clearSelectionBox();
        
        // Create selection box
        const geometry = new THREE.BoxGeometry(1, 1, 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthTest: false
        });
        
        this.selectionBox = new THREE.Mesh(geometry, material);
        this.scene.add(this.selectionBox);
        
        // Store coordinates as numbers
        this.selectionStartX = Number(x);
        this.selectionStartY = Number(y);
    }

    public updateSelection(x: number, y: number): void {
        if (!this.selectionBox) return;

        const currentX = Number(x);
        const currentY = Number(y);
        const startX = this.selectionStartX;
        const startY = this.selectionStartY;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const centerX = (currentX + startX) / 2;
        const centerY = (currentY + startY) / 2;

        this.selectionBox.scale.set(width, height, 1);
        this.selectionBox.position.set(centerX, centerY, 0);
    }

    public endSelection(): void {
        console.log("Ending selection");
        this.clearSelectionBox();
        // Process selection...
    }

    private clearSelectionBox(): void {
        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
            this.selectionBox = null;
        }
    }

    public clearSelection(): void {
        this.selectedUnits.forEach(unit => unit.setSelected(false));
        this.selectedUnits.clear();
        this.clearSelectionBox();
    }

    public moveSelectedUnits(target: THREE.Vector3): void {
        // Simple formation movement - can be improved later
        const spacing = 8; // Space between units
        const unitsPerRow = Math.ceil(Math.sqrt(this.selectedUnits.size));
        
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

    public update(delta: number): void {
        this.units.forEach(unit => unit.update(delta));
    }

    public dispose(): void {
        this.units.forEach(unit => {
            unit.dispose();
            this.scene.remove(unit.getMesh());
        });
        this.units = [];
        this.selectedUnits = new Set();
    }

    public isUnitSelected(unit: Unit): boolean {
        return this.selectedUnits.has(unit);
    }
} 