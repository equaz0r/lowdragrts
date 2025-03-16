import * as THREE from 'three';

export class CommandVisuals {
    private moveArrow: THREE.Group;
    private attackMarker: THREE.Group;
    private targetCrosshair: THREE.Group;

    constructor() {
        this.moveArrow = this.createMoveArrow();
        this.attackMarker = this.createAttackMarker();
        this.targetCrosshair = this.createTargetCrosshair();
    }

    private createMoveArrow(): THREE.Group {
        const group = new THREE.Group();
        
        // Create glowing arrow
        const arrowGeometry = new THREE.ConeGeometry(0.5, 2, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7
        });
        
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;
        
        // Add trail
        const trailGeometry = new THREE.BoxGeometry(0.2, 0.2, 2);
        const trail = new THREE.Mesh(trailGeometry, arrowMaterial);
        trail.position.z = -1;
        
        group.add(arrow);
        group.add(trail);
        
        return group;
    }

    private createAttackMarker(): THREE.Group {
        // Similar to moveArrow but red
        // ... implementation ...
    }

    private createTargetCrosshair(): THREE.Group {
        // Create targeting crosshair
        // ... implementation ...
    }

    public updateMoveCommand(start: THREE.Vector3, end: THREE.Vector3, speed: number): void {
        const direction = end.clone().sub(start);
        const length = direction.length();
        
        // Scale arrow based on speed
        this.moveArrow.scale.z = speed;
        
        // Position and rotate
        this.moveArrow.position.copy(start);
        this.moveArrow.lookAt(end);
        
        // Fade out based on distance
        const material = (this.moveArrow.children[0].material as THREE.Material);
        material.opacity = Math.max(0.2, 1 - (length / 50));
    }

    // ... other methods
} 