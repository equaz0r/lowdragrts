import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { TerrainControls } from './TerrainControls';
import { EdgeControls } from './EdgeControls';
import { ReflectionControls } from './ReflectionControls';
import { makeDraggable, DragHandle, clearAllPanelPositions } from './Draggable';
import {
    CURRENT_SCENE_SETTINGS_VERSION,
    normalizeSceneSettings,
    SceneSettings,
} from '../config/SceneSettings';
import {
    decodeLightingCode,
    decodeSceneCode,
    encodeLightingCode,
    encodeSceneCode,
} from '../config/ShareCodes';

/**
 * Save/load the whole tunable scene (terrain shape + seed, grid colours/
 * pulse, reflection/sun) as one JSON blob. Export writes it into the textarea
 * (and best-effort to the clipboard); paste JSON back in + Import to restore.
 *
 * Doesn't own any state itself — just bundles/applies the exportSettings()/
 * importSettings() each sibling panel already exposes for its own slice.
 */
export class SettingsIO {
    private container: HTMLDivElement;
    private textarea: HTMLTextAreaElement;
    private status: HTMLDivElement;
    private terrainGenerator: TerrainGenerator;
    private terrainControls: TerrainControls;
    private edgeControls: EdgeControls;
    private reflectionControls: ReflectionControls;
    private dragHandle: DragHandle | null = null;
    private terrainSeedInput!: HTMLInputElement;
    private lightingCodeInput!: HTMLInputElement;
    private sceneCodeInput!: HTMLInputElement;
    private readonly regenerateListener = () => this.refreshShareValues();
    private readonly shareSettingsListener = () => this.refreshShareValues();

