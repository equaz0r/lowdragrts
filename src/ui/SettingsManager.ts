import * as THREE from 'three';

export interface GameSettings {
    projectileColor: string;
    trailColor: string;
    hitEffectColor: string;
    projectileSize: number;
    trailLength: number;
    hitEffectSize: number;
    glowIntensity: number;
    particleCount: number;
    projectileSpeed: number;
    projectileDamage: number;
}

interface SettingConfig {
    name: string;
    type: 'color' | 'range';
    key: keyof GameSettings;
    min?: number;
    max?: number;
    step?: number;
}

export class SettingsManager {
    private settingsPanel: HTMLDivElement;
    private settings: GameSettings;
    private onSettingsChange: (settings: GameSettings) => void;

    constructor(onSettingsChange: (settings: GameSettings) => void) {
        this.onSettingsChange = onSettingsChange;
        this.settings = this.getDefaultSettings();
        this.settingsPanel = this.createSettingsPanel();
        this.setupEventListeners();
    }

    private getDefaultSettings(): GameSettings {
        return {
            projectileColor: '#ff0000',
            trailColor: '#ff6600',
            hitEffectColor: '#ffcc00',
            projectileSize: 1,
            trailLength: 20,
            hitEffectSize: 1,
            glowIntensity: 0.5,
            particleCount: 20,
            projectileSpeed: 5,
            projectileDamage: 10
        };
    }

    private createSettingsPanel(): HTMLDivElement {
        const panel = document.createElement('div');
        panel.className = 'settings-panel';
        panel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            width: 300px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
            display: none;
            z-index: 1000;
        `;

        const settings: SettingConfig[] = [
            { name: 'Projectile Color', type: 'color', key: 'projectileColor' },
            { name: 'Trail Color', type: 'color', key: 'trailColor' },
            { name: 'Hit Effect Color', type: 'color', key: 'hitEffectColor' },
            { name: 'Projectile Size', type: 'range', key: 'projectileSize', min: 0.5, max: 2, step: 0.1 },
            { name: 'Trail Length', type: 'range', key: 'trailLength', min: 5, max: 50, step: 1 },
            { name: 'Hit Effect Size', type: 'range', key: 'hitEffectSize', min: 0.5, max: 2, step: 0.1 },
            { name: 'Glow Intensity', type: 'range', key: 'glowIntensity', min: 0, max: 1, step: 0.1 },
            { name: 'Particle Count', type: 'range', key: 'particleCount', min: 5, max: 50, step: 1 },
            { name: 'Projectile Speed', type: 'range', key: 'projectileSpeed', min: 1, max: 20, step: 1 },
            { name: 'Projectile Damage', type: 'range', key: 'projectileDamage', min: 1, max: 50, step: 1 }
        ];

        settings.forEach(setting => {
            const container = document.createElement('div');
            container.style.marginBottom = '15px';

            const label = document.createElement('label');
            label.textContent = setting.name;
            label.style.display = 'block';
            label.style.marginBottom = '5px';

            const input = document.createElement('input');
            input.type = setting.type;
            input.id = setting.key;
            input.value = this.settings[setting.key].toString();
            
            if (setting.type === 'range' && setting.min !== undefined && setting.max !== undefined && setting.step !== undefined) {
                input.min = setting.min.toString();
                input.max = setting.max.toString();
                input.step = setting.step.toString();
            }

            container.appendChild(label);
            container.appendChild(input);
            panel.appendChild(container);
        });

        return panel;
    }

    private setupEventListeners(): void {
        const inputs = this.settingsPanel.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                const key = input.id as keyof GameSettings;
                const value = input.type === 'range' ? 
                    parseFloat(input.value) : 
                    input.value;
                if (typeof value === 'number' && (key === 'projectileSize' || key === 'trailLength' || key === 'hitEffectSize' || key === 'glowIntensity' || key === 'particleCount' || key === 'projectileSpeed' || key === 'projectileDamage')) {
                    this.settings[key] = value;
                } else if (typeof value === 'string' && (key === 'projectileColor' || key === 'trailColor' || key === 'hitEffectColor')) {
                    this.settings[key] = value;
                }
                this.onSettingsChange(this.settings);
            });
        });
    }

    public toggleSettingsPanel(show: boolean): void {
        this.settingsPanel.style.display = show ? 'block' : 'none';
    }

    public getSettings(): GameSettings {
        return { ...this.settings };
    }

    public setSettings(settings: Partial<GameSettings>): void {
        this.settings = { ...this.settings, ...settings };
        this.updateUI();
    }

    private updateUI(): void {
        const inputs = this.settingsPanel.querySelectorAll('input');
        inputs.forEach(input => {
            const key = input.id as keyof GameSettings;
            input.value = this.settings[key].toString();
        });
    }

    public getElement(): HTMLDivElement {
        return this.settingsPanel;
    }
} 