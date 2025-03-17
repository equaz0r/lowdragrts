import * as THREE from 'three';
import { SettingsManager } from './SettingsManager';

export class SettingsButton {
    private button: HTMLButtonElement;
    private settingsManager: SettingsManager;
    private isOpen: boolean = false;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
        this.button = this.createButton();
        this.setupEventListeners();
    }

    private createButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'settings-button';
        button.innerHTML = '⚙️';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.5);
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 1000;
            transition: transform 0.2s;
        `;

        button.addEventListener('mouseover', () => {
            button.style.transform = 'rotate(90deg)';
        });

        button.addEventListener('mouseout', () => {
            button.style.transform = 'rotate(0deg)';
        });

        return button;
    }

    private setupEventListeners(): void {
        this.button.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            this.settingsManager.toggleSettingsPanel(this.isOpen);
        });
    }

    public getElement(): HTMLButtonElement {
        return this.button;
    }
} 