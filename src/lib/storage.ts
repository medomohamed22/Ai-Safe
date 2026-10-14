import type { AppSettings } from '../types';

export const KEYS = {
  settings: 's2ui.settings.v1',
  scene: 's2ui.scene.v1',
  versions: 's2ui.versions.v1',
  vIndex: 's2ui.vindex.v1',
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
  } catch (e) {
    console.warn('localStorage save failed', key, e);
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  autoSync: false,
  debounceMs: 2000,
  temperature: 0.2,
};

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<AppSettings>>(KEYS.settings, {}) };
}

export function clearAll() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
