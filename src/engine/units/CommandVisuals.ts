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
        const group = new THREE.Group();
        const geometry = new THREE.RingGeometry(1, 1.2, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        return group;
    }

    private createTargetCrosshair(): THREE.Group {
        const group = new THREE.Group();
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });

        const size = 1;
        const points = [
            new THREE.Vector3(-size, 0, 0),
            new THREE.Vector3(size, 0, 0),
            new THREE.Vector3(0, 0, -size),
            new THREE.Vector3(0, 0, size)
        ];

        lineGeometry.setFromPoints(points);
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        group.add(lines);
        return group;
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
        const mesh = this.moveArrow.children[0] as THREE.Mesh;
        if (mesh && mesh.material instanceof THREE.Material) {
            mesh.material.opacity = Math.max(0.2, 1 - (length / 50));
        }
    }

    // ... other methods
} 