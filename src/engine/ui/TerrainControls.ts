import { TerrainGenerator } from '../terrain/TerrainGenerator';

export class TerrainControls {
    private container: HTMLDivElement;
    private terrainGenerator: TerrainGenerator;
    private regenerating: boolean = false;

    constructor(terrainGenerator: TerrainGenerator) {
        this.terrainGenerator = terrainGenerator;

        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.left = '10px';
        this.container.style.top = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.padding = '4px';
        this.container.style.borderRadius = '3px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'monospace';
        this.container.style.fontSize = '11px';
        this.container.style.zIndex = '1000';
        this.container.style.minWidth = '180px';

        const title = document.createElement('div');
        title.textContent = 'Terrain Shape';
        title.style.fontSize = '11px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
        title.style.paddingBottom = '2px';
        this.container.appendChild(title);

        this.createControls();
        document.body.appendChild(this.container);
    }

    private createSlider(
        label: string,
        min: number,
        max: number,
        value: number,
        step: number,
        onChange: (value: number) => void,
        tooltip?: string
    ): void {
        const row = document.createElement('div');
        row.style.marginBottom = '3px';

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.alignItems = 'center';
        labelRow.style.marginBottom = '1px';
        labelRow.style.fontSize = '11px';

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        if (tooltip) {
            const icon = document.createElement('span');
            icon.textContent = ' ℹ';
            icon.style.marginLeft = '3px';
            icon.style.cursor = 'help';
            icon.style.opacity = '0.7';
            icon.title = tooltip;
            labelEl.appendChild(icon);
        }
        labelRow.appendChild(labelEl);
        row.appendChild(labelRow);

        const sliderRow = document.createElement('div');
        sliderRow.style.display = 'flex';
        sliderRow.style.alignItems = 'center';
        sliderRow.style.gap = '4px';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = value.toString();
        slider.style.width = '120px';
        slider.style.height = '15px';
        slider.style.accentColor = '#666';
        slider.style.opacity = '0.8';

        const display = document.createElement('span');
        display.textContent = value.toFixed(step < 1 ? 2 : 0);
        display.style.minWidth = '35px';
        display.style.fontSize = '10px';

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            display.textContent = v.toFixed(step < 1 ? 2 : 0);
            onChange(v);
        });

        sliderRow.appendChild(slider);
        sliderRow.appendChild(display);
        row.appendChild(sliderRow);
        this.container.appendChild(row);
    }

    private createSeparator(): void {
        const sep = document.createElement('div');
        sep.style.borderTop = '1px solid rgba(255, 255, 255, 0.2)';
        sep.style.margin = '6px 0';
        this.container.appendChild(sep);
    }

    private createControls(): void {
        const cfg = this.terrainGenerator.config;

        this.createSlider('Height Scale', 400, 3000, cfg.heightScale, 50, (v) => {
            this.terrainGenerator.config.heightScale = v;
        }, 'Overall terrain amplitude — taller mountains and deeper valleys');

        this.createSlider('Persistence', 0.3, 0.8, cfg.persistence, 0.01, (v) => {
            this.terrainGenerator.config.persistence = v;
        }, 'Lower = smoother slopes; higher = more jagged detail');

        this.createSlider('Base/Peak Blend', 0.1, 0.9, cfg.basePeakBlend, 0.01, (v) => {
            this.terrainGenerator.config.basePeakBlend = v;
        }, 'Higher = more rolling base terrain; lower = more mountain spikes');

        this.createSeparator();

        // Valley section label
        const valleyLabel = document.createElement('div');
        valleyLabel.style.fontSize = '10px';
        valleyLabel.style.fontWeight = 'bold';
        valleyLabel.style.opacity = '0.8';
        valleyLabel.style.marginBottom = '3px';
        valleyLabel.textContent = 'Valley';
        this.container.appendChild(valleyLabel);

        // Valley enabled toggle
        const toggleRow = document.createElement('div');
        toggleRow.style.display = 'flex';
        toggleRow.style.alignItems = 'center';
        toggleRow.style.gap = '6px';
        toggleRow.style.marginBottom = '3px';
        toggleRow.style.fontSize = '11px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = cfg.valleyEnabled;
        checkbox.style.accentColor = '#666';
        checkbox.addEventListener('change', () => {
            this.terrainGenerator.config.valleyEnabled = checkbox.checked;
        });
        const toggleLabel = document.createElement('label');
        toggleLabel.textContent = 'Enabled';
        toggleRow.appendChild(checkbox);
        toggleRow.appendChild(toggleLabel);
        this.container.appendChild(toggleRow);

        this.createSlider('Valley Width', 0.05, 0.5, cfg.valleyWidth, 0.01, (v) => {
            this.terrainGenerator.config.valleyWidth = v;
        }, 'Width of the valley corridor as a fraction of map size');

        this.createSlider('Valley Depth', 0.0, 1.0, cfg.valleyDepth, 0.01, (v) => {
            this.terrainGenerator.config.valleyDepth = v;
        }, 'How deeply the valley carves into the terrain (0 = none, 1 = flat floor)');

        this.createSeparator();

        // Regenerate button
        const btn = document.createElement('button');
        btn.textContent = 'Regenerate';
        btn.style.width = '100%';
        btn.style.padding = '4px 0';
        btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)';
        btn.style.color = 'white';
        btn.style.border = '1px solid rgba(120, 160, 255, 0.5)';
        btn.style.borderRadius = '3px';
        btn.style.fontFamily = 'monospace';
        btn.style.fontSize = '11px';
        btn.style.cursor = 'pointer';
        btn.style.letterSpacing = '0.05em';

        btn.addEventListener('mouseenter', () => {
            if (!this.regenerating) btn.style.backgroundColor = 'rgba(100, 140, 220, 0.9)';
        });
        btn.addEventListener('mouseleave', () => {
            if (!this.regenerating) btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)';
        });

        btn.addEventListener('click', () => {
            console.log('[TerrainControls] Regenerate clicked. regenerating=', this.regenerating);
            if (this.regenerating) { console.log('[TerrainControls] Already regenerating, skipping.'); return; }
            this.regenerating = true;
            btn.textContent = 'Generating…';
            btn.style.backgroundColor = 'rgba(60, 80, 140, 0.7)';
            btn.style.cursor = 'default';
            console.log('[TerrainControls] Scheduling regenerate via rAF...');

            requestAnimationFrame(() => requestAnimationFrame(async () => {
                console.log('[TerrainControls] rAF fired — calling terrainGenerator.regenerate()');
                console.log('[TerrainControls] terrainGenerator =', this.terrainGenerator);
                try {
                    await this.terrainGenerator.regenerate();
                    console.log('[TerrainControls] regenerate() completed successfully');
                } catch (e) {
                    console.error('[TerrainControls] regenerate() threw:', e);
                } finally {
                    this.regenerating = false;
                    btn.textContent = 'Regenerate';
                    btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)';
                    btn.style.cursor = 'pointer';
                }
            }));
        });

        this.container.appendChild(btn);
    }

    public dispose(): void {
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
