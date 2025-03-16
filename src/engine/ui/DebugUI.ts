export class DebugUI {
    private container: HTMLDivElement;
    private timeSlider: HTMLInputElement;
    private timeDisplay: HTMLDivElement;
    private autoRotateCheckbox: HTMLInputElement;
    private regenerateButton: HTMLButtonElement;

    constructor(
        onTimeChange: (time: number) => void,
        onAutoRotateChange: (enabled: boolean) => void,
        onRegenerate: () => void
    ) {
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '10px';
        this.container.style.left = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';

        // Time slider
        const timeLabel = document.createElement('div');
        timeLabel.textContent = 'Time of Day:';
        this.container.appendChild(timeLabel);

        this.timeSlider = document.createElement('input');
        this.timeSlider.type = 'range';
        this.timeSlider.min = '0';
        this.timeSlider.max = '1';
        this.timeSlider.step = '0.001';
        this.timeSlider.value = '0.25';
        this.timeSlider.style.width = '200px';
        this.container.appendChild(this.timeSlider);

        this.timeDisplay = document.createElement('div');
        this.container.appendChild(this.timeDisplay);

        // Auto rotate checkbox
        const autoRotateLabel = document.createElement('label');
        this.autoRotateCheckbox = document.createElement('input');
        this.autoRotateCheckbox.type = 'checkbox';
        autoRotateLabel.appendChild(this.autoRotateCheckbox);
        autoRotateLabel.appendChild(document.createTextNode(' Auto Rotate'));
        this.container.appendChild(autoRotateLabel);

        // Regenerate button
        this.regenerateButton = document.createElement('button');
        this.regenerateButton.textContent = 'Regenerate World';
        this.regenerateButton.style.marginTop = '10px';
        this.regenerateButton.style.padding = '5px 10px';
        this.container.appendChild(this.regenerateButton);

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

    private updateTimeDisplay(time: number): void {
        const hours = Math.floor(time * 24);
        const minutes = Math.floor((time * 24 * 60) % 60);
        this.timeDisplay.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    public updateTime(time: number): void {
        this.timeSlider.value = time.toString();
        this.updateTimeDisplay(time);
    }

    public getCurrentTime(): number {
        return parseFloat(this.timeSlider.value);
    }
} 