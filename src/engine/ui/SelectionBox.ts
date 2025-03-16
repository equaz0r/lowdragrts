export class SelectionBox {
    private element: HTMLDivElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.style.position = 'fixed';
        this.element.style.border = '2px solid #00ff00';
        this.element.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
        this.element.style.pointerEvents = 'none'; // Prevent interfering with other events
        this.element.style.display = 'none';
        document.body.appendChild(this.element);
    }

    public update(startX: number, startY: number, currentX: number, currentY: number): void {
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        this.element.style.width = `${width}px`;
        this.element.style.height = `${height}px`;
        this.element.style.display = 'block';
    }

    public hide(): void {
        this.element.style.display = 'none';
    }

    public dispose(): void {
        document.body.removeChild(this.element);
    }
} 