import { GameInterface } from '../interfaces/GameInterface';

export enum ControlMode {
    UNIT_CONTROL = 'UNIT_CONTROL',
    CAMERA = 'CAMERA'
}

export class InputManager {
    private game: GameInterface;
    private mode: ControlMode = ControlMode.UNIT_CONTROL;
    private controlGroups: Map<number, Set<number>> = new Map(); // Key: group number, Value: Set of unit IDs
    private currentAction: string | null = null;
    private keyState: Map<string, boolean> = new Map();
    private keys: Set<string> = new Set();
    private cameraPanSpeed: number = 0.5; // Speed of camera panning

    constructor(game: GameInterface) {
        this.game = game;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    private onKeyDown(event: KeyboardEvent): void {
        if (event.repeat) return;
        
        console.log('Key pressed:', event.code); // Debug log
        
        this.keyState.set(event.code, true);
        this.keys.add(event.key.toLowerCase());
        
        // Handle control groups
        if (event.ctrlKey && event.code.startsWith('Digit')) {
            const groupNumber = parseInt(event.code.slice(-1));
            this.assignControlGroup(groupNumber);
            event.preventDefault();
            return;
        }

        if (event.code.startsWith('Digit')) {
            const groupNumber = parseInt(event.code.slice(-1));
            this.selectControlGroup(groupNumber);
            event.preventDefault();
            return;
        }

        // Handle other hotkeys
        switch (event.code) {
            case 'Space':
                this.toggleMode();
                event.preventDefault();
                break;
            case 'Digit1':
                this.setAction('attack');
                event.preventDefault();
                break;
            case 'Digit2':
                this.game.stopSelectedUnits();
                event.preventDefault();
                break;
            case 'Digit3':
                this.game.holdSelectedUnits();
                event.preventDefault();
                break;
            case 'Digit4':
                this.setAction('patrol');
                event.preventDefault();
                break;
            case 'Escape':
                this.cancelAction();
                event.preventDefault();
                break;
            case 'F1':
                this.game.toggleHelp();
                event.preventDefault();
                break;
        }

        this.handleInput();
    }

    private onKeyUp(event: KeyboardEvent): void {
        this.keyState.set(event.code, false);
        this.keys.delete(event.key.toLowerCase());
    }

    private toggleMode(): void {
        this.mode = this.mode === ControlMode.CAMERA ? 
            ControlMode.UNIT_CONTROL : ControlMode.CAMERA;
        this.game.updateControlMode(this.mode);
    }

    private assignControlGroup(groupNumber: number): void {
        const selectedUnits = this.game.getSelectedUnitIds();
        if (selectedUnits.length > 0) {
            this.controlGroups.set(groupNumber, new Set(selectedUnits));
        }
    }

    private selectControlGroup(groupNumber: number): void {
        const group = this.controlGroups.get(groupNumber);
        if (group) {
            this.game.selectUnitsById(Array.from(group));
        }
    }

    private setAction(action: string): void {
        this.currentAction = action;
        this.game.setCurrentAction(action);
    }

    private cancelAction(): void {
        this.currentAction = null;
        this.game.cancelCurrentAction();
    }

    private handleInput(): void {
        // Handle camera panning in both modes
        if (this.keys.has('w')) {
            this.game.panCamera('forward');
        }
        if (this.keys.has('s')) {
            this.game.panCamera('backward');
        }
        if (this.keys.has('a')) {
            this.game.panCamera('left');
        }
        if (this.keys.has('d')) {
            this.game.panCamera('right');
        }

        // Handle mode switching
        if (this.keys.has(' ')) {
            this.game.updateControlMode(
                this.game.getControlMode() === ControlMode.CAMERA 
                    ? ControlMode.UNIT_CONTROL 
                    : ControlMode.CAMERA
            );
        }
    }

    public update(): void {
        this.handleInput();
    }

    public getMode(): ControlMode {
        return this.mode;
    }

    public isKeyPressed(code: string): boolean {
        return this.keyState.get(code) || false;
    }
} 