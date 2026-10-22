import type { AppSettings } from '../types';

export const KEYS = {
  settings: 's2ui.settings.v1',
  scene: 's2ui.scene.v1',
  versions: 's2ui.versions.v1',
  vIndex: 's2ui.vindex.v1',
  backend: 's2ui.backend.v1',
  project: 's2ui.project.v1',
  brand: 's2ui.brand.v1',
  reference: 's2ui.reference.v1',
  alternatives: 's2ui.alternatives.v1',
  locks: 's2ui.locks.v1',
  tests: 's2ui.tests.v1',
};

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('s2ui-storage-change', {detail:key}));
  } catch (e) {
    console.warn('localStorage save failed', key, e);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('s2ui-storage-error', {detail:key}));
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  autoSync: false,
  autoImages: true,
  autoSegment: true,
  debounceMs: 2000,
  temperature: 0.2,
  planFirst: false,
};

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<AppSettings>>(KEYS.settings, {}) };
}

export function clearAll() {
  Object.keys(localStorage).filter(key => key.startsWith('s2ui.')).forEach(key => localStorage.removeItem(key));
}
