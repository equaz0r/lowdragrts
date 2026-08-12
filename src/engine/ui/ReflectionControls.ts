import { Vector4 } from 'three';
import { ReflectionParameters } from '../config/LightingConfig';
import { LightingParameters } from '../config/LightingConfig';
import { LightingSystem } from '../terrain/LightingSystem';
import { makeDraggable, DragHandle } from './Draggable';

/** JSON-safe snapshot of this panel's tunables — see SettingsIO.ts. */
export interface ReflectionSettings {
    metalness: number;
    roughness: number;
    positionFactor: number;
    reflectionPower: number;
    sunIntensity: number;
    sunHeight: number;
    glitterReach: number;
    /** Multiplier on the auto sun-height-driven width curve (round 17, 12 Aug
     *  2026) — NOT an absolute world-unit width any more. 1.0 = the curve as
     *  designed; see GLITTER_WIDTH_AUTO_MIN/MAX/CURVE_POWER in
     *  TerrainMaterial.ts. Field name kept as glitterWidth for settings-file
     *  backward compatibility, meaning changed. */
    glitterWidth: number;
}

export class ReflectionControls {
    private container: HTMLDivElement;
    private onUpdate: (params: Vector4) => void;
    private onGlitterUpdate: (reach: number, width: number) => void;
    private onDebugGlitterToggle: (show: boolean) => void;
    private currentParams: Vector4;
    // Reach default matches GLITTER_ALONG_FAR's initial uniform value in
    // TerrainMaterial.ts. Width is now a MULTIPLIER (1.0 = the auto sun-
    // height-driven curve as designed) — see ReflectionSettings above.
    private currentGlitterReach = 2500;
    private currentGlitterWidth = 1.0;
    private lightingSystem: LightingSystem;
    private dragHandle: DragHandle | null = null;

    constructor(
        onUpdate: (params: Vector4) => void,
        lightingSystem: LightingSystem,
        onGlitterUpdate: (reach: number, width: number) => void = () => {},
        onDebugGlitterToggle: (show: boolean) => void = () => {},
    ) {
        this.onUpdate = onUpdate;
        this.onGlitterUpdate = onGlitterUpdate;
        this.onDebugGlitterToggle = onDebugGlitterToggle;
        this.lightingSystem = lightingSystem;
        this.currentParams = ReflectionParameters.REFLECTION_PARAMS.clone();

        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.right = '10px';
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

    // Full rebuild — used at construction and after importSettings().
    private renderAll(): void {
        this.dragHandle?.destroy(); // old title (drag handle) is about to be destroyed below
        this.container.innerHTML = '';

        const title = document.createElement('div');
        title.textContent = 'Terrain Controls';
        title.style.fontSize = '11px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
        title.style.paddingBottom = '2px';
        this.container.appendChild(title);
        this.dragHandle = makeDraggable(this.container, title, 'reflection-controls');

        this.createControls();
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
        const container = document.createElement('div');
        container.style.marginBottom = '3px';

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'center';
        labelContainer.style.marginBottom = '1px';
        labelContainer.style.fontSize = '11px';

        const labelElement = document.createElement('div');
        labelElement.textContent = label;

        if (tooltip) {
            const tooltipIcon = document.createElement('span');
            tooltipIcon.textContent = ' ℹ';
            tooltipIcon.style.marginLeft = '3px';
            tooltipIcon.style.cursor = 'help';
            tooltipIcon.style.opacity = '0.7';
            tooltipIcon.title = tooltip;
            labelElement.appendChild(tooltipIcon);
        }

        labelContainer.appendChild(labelElement);
        container.appendChild(labelContainer);

        const sliderContainer = document.createElement('div');
        sliderContainer.style.display = 'flex';
        sliderContainer.style.alignItems = 'center';
        sliderContainer.style.gap = '4px';

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

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = value.toFixed(2);
        valueDisplay.style.minWidth = '35px';
        valueDisplay.style.fontSize = '10px';

        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueDisplay.textContent = newValue.toFixed(2);
            onChange(newValue);
        });

        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        container.appendChild(sliderContainer);
        this.container.appendChild(container);
    }

    private createControls(): void {
        // Metalness control
        this.createSlider('Metalness', 0, 1, this.currentParams.x, 0.01, (value) => {
            this.currentParams.x = value;
            this.onUpdate(this.currentParams);
        }, 'Controls how metallic the surface appears');

        // Roughness control
        this.createSlider('Roughness', 0, 1, this.currentParams.y, 0.01, (value) => {
            this.currentParams.y = value;
            this.onUpdate(this.currentParams);
        }, 'Controls how rough or smooth the surface appears');

        // Position factor control — min is 0.1, not 0: this value is smoothstep's
        // edge1 in TerrainMaterial.ts and edge0==edge1 is undefined GLSL behaviour
        // (produced a NaN/white blowout bug at exactly 0). Shader has its own floor
        // too, but keeping the slider clear of it is the simpler guarantee.
        this.createSlider('Position Factor', 0.1, 5, this.currentParams.z, 0.1, (value) => {
            this.currentParams.z = value;
            this.onUpdate(this.currentParams);
        }, 'Controls how reflection strength varies with terrain position');

        // Reflection power control
        this.createSlider('Reflection Power', 0, 2, this.currentParams.w, 0.1, (value) => {
            this.currentParams.w = value;
            this.onUpdate(this.currentParams);
        }, 'Controls the overall intensity of reflections');

        // Sun intensity control
        this.createSlider('Sun Intensity', 0.3, 2, LightingParameters.SUN_BASE_INTENSITY, 0.05, (value) => {
            if (this.lightingSystem) {
                this.lightingSystem.setSunIntensity(value);
            }
        }, 'Controls the brightness of the sun and its halo effect');

        // Add separator
        const separator = document.createElement('div');
        separator.style.borderTop = '1px solid rgba(255, 255, 255, 0.3)';
        separator.style.margin = '15px 0';
        this.container.appendChild(separator);

        // Sun height control — initial value reads the configured TARGET (was
        // hardcoded 0.5 regardless of reality). Deliberately getTargetSunHeight(),
        // not getSunHeight(): the latter is the smoothed, still-animating value —
        // reading it here, before any frames have run, would just show the OLD
        // height and fight the intentional ease-in animation.
        this.createSlider('Sun Height',
            Number(LightingParameters.SUN_MIN_HEIGHT),
            Number(LightingParameters.SUN_MAX_HEIGHT),
            this.lightingSystem.getTargetSunHeight(),
            0.01,
            (value) => {
                if (this.lightingSystem) {
                    this.lightingSystem.setSunHeight(value);
                }
            },
            'Controls the height of the sun in the sky'
        );

        // Add separator
        const glitterSeparator = document.createElement('div');
        glitterSeparator.style.borderTop = '1px solid rgba(255, 255, 255, 0.3)';
        glitterSeparator.style.margin = '15px 0';
        this.container.appendChild(glitterSeparator);

        const glitterTitle = document.createElement('div');
        glitterTitle.textContent = 'Sun Glitter';
        glitterTitle.style.fontSize = '11px';
        glitterTitle.style.fontWeight = 'bold';
        glitterTitle.style.marginBottom = '4px';
        this.container.appendChild(glitterTitle);

        // Reach is a world-unit distance (TerrainMaterial.ts's
        // GLITTER_ALONG_FAR) — how far along the camera->sun ground axis the
        // glitter wedge takes to reach full width. Deliberately NOT a
        // normalized 0-1 slider: raw world units make it obvious how this
        // relates to the 8000-unit map. Range extended 6000->12000 (12 Aug
        // 2026, round 17) — Simon wanted to push past the old max, especially
        // for high-sun (small, distant-feeling) scenes.
        this.createSlider('Glitter Reach', 500, 12000, this.currentGlitterReach, 50, (value) => {
            this.currentGlitterReach = value;
            this.onGlitterUpdate(this.currentGlitterReach, this.currentGlitterWidth);
        }, 'World-unit distance for the sun glitter wedge to reach full width — smaller = fills the visible screen sooner');

        // Width is now a MULTIPLIER (round 17), not an absolute world-unit
        // size — the width itself auto-scales with the sun's apparent size
        // (see GLITTER_WIDTH_AUTO_MIN/MAX/CURVE_POWER in TerrainMaterial.ts).
        // 1.0 = that curve as designed; use this to nudge the whole curve up
        // or down without fighting the automatic sun-height linkage.
        this.createSlider('Glitter Width ×', 0.2, 3.0, this.currentGlitterWidth, 0.05, (value) => {
            this.currentGlitterWidth = value;
            this.onGlitterUpdate(this.currentGlitterReach, this.currentGlitterWidth);
        }, 'Multiplier on the glitter wedge\'s auto sun-height-driven width — 1.0 = the automatic curve as designed, higher/lower scales it');

        // Debug isolation toggle (11 Aug 2026, round 10) — after several
        // rounds where it was genuinely unclear whether the visible
        // "reflection" was sunGlitter, the ambient weighted-sum terms, or
        // Three's own built-in specular, this renders ONLY sunGlitter's raw
        // output as flat greyscale, with roughness/metalness forced fully
        // non-reflective so nothing else can contribute. Not part of
        // ReflectionSettings — deliberately not saved/exported, it's a
        // debugging aid, not a scene setting.
        this.createCheckbox('Debug: Glitter Only', false, (checked) => {
            this.onDebugGlitterToggle(checked);
        }, 'Shows ONLY calculateSunGlitter()\'s raw output as greyscale — nothing else (no ambient shine, no Three.js built-in specular) can contribute while this is on');
    }

    private createCheckbox(
        label: string,
        checked: boolean,
        onChange: (checked: boolean) => void,
        tooltip?: string
    ): void {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.marginBottom = '3px';
        container.style.fontSize = '11px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.style.marginRight = '4px';
        checkbox.addEventListener('change', () => onChange(checkbox.checked));
        container.appendChild(checkbox);

        const labelElement = document.createElement('span');
        labelElement.textContent = label;
        if (tooltip) {
            labelElement.title = tooltip;
            labelElement.style.cursor = 'help';
        }
        container.appendChild(labelElement);

        this.container.appendChild(container);
    }

    // ── Export / Import ─────────────────────────────────────────────────────

    public exportSettings(): ReflectionSettings {
        return {
            metalness: this.currentParams.x,
            roughness: this.currentParams.y,
            positionFactor: this.currentParams.z,
            reflectionPower: this.currentParams.w,
            sunIntensity: LightingParameters.SUN_BASE_INTENSITY,
            sunHeight: this.lightingSystem.getTargetSunHeight(),
            glitterReach: this.currentGlitterReach,
            glitterWidth: this.currentGlitterWidth,
        };
    }

    public importSettings(data: ReflectionSettings): void {
        this.currentParams.set(data.metalness, data.roughness, data.positionFactor, data.reflectionPower);
        this.onUpdate(this.currentParams);
        this.lightingSystem.setSunIntensity(data.sunIntensity);
        this.lightingSystem.setSunHeight(data.sunHeight);
        // Older exports won't have these two fields — fall back to the
        // current (already-sane) defaults rather than importing `undefined`.
        this.currentGlitterReach = data.glitterReach ?? this.currentGlitterReach;
        // glitterWidth's MEANING changed 12 Aug 2026 (round 17): was an
        // absolute world-unit width (200-3000), now a 0.2-3.0 multiplier.
        // An export from before that change would still have a value in the
        // old range (e.g. 1200), which as a multiplier would blow the width
        // curve out completely — clamp into the current slider's range so an
        // old save degrades to "very wide" rather than something broken.
        this.currentGlitterWidth = Math.min(3.0, Math.max(0.2, data.glitterWidth ?? this.currentGlitterWidth));
        this.onGlitterUpdate(this.currentGlitterReach, this.currentGlitterWidth);
        this.renderAll(); // refresh sliders to match
    }

    public dispose(): void {
        this.dragHandle?.destroy();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}