import type { ReflectionSettings } from '../ui/ReflectionControls';
import type { SceneSettings } from './SceneSettings';

export const LIGHTING_CODE_PREFIX = 'LDR-L1-';
export const SCENE_CODE_PREFIX = 'LDR-S1-';

interface LightingCodePayload {
    version: 1;
    reflection: ReflectionSettings;
}

function encodePayload(prefix: string, value: unknown): string {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return prefix + btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function decodePayload(code: string, prefix: string): unknown {
    const trimmed = code.trim();
    if (!trimmed.startsWith(prefix)) {
        throw new Error(`Expected a code beginning ${prefix}`);
    }

    const encoded = trimmed.slice(prefix.length);
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
        throw new Error('Share code contains invalid characters.');
    }

    const standard = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard + '='.repeat((4 - standard.length % 4) % 4);
    try {
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new Error('Share code is damaged or incomplete.');
    }
}

export function encodeLightingCode(reflection: ReflectionSettings): string {
    return encodePayload(LIGHTING_CODE_PREFIX, { version: 1, reflection });
}

export function decodeLightingCode(code: string): unknown {
    return decodePayload(code, LIGHTING_CODE_PREFIX);
}

export function encodeSceneCode(settings: SceneSettings): string {
    return encodePayload(SCENE_CODE_PREFIX, settings);
}

export function decodeSceneCode(code: string): unknown {
    return decodePayload(code, SCENE_CODE_PREFIX);
}
