export interface DragHandle {
    /** Removes the window-level listeners this created. MUST be called from
     *  the owning panel's dispose() — otherwise this leaks a pair of
     *  window-level listeners per panel instance/rebuild (the project's own
     *  "anonymous/unremoved listeners accumulate" lesson, see CLAUDE.md). */
    destroy: () => void;
}

const STORAGE_PREFIX = 'lowdragrts.panelPos.';

interface SavedPosition {
    left: number;
    top: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Makes `container` draggable via `handle` (its title bar), persisting
 * position to localStorage across reloads. `storageKey` must be unique per
 * panel — collisions silently share a saved position.
 *
 * On construction, if a saved position exists it's applied immediately
 * (switching the panel from whatever left/top/right/bottom the caller set to
 * absolute left/top); otherwise the caller's original position is left alone.
 *
 * Panels that rebuild their whole DOM on tuning (TerrainControls/EdgeControls/
 * ReflectionControls' renderAll() pattern) destroy their OLD title element
 * each rebuild — call destroy() then makeDraggable() again on the new title
 * element rather than assuming one binding survives a rebuild.
 */
export function makeDraggable(container: HTMLElement, handle: HTMLElement, storageKey: string): DragHandle {
    const fullKey = STORAGE_PREFIX + storageKey;

    const applyPosition = (left: number, top: number): void => {
        const maxLeft = Math.max(0, window.innerWidth - container.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - container.offsetHeight);
        container.style.left = clamp(left, 0, maxLeft) + 'px';
        container.style.top = clamp(top, 0, maxTop) + 'px';
        container.style.right = '';
        container.style.bottom = '';
    };

    const saved = localStorage.getItem(fullKey);
    if (saved) {
        try {
            const pos = JSON.parse(saved) as SavedPosition;
            applyPosition(pos.left, pos.top);
        } catch {
            localStorage.removeItem(fullKey); // corrupt entry — don't keep re-failing on it
        }
    }

    handle.style.cursor = 'move';
    handle.style.userSelect = 'none';
    handle.style.pointerEvents = 'auto'; // in case the container itself has pointerEvents:none

    let dragging = false;
    let startMouseX = 0, startMouseY = 0, startLeft = 0, startTop = 0;

    const onMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0) return; // left button only
        dragging = true;
        const rect = container.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startMouseX = e.clientX;
        startMouseY = e.clientY;
        applyPosition(startLeft, startTop); // lock in left/top positioning now
        e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent): void => {
        if (!dragging) return;
        applyPosition(startLeft + (e.clientX - startMouseX), startTop + (e.clientY - startMouseY));
    };

    const onMouseUp = (): void => {
        if (!dragging) return;
        dragging = false;
        const rect = container.getBoundingClientRect();
        localStorage.setItem(fullKey, JSON.stringify({ left: rect.left, top: rect.top }));
    };

    handle.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return {
        destroy: () => {
            handle.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        },
    };
}

/**
 * Clears every panel's saved position. Panels only read localStorage at
 * construction/rebuild time, so this needs a page reload to take visual
 * effect — the "Reset Panel Positions" button (SettingsIO) does both.
 */
export function clearAllPanelPositions(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
}
