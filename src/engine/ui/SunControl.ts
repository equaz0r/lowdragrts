import { LightingSystem } from '../terrain/LightingSystem';

export class SunControl {
    private container!: HTMLDivElement;
    private slider!: HTMLInputElement;
    private lightingSystem: LightingSystem;

    constructor(lightingSystem: LightingSystem) {
        this.lightingSystem = lightingSystem;
        this.createUI();
    }

    private createUI(): void {
        // Create container
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.right = '20px';
        this.container.style.top = '50%';
        this.container.style.transform = 'translateY(-50%)';
        this.container.style.background = 'rgba(0, 0, 0, 0.5)';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.zIndex = '1000';

        // Create label
        const label = document.createElement('div');
        label.textContent = 'Sun Height';
        label.style.color = 'white';
        label.style.marginBottom = '5px';
        label.style.textAlign = 'center';
        label.style.fontSize = '12px';
        this.container.appendChild(label);

        // Create slider wrapper for vertical orientation
        const sliderWrapper = document.createElement('div');
        sliderWrapper.style.cssText = `
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            height: 200px;
            display: flex;
            align-items: center;
            z-index: 1000;
        `;

        // Create slider with modern vertical styling
        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = '0';
        this.slider.max = '1';
        this.slider.step = '0.01';
        this.slider.value = '0.5';
        
        // Modern vertical slider styling
        this.slider.style.cssText = `
            writing-mode: vertical-lr;
            direction: rtl;
            width: 150px;
            height: 100%;
            margin: 0;
            padding: 0;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        `;

        // Add hover effect
        this.slider.addEventListener('mouseover', () => {
            this.slider.style.opacity = '1';
        });
        this.slider.addEventListener('mouseout', () => {
            this.slider.style.opacity = '0.7';
        });

        // Add input event listener for continuous updates
        this.slider.addEventListener('input', () => {
            const value = parseFloat(this.slider.value);
            this.lightingSystem.setManualSunHeight(value);
        });

        // Add slider to wrapper and wrapper to document
        sliderWrapper.appendChild(this.slider);
        this.container.appendChild(sliderWrapper);
        document.body.appendChild(this.container);
    }

    public dispose(): void {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
} 