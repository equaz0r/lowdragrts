import { TerrainGenerator, TerrainConfig } from '../terrain/TerrainGenerator';
import { TerrainControls } from './TerrainControls';
import { EdgeControls, EdgeSettings } from './EdgeControls';
import { ReflectionControls, ReflectionSettings } from './ReflectionControls';
import { makeDraggable, DragHandle, clearAllPanelPositions } from './Draggable';

export interface SceneSettings {
    version: 1;
    seed: number;
    terrain: TerrainConfig;
    edge: EdgeSettings;
    reflection: ReflectionSettings;
}

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
        title.textContent = 'Save / Load Settings';
        Object.assign(title.style, {
            fontWeight:    'bold',
            marginBottom:  '4px',
            borderBottom:  '1px solid rgba(255,255,255,0.2)',
            paddingBottom: '2px',
        });
        this.container.appendChild(title);
        this.dragHandle = makeDraggable(this.container, title, 'settings-io');

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '4px';
        btnRow.style.marginBottom = '4px';
        btnRow.appendChild(this.makeButton('Export', () => this.exportToTextarea()));
        btnRow.appendChild(this.makeButton('Import', () => this.importFromTextarea()));
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
        const resetBtn = this.makeButton('Reset Panel Positions', () => {
            clearAllPanelPositions();
            window.location.reload();
        });
        // Muted styling — distinct from Export/Import, this is a "layout"
        // action not a "data" one, and it's a full reload, not instant.
        resetBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        resetBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        resetBtn.title = 'Clears saved drag positions for all panels and reloads the page';
        resetRow.appendChild(resetBtn);
        this.container.appendChild(resetRow);

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

    private exportToTextarea(): void {
        const settings: SceneSettings = {
            version: 1,
            seed: this.terrainGenerator.getSeed(),
            terrain: this.terrainControls.exportSettings(),
            edge: this.edgeControls.exportSettings(),
            reflection: this.reflectionControls.exportSettings(),
        };
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
        let data: SceneSettings;
        try {
            data = JSON.parse(this.textarea.value);
        } catch {
            this.status.textContent = 'Invalid JSON — check for typos/truncation';
            return;
        }
        if (!data || typeof data !== 'object' || !data.terrain || !data.edge || !data.reflection) {
            this.status.textContent = 'Missing terrain/edge/reflection sections — not a settings export';
            return;
        }
        try {
            // Seed first: TerrainControls.importSettings() regenerates with
            // whatever seed is CURRENTLY set, keeping it unchanged — so this
            // has to land before that call, not after.
            if (typeof data.seed === 'number') this.terrainGenerator.setSeed(data.seed);
            this.edgeControls.importSettings(data.edge);
            this.reflectionControls.importSettings(data.reflection);
            this.terrainControls.importSettings(data.terrain); // triggers the regenerate — do this last
            this.status.textContent = 'Loaded';
        } catch (e) {
            this.status.textContent = 'Import failed: ' + (e instanceof Error ? e.message : String(e));
        }
    }

    public dispose(): void {
        this.dragHandle?.destroy();
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
