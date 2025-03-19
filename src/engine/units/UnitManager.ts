import * as THREE from 'three';
import { Unit, UnitType } from './Unit';
import { WorldManager } from '../world/WorldManager';
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

        // Store reference to UnitManager in scene for scrap collection
        scene.userData.unitManager = this;
    }

    public createUnit(type: UnitType, position: THREE.Vector3): Unit {
        const unit = new Unit(type, position);
        unit.setWorldManager(this.worldManager);
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
            this.scrapPiles.forEach((scrapPile, index) => {
                const distance = unit.position.distanceTo(scrapPile.position);
                if (distance < 2) {
                    // Collect scrap
                    const scrapAmount = 5;
                    this.scrapCount += scrapAmount;
                    
                    // Create floating text
                    const div = document.createElement('div');
                    div.style.position = 'absolute';
                    div.style.color = 'white';
                    div.style.fontSize = '24px';
                    div.style.fontWeight = 'bold';
                    div.style.textShadow = '0 0 10px cyan';
                    div.style.whiteSpace = 'nowrap';
                    div.style.pointerEvents = 'none';
                    div.style.zIndex = '1000';
                    div.textContent = `+${scrapAmount}`;
                    
                    // Position text at unit's position
                    const vector = unit.position.clone();
                    vector.y += 2; // Offset above unit
                    
                    // Project 3D position to screen
                    vector.project(this.scene.userData.camera);
                    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
                    
                    div.style.left = `${x}px`;
                    div.style.top = `${y}px`;
                    div.style.transform = 'translate(-50%, -50%)';
                    
                    document.body.appendChild(div);
                    
                    // Animate text
                    let opacity = 1;
                    let offset = 0;
                    const animate = () => {
                        opacity -= 0.02;
                        offset += 1;
                        
                        if (opacity > 0) {
                            div.style.opacity = opacity.toString();
                            div.style.top = `${y - offset}px`;
                            requestAnimationFrame(animate);
                        } else {
                            document.body.removeChild(div);
                        }
                    };
                    animate();
                    
                    // Remove scrap pile
                    this.scene.remove(scrapPile);
                    scrapPile.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            if (child.geometry) {
                                child.geometry.dispose();
                            }
                            if (child.material instanceof THREE.Material) {
                                child.material.dispose();
                            } else if (Array.isArray(child.material)) {
                                child.material.forEach(material => material.dispose());
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
        // Find units within the selection box
        const unitsInBox = this.units.filter(unit => {
            const mesh = unit.getMesh();
            if (!mesh) return false;
            return box.containsPoint(mesh.position);
        });

        // Update selection
        this.selectedUnits.forEach(unit => unit.setSelected(false));
        this.selectedUnits = new Set(unitsInBox);
        this.selectedUnits.forEach(unit => unit.setSelected(true));
    }

    public updateHover(x: number, y: number): void {
        // Convert mouse position to normalized device coordinates (-1 to +1)
        this.mouse.x = (x / window.innerWidth) * 2 - 1;
        this.mouse.y = -(y / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.scene.userData.camera);

        // Filter out null meshes and ensure we have valid Object3D instances
        const validMeshes = this.units
            .map(unit => unit.getMesh())
            .filter((mesh): mesh is THREE.Mesh => mesh !== null);

        // Find intersected units
        const intersects = this.raycaster.intersectObjects(validMeshes, true);
        
        // Find the first intersected unit
        const intersectedUnit = intersects.length > 0 
            ? this.units.find(unit => unit.getMesh()?.id === intersects[0].object.id) || null
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