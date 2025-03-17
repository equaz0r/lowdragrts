import * as THREE from 'three';
import { Unit, UnitType } from './Unit';
import { WorldManager } from '../voxel/WorldManager';
import { ProjectileManager } from '../combat/ProjectileManager';
import { CommandVisualizer } from './CommandVisualizer';
import { GameUI } from '../ui/GameUI';

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
    private currentX: number = 0;
    private currentY: number = 0;
    private nextUnitId: number = 1;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private lastHoveredUnit: Unit | null = null;
    private scrapPiles: THREE.Group[] = [];
    private scrapCount: number = 0;
    private gameUI: GameUI;

    constructor(
        scene: THREE.Scene, 
        worldManager: WorldManager,
        projectileManager: ProjectileManager,
        commandVisualizer: CommandVisualizer,
        gameUI: GameUI
    ) {
        this.scene = scene;
        this.worldManager = worldManager;
        this.projectileManager = projectileManager;
        this.commandVisualizer = commandVisualizer;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.gameUI = gameUI;
    }

    public createUnit(type: UnitType, position: THREE.Vector3): Unit {
        const unit = new Unit(
            this.nextUnitId++,
            type,
            this.scene,
            this.worldManager,
            this.projectileManager,
            this.commandVisualizer
        );
        unit.position.copy(position);
        this.units.push(unit);
        this.scene.add(unit);
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
        const threshold = 5; // Reduced threshold for more precise selection
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
        console.log('Attacking target unit:', target.getId());
        this.selectedUnits.forEach(unit => {
            if (unit !== target) { // Prevent unit from attacking itself
                console.log('Unit', unit.getId(), 'attacking target');
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
        this.selectionStartX = x;
        this.selectionStartY = y;
        this.selectedUnits.clear();
        this.selectedUnits.forEach(unit => unit.setSelected(false));
    }

    public updateSelection(x: number, y: number): void {
        this.currentX = x;
        this.currentY = y;
        const box = this.calculateSelectionBox();
        this.selectUnitsInBox(box);
        this.createSelectionBox();
    }

    public endSelection(): void {
        // Finalize selection box
        const box = this.calculateSelectionBox();
        this.selectUnitsInBox(box);
        
        // Clean up selection box visualization
        this.clearSelectionBox();
        
        // Update selected units' visual state
        this.selectedUnits.forEach(unit => unit.setSelected(true));
    }

    private createSelectionBox(): void {
        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
        }

        const box = this.calculateSelectionBox();
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });

        this.selectionBox = new THREE.Mesh(geometry, material);
        this.selectionBox.position.copy(center);
        this.scene.add(this.selectionBox);
    }

    private clearSelectionBox(): void {
        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
            this.selectionBox.geometry.dispose();
            (this.selectionBox.material as THREE.Material).dispose();
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
        
        Array.from(this.selectedUnits).forEach((unit, index: number) => {
            const row = Math.floor(index / unitsPerRow);
            const col = index % unitsPerRow;
            const offset = new THREE.Vector3(
                (col - (unitsPerRow - 1) / 2) * spacing,
                0,
                row * spacing
            );
            const targetPosition = target.clone().add(offset);
            unit.moveTo(targetPosition);
        });
    }

    public update(delta: number): void {
        // Update all units
        this.units.forEach(unit => unit.update(delta));

        // Check for scrap collection
        this.checkScrapCollection();
    }

    private checkScrapCollection(): void {
        this.units.forEach(unit => {
            const unitPosition = unit.getPosition();
            
            // Check each scrap pile
            this.scrapPiles.forEach((pile, index) => {
                const pilePosition = pile.position;
                const distance = unitPosition.distanceTo(pilePosition);
                
                // If unit is close enough to collect scrap
                if (distance < 2) {
                    // Add scrap to counter
                    this.scrapCount += 5; // Each pile gives 5 scrap
                    
                    // Remove scrap pile from scene
                    this.scene.remove(pile);
                    pile.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.geometry.dispose();
                            if (Array.isArray(child.material)) {
                                child.material.forEach(material => material.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                    this.scrapPiles.splice(index, 1);
                    
                    // Update UI
                    this.gameUI.updateScrapCounter(this.scrapCount);
                }
            });
        });
    }

    public addScrapPile(pile: THREE.Group): void {
        this.scrapPiles.push(pile);
    }

    public getScrapCount(): number {
        return this.scrapCount;
    }

    public isUnitSelected(unit: Unit): boolean {
        return this.selectedUnits.has(unit);
    }

    private calculateSelectionBox(): THREE.Box3 {
        const box = new THREE.Box3();
        const camera = this.scene.userData.camera;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        // Convert screen coordinates to normalized device coordinates (-1 to +1)
        mouse.x = (this.selectionStartX / window.innerWidth) * 2 - 1;
        mouse.y = -(this.selectionStartY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const startPoint = raycaster.intersectObjects(this.scene.children, true)[0]?.point || new THREE.Vector3();

        mouse.x = (this.currentX / window.innerWidth) * 2 - 1;
        mouse.y = -(this.currentY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const endPoint = raycaster.intersectObjects(this.scene.children, true)[0]?.point || new THREE.Vector3();

        // Create a box that encompasses both points with some padding
        const padding = 5;
        box.setFromPoints([
            new THREE.Vector3(startPoint.x - padding, startPoint.y - padding, startPoint.z - padding),
            new THREE.Vector3(startPoint.x + padding, startPoint.y + padding, startPoint.z + padding),
            new THREE.Vector3(endPoint.x - padding, endPoint.y - padding, endPoint.z - padding),
            new THREE.Vector3(endPoint.x + padding, endPoint.y + padding, endPoint.z + padding)
        ]);
        return box;
    }

    private selectUnitsInBox(box: THREE.Box3): void {
        // Clear previous selection
        this.selectedUnits.forEach(unit => unit.setSelected(false));
        this.selectedUnits.clear();

        // Select units in box
        this.units.forEach(unit => {
            const position = unit.getPosition();
            if (box.containsPoint(position)) {
                unit.setSelected(true);
                this.selectedUnits.add(unit);
            }
        });
    }

    public updateHover(x: number, y: number): void {
        // Convert mouse position to normalized device coordinates (-1 to +1)
        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.scene.userData.camera);

        // Find intersected units
        const intersects = this.raycaster.intersectObjects(this.units.map(unit => unit.getMesh()), true);
        
        // Find the first intersected unit
        const intersectedUnit = intersects.length > 0 
            ? this.units.find(unit => unit.getMesh().id === intersects[0].object.id) || null
            : null;

        // Update hover state
        if (this.lastHoveredUnit && this.lastHoveredUnit !== intersectedUnit) {
            this.lastHoveredUnit.setHovered(false);
        }
        if (intersectedUnit) {
            intersectedUnit.setHovered(true);
        }
        this.lastHoveredUnit = intersectedUnit;
    }

    public selectUnit(unit: Unit): void {
        this.selectedUnits.forEach(u => u.setSelected(false));
        this.selectedUnits.clear();
        unit.setSelected(true);
        this.selectedUnits.add(unit);
    }

    public deselectUnit(unit: Unit): void {
        unit.setSelected(false);
        this.selectedUnits.delete(unit);
    }

    public toggleUnitSelection(unit: Unit): void {
        if (this.selectedUnits.has(unit)) {
            this.deselectUnit(unit);
        } else {
            this.selectUnit(unit);
        }
    }

    public updateSelectedUnitsInfo(): void {
        const selectedUnits = this.getSelectedUnits();
        const unitInfo = selectedUnits.map(unit => ({
            type: unit.getType(),
            count: 1,
            health: unit.getHealth(),
            maxHealth: unit.getMaxHealth()
        }));

        // Group by unit type
        const groupedInfo = unitInfo.reduce((acc, curr) => {
            const existing = acc.find(item => item.type === curr.type);
            if (existing) {
                existing.count++;
            } else {
                acc.push(curr);
            }
            return acc;
        }, [] as typeof unitInfo);

        this.gameUI.updateSelectedUnitsInfo(groupedInfo);
    }

    public updateScrapCounter(): void {
        this.gameUI.updateScrapCounter(this.scrapCount);
    }
} 