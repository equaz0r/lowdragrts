import * as THREE from 'three';
import { ControlMode } from '../controls/InputManager';
import { UnitType } from '../units/Unit';

export class GameUI {
    private container: HTMLDivElement;
    private controlBar: HTMLDivElement;
    private statusBar: HTMLDivElement;
    private modeIndicator: HTMLDivElement;
    private hotkeyDisplay: HTMLDivElement;
    private selectedUnitsInfo: HTMLDivElement;
    private cursorCoordinates: HTMLDivElement;
    private actionIndicator: HTMLDivElement;
    private cursorStyle: string;
    private currentMode: string;
    private unitInfo: HTMLDivElement | null;
    private cursorStyleElement: HTMLStyleElement;
    private scrapCounter: HTMLDivElement;

    constructor() {
        // Initialize all properties in constructor
        this.container = document.createElement('div');
        this.container.className = 'game-ui';
        this.controlBar = document.createElement('div');
        this.statusBar = document.createElement('div');
        this.modeIndicator = document.createElement('div');
        this.hotkeyDisplay = document.createElement('div');
        this.selectedUnitsInfo = document.createElement('div');
        this.cursorCoordinates = document.createElement('div');
        this.actionIndicator = document.createElement('div');
        this.cursorStyle = 'default';
        this.currentMode = 'CAMERA';
        this.unitInfo = null;
        this.cursorStyleElement = document.createElement('style');
        this.scrapCounter = document.createElement('div');
        document.head.appendChild(this.cursorStyleElement);

        // Set up UI elements
        this.setupUI();
    }

    private setupUI(): void {
        this.container = document.createElement('div');
        this.container.className = 'game-ui';
        
        // Create unit info panel
        this.unitInfo = document.createElement('div');
        this.unitInfo.className = 'unit-info';
        this.container.appendChild(this.unitInfo);

        // Create styles
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .game-ui {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
            }
            .game-ui * {
                pointer-events: auto;
            }
            .selection-box {
                position: absolute;
                border: 2px solid #00ff00;
                background-color: rgba(0, 255, 0, 0.1);
                pointer-events: none;
            }
            .unit-info {
                position: absolute;
                bottom: 20px;
                left: 20px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
            }
            .action-indicator {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                font-family: Arial, sans-serif;
                font-size: 16px;
                display: none;
            }
        `;
        document.head.appendChild(styleElement);

        // Create all UI elements
        this.createStatusBar();
        this.createControlBar();
        this.createHotkeyDisplay();
        this.createCursorCoordinates();
        this.createCursorStyles();

        // Add action indicator
        this.actionIndicator = document.createElement('div');
        this.actionIndicator.className = 'action-indicator';
        this.container.appendChild(this.actionIndicator);

        // Add scrap counter
        this.scrapCounter = document.createElement('div');
        this.scrapCounter.className = 'scrap-counter';
        this.container.appendChild(this.scrapCounter);

        document.body.appendChild(this.container);
    }

    private createStatusBar(): void {
        this.statusBar = document.createElement('div');
        this.statusBar.style.position = 'fixed';
        this.statusBar.style.top = '10px';
        this.statusBar.style.left = '10px';
        this.statusBar.style.right = '10px';
        this.statusBar.style.height = '30px';
        this.statusBar.style.display = 'flex';
        this.statusBar.style.justifyContent = 'space-between';
        this.statusBar.style.alignItems = 'center';
        this.statusBar.style.padding = '0 20px';
        this.statusBar.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.statusBar.style.color = 'white';
        this.statusBar.style.fontFamily = 'Arial, sans-serif';
        this.statusBar.style.fontSize = '14px';
        this.statusBar.style.borderRadius = '5px';
        this.statusBar.style.zIndex = '1001';

        // Mode indicator
        this.modeIndicator = document.createElement('div');
        this.modeIndicator.textContent = 'Mode: Unit Control';
        this.statusBar.appendChild(this.modeIndicator);

        // Selected units info
        this.selectedUnitsInfo = document.createElement('div');
        this.selectedUnitsInfo.textContent = 'Selected: 0 units';
        this.statusBar.appendChild(this.selectedUnitsInfo);

        // Settings button
        const settingsButton = this.createButton('⚙️ Settings', 'settings');
        settingsButton.style.marginLeft = '20px';
        this.statusBar.appendChild(settingsButton);

        this.container.appendChild(this.statusBar);
    }

    private createControlBar(): void {
        this.controlBar = document.createElement('div');
        this.controlBar.style.position = 'fixed';
        this.controlBar.style.bottom = '10px';
        this.controlBar.style.left = '50%';
        this.controlBar.style.transform = 'translateX(-50%)';
        this.controlBar.style.display = 'flex';
        this.controlBar.style.gap = '10px';
        this.controlBar.style.padding = '10px';
        this.controlBar.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.controlBar.style.borderRadius = '5px';
        this.controlBar.style.zIndex = '1001';

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
            const button = this.createButton(text, action);
            this.controlBar.appendChild(button);
        });

        this.container.appendChild(this.controlBar);
    }

    private createButton(text: string, action: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.padding = '8px 16px';
        button.style.backgroundColor = '#444';
        button.style.color = 'white';
        button.style.border = '1px solid #666';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.dataset.action = action;

        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#555';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#444';
        });
        button.addEventListener('mousedown', () => {
            button.style.backgroundColor = '#333';
        });
        button.addEventListener('mouseup', () => {
            button.style.backgroundColor = '#555';
        });

        // Add click handler
        button.addEventListener('click', () => {
            const event = new CustomEvent('gameAction', {
                detail: { action: action }
            });
            document.dispatchEvent(event);
        });

        return button;
    }

    private createHotkeyDisplay(): void {
        this.hotkeyDisplay = document.createElement('div');
        this.hotkeyDisplay.style.position = 'fixed';
        this.hotkeyDisplay.style.top = '10px';
        this.hotkeyDisplay.style.right = '10px';
        this.hotkeyDisplay.style.padding = '10px';
        this.hotkeyDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.hotkeyDisplay.style.color = 'white';
        this.hotkeyDisplay.style.fontFamily = 'monospace';
        this.hotkeyDisplay.style.fontSize = '12px';
        this.hotkeyDisplay.style.borderRadius = '5px';
        this.hotkeyDisplay.style.display = 'none';

        const hotkeyList = [
            'Space - Toggle Camera/Unit Mode',
            'Ctrl + 1-9 - Set Control Group',
            '1-9 - Select Control Group',
            'A - Attack Mode',
            'S - Stop',
            'H - Hold Position',
            'P - Patrol',
            'Esc - Cancel Action'
        ];

        hotkeyList.forEach(hotkey => {
            const div = document.createElement('div');
            div.textContent = hotkey;
            this.hotkeyDisplay.appendChild(div);
        });

        this.container.appendChild(this.hotkeyDisplay);
    }

    private createCursorCoordinates(): void {
        this.cursorCoordinates = document.createElement('div');
        this.cursorCoordinates.style.position = 'fixed';
        this.cursorCoordinates.style.bottom = '50px'; // Moved up to avoid overlap with control bar
        this.cursorCoordinates.style.right = '10px';
        this.cursorCoordinates.style.padding = '5px 10px';
        this.cursorCoordinates.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.cursorCoordinates.style.color = 'white';
        this.cursorCoordinates.style.fontFamily = 'monospace';
        this.cursorCoordinates.style.fontSize = '12px';
        this.cursorCoordinates.style.borderRadius = '3px';
        this.cursorCoordinates.style.zIndex = '1001';

        this.container.appendChild(this.cursorCoordinates);
    }

    private createCursorStyles(): void {
        this.cursorStyleElement = document.createElement('style');
        document.head.appendChild(this.cursorStyleElement);
        this.updateCursorStyle('default');
    }

    public updateModeIndicator(): void {
        this.modeIndicator.textContent = `Mode: ${this.currentMode}`;
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
        if (this.cursorStyleElement) {
            this.cursorStyleElement.textContent = `
                body { 
                    cursor: ${cursorType} !important;
                }
            `;
        }
    }

    public updateSelectedUnitsInfo(selectedUnits: { type: UnitType; count: number; health?: number; maxHealth?: number }[]): void {
        if (selectedUnits.length === 0) {
            this.selectedUnitsInfo.textContent = 'No units selected';
            return;
        }

        let info = 'Selected Units:\n';
        selectedUnits.forEach(unit => {
            info += `${unit.type}: ${unit.count}\n`;
        });

        // Add health info for single unit selection
        if (selectedUnits.length === 1) {
            const unit = selectedUnits[0];
            if (unit.health !== undefined && unit.maxHealth !== undefined) {
                const healthPercent = (unit.health / unit.maxHealth) * 100;
                info += `\nHealth: ${healthPercent.toFixed(1)}%`;
            }
        }

        this.selectedUnitsInfo.textContent = info;
    }

    public updateCursorPosition(x: number, y: number, z: number): void {
        this.cursorCoordinates.textContent = 
            `X: ${x.toFixed(1)} Y: ${y.toFixed(1)} Z: ${z.toFixed(1)}`;
    }

    public toggleHotkeyDisplay(): void {
        this.hotkeyDisplay.style.display = 
            this.hotkeyDisplay.style.display === 'none' ? 'block' : 'none';
    }

    public dispose(): void {
        document.body.removeChild(this.container);
    }

    public updateUnitInfo(info: string): void {
        if (this.unitInfo) {
            this.unitInfo.textContent = info;
        }
    }

    public updateCursorCoordinates(coordinates: THREE.Vector3): void {
        this.cursorCoordinates.textContent = `X: ${coordinates.x.toFixed(1)} Y: ${coordinates.y.toFixed(1)} Z: ${coordinates.z.toFixed(1)}`;
    }

    public updateScrapCounter(scrap: number): void {
        this.scrapCounter.textContent = `Scrap: ${scrap}`;
    }
} 