export class HelpDialog {
    private dialog: HTMLDivElement;
    private isVisible: boolean = false;

    constructor() {
        this.dialog = this.createDialog();
        this.setupEventListeners();
    }

    private createDialog(): HTMLDivElement {
        this.dialog = document.createElement('div');
        this.dialog.style.position = 'fixed';
        this.dialog.style.top = '50%';
        this.dialog.style.left = '50%';
        this.dialog.style.transform = 'translate(-50%, -50%)';
        this.dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        this.dialog.style.color = 'white';
        this.dialog.style.padding = '20px';
        this.dialog.style.borderRadius = '5px';
        this.dialog.style.display = 'none';
        this.dialog.style.zIndex = '1000';

        const controls = [
            ['Space', 'Toggle between Camera and Unit Control modes'],
            ['Left Click + Drag', 'Select units (in Unit Control mode)'],
            ['Right Click', 'Move selected units / Attack target'],
            ['Ctrl + 1-9', 'Assign control group'],
            ['1-9', 'Select control group'],
            ['A', 'Toggle attack mode'],
            ['Esc', 'Cancel current action'],
            ['H', 'Toggle this help dialog']
        ];

        const table = document.createElement('table');
        controls.forEach(([key, description]) => {
            const row = table.insertRow();
            const keyCell = row.insertCell();
            const descCell = row.insertCell();
            
            keyCell.textContent = key;
            keyCell.style.padding = '5px 10px';
            keyCell.style.backgroundColor = '#333';
            
            descCell.textContent = description;
            descCell.style.padding = '5px 10px';
        });

        this.dialog.appendChild(table);
        document.body.appendChild(this.dialog);
        return this.dialog;
    }

    private setupEventListeners(): void {
        // Implementation of setupEventListeners method
    }

    public toggle(): void {
        this.dialog.style.display = 
            this.dialog.style.display === 'none' ? 'block' : 'none';
    }
} 