import * as THREE from 'three';
import { ControlMode } from '../controls/InputManager';
import { UnitType } from '../units/Unit';
import { DraggableUI } from './DraggableUI';
import { Unit } from '../units/Unit';

export class GameUI {
    private container: HTMLElement;
    private selectionBox: HTMLElement = document.createElement('div');
    private unitInfo: HTMLElement = document.createElement('div');
    private actionIndicator: HTMLElement = document.createElement('div');
    private statusBar: HTMLElement = document.createElement('div');
    private controlBar: HTMLElement = document.createElement('div');
    private scrapCounter: HTMLElement = document.createElement('div');
    private cursorCoordinates: HTMLElement = document.createElement('div');
    private statusText: HTMLElement = document.createElement('div');
    private draggableUI: DraggableUI = new DraggableUI(document.createElement('div'));
    private currentMode: string = 'CAMERA';
    private cursorStyle: string = 'default';
    private cursorStyleElement: HTMLStyleElement = document.createElement('style');

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'game-ui';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none';
        this.container.style.zIndex = '1000';
        document.body.appendChild(this.container);
        document.head.appendChild(this.cursorStyleElement);

        this.setupUI();
    }

    private setupUI(): void {
        // Create selection box
        this.selectionBox.style.position = 'absolute';
        this.selectionBox.style.border = '2px solid #00ff00';
        this.selectionBox.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
        this.selectionBox.style.pointerEvents = 'none';
        this.selectionBox.style.display = 'none';
        this.container.appendChild(this.selectionBox);

        // Create unit info display
        this.unitInfo.style.position = 'absolute';
        this.unitInfo.style.padding = '10px';
        this.unitInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.unitInfo.style.color = '#00ff00';
        this.unitInfo.style.fontFamily = 'Consolas, monospace';
        this.unitInfo.style.fontSize = '12px';
        this.unitInfo.style.pointerEvents = 'none';
        this.unitInfo.style.display = 'none';
        this.container.appendChild(this.unitInfo);

        // Create action indicator
        this.actionIndicator.style.position = 'absolute';
        this.actionIndicator.style.padding = '5px';
        this.actionIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.actionIndicator.style.color = '#00ff00';
        this.actionIndicator.style.fontFamily = 'Consolas, monospace';
        this.actionIndicator.style.fontSize = '12px';
        this.actionIndicator.style.pointerEvents = 'none';
        this.actionIndicator.style.display = 'none';
        this.container.appendChild(this.actionIndicator);

        // Create status bar
        this.statusBar.style.position = 'fixed';
        this.statusBar.style.top = '10px';
        this.statusBar.style.left = '10px';
        this.statusBar.style.padding = '10px';
        this.statusBar.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.statusBar.style.color = '#00ff00';
        this.statusBar.style.fontFamily = 'Consolas, monospace';
        this.statusBar.style.fontSize = '12px';
        this.statusBar.style.pointerEvents = 'auto';
        this.statusBar.style.zIndex = '1001';
        this.statusBar.style.border = '1px solid #00ff00';
        this.statusBar.style.borderRadius = '5px';
        this.container.appendChild(this.statusBar);

        // Create control bar
        this.controlBar.style.position = 'fixed';
        this.controlBar.style.bottom = '20px';
        this.controlBar.style.left = '50%';
        this.controlBar.style.transform = 'translateX(-50%)';
        this.controlBar.style.padding = '10px';
        this.controlBar.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.controlBar.style.color = '#00ff00';
        this.controlBar.style.fontFamily = 'Consolas, monospace';
        this.controlBar.style.fontSize = '12px';
        this.controlBar.style.pointerEvents = 'auto';
        this.controlBar.style.zIndex = '1001';
        this.controlBar.style.border = '1px solid #00ff00';
        this.controlBar.style.borderRadius = '5px';
        this.controlBar.style.display = 'flex';
        this.controlBar.style.gap = '10px';
        this.controlBar.style.flexWrap = 'nowrap';
        this.controlBar.style.width = 'auto';
        this.controlBar.style.minWidth = 'fit-content';
        this.controlBar.style.maxWidth = '80%';
        this.controlBar.style.height = 'auto';
        this.controlBar.style.minHeight = 'fit-content';
        this.controlBar.style.maxHeight = 'none';
        this.container.appendChild(this.controlBar);

        // Create scrap counter
        this.scrapCounter.style.position = 'fixed';
        this.scrapCounter.style.top = '10px';
        this.scrapCounter.style.right = '10px';
        this.scrapCounter.style.padding = '10px';
        this.scrapCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.scrapCounter.style.color = '#00ff00';
        this.scrapCounter.style.fontFamily = 'Consolas, monospace';
        this.scrapCounter.style.fontSize = '12px';
        this.scrapCounter.style.pointerEvents = 'auto';
        this.scrapCounter.style.zIndex = '1001';
        this.scrapCounter.style.border = '1px solid #00ff00';
        this.scrapCounter.style.borderRadius = '5px';
        this.container.appendChild(this.scrapCounter);

        // Create cursor coordinates
        this.cursorCoordinates.style.position = 'fixed';
        this.cursorCoordinates.style.bottom = '10px';
        this.cursorCoordinates.style.right = '10px';
        this.cursorCoordinates.style.padding = '10px';
        this.cursorCoordinates.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.cursorCoordinates.style.color = '#00ff00';
        this.cursorCoordinates.style.fontFamily = 'Consolas, monospace';
        this.cursorCoordinates.style.fontSize = '12px';
        this.cursorCoordinates.style.pointerEvents = 'auto';
        this.cursorCoordinates.style.zIndex = '1001';
        this.cursorCoordinates.style.border = '1px solid #00ff00';
        this.cursorCoordinates.style.borderRadius = '5px';
        this.container.appendChild(this.cursorCoordinates);

        // Create status text display
        this.statusText.style.position = 'fixed';
        this.statusText.style.top = '20px';
        this.statusText.style.left = '50%';
        this.statusText.style.transform = 'translateX(-50%)';
        this.statusText.style.padding = '10px 20px';
        this.statusText.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.statusText.style.color = '#ffffff';
        this.statusText.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        this.statusText.style.fontSize = '16px';
        this.statusText.style.fontWeight = 'bold';
        this.statusText.style.pointerEvents = 'none';
        this.statusText.style.zIndex = '1001';
        this.statusText.style.border = '1px solid #00ff00';
        this.statusText.style.borderRadius = '5px';
        this.statusText.style.textAlign = 'center';
        this.statusText.style.whiteSpace = 'nowrap';
        this.container.appendChild(this.statusText);

        // Make control bar draggable
        this.draggableUI = new DraggableUI(this.controlBar, 'Unit Controls');

        // Add control buttons
        const buttons = [
            { text: 'Attack (A)', action: 'attack' },
            { text: 'Stop (S)', action: 'stop' },
            { text: 'Hold (H)', action: 'hold' },
            { text: 'Patrol (P)', action: 'patrol' },
            { text: '👁️ Camera Mode (Space)', action: 'toggleMode' },
            { text: '❔ Help', action: 'help' }
        ];

        buttons.forEach(({ text, action }) => {
            const button = this.createButton(text, () => {
                const event = new CustomEvent('gameAction', {
                    detail: { action: action }
                });
                document.dispatchEvent(event);
            });
            this.controlBar.appendChild(button);
        });
    }

    public createButton(text: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.padding = '8px 16px';
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        button.style.color = '#00ff00';
        button.style.border = '1px solid #00ff00';
        button.style.borderRadius = '3px';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Consolas, monospace';
        button.style.fontSize = '12px';
        button.style.whiteSpace = 'nowrap';
        button.style.minWidth = 'fit-content';
        button.style.height = 'auto';
        button.style.minHeight = 'fit-content';
        button.style.maxHeight = 'none';
        button.style.flex = '0 0 auto';
        button.style.pointerEvents = 'auto';
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        });

        button.addEventListener('click', onClick);
        return button;
    }

    public updateModeIndicator(): void {
        this.statusBar.textContent = `Mode: ${this.currentMode}`;
    }

    public setMode(mode: string): void {
        this.currentMode = mode;
        this.updateModeIndicator();
    }

    public updateAction(action: string | null): void {
        if (action) {
            this.actionIndicator.textContent = `ACTION: ${action.toUpperCase()}`;
            this.actionIndicator.style.display = 'block';
            this.updateCursorStyle(action === 'attack' ? 'crosshair' : 'pointer');
        } else {
            this.actionIndicator.style.display = 'none';
            this.updateCursorStyle('default');
        }
    }

    private updateCursorStyle(cursorType: string): void {
        this.cursorStyle = cursorType;
        this.cursorStyleElement.textContent = `
            body { 
                cursor: ${cursorType} !important;
            }
        `;
    }

    public updateSelectedUnitsInfo(selectedUnits: { type: string; count: number; health?: number; maxHealth?: number }[]): void {
        if (selectedUnits.length === 0) {
            this.statusBar.textContent = 'No units selected';
            return;
        }

        const info = selectedUnits.map(unit => {
            const healthInfo = unit.health !== undefined && unit.maxHealth !== undefined
                ? ` (${Math.round(unit.health)}/${unit.maxHealth})`
                : '';
            return `${unit.count}x ${unit.type}${healthInfo}`;
        }).join(', ');

        this.statusBar.textContent = info;
    }

    public updateCursorPosition(x: number, y: number, z: number): void {
        this.cursorCoordinates.textContent = 
            `X: ${x.toFixed(1)} Y: ${y.toFixed(1)} Z: ${z.toFixed(1)}`;
    }

    public toggleHotkeyDisplay(): void {
        // Removed hotkey display functionality
    }

    public updateCursorCoordinates(coordinates: THREE.Vector3): void {
        this.cursorCoordinates.textContent = `X: ${coordinates.x.toFixed(1)} Y: ${coordinates.y.toFixed(1)} Z: ${coordinates.z.toFixed(1)}`;
    }

    public updateScrapCounter(scrap: number): void {
        this.scrapCounter.textContent = `Scrap: ${scrap}`;
    }

    public showActionIndicator(action: string): void {
        this.actionIndicator.textContent = action;
        this.actionIndicator.style.display = 'block';
    }

    public hideActionIndicator(): void {
        this.actionIndicator.style.display = 'none';
    }

    public updateSelectionBox(startX: number, startY: number, endX: number, endY: number): void {
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        this.selectionBox.style.left = `${left}px`;
        this.selectionBox.style.top = `${top}px`;
        this.selectionBox.style.width = `${width}px`;
        this.selectionBox.style.height = `${height}px`;
        this.selectionBox.style.display = 'block';
    }

    public hideSelectionBox(): void {
        this.selectionBox.style.display = 'none';
    }

    public showUnitInfo(unit: Unit): void {
        const health = unit.getHealth();
        const maxHealth = unit.getMaxHealth();
        this.unitInfo.textContent = `${unit.getType()} (${Math.round(health)}/${maxHealth})`;
        this.unitInfo.style.display = 'block';
    }

    public hideUnitInfo(): void {
        this.unitInfo.style.display = 'none';
    }

    public updateStatusText(mode: string, action: string = ''): void {
        let text = mode;
        if (action) {
            text += ` - ${action}`;
        }
        this.statusText.textContent = text;
        this.statusText.style.display = text ? 'block' : 'none';
    }

    public updateUnitInfo(selectedUnits: Unit[]): void {
        if (!selectedUnits || selectedUnits.length === 0) {
            this.statusText.textContent = '';
            this.statusText.style.display = 'none';
            return;
        }

        const info = selectedUnits.map(unit => {
            const type = unit.getType();
            const health = unit.getHealth();
            const maxHealth = unit.getMaxHealth();
            return `${type} (${health}/${maxHealth} HP)`;
        }).join(' | ');

        this.statusText.textContent = info;
        this.statusText.style.display = 'block';
    }

    public dispose(): void {
        document.body.removeChild(this.container);
    }
} 