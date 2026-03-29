import { Color } from 'three';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { EdgeParameters } from '../config/GameParameters';

/**
 * Debug panel for live-editing the edge colour layers and pulse animation.
 * All changes update shader uniforms directly — no terrain regen needed.
 */
export class EdgeControls {
    private container: HTMLDivElement;
    private terrainGenerator: TerrainGenerator;

    constructor(terrainGenerator: TerrainGenerator) {
        this.terrainGenerator = terrainGenerator;

        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position:        'absolute',
            left:            '260px',
            top:             '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding:         '6px',
            borderRadius:    '3px',
            color:           'white',
            fontFamily:      'monospace',
            fontSize:        '11px',
            zIndex:          '1000',
            minWidth:        '230px',
        });

        const title = document.createElement('div');
        title.textContent = 'Grid Appearance';
        Object.assign(title.style, {
            fontWeight:   'bold',
            marginBottom: '4px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '2px',
        });
        this.container.appendChild(title);

        this.buildLayerSection();
        this.buildPulseSection();

        document.body.appendChild(this.container);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private sectionLabel(text: string): void {
        const el = document.createElement('div');
        el.textContent = text;
        Object.assign(el.style, {
            fontSize:     '10px',
            fontWeight:   'bold',
            opacity:      '0.7',
            marginBottom: '3px',
            marginTop:    '5px',
        });
        this.container.appendChild(el);
    }

    private sep(): void {
        const el = document.createElement('div');
        el.style.borderTop = '1px solid rgba(255,255,255,0.15)';
        el.style.margin = '5px 0';
        this.container.appendChild(el);
    }

    private makeSlider(
        label: string,
        min: number, max: number, step: number, value: number,
        fmt: (v: number) => string,
        onChange: (v: number) => void,
        tooltip?: string,
    ): void {
        const row = document.createElement('div');
        row.style.marginBottom = '2px';

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.fontSize = '10px';
        const lbl = document.createElement('span');
        lbl.textContent = label;
        if (tooltip) {
            const i = document.createElement('span');
            i.textContent = ' ℹ';
            i.style.opacity = '0.5';
            i.style.cursor = 'help';
            i.title = tooltip;
            lbl.appendChild(i);
        }
        labelRow.appendChild(lbl);
        row.appendChild(labelRow);

        const sliderRow = document.createElement('div');
        sliderRow.style.display = 'flex';
        sliderRow.style.alignItems = 'center';
        sliderRow.style.gap = '4px';

        const slider = document.createElement('input');
        slider.type = 'range';
        Object.assign(slider, { min: String(min), max: String(max), step: String(step), value: String(value) });
        slider.style.width = '120px';
        slider.style.accentColor = '#666';

        const val = document.createElement('span');
        val.textContent = fmt(value);
        val.style.minWidth = '34px';
        val.style.fontSize = '10px';

        slider.addEventListener('input', () => {
            const v = parseFloat(slider.value);
            val.textContent = fmt(v);
            onChange(v);
        });

        sliderRow.appendChild(slider);
        sliderRow.appendChild(val);
        row.appendChild(sliderRow);
        this.container.appendChild(row);
    }

    private getUniforms() {
        return this.terrainGenerator.getEdgeUniforms();
    }

    // ── Layer section ─────────────────────────────────────────────────────────

    private buildLayerSection(): void {
        this.sectionLabel('Colour Layers  (low → high)');

        EdgeParameters.layers.forEach((layer, idx) => {
            const layerRow = document.createElement('div');
            layerRow.style.marginBottom = '5px';
            layerRow.style.paddingLeft = '2px';
            layerRow.style.borderLeft = '2px solid rgba(255,255,255,0.1)';

            // Layer label
            const lbl = document.createElement('div');
            lbl.textContent = `Layer ${idx + 1}`;
            lbl.style.fontSize = '10px';
            lbl.style.opacity = '0.6';
            layerRow.appendChild(lbl);

            // Color picker row
            const colorRow = document.createElement('div');
            colorRow.style.display = 'flex';
            colorRow.style.alignItems = 'center';
            colorRow.style.gap = '6px';
            colorRow.style.marginBottom = '2px';

            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.value = '#' + layer.color.getHexString();
            colorPicker.style.width = '32px';
            colorPicker.style.height = '18px';
            colorPicker.style.padding = '0';
            colorPicker.style.border = 'none';
            colorPicker.style.cursor = 'pointer';

            colorPicker.addEventListener('input', () => {
                layer.color.set(colorPicker.value);
                const u = this.getUniforms();
                if (u) {
                    (u.layerColors.value as Color[])[idx].copy(layer.color);
                }
            });

            const colorLbl = document.createElement('span');
            colorLbl.textContent = 'Colour';
            colorLbl.style.fontSize = '10px';

            colorRow.appendChild(colorPicker);
            colorRow.appendChild(colorLbl);
            layerRow.appendChild(colorRow);

            this.container.appendChild(layerRow);

            // Height slider
            this.makeSlider(
                'Height %', 0, 100, 1, Math.round(layer.heightFraction * 100),
                v => v.toFixed(0) + '%',
                v => {
                    layer.heightFraction = v / 100;
                    const u = this.getUniforms();
                    if (u) (u.layerHeights.value as Float32Array)[idx] = layer.heightFraction;
                },
                'Normalised terrain height where this layer begins',
            );

            // Intensity slider
            this.makeSlider(
                'Intensity', 0, 4, 0.05, layer.intensity,
                v => v.toFixed(2),
                v => {
                    layer.intensity = v;
                    const u = this.getUniforms();
                    if (u) (u.layerIntensities.value as Float32Array)[idx] = v;
                },
                '0 = black/off · 1 = normal · 3+ = neon glow',
            );
        });
    }

    // ── Pulse section ─────────────────────────────────────────────────────────

    private buildPulseSection(): void {
        this.sep();
        this.sectionLabel('Electric Pulse');

        this.makeSlider(
            'Speed', 0, 1, 0.01, EdgeParameters.pulseSpeed,
            v => v.toFixed(2),
            v => {
                EdgeParameters.pulseSpeed = v;
                const u = this.getUniforms();
                if (u) u.pulseSpeed.value = v;
            },
            'How fast pulses travel up the terrain',
        );

        this.makeSlider(
            'Intensity', 0, 12, 0.1, EdgeParameters.pulseIntensity,
            v => v.toFixed(1),
            v => {
                EdgeParameters.pulseIntensity = v;
                const u = this.getUniforms();
                if (u) u.pulseIntensity.value = v;
            },
            'Brightness of the pulse — high values create neon glow',
        );

        this.makeSlider(
            'Width', 0.01, 0.4, 0.005, EdgeParameters.pulseWidth,
            v => v.toFixed(3),
            v => {
                EdgeParameters.pulseWidth = v;
                const u = this.getUniforms();
                if (u) u.pulseWidth.value = v;
            },
            'Fraction of terrain height covered by one pulse tail',
        );
    }

    public dispose(): void {
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
