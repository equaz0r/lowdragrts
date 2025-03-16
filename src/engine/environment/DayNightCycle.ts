import * as THREE from 'three';

export class DayNightCycle {
    private sun: THREE.DirectionalLight;
    private ambientLight: THREE.HemisphereLight;
    private gameTime: number = 0; // 0 to 1 (0 = midnight, 0.5 = noon)
    private dayDuration: number = 600; // 10 minutes per day cycle
    private autoRotate: boolean = false;

    constructor(scene: THREE.Scene) {
        // Create sun
        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.camera.left = -100;
        this.sun.shadow.camera.right = 100;
        this.sun.shadow.camera.top = 100;
        this.sun.shadow.camera.bottom = -100;
        scene.add(this.sun);

        // Add ambient light
        this.ambientLight = new THREE.HemisphereLight(
            0x87CEEB, // Sky color
            0x4B0082, // Ground color
            0.5       // Intensity
        );
        scene.add(this.ambientLight);

        // Add sun helper sphere
        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sun.add(sunSphere);

        this.updateSunPosition(0.25); // Start at sunrise
    }

    public updateSunPosition(time: number): void {
        this.gameTime = time;

        // Calculate sun position
        const angle = (time * Math.PI * 2) - Math.PI/2;
        const radius = 200;
        const height = Math.sin(angle) * radius;
        const horizontal = Math.cos(angle) * radius;

        this.sun.position.set(horizontal, height, 0);
        this.sun.lookAt(0, 0, 0);

        // Adjust light intensities based on time
        const dayIntensity = Math.sin(time * Math.PI * 2);
        const intensity = Math.max(0, dayIntensity);
        this.sun.intensity = intensity * 1.5;
        this.ambientLight.intensity = 0.2 + (intensity * 0.3);

        // Adjust sky color based on time
        const skyColor = new THREE.Color();
        if (dayIntensity > 0) {
            skyColor.setHSL(0.6, 0.8, 0.3 + (dayIntensity * 0.4)); // Blue sky
        } else {
            skyColor.setHSL(0.6, 0.8, 0.1); // Dark blue night
        }
        this.ambientLight.groundColor.setHSL(0.1, 0.8, 0.1 + (dayIntensity * 0.2));
    }

    public update(delta: number): void {
        if (this.autoRotate) {
            this.gameTime = (this.gameTime + (delta / this.dayDuration)) % 1;
            this.updateSunPosition(this.gameTime);
        }
    }

    public setAutoRotate(enabled: boolean): void {
        this.autoRotate = enabled;
    }

    public getTime(): number {
        return this.gameTime;
    }
} 