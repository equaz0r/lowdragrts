import * as THREE from 'three';

export class MaterialManager {
    private static materials: Map<string, THREE.Material> = new Map();

    public static getMaterial(type: string): THREE.Material {
        if (!this.materials.has(type)) {
            this.materials.set(type, this.createMaterial(type));
        }
        return this.materials.get(type)!;
    }

    private static createMaterial(type: string): THREE.Material {
        switch (type) {
            case 'SKIRULUM_ORE':
                return new THREE.MeshPhysicalMaterial({
                    color: 0x4B0082,
                    metalness: 0.9,
                    roughness: 0.2,
                    emissive: 0x1B0032,
                    emissiveIntensity: 0.5
                });

            case 'FREDALITE_CRYSTAL':
                return new THREE.MeshPhysicalMaterial({
                    color: 0x00FF00,
                    metalness: 0.1,
                    roughness: 0.1,
                    transmission: 0.6,
                    transparent: true,
                    emissive: 0x00FF00,
                    emissiveIntensity: 0.8
                });

            case 'GRASS':
                return new THREE.MeshStandardMaterial({
                    color: 0x567d46,
                    roughness: 0.8,
                    metalness: 0.1
                });

            case 'DIRT':
                return new THREE.MeshStandardMaterial({
                    color: 0x8B4513,
                    roughness: 0.9,
                    metalness: 0.1
                });

            case 'STONE':
                return new THREE.MeshStandardMaterial({
                    color: 0x808080,
                    roughness: 0.7,
                    metalness: 0.2
                });

            default:
                return new THREE.MeshStandardMaterial({
                    color: 0xFFFFFF
                });
        }
    }

    public static dispose(): void {
        this.materials.forEach(material => material.dispose());
        this.materials.clear();
    }
} 