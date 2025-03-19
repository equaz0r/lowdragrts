import * as THREE from 'three';

export class DayNightCycle {
    private sun: THREE.DirectionalLight;
    private moon: THREE.DirectionalLight;
    private skybox: THREE.Mesh;
    private ambientLight: THREE.AmbientLight;
    private hemisphereLight: THREE.HemisphereLight;
    private currentTime: number = 0;
    private timeScale: number = 600; // 10 minutes per day cycle

    constructor(scene: THREE.Scene) {
        // Create sun light with reduced intensity
        this.sun = new THREE.DirectionalLight(0xffffff, 0.5);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.bias = -0.0001;
        scene.add(this.sun);

        // Create moon light with very low intensity
        this.moon = new THREE.DirectionalLight(0x4040ff, 0.1);
        this.moon.castShadow = true;
        this.moon.shadow.mapSize.width = 2048;
        this.moon.shadow.mapSize.height = 2048;
        this.moon.shadow.camera.near = 0.5;
        this.moon.shadow.camera.far = 500;
        this.moon.shadow.bias = -0.0001;
        scene.add(this.moon);

        // Create ambient light with reduced intensity
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        scene.add(this.ambientLight);

        // Create hemisphere light with reduced intensity
        this.hemisphereLight = new THREE.HemisphereLight(0x404040, 0x202020, 0.2);
        scene.add(this.hemisphereLight);

        // Create skybox
        const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
        const skyboxMaterials = [
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }), // Darker blue for better contrast
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
            new THREE.MeshBasicMaterial({ color: 0x0a0a1a }),
        ];
        this.skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
        scene.add(this.skybox);

        // Set initial sun position
        this.updateSunPosition(0);
    }

    public updateSunPosition(time: number): void {
        this.currentTime = time;
        
        // Calculate sun position
        const sunAngle = time * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle) * 50;
        const sunDistance = Math.cos(sunAngle) * 50;
        
        // Update sun position and intensity
        this.sun.position.set(sunDistance, sunHeight, 0);
        this.sun.intensity = Math.max(0.1, Math.sin(sunAngle) * 0.5);
        
        // Update moon position and intensity (opposite to sun)
        this.moon.position.set(-sunDistance, -sunHeight, 0);
        this.moon.intensity = Math.max(0.05, -Math.sin(sunAngle) * 0.1);
        
        // Update ambient light intensity based on time
        this.ambientLight.intensity = 0.3 + Math.sin(sunAngle) * 0.2;
        
        // Update hemisphere light intensity
        this.hemisphereLight.intensity = 0.2 + Math.sin(sunAngle) * 0.1;
        
        // Update skybox color based on time
        const skyColor = new THREE.Color(0x0a0a1a);
        const nightColor = new THREE.Color(0x000000);
        const dayColor = new THREE.Color(0x1a1a2a);
        
        const t = (Math.sin(sunAngle) + 1) / 2;
        skyColor.lerpColors(nightColor, dayColor, t);
        
        this.skybox.material = new THREE.MeshBasicMaterial({ color: skyColor });
    }

    public getCurrentTime(): number {
        return this.currentTime;
    }

    public setTime(time: number): void {
        this.updateSunPosition(time);
    }
} 