    constructor(
        terrainGenerator: TerrainGenerator,
        terrainControls: TerrainControls,
        edgeControls: EdgeControls,
        reflectionControls: ReflectionControls,
    ) {
        this.terrainGenerator = terrainGenerator;
        this.terrainControls = terrainControls;
        this.edgeControls = edgeControls;
        this.reflectionControls = reflectionControls;

        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position:        'absolute',
            right:           '10px',
            bottom:          '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding:         '6px',
            borderRadius:    '3px',
            color:           'white',
            fontFamily:      'monospace',
            fontSize:        '11px',
            zIndex:          '1000',
            width:           '260px',
        });

        const title = document.createElement('div');
        title.textContent = 'Share / Save Settings';
        Object.assign(title.style, {
            fontWeight:    'bold',
            marginBottom:  '4px',
            borderBottom:  '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '2px',
        });
        this.container.appendChild(title);

        this.createShareControls();

        const jsonLabel = document.createElement('div');
        jsonLabel.textContent = 'Readable JSON (full scene)';
        Object.assign(jsonLabel.style, {
            marginTop: '7px',
            marginBottom: '3px',
            paddingTop: '5px',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            fontSize: '10px',
            fontWeight: 'bold',
        });
        this.container.appendChild(jsonLabel);

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '4px';
        btnRow.style.marginBottom = '4px';
        btnRow.appendChild(this.makeButton('Export JSON', () => this.exportToTextarea()));
        btnRow.appendChild(this.makeButton('Import JSON', () => this.importFromTextarea()));
        this.container.appendChild(btnRow);

        this.textarea = document.createElement('textarea');
        Object.assign(this.textarea.style, {
            width:           '100%',
            height:          '90px',
            fontFamily:      'monospace',
            fontSize:        '9px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            color:           '#ddd',
            border:          '1px solid rgba(255,255,255,0.2)',
            borderRadius:    '3px',
            resize:          'vertical',
            boxSizing:       'border-box',
        });
        this.textarea.placeholder = 'Export writes JSON here — copy it out. Paste JSON here, then Import to load.';
        this.container.appendChild(this.textarea);

        this.status = document.createElement('div');
        Object.assign(this.status.style, {
            marginTop: '3px',
            fontSize:  '10px',
            opacity:   '0.6',
        });
        this.status.textContent = 'Ready';
        this.container.appendChild(this.status);

        const resetRow = document.createElement('div');
        resetRow.style.marginTop = '4px';
        const resetBtn = this.makeButton('Reset Panel Layout', () => {
            clearAllPanelPositions();
            window.location.reload();
        });
        // Muted styling — distinct from Export/Import, this is a "layout"
        // action not a "data" one, and it's a full reload, not instant.
        resetBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        resetBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        resetBtn.title = 'Clears saved panel positions and collapsed states, then reloads the page';
        resetRow.appendChild(resetBtn);
        this.container.appendChild(resetRow);
        this.dragHandle = makeDraggable(this.container, title, 'settings-io');

        this.terrainGenerator.addRegenerateListener(this.regenerateListener);
        this.edgeControls.addChangeListener(this.shareSettingsListener);
        this.reflectionControls.addChangeListener(this.shareSettingsListener);
        this.refreshShareValues();
        document.body.appendChild(this.container);
    }

    private makeButton(label: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = label;
        Object.assign(btn.style, {
            flex:            '1',
            padding:         '3px 0',
            backgroundColor: 'rgba(80, 120, 200, 0.7)',
            color:           'white',
            border:          '1px solid rgba(120, 160, 255, 0.5)',
            borderRadius:    '3px',
            fontFamily:      'monospace',
            fontSize:        '10px',
            cursor:          'pointer',
        });
        btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = 'rgba(100, 140, 220, 0.9)'; });
        btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = 'rgba(80, 120, 200, 0.7)'; });
        btn.addEventListener('click', onClick);
        return btn;
    }

    private createShareControls(): void {
        const note = document.createElement('div');
        note.textContent = 'Seed = terrain RNG only. Codes restore settings.';
        Object.assign(note.style, { fontSize: '9px', opacity: '0.65', marginBottom: '4px' });
        this.container.appendChild(note);

        this.terrainSeedInput = this.makeShareRow(
            'Terrain Seed (current terrain sliders)',
            '0–4294967295',
            () => String(this.terrainGenerator.getSeed()),
            value => this.loadTerrainSeed(value),
        );
        this.lightingCodeInput = this.makeShareRow(
            'Lighting Code (sun + reflections)',
            'LDR-L1-…',
            () => encodeLightingCode(this.reflectionControls.exportSettings()),
            value => this.loadLightingCode(value),
        );
        this.sceneCodeInput = this.makeShareRow(
            'Full Scene Code (terrain + grid + lighting)',
            'LDR-S1-…',
            () => encodeSceneCode(this.captureSceneSettings()),
            value => this.loadSceneCode(value),
        );
    }

    private makeShareRow(
        label: string,
        placeholder: string,
        valueForCopy: () => string,
        onLoad: (value: string) => void,
    ): HTMLInputElement {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '5px';

        const labelElement = document.createElement('div');
        labelElement.textContent = label;
        Object.assign(labelElement.style, { fontSize: '10px', marginBottom: '2px' });
        wrapper.appendChild(labelElement);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.autocomplete = 'off';
        input.spellcheck = false;
        Object.assign(input.style, {
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#ddd',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '3px',
            padding: '3px',
            marginBottom: '2px',
        });
        wrapper.appendChild(input);

        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.gap = '4px';
        buttons.appendChild(this.makeButton('Copy', () => {
            this.showAndCopy(input, valueForCopy());
        }));
        buttons.appendChild(this.makeButton('Load', () => onLoad(input.value)));
        wrapper.appendChild(buttons);
        this.container.appendChild(wrapper);
        return input;
    }

    private captureSceneSettings(): SceneSettings {
        return {
            version: CURRENT_SCENE_SETTINGS_VERSION,
            seed: this.terrainGenerator.getSeed(),
            terrain: this.terrainControls.exportSettings(),
            edge: this.edgeControls.exportSettings(),
            reflection: this.reflectionControls.exportSettings(),
        };
    }

    private showAndCopy(input: HTMLInputElement, value: string): void {
        input.value = value;
        input.focus();
        input.select();
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(value).then(
                () => { this.status.textContent = 'Copied'; },
                () => { this.status.textContent = 'Selected — press Ctrl+C'; },
            );
        } else {
            this.status.textContent = 'Selected — press Ctrl+C';
        }
    }

    private refreshTerrainSeed(): void {
        if (this.terrainSeedInput) {
            this.terrainSeedInput.value = String(this.terrainGenerator.getSeed());
        }
    }

    /** Show current share values rather than placeholder-only paste boxes. */
    private refreshShareValues(): void {
        this.refreshTerrainSeed();
        if (this.lightingCodeInput) {
            this.lightingCodeInput.value = encodeLightingCode(
                this.reflectionControls.exportSettings(),
            );
        }
        if (this.sceneCodeInput) {
            this.sceneCodeInput.value = encodeSceneCode(this.captureSceneSettings());
        }
    }

    private loadTerrainSeed(value: string): void {
        const trimmed = value.trim();
        if (!/^\d{1,10}$/.test(trimmed)) {
            this.status.textContent = 'Terrain Seed must be 0–4294967295';
            return;
        }
        const seed = Number(trimmed);
        if (!Number.isSafeInteger(seed) || seed > 4294967295) {
            this.status.textContent = 'Terrain Seed must be 0–4294967295';
            return;
        }
        if (this.terrainControls.regenerateWithSeed(seed)) {
            this.refreshTerrainSeed();
            this.status.textContent = 'Terrain seed loaded (current sliders retained)';
        } else {
            this.status.textContent = 'Wait for the current terrain generation to finish';
        }
    }

    private loadLightingCode(value: string): void {
        try {
            const normalized = normalizeSceneSettings(
                decodeLightingCode(value),
                this.captureSceneSettings(),
            );
            this.reflectionControls.importSettings(normalized.reflection);
            this.refreshShareValues();
            this.status.textContent = 'Lighting code loaded';
        } catch (error) {
            this.status.textContent = 'Lighting code failed: '
                + (error instanceof Error ? error.message : String(error));
        }
    }

    private loadSceneCode(value: string): void {
        try {
            this.applySceneSettings(decodeSceneCode(value));
            this.status.textContent = 'Full scene code loaded';
        } catch (error) {
            this.status.textContent = 'Scene code failed: '
                + (error instanceof Error ? error.message : String(error));
        }
    }

    private applySceneSettings(rawData: unknown): void {
        const data = normalizeSceneSettings(rawData, this.captureSceneSettings());
        this.terrainGenerator.setSeed(data.seed);
        this.edgeControls.importSettings(data.edge);
        this.reflectionControls.importSettings(data.reflection);
        this.terrainControls.importSettings(data.terrain);
        this.refreshShareValues();
    }

    private exportToTextarea(): void {
        const settings = this.captureSceneSettings();
        const json = JSON.stringify(settings, null, 2);
        this.textarea.value = json;
        this.textarea.focus();
        this.textarea.select();

        // Best-effort clipboard write — never relied on. The textarea (already
        // selected above) is the reliable path if the browser blocks this
        // (clipboard API needs a secure context/permission and can silently
        // refuse); Ctrl+C still works either way.
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(json).then(
                () => { this.status.textContent = 'Copied to clipboard (also shown below)'; },
                () => { this.status.textContent = 'Shown below — select all + Ctrl+C to copy'; },
            );
        } else {
            this.status.textContent = 'Shown below — select all + Ctrl+C to copy';
        }
    }

    private importFromTextarea(): void {
        let rawData: unknown;
        try {
            rawData = JSON.parse(this.textarea.value);
        } catch {
            this.status.textContent = 'Invalid JSON — check for typos/truncation';
            return;
        }
        try {
            this.applySceneSettings(rawData);
            this.status.textContent = 'Loaded';
        } catch (e) {
            this.status.textContent = 'Import failed: ' + (e instanceof Error ? e.message : String(e));
        }
    }

    public dispose(): void {
        this.terrainGenerator.removeRegenerateListener(this.regenerateListener);
        this.edgeControls.removeChangeListener(this.shareSettingsListener);
        this.reflectionControls.removeChangeListener(this.shareSettingsListener);
        this.dragHandle?.destroy();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
