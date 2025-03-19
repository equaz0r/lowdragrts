import { DraggableUI } from './DraggableUI';

export class DebugUI {
    private container: HTMLElement;
    private timeSlider: HTMLInputElement;
    private timeDisplay: HTMLElement;
    private autoRotateCheckbox: HTMLInputElement;
    private regenerateButton: HTMLElement;
    private draggableUI: DraggableUI;

    constructor(
        onTimeChange: (time: number) => void,
        onAutoRotateChange: (enabled: boolean) => void,
        onRegenerate: () => void
    ) {
        // Create main container
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.right = '20px';
        this.container.style.top = '50%';
        this.container.style.transform = 'translateY(-50%)';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.container.style.color = '#00ff00';
        this.container.style.fontFamily = 'Consolas, monospace';
        this.container.style.fontSize = '12px';
        this.container.style.border = '1px solid #00ff00';
        this.container.style.borderRadius = '5px';
        this.container.style.zIndex = '1000';
        this.container.style.pointerEvents = 'auto';
        this.container.style.width = '300px';
        this.container.style.minHeight = '200px';
        this.container.style.maxHeight = '80vh';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.overflow = 'hidden';
        this.container.style.boxSizing = 'border-box';

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.padding = '10px';
        contentContainer.style.flex = '1';
        contentContainer.style.overflow = 'hidden';
        contentContainer.style.display = 'flex';
        contentContainer.style.flexDirection = 'column';
        contentContainer.style.gap = '10px';
        contentContainer.style.boxSizing = 'border-box';

        // Create time control section
        const timeSection = document.createElement('div');
        timeSection.style.marginBottom = '10px';
        timeSection.style.paddingBottom = '10px';
        timeSection.style.borderBottom = '1px solid #00ff00';
        timeSection.style.width = '100%';
        timeSection.style.boxSizing = 'border-box';

        // Time slider label
        const timeLabel = document.createElement('div');
        timeLabel.textContent = 'Time of Day';
        timeLabel.style.marginBottom = '5px';
        timeLabel.style.color = '#00ff00';
        timeLabel.style.width = '100%';
        timeLabel.style.boxSizing = 'border-box';
        timeSection.appendChild(timeLabel);

        // Time slider
        this.timeSlider = document.createElement('input');
        this.timeSlider.type = 'range';
        this.timeSlider.min = '0';
        this.timeSlider.max = '1';
        this.timeSlider.step = '0.01';
        this.timeSlider.value = '0.25';
        this.timeSlider.style.width = '100%';
        this.timeSlider.style.marginBottom = '5px';
        this.timeSlider.style.accentColor = '#00ff00';
        this.timeSlider.style.boxSizing = 'border-box';
        this.timeSlider.style.cursor = 'pointer';
        timeSection.appendChild(this.timeSlider);

        // Time display
        this.timeDisplay = document.createElement('div');
        this.timeDisplay.style.marginBottom = '5px';
        this.timeDisplay.style.width = '100%';
        this.timeDisplay.style.boxSizing = 'border-box';
        timeSection.appendChild(this.timeDisplay);

        // Auto-rotate checkbox
        const autoRotateLabel = document.createElement('label');
        autoRotateLabel.style.display = 'flex';
        autoRotateLabel.style.alignItems = 'center';
        autoRotateLabel.style.gap = '5px';
        autoRotateLabel.style.cursor = 'pointer';
        autoRotateLabel.style.width = '100%';
        autoRotateLabel.style.boxSizing = 'border-box';

        this.autoRotateCheckbox = document.createElement('input');
        this.autoRotateCheckbox.type = 'checkbox';
        this.autoRotateCheckbox.style.accentColor = '#00ff00';
        this.autoRotateCheckbox.style.cursor = 'pointer';
        autoRotateLabel.appendChild(this.autoRotateCheckbox);

        const autoRotateText = document.createElement('span');
        autoRotateText.textContent = 'Auto-rotate Camera';
        autoRotateText.style.whiteSpace = 'nowrap';
        autoRotateLabel.appendChild(autoRotateText);

        timeSection.appendChild(autoRotateLabel);
        contentContainer.appendChild(timeSection);

        // Regenerate button
        this.regenerateButton = document.createElement('button');
        this.regenerateButton.textContent = 'Regenerate World';
        this.regenerateButton.style.marginTop = '10px';
        this.regenerateButton.style.padding = '8px 16px';
        this.regenerateButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.regenerateButton.style.color = '#00ff00';
        this.regenerateButton.style.border = '1px solid #00ff00';
        this.regenerateButton.style.borderRadius = '4px';
        this.regenerateButton.style.cursor = 'pointer';
        this.regenerateButton.style.fontFamily = 'Consolas, monospace';
        this.regenerateButton.style.fontSize = '12px';
        this.regenerateButton.style.transition = 'all 0.3s ease';
        this.regenerateButton.style.width = '100%';
        this.regenerateButton.style.boxSizing = 'border-box';

        this.regenerateButton.addEventListener('mouseenter', () => {
            this.regenerateButton.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        });

        this.regenerateButton.addEventListener('mouseleave', () => {
            this.regenerateButton.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        });

        contentContainer.appendChild(this.regenerateButton);

        // Add content container to main container
        this.container.appendChild(contentContainer);

        // Make the panel draggable
        this.draggableUI = new DraggableUI(this.container, 'Day/Night Settings');

        // Event listeners
        this.timeSlider.addEventListener('input', () => {
            const time = parseFloat(this.timeSlider.value);
            this.updateTimeDisplay(time);
            onTimeChange(time);
        });

        this.autoRotateCheckbox.addEventListener('change', () => {
            onAutoRotateChange(this.autoRotateCheckbox.checked);
        });

        this.regenerateButton.addEventListener('click', onRegenerate);

        document.body.appendChild(this.container);
        this.updateTimeDisplay(0.25);
    }

    public updateTime(time: number): void {
        this.timeSlider.value = time.toString();
        this.updateTimeDisplay(time);
    }

    private updateTimeDisplay(time: number): void {
        const hours = Math.floor(time * 24);
        const minutes = Math.floor((time * 24 - hours) * 60);
        this.timeDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    public dispose(): void {
        document.body.removeChild(this.container);
    }
} 