import * as THREE from 'three';

export class DraggableUI {
    private element: HTMLElement;
    private handle: HTMLElement = document.createElement('div');
    private isDragging: boolean = false;
    private currentX: number = 0;
    private currentY: number = 0;
    private initialX: number = 0;
    private initialY: number = 0;
    private xOffset: number = 0;
    private yOffset: number = 0;
    private handleHeight: number = 30; // Height of the handle bar
    private minDistanceFromEdge: number = 20; // Minimum distance from viewport edges

    constructor(element: HTMLElement, title: string = '') {
        this.element = element;
        this.setupDraggable();
        this.createHandle(title);
        
        // Store initial position
        const rect = this.element.getBoundingClientRect();
        this.xOffset = rect.left;
        this.yOffset = rect.top;
    }

    private setupDraggable(): void {
        // Make sure the element is positioned absolutely and can receive pointer events
        this.element.style.position = 'fixed';
        this.element.style.cursor = 'default';
        this.element.style.pointerEvents = 'auto';
        this.element.style.zIndex = '9999';
        this.element.style.userSelect = 'none';
        this.element.style.height = 'auto'; // Ensure height is auto
        this.element.style.maxHeight = 'none'; // Remove any max-height constraints
        this.element.style.display = 'flex'; // Use flexbox for layout
        this.element.style.flexDirection = 'column'; // Stack children vertically
        this.element.style.flexWrap = 'nowrap'; // Prevent wrapping
        this.element.style.width = 'auto'; // Allow width to adjust to content
        this.element.style.minWidth = 'fit-content'; // Ensure minimum width fits content
        this.element.style.maxWidth = '80%'; // Limit maximum width
        
        // Add a subtle transition for smoother movement
        this.element.style.transition = 'box-shadow 0.3s ease';
        
        // Add hover effect
        this.element.addEventListener('mouseenter', () => {
            this.element.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.3)';
        });
        
        this.element.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                this.element.style.boxShadow = 'none';
            }
        });

        // Prevent world interaction when interacting with UI
        this.element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    private createHandle(title: string): void {
        this.handle = document.createElement('div');
        this.handle.style.padding = '5px';
        this.handle.style.cursor = 'move';
        this.handle.style.userSelect = 'none';
        this.handle.style.display = 'flex';
        this.handle.style.alignItems = 'center';
        this.handle.style.gap = '5px';
        this.handle.style.color = '#00ff00';
        this.handle.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.handle.style.borderBottom = '1px solid #00ff00';
        this.handle.style.marginBottom = '5px';
        this.handle.style.pointerEvents = 'auto';
        this.handle.style.zIndex = '10000';
        this.handle.style.height = `${this.handleHeight}px`;
        this.handle.style.borderTopLeftRadius = '5px';
        this.handle.style.borderTopRightRadius = '5px';
        this.handle.style.position = 'relative'; // Ensure handle stays in position
        this.handle.style.width = '100%'; // Ensure handle spans full width
        this.handle.style.flex = '0 0 auto'; // Prevent handle from growing or shrinking

        // Create handle icon (⋮⋮)
        const icon = document.createElement('span');
        icon.innerHTML = '⋮⋮';
        icon.style.cursor = 'move';
        icon.style.fontSize = '16px';
        icon.style.fontWeight = 'bold';
        icon.style.padding = '0 5px';
        icon.style.pointerEvents = 'none'; // Prevent icon from interfering with drag
        icon.style.flex = '0 0 auto'; // Prevent icon from growing or shrinking
        this.handle.appendChild(icon);

        // Add title if provided
        if (title) {
            const titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            titleSpan.style.flex = '1';
            titleSpan.style.fontFamily = 'Consolas, monospace';
            titleSpan.style.fontSize = '12px';
            titleSpan.style.pointerEvents = 'none'; // Prevent title from interfering with drag
            this.handle.appendChild(titleSpan);
        }

        // Insert handle as first child
        this.element.insertBefore(this.handle, this.element.firstChild);

        // Prevent propagation of events to world
        this.handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dragStart(e);
        });

        // Use capture phase to ensure we get the events first
        document.addEventListener('mousemove', (e) => this.drag(e), true);
        document.addEventListener('mouseup', () => this.dragEnd(), true);
    }

    private dragStart(e: MouseEvent): void {
        this.initialX = e.clientX - this.xOffset;
        this.initialY = e.clientY - this.yOffset;

        if (e.target === this.handle || e.target === this.handle.firstChild) {
            this.isDragging = true;
            this.element.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.5)';
            this.element.style.transition = 'none'; // Disable transition during drag
            this.element.style.height = 'auto'; // Ensure height stays auto during drag
            this.element.style.display = 'flex'; // Maintain flex display during drag
            this.element.style.flexDirection = 'column'; // Keep vertical stacking
            this.element.style.flexWrap = 'nowrap'; // Prevent wrapping
            this.element.style.transform = 'none'; // Remove any transforms during drag
        }
    }

    private drag(e: MouseEvent): void {
        if (this.isDragging) {
            e.preventDefault();
            e.stopPropagation();

            // Calculate new position
            this.currentX = e.clientX - this.initialX;
            this.currentY = e.clientY - this.initialY;

            // Get element dimensions
            const rect = this.element.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate bounds
            const minX = this.minDistanceFromEdge;
            const minY = this.minDistanceFromEdge;
            const maxX = viewportWidth - rect.width - this.minDistanceFromEdge;
            const maxY = viewportHeight - rect.height - this.minDistanceFromEdge;

            // Clamp position to viewport bounds
            this.currentX = Math.min(Math.max(minX, this.currentX), maxX);
            this.currentY = Math.min(Math.max(minY, this.currentY), maxY);

            // Update position
            this.xOffset = this.currentX;
            this.yOffset = this.currentY;
            this.setTranslate(this.currentX, this.currentY);
        }
    }

    private dragEnd(): void {
        this.initialX = this.currentX;
        this.initialY = this.currentY;
        this.isDragging = false;
        
        // Re-enable transition
        this.element.style.transition = 'box-shadow 0.3s ease';
        
        if (!this.element.matches(':hover')) {
            this.element.style.boxShadow = 'none';
        }
    }

    private setTranslate(xPos: number, yPos: number): void {
        this.element.style.left = `${xPos}px`;
        this.element.style.top = `${yPos}px`;
    }
} 