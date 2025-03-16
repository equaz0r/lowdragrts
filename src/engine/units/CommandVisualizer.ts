import * as THREE from 'three';

export enum CommandType {
    MOVE,
    ATTACK,
    STOP
}

export class CommandVisualizer {
    private scene: THREE.Scene;
    private moveArrows: Map<number, THREE.Group> = new Map(); // Unit ID to arrow mapping
    private targetMarkers: Map<number, THREE.Group> = new Map();
    private crosshairs: Map<number, THREE.Group> = new Map();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public showCommand(unitId: number, commandType: CommandType, start: THREE.Vector3, end: THREE.Vector3, speed: number = 1): void {
        switch (commandType) {
            case CommandType.MOVE:
                this.showMoveCommand(unitId, start, end, speed);
                break;
            case CommandType.ATTACK:
                this.showAttackCommand(unitId, start, end);
                break;
        }
    }

    private showMoveCommand(unitId: number, start: THREE.Vector3, end: THREE.Vector3, speed: number): void {
        // Remove existing arrow if present
        this.removeMoveArrow(unitId);

        const arrow = this.createMoveArrow(speed);
        this.moveArrows.set(unitId, arrow);
        this.scene.add(arrow);

        // Position and rotate arrow
        this.updateArrowTransform(arrow, start, end, speed);

        // Fade out arrow after 2 seconds
        setTimeout(() => this.fadeOutArrow(unitId), 2000);
    }

    private createMoveArrow(speed: number): THREE.Group {
        const group = new THREE.Group();

        // Create glowing arrow head
        const arrowHead = new THREE.ConeGeometry(0.3, 1, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const arrow = new THREE.Mesh(arrowHead, arrowMaterial);
        arrow.rotation.x = -Math.PI / 2;

        // Create arrow trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.5
        });

        const points = [
            new THREE.Vector3(0, 0, -2),
            new THREE.Vector3(0, 0, 0)
        ];
        trailGeometry.setFromPoints(points);
        const trail = new THREE.Line(trailGeometry, trailMaterial);

        // Add glow effect
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffff00) },
                viewVector: { value: new THREE.Vector3() }
            },
            vertexShader: `
                uniform vec3 viewVector;
                varying float intensity;
                void main() {
                    vec3 vNormal = normalize(normalMatrix * normal);
                    vec3 vNormalized = normalize(viewVector);
                    intensity = pow(1.0 - abs(dot(vNormal, vNormalized)), 2.0);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                varying float intensity;
                void main() {
                    gl_FragColor = vec4(color, 0.5 * intensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const glowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);

        group.add(arrow);
        group.add(trail);
        group.add(glow);

        return group;
    }

    private showAttackCommand(unitId: number, start: THREE.Vector3, end: THREE.Vector3): void {
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

        return group;
    }

    private updateArrowTransform(arrow: THREE.Group, start: THREE.Vector3, end: THREE.Vector3, speed: number): void {
        const direction = end.clone().sub(start);
        const length = direction.length();
        
        arrow.position.copy(start);
        arrow.lookAt(end);
        
        // Scale arrow based on speed
        arrow.scale.z = Math.min(length, speed * 2);
        
        // Update trail length
        const trail = arrow.children[1] as THREE.Line;
        const trailGeometry = trail.geometry as THREE.BufferGeometry;
        const points = [
            new THREE.Vector3(0, 0, -length),
            new THREE.Vector3(0, 0, 0)
        ];
        trailGeometry.setFromPoints(points);
    }

    private fadeOutArrow(unitId: number): void {
        const arrow = this.moveArrows.get(unitId);
        if (!arrow) return;

        const fadeOut = () => {
            arrow.children.forEach(child => {
                if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                    const material = child.material as THREE.Material;
                    if (material.opacity > 0.01) {
                        material.opacity *= 0.9;
                        requestAnimationFrame(fadeOut);
                    } else {
                        this.removeMoveArrow(unitId);
                    }
                }
            });
        };

        fadeOut();
    }

    private removeMoveArrow(unitId: number): void {
        const arrow = this.moveArrows.get(unitId);
        if (arrow) {
            this.scene.remove(arrow);
            arrow.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
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
        [...this.moveArrows.keys()].forEach(id => this.removeMoveArrow(id));
        [...this.targetMarkers.keys()].forEach(id => this.removeAttackMarkers(id));
    }
} 