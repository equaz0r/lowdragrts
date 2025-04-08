import { Vector4 } from 'three';
import { ReflectionParameters, LightingParameters } from '../config/GameParameters';
import { LightingSystem } from '../terrain/LightingSystem';

export class ReflectionControls {
    private container: HTMLDivElement;
    private onUpdate: (params: Vector4) => void;
    private currentParams: Vector4;
    private lightingSystem: LightingSystem;

    constructor(onUpdate: (params: Vector4) => void, lightingSystem: LightingSystem) {
        this.onUpdate = onUpdate;
        this.lightingSystem = lightingSystem;
        this.currentParams = ReflectionParameters.REFLECTION_PARAMS.clone();

        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.right = '20px';
        this.container.style.top = '20px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.container.style.padding = '15px';
        this.container.style.borderRadius = '5px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial';
        this.container.style.zIndex = '1000';
        this.container.style.minWidth = '250px';

        // Add title
        const title = document.createElement('div');
        title.textContent = 'Terrain Controls';
        title.style.fontSize = '16px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '15px';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
        title.style.paddingBottom = '5px';
        this.container.appendChild(title);

        this.createControls();
        document.body.appendChild(this.container);
    }

    private createSlider(
        label: string,
        min: number,
        max: number,
        value: number,
        step: number,
        onChange: (value: number) => void,
        tooltip?: string
    ): void {
        const container = document.createElement('div');
        container.style.marginBottom = '10px';

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'center';
        labelContainer.style.marginBottom = '5px';

        const labelElement = document.createElement('div');
        labelElement.textContent = label;

        if (tooltip) {
            const tooltipIcon = document.createElement('span');
            tooltipIcon.textContent = ' ℹ';
            tooltipIcon.style.marginLeft = '5px';
            tooltipIcon.style.cursor = 'help';
            tooltipIcon.title = tooltip;
            labelElement.appendChild(tooltipIcon);
        }

        labelContainer.appendChild(labelElement);
        container.appendChild(labelContainer);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = value.toString();
        slider.style.width = '200px';

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = value.toFixed(2);
        valueDisplay.style.marginLeft = '10px';

        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueDisplay.textContent = newValue.toFixed(2);
            onChange(newValue);
        });

        container.appendChild(slider);
        container.appendChild(valueDisplay);
        this.container.appendChild(container);
    }

    private createControls(): void {
        // Metalness control
        this.createSlider('Metalness', 0, 1, this.currentParams.x, 0.01, (value) => {
            this.currentParams.x = value;
            this.onUpdate(this.currentParams);
        }, 'Controls how metallic the surface appears');

        // Roughness control
        this.createSlider('Roughness', 0, 1, this.currentParams.y, 0.01, (value) => {
            this.currentParams.y = value;
            this.onUpdate(this.currentParams);
        }, 'Controls how rough or smooth the surface appears');

        // Position factor control
        this.createSlider('Position Factor', 0, 5, this.currentParams.z, 0.1, (value) => {
            this.currentParams.z = value;
            this.onUpdate(this.currentParams);
        }, 'Controls how reflection strength varies with terrain position');

        // Reflection power control
        this.createSlider('Reflection Power', 0, 2, this.currentParams.w, 0.1, (value) => {
            this.currentParams.w = value;
            this.onUpdate(this.currentParams);
        }, 'Controls the overall intensity of reflections');

        // Sun intensity control
        this.createSlider('Sun Intensity', 0.3, 2, LightingParameters.SUN_BASE_INTENSITY, 0.05, (value) => {
            if (this.lightingSystem) {
                this.lightingSystem.setSunIntensity(value);
            }
        }, 'Controls the brightness of the sun and its halo effect');

        // Add separator
        const separator = document.createElement('div');
        separator.style.borderTop = '1px solid rgba(255, 255, 255, 0.3)';
        separator.style.margin = '15px 0';
        this.container.appendChild(separator);

        // Sun height control
        this.createSlider('Sun Height', 
            Number(LightingParameters.SUN_MIN_HEIGHT), 
            Number(LightingParameters.SUN_MAX_HEIGHT), 
            0.5, 
            0.01, 
            (value) => {
                if (this.lightingSystem) {
                    this.lightingSystem.setSunHeight(value);
                }
            },
            'Controls the height of the sun in the sky'
        );
    }

    public dispose(): void {
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
} 