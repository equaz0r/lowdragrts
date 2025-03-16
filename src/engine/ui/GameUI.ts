import { ControlMode } from '../controls/InputManager';

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

    constructor() {
        // Initialize all properties in constructor
        this.container = document.createElement('div');
        this.controlBar = document.createElement('div');
        this.statusBar = document.createElement('div');
        this.modeIndicator = document.createElement('div');
        this.hotkeyDisplay = document.createElement('div');
        this.selectedUnitsInfo = document.createElement('div');
        this.cursorCoordinates = document.createElement('div');
        this.actionIndicator = document.createElement('div');
        this.cursorStyle = 'default';
        this.currentMode = 'CAMERA';

        this.setupUI();
    }

    private setupUI(): void {
        // Setup container
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        document.body.appendChild(this.container);

        // Setup mode indicator
        this.modeIndicator.style.position = 'absolute';
        this.modeIndicator.style.top = '10px';
        this.modeIndicator.style.left = '10px';
        this.modeIndicator.style.padding = '5px';
        this.modeIndicator.style.backgroundColor = 'rgba(0,0,0,0.7)';
        this.modeIndicator.style.color = 'white';
        this.container.appendChild(this.modeIndicator);
        
        this.updateModeIndicator();
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

        // Mode indicator
        this.modeIndicator = document.createElement('div');
        this.modeIndicator.textContent = 'Mode: Unit Control';
        this.statusBar.appendChild(this.modeIndicator);

        // Selected units info
        this.selectedUnitsInfo = document.createElement('div');
        this.selectedUnitsInfo.textContent = 'Selected: 0 units';
        this.statusBar.appendChild(this.selectedUnitsInfo);

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
        this.cursorCoordinates.style.bottom = '10px';
        this.cursorCoordinates.style.right = '10px';
        this.cursorCoordinates.style.padding = '5px 10px';
        this.cursorCoordinates.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.cursorCoordinates.style.color = 'white';
        this.cursorCoordinates.style.fontFamily = 'monospace';
        this.cursorCoordinates.style.fontSize = '12px';
        this.cursorCoordinates.style.borderRadius = '3px';

        this.container.appendChild(this.cursorCoordinates);
    }

    private createCursorStyles(): void {
        this.cursorStyle = document.createElement('style');
        document.head.appendChild(this.cursorStyle);
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
        this.cursorStyle.textContent = `
            body { 
                cursor: ${cursorType} !important;
            }
        `;
    }

    public updateSelectedUnits(count: number, types: Map<string, number>): void {
        let text = `Selected: ${count} unit${count !== 1 ? 's' : ''}`;
        if (count > 0) {
            const typeStrings: string[] = [];
            types.forEach((count, type) => {
                typeStrings.push(`${count} ${type}`);
            });
            text += ` (${typeStrings.join(', ')})`;
        }
        this.selectedUnitsInfo.textContent = text;
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
} 