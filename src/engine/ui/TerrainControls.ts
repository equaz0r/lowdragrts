import { TerrainGenerator, TerrainPresets, TerrainConfig } from '../terrain/TerrainGenerator';
import { makeDraggable, DragHandle } from './Draggable';

/** Decimal places to show for a slider's step size. A flat toFixed(2) truncated
 *  tiny-magnitude sliders (baseFrequency etc., step ~0.0001) to a useless "0.00" —
 *  this scales precision to the step instead, so those still read as real numbers. */
function displayDecimals(step: number): number {
    if (step < 0.001) return 6;
    if (step < 1) return 2;
    return 0;
}

export class TerrainControls {
    private container: HTMLDivElement;
    private terrainGenerator: TerrainGenerator;
    private onNewTerrain: (() => void) | undefined;
    private regenerating: boolean = false;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private btn!: HTMLButtonElement;
    private statusEl!: HTMLDivElement;
    private regenCount: number = 0;
    private dragHandle: DragHandle | null = null;

    constructor(terrainGenerator: TerrainGenerator, onNewTerrain?: () => void) {
        this.terrainGenerator = terrainGenerator;
        this.onNewTerrain = onNewTerrain;

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

        this.renderAll();
        document.body.appendChild(this.container);
    }

    // Full rebuild — used at construction and after applying a preset, so slider
    // positions/displays reflect whatever just changed the underlying config.
    private renderAll(): void {
        // Rebuild destroys the old title element the drag handle was bound
        // to — destroy() first, then rebind to the fresh one below, or
        // dragging silently stops working after the first preset/import click.
        this.dragHandle?.destroy();
        this.container.innerHTML = '';

        const title = document.createElement('div');
        title.textContent = 'Terrain Shape';
        title.style.fontSize = '11px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
        title.style.paddingBottom = '2px';
        this.container.appendChild(title);

        this.createControls();
        this.dragHandle = makeDraggable(this.container, title, 'terrain-shape');
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

        const decimals = displayDecimals(step);
        const display = document.createElement('span');
        display.textContent = value.toFixed(decimals);
        display.style.minWidth = '35px';
        display.style.fontSize = '10px';

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            display.textContent = v.toFixed(decimals);
            onChange(v);
            // Auto-apply after slider settles — same terrain topology, new parameters
            this.scheduleRegenerate();
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

    // Debounced regenerate with same noise seed — for slider changes
    private scheduleRegenerate(): void {
        if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.triggerRegenerate(false);
        }, 400);
    }

    // Immediate regenerate — newSeed=true for button (new terrain), false for slider auto-apply
    private triggerRegenerate(newSeed: boolean): void {
        if (this.regenerating) return;
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.regenerating = true;
        this.btn.textContent = 'Generating…';
        this.btn.style.backgroundColor = 'rgba(60, 80, 140, 0.7)';
        this.btn.style.cursor = 'default';

        requestAnimationFrame(() => requestAnimationFrame(async () => {
            try {
                await this.terrainGenerator.regenerate(newSeed);
                this.regenCount++;
                this.statusEl.textContent = `Generated #${this.regenCount}${newSeed ? ' (new seed)' : ' (same seed)'}`;
                if (newSeed && this.onNewTerrain) {
                    this.onNewTerrain();
                }
            } catch (e) {
                console.error('[TerrainControls] regenerate() threw:', e);
                this.statusEl.textContent = 'Error — check console';
            } finally {
                this.regenerating = false;
                this.btn.textContent = 'Regenerate';
                this.btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)';
                this.btn.style.cursor = 'pointer';
            }
        }));
    }

    private createSectionLabel(text: string): void {
        const el = document.createElement('div');
        el.style.fontSize = '10px';
        el.style.fontWeight = 'bold';
        el.style.opacity = '0.8';
        el.style.marginBottom = '3px';
        el.textContent = text;
        this.container.appendChild(el);
    }

    // Preset buttons apply a full known-good config (overwriting whatever the
    // sliders currently hold), refresh the panel to match, then regenerate with
    // a new seed — same "new map" semantics as the Regenerate button.
    private createPresetButtons(): void {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '4px';
        row.style.marginBottom = '3px';

        const labels: Record<keyof typeof TerrainPresets, string> = {
            PRESET_DRAMATIC: 'Dramatic',
            PRESET_ROLLING: 'Rolling',
            PRESET_BATTLEFIELD: 'Battlefield',
        };

        (Object.keys(TerrainPresets) as Array<keyof typeof TerrainPresets>).forEach((key) => {
            const btn = document.createElement('button');
            btn.textContent = labels[key];
            btn.style.flex = '1';
            btn.style.padding = '3px 0';
            btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = 'white';
            btn.style.border = '1px solid rgba(255, 255, 255, 0.25)';
            btn.style.borderRadius = '3px';
            btn.style.fontFamily = 'monospace';
            btn.style.fontSize = '10px';
            btn.style.cursor = 'pointer';

            btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'; });
            btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; });

            btn.addEventListener('click', () => {
                Object.assign(this.terrainGenerator.config, TerrainPresets[key]);
                this.renderAll(); // slider positions reflect the preset immediately
                this.triggerRegenerate(true); // new seed — a preset is a new map
            });

            row.appendChild(btn);
        });

        this.container.appendChild(row);
    }

    private createControls(): void {
        const cfg = this.terrainGenerator.config;

        this.createSectionLabel('Shape');
        this.createSlider('Height Scale', 200, 3000, cfg.heightScale, 50, (v) => {
            this.terrainGenerator.config.heightScale = v;
        }, 'Overall terrain amplitude');

        this.createSlider('Persistence', 0.2, 0.8, cfg.persistence, 0.01, (v) => {
            this.terrainGenerator.config.persistence = v;
        }, 'Fractal gain — lower = smoother, higher = rougher/more detail');

        this.createSlider('Base/Peak Blend', 0.0, 1.0, cfg.basePeakBlend, 0.01, (v) => {
            this.terrainGenerator.config.basePeakBlend = v;
        }, '1.0 = all rolling hills, 0.0 = all ridged peaks');

        this.createSeparator();
        this.createSectionLabel('Noise Frequency');
        this.createSlider('Base Scale', 0.0001, 0.002, cfg.baseFrequency, 0.0001, (v) => {
            this.terrainGenerator.config.baseFrequency = v;
        }, 'Scale of rolling hills — lower = larger features');

        this.createSlider('Peak Scale', 0.0002, 0.003, cfg.peakFrequency, 0.0001, (v) => {
            this.terrainGenerator.config.peakFrequency = v;
        }, 'Scale of mountain ridges');

        this.createSeparator();
        this.createSectionLabel('Domain Warp');
        this.createSlider('Warp Strength', 0, 800, cfg.warpAmplitude, 10, (v) => {
            this.terrainGenerator.config.warpAmplitude = v;
        }, 'How much coordinates are twisted before sampling (0 = off)');

        this.createSlider('Warp Scale', 0.00005, 0.0006, cfg.warpFrequency, 0.00005, (v) => {
            this.terrainGenerator.config.warpFrequency = v;
        }, 'Scale of the warp pattern — lower = larger twists');

        this.createSeparator();
        this.createSectionLabel('Peak Shape');
        this.createSlider('Peak Threshold', 0.1, 0.75, cfg.peakThreshold, 0.01, (v) => {
            this.terrainGenerator.config.peakThreshold = v;
        }, 'Higher = fewer, more isolated peaks; lower = ridges cover more area');

        this.createSlider('Base Detail', 2, 8, cfg.baseOctaves, 1, (v) => {
            this.terrainGenerator.config.baseOctaves = Math.round(v);
        }, 'Octaves for rolling hills — more = finer surface detail');

        this.createSlider('Peak Detail', 2, 8, cfg.peakOctaves, 1, (v) => {
            this.terrainGenerator.config.peakOctaves = Math.round(v);
        }, 'Octaves for mountain ridges');

        this.createSeparator();
        this.createSectionLabel('Regions (flatland / mountain)');

        const regionToggleRow = document.createElement('div');
        regionToggleRow.style.display = 'flex';
        regionToggleRow.style.alignItems = 'center';
        regionToggleRow.style.gap = '6px';
        regionToggleRow.style.marginBottom = '3px';
        regionToggleRow.style.fontSize = '11px';
        const regionCheckbox = document.createElement('input');
        regionCheckbox.type = 'checkbox';
        regionCheckbox.checked = cfg.regionMaskEnabled;
        regionCheckbox.style.accentColor = '#666';
        regionCheckbox.addEventListener('change', () => {
            this.terrainGenerator.config.regionMaskEnabled = regionCheckbox.checked;
            this.scheduleRegenerate();
        });
        const regionToggleLabel = document.createElement('label');
        regionToggleLabel.textContent = 'Enabled';
        regionToggleRow.appendChild(regionCheckbox);
        regionToggleRow.appendChild(regionToggleLabel);
        this.container.appendChild(regionToggleRow);

        this.createSlider('Zone Size', 0.00001, 0.0001, cfg.regionMaskFrequency, 0.000005, (v) => {
            this.terrainGenerator.config.regionMaskFrequency = v;
        }, 'Lower = fewer, bigger flatland/mountain zones');

        this.createSlider('Flat Variation', 0, 0.6, cfg.regionFlatAmplitude, 0.02, (v) => {
            this.terrainGenerator.config.regionFlatAmplitude = v;
        }, '0 = dead flat, higher = more minor bumpiness in flatland zones');

        this.createSlider('Mountain Amplitude', 0.5, 1.5, cfg.regionMountainAmplitude, 0.05, (v) => {
            this.terrainGenerator.config.regionMountainAmplitude = v;
        }, 'Height multiplier inside mountain zones — above 1.0 exaggerates them');

        this.createSeparator();
        this.createSectionLabel('Valley');

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
            this.scheduleRegenerate();
        });
        const toggleLabel = document.createElement('label');
        toggleLabel.textContent = 'Enabled';
        toggleRow.appendChild(checkbox);
        toggleRow.appendChild(toggleLabel);
        this.container.appendChild(toggleRow);

        this.createSlider('Valley Width', 0.05, 0.5, cfg.valleyWidth, 0.01, (v) => {
            this.terrainGenerator.config.valleyWidth = v;
        }, 'Width of the valley as a fraction of map size');

        this.createSlider('Valley Depth', 0.0, 1.0, cfg.valleyDepth, 0.01, (v) => {
            this.terrainGenerator.config.valleyDepth = v;
        }, '0 = no effect, 1 = flat valley floor');

        // 0-360deg, full rotation — 90 (the new default) runs the corridor
        // east-west, aligned with the sun's fixed westward direction.
        this.createSlider('Valley Angle', 0, 360, cfg.valleyAngle, 1, (v) => {
            this.terrainGenerator.config.valleyAngle = v;
        }, 'Corridor orientation in degrees — 90 runs it east-west, aligned with the sun');

        this.createSeparator();
        this.createSectionLabel('Plateaus (build sites)');

        const plateauToggleRow = document.createElement('div');
        plateauToggleRow.style.display = 'flex';
        plateauToggleRow.style.alignItems = 'center';
        plateauToggleRow.style.gap = '6px';
        plateauToggleRow.style.marginBottom = '3px';
        plateauToggleRow.style.fontSize = '11px';
        const plateauCheckbox = document.createElement('input');
        plateauCheckbox.type = 'checkbox';
        plateauCheckbox.checked = cfg.plateauEnabled;
        plateauCheckbox.style.accentColor = '#666';
        plateauCheckbox.addEventListener('change', () => {
            this.terrainGenerator.config.plateauEnabled = plateauCheckbox.checked;
            this.scheduleRegenerate();
        });
        const plateauToggleLabel = document.createElement('label');
        plateauToggleLabel.textContent = 'Enabled';
        plateauToggleRow.appendChild(plateauCheckbox);
        plateauToggleRow.appendChild(plateauToggleLabel);
        this.container.appendChild(plateauToggleRow);

        this.createSlider('Count', 0, 8, cfg.plateauCount, 1, (v) => {
            this.terrainGenerator.config.plateauCount = Math.round(v);
        }, 'Number of flat build-sites to place');

        this.createSlider('Radius', 200, 1200, cfg.plateauRadius, 20, (v) => {
            this.terrainGenerator.config.plateauRadius = v;
        }, 'Size of each flat site, world units');

        this.createSlider('Edge Sharpness', 0.1, 0.95, cfg.plateauEdge, 0.01, (v) => {
            this.terrainGenerator.config.plateauEdge = v;
        }, 'Lower = soft gradual mound, higher = sharp mesa-like cliff edge');

        this.createSeparator();
        this.createSectionLabel('Presets');
        this.createPresetButtons();

        this.createSeparator();

        // Regenerate button — creates a new random terrain with current parameters
        this.btn = document.createElement('button');
        this.btn.textContent = 'Regenerate';
        this.btn.style.width = '100%';
        this.btn.style.padding = '4px 0';
        this.btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)';
        this.btn.style.color = 'white';
        this.btn.style.border = '1px solid rgba(120, 160, 255, 0.5)';
        this.btn.style.borderRadius = '3px';
        this.btn.style.fontFamily = 'monospace';
        this.btn.style.fontSize = '11px';
        this.btn.style.cursor = 'pointer';
        this.btn.style.letterSpacing = '0.05em';

        this.btn.addEventListener('mouseenter', () => {
            if (!this.regenerating) this.btn.style.backgroundColor = 'rgba(100, 140, 220, 0.9)';
        });
        this.btn.addEventListener('mouseleave', () => {
            if (!this.regenerating) this.btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)';
        });

        this.btn.addEventListener('click', () => {
            this.triggerRegenerate(true); // new random seed
        });

        this.container.appendChild(this.btn);

        // Status line — shows regen count so we can confirm it's firing
        this.statusEl = document.createElement('div');
        this.statusEl.style.marginTop = '4px';
        this.statusEl.style.fontSize = '10px';
        this.statusEl.style.opacity = '0.5';
        this.statusEl.textContent = 'Ready';
        this.container.appendChild(this.statusEl);
    }

    // ── Export / Import ─────────────────────────────────────────────────────
    // TerrainConfig is already plain numbers/booleans — JSON-safe as-is,
    // unlike EdgeSettings/ReflectionSettings which need a THREE.Color->hex step.

    public exportSettings(): TerrainConfig {
        return { ...this.terrainGenerator.config };
    }

    public importSettings(data: TerrainConfig): void {
        Object.assign(this.terrainGenerator.config, data);
        this.renderAll();
        // false = keep the current seed. Unlike Presets (deliberately a new map),
        // a settings load should reproduce the EXACT saved terrain — the caller
        // (SettingsIO) sets the saved seed via terrainGenerator.setSeed() before
        // calling this; regenerating with a fresh random seed here would
        // immediately discard that.
        this.triggerRegenerate(false);
    }

    /** Apply an exact shared terrain seed while retaining the current terrain sliders. */
    public regenerateWithSeed(seed: number): boolean {
        if (this.regenerating) return false;
        this.terrainGenerator.setSeed(seed);
        this.triggerRegenerate(false);
        return true;
    }

    public dispose(): void {
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.dragHandle?.destroy();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
