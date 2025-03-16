import { GameInterface } from '../interfaces/GameInterface';

export enum ControlMode {
    CAMERA,
    UNIT_CONTROL
}

export class InputManager {
    private game: GameInterface;
    private mode: ControlMode = ControlMode.UNIT_CONTROL;
    private controlGroups: Map<number, Set<number>> = new Map(); // Key: group number, Value: Set of unit IDs
    private currentAction: string | null = null;
    private keyState: Map<string, boolean> = new Map();

    constructor(game: GameInterface) {
        this.game = game;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (event.repeat) return;
        
        console.log('Key pressed:', event.code); // Debug log
        
        this.keyState.set(event.code, true);
        
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
            case 'KeyA':
                this.setAction('attack');
                event.preventDefault();
                break;
            case 'KeyS':
                this.game.stopSelectedUnits();
                event.preventDefault();
                break;
            case 'KeyH':
                this.game.holdSelectedUnits();
                event.preventDefault();
                break;
            case 'KeyP':
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
    }

    private handleKeyUp(event: KeyboardEvent): void {
        this.keyState.set(event.code, false);
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

    public getMode(): ControlMode {
        return this.mode;
    }

    public isKeyPressed(code: string): boolean {
        return this.keyState.get(code) || false;
    }
} 