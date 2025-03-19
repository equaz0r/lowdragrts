import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { LightingSystem } from '../terrain/LightingSystem';

export class DebugUI {
    private container: HTMLDivElement;
    private terrainGenerator: TerrainGenerator;
    private lightingSystem: LightingSystem;
    private seedInput: HTMLInputElement = document.createElement('input');
    private timeSlider: HTMLInputElement = document.createElement('input');
    private randomSeedButton: HTMLButtonElement = document.createElement('button');

    constructor(terrainGenerator: TerrainGenerator, lightingSystem: LightingSystem) {
        this.terrainGenerator = terrainGenerator;
        this.lightingSystem = lightingSystem;
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '10px';
        this.container.style.left = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.container.style.padding = '10px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'monospace';
        this.container.style.zIndex = '1000';
        
        this.initialize();
    }

    private initialize(): void {
        // Create seed control
        const seedContainer = document.createElement('div');
        seedContainer.style.marginBottom = '10px';
        
        const seedLabel = document.createElement('label');
        seedLabel.textContent = 'Seed: ';
        
        this.seedInput.type = 'number';
        this.seedInput.value = this.terrainGenerator.getSeed().toString();
        this.seedInput.style.width = '100px';
        this.seedInput.style.marginRight = '5px';
        
        this.randomSeedButton.textContent = 'Random';
        this.randomSeedButton.style.marginLeft = '5px';
        
        seedContainer.appendChild(seedLabel);
        seedContainer.appendChild(this.seedInput);
        seedContainer.appendChild(this.randomSeedButton);
        
        // Create time control
        const timeContainer = document.createElement('div');
        timeContainer.style.marginBottom = '10px';
        
        const timeLabel = document.createElement('label');
        timeLabel.textContent = 'Time: ';
        
        this.timeSlider.type = 'range';
        this.timeSlider.min = '0';
        this.timeSlider.max = this.lightingSystem.getDayLength().toString();
        this.timeSlider.value = '0';
        this.timeSlider.style.width = '200px';
        
        timeContainer.appendChild(timeLabel);
        timeContainer.appendChild(this.timeSlider);
        
        // Add event listeners
        this.seedInput.addEventListener('change', () => {
            const seed = parseInt(this.seedInput.value);
            if (!isNaN(seed)) {
                this.terrainGenerator.setSeed(seed);
            }
        });
        
        this.randomSeedButton.addEventListener('click', () => {
            const randomSeed = Math.floor(Math.random() * 1000000);
            this.seedInput.value = randomSeed.toString();
            this.terrainGenerator.setSeed(randomSeed);
        });
        
        this.timeSlider.addEventListener('input', () => {
            const time = parseFloat(this.timeSlider.value);
            this.lightingSystem.setTime(time);
        });
        
        // Add elements to container
        this.container.appendChild(seedContainer);
        this.container.appendChild(timeContainer);
        
        // Add container to document
        document.body.appendChild(this.container);
    }

    public update(): void {
        // Update time slider to match current time
        this.timeSlider.value = this.lightingSystem.getTime().toString();
    }

    public dispose(): void {
        document.body.removeChild(this.container);
    }
} 