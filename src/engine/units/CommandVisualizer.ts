import * as THREE from 'three';
import { Unit } from './Unit';

export enum CommandType {
    MOVE,
    ATTACK,
    STOP
}

export class CommandVisualizer {
    private scene: THREE.Scene;
    private moveArrows: Map<number, THREE.Object3D>;
    private targetMarkers: Map<number, THREE.Group> = new Map();
    private crosshairs: Map<number, THREE.Group> = new Map();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.moveArrows = new Map();
    }

    public showMoveCommand(unit: Unit, target: THREE.Vector3): void {
        const unitPos = unit.getPosition();
        const direction = target.clone().sub(unitPos).normalize();

        // Create arrow
        const arrow = new THREE.Group();
        
        // Arrow shaft
        const shaftGeometry = new THREE.BoxGeometry(0.2, 0.2, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7
        });
        const shaft = new THREE.Mesh(shaftGeometry, material);
        arrow.add(shaft);

        // Arrow head
        const headGeometry = new THREE.ConeGeometry(0.3, 0.5, 8);
        const head = new THREE.Mesh(headGeometry, material);
        head.position.z = 0.5;
        head.rotation.x = -Math.PI / 2;
        arrow.add(head);

        // Position and rotate arrow
        arrow.position.copy(unitPos);
        
        // Create a quaternion to rotate the arrow to face the target
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            direction
        );
        arrow.setRotationFromQuaternion(quaternion);

        // Add to scene and store reference
        this.scene.add(arrow);
        this.moveArrows.set(unit.getId(), arrow);

        // Remove after delay
        setTimeout(() => this.removeMoveCommand(unit.getId()), 2000);
    }

    public showAttackCommand(unitId: number, start: THREE.Vector3, end: THREE.Vector3): void {
        // Remove existing markers
        this.removeAttackMarkers(unitId);

        // Create attack marker at source
        const sourceMarker = this.createAttackMarker();
        this.targetMarkers.set(unitId, sourceMarker);
        this.scene.add(sourceMarker);
        sourceMarker.position.copy(start);

        // Create crosshair at target
        const crosshair = this.createCrosshair();
        this.crosshairs.set(unitId, crosshair);
        this.scene.add(crosshair);
        crosshair.position.copy(end);

        // Fade out after 2 seconds
        setTimeout(() => {
            this.fadeOutAttackMarkers(unitId);
        }, 2000);
    }

    private createAttackMarker(): THREE.Group {
        const group = new THREE.Group();

        // Create red glowing circle
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

        // Add pulsing effect
        const animate = () => {
            if (!ring.visible) return;
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
            ring.scale.set(scale, scale, scale);
            requestAnimationFrame(animate);
        };
        animate();

        return group;
    }

    private createCrosshair(): THREE.Group {
        const group = new THREE.Group();

        // Create crosshair lines
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

        // Add pulsing effect
        const animate = () => {
            if (!lines.visible) return;
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
            lines.scale.set(scale, scale, scale);
            requestAnimationFrame(animate);
        };
        animate();

        return group;
    }

    private removeMoveCommand(unitId: number): void {
        const arrow = this.moveArrows.get(unitId);
        if (arrow) {
            this.scene.remove(arrow);
            this.moveArrows.delete(unitId);
        }
    }

    private fadeOutAttackMarkers(unitId: number): void {
        const marker = this.targetMarkers.get(unitId);
        const crosshair = this.crosshairs.get(unitId);

        const fadeOut = () => {
            [marker, crosshair].forEach(obj => {
                if (obj) {
                    obj.children.forEach(child => {
                        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                            const material = child.material as THREE.Material;
                            if (material.opacity > 0.01) {
                                material.opacity *= 0.9;
                                requestAnimationFrame(fadeOut);
                            } else {
                                this.removeAttackMarkers(unitId);
                            }
                        }
                    });
                }
            });
        };

        fadeOut();
    }

    private removeAttackMarkers(unitId: number): void {
        [this.targetMarkers, this.crosshairs].forEach(markerMap => {
            const marker = markerMap.get(unitId);
            if (marker) {
                this.scene.remove(marker);
                marker.children.forEach(child => {
                    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                        child.geometry.dispose();
                        (child.material as THREE.Material).dispose();
                    }
                });
                markerMap.delete(unitId);
            }
        });
    }

    public dispose(): void {
        Array.from(this.moveArrows.keys()).forEach(id => this.removeMoveCommand(id));
        Array.from(this.targetMarkers.keys()).forEach(id => this.removeAttackMarkers(id));
    }
} 