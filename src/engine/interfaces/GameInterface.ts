import { ControlMode } from '../controls/InputManager';

export interface GameInterface {
    updateControlMode(mode: ControlMode): void;
    getSelectedUnitIds(): number[];
    selectUnitsById(ids: number[]): void;
    setCurrentAction(action: string): void;
    cancelCurrentAction(): void;
    stopSelectedUnits(): void;
    holdSelectedUnits(): void;
    toggleHelp(): void;
} 