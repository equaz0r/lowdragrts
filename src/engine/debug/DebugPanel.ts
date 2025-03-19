import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { WorldManager } from '../world/WorldManager';
import { DraggableUI } from '../ui/DraggableUI';

export class DebugPanel {
    private container: HTMLElement;
    private stats: Stats;
    private camera: THREE.PerspectiveCamera;
    private worldManager: WorldManager;
    private draggableUI: DraggableUI;
    private chunkGenerationTimes: { [key: string]: number[] } = {};
    private readonly maxSamples = 10;

    constructor(camera: THREE.PerspectiveCamera, worldManager: WorldManager) {
        this.camera = camera;
        this.worldManager = worldManager;
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3: custom

        // Create container with draggable UI
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.left = '20px';
        this.container.style.top = '50%';
        this.container.style.transform = 'translateY(-50%)';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.container.style.color = '#00ff00';
        this.container.style.fontFamily = 'Consolas, monospace';
        this.container.style.fontSize = '12px';
        this.container.style.border = '1px solid #00ff00';
        this.container.style.borderRadius = '5px';
        this.container.style.zIndex = '1000';
        this.container.style.pointerEvents = 'auto';
        this.container.style.width = '300px';
        this.container.style.minHeight = '200px';
        this.container.style.maxHeight = '80vh';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.overflow = 'hidden';

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.style.padding = '10px';
        contentContainer.style.flex = '1';
        contentContainer.style.overflow = 'hidden';
        contentContainer.style.display = 'flex';
        contentContainer.style.flexDirection = 'column';
        contentContainer.style.gap = '10px';

        // Make the panel draggable
        this.draggableUI = new DraggableUI(this.container, 'Debug Panel');

        // Add stats to content container with margin
        this.stats.dom.style.marginTop = '10px';
        contentContainer.appendChild(this.stats.dom);

        // Add custom stats
        const customStats = document.createElement('div');
        customStats.style.paddingTop = '10px';
        customStats.style.borderTop = '1px solid #00ff00';
        contentContainer.appendChild(customStats);

        // Add world stats
        const worldStats = document.createElement('div');
        worldStats.style.paddingTop = '10px';
        worldStats.style.borderTop = '1px solid #00ff00';
        contentContainer.appendChild(worldStats);

        // Add camera stats
        const cameraStats = document.createElement('div');
        cameraStats.style.paddingTop = '10px';
        cameraStats.style.borderTop = '1px solid #00ff00';
        contentContainer.appendChild(cameraStats);

        // Add content container to main container
        this.container.appendChild(contentContainer);
        document.body.appendChild(this.container);
    }

    public update(deltaTime: number): void {
        this.stats.update();

        // Update custom stats
        const customStats = this.container.querySelector('div:nth-child(2)');
        if (customStats) {
            customStats.innerHTML = `
                <div style="color: #00ff00; margin-bottom: 5px;">Performance</div>
                <div>Render Time: ${(deltaTime * 1000).toFixed(2)}ms</div>
                <div>FPS: ${(1000 / deltaTime).toFixed(1)}</div>
                <div>Chunk Gen Time: ${this.getAverageChunkGenTime().toFixed(2)}ms</div>
            `;
        }

        // Update world stats
        const worldStats = this.container.querySelector('div:nth-child(3)');
        if (worldStats) {
            const totalChunks = this.worldManager.getTotalChunks();
            const worldSize = this.worldManager.getWorldSize();
            worldStats.innerHTML = `
                <div style="color: #00ff00; margin-bottom: 5px;">World</div>
                <div>Total Chunks: ${totalChunks}</div>
                <div>World Size: ${worldSize.width}x${worldSize.length}</div>
                <div>Active Chunks: ${this.worldManager.getActiveChunks()}</div>
                <div>Chunks in View: ${this.worldManager.getChunksInView()}</div>
            `;
        }

        // Update camera stats
        const cameraStats = this.container.querySelector('div:nth-child(4)');
        if (cameraStats) {
            const pos = this.camera.position;
            const rot = this.camera.rotation;
            const fov = this.camera.fov;
            cameraStats.innerHTML = `
                <div style="color: #00ff00; margin-bottom: 5px;">Camera</div>
                <div>Position: ${this.formatVector3(pos)}</div>
                <div>Rotation: ${this.formatVector3(rot)}</div>
                <div>FOV: ${fov.toFixed(1)}°</div>
                <div>Near: ${this.camera.near.toFixed(1)}</div>
                <div>Far: ${this.camera.far.toFixed(1)}</div>
            `;
        }
    }

    public addChunkGenerationTime(chunkKey: string, time: number): void {
        if (!this.chunkGenerationTimes[chunkKey]) {
            this.chunkGenerationTimes[chunkKey] = [];
        }
        this.chunkGenerationTimes[chunkKey].push(time);
        if (this.chunkGenerationTimes[chunkKey].length > this.maxSamples) {
            this.chunkGenerationTimes[chunkKey].shift();
        }
    }

    private formatVector3(v: THREE.Vector3 | THREE.Euler): string {
        return `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`;
    }

    private getAverageChunkGenTime(): number {
        let totalTime = 0;
        let count = 0;
        Object.values(this.chunkGenerationTimes).forEach(times => {
            times.forEach(time => {
                totalTime += time;
                count++;
            });
        });
        return count > 0 ? totalTime / count : 0;
    }

    public dispose(): void {
        document.body.removeChild(this.container);
    }
} 