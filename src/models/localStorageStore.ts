import { DEFAULT_SCENARIOS } from './defaultScenarios';
import { DomainType, Scenario } from '../types';

export type MapViewMode = '3d' | 'holo' | '2d';

export interface LocalProfileSettings {
  displayName: string;
  initials: string;
  defaultMapView: MapViewMode;
  motionPreference: 'system' | 'reduced';
  persistHistory: boolean;
}

export interface WorkspacePreferences {
  activeScenarioId: string;
  selectedAltIdByScenario: Record<string, string | null>;
  mapPlaceIdByScenario: Record<string, string>;
  mapViewMode: MapViewMode;
}

export interface SimulationRunLogEntry {
  id: string;
  timestampIso: string;
  scenarioId: string;
  scenarioTitle: string;
  domain: DomainType;
  alternativeId: string | null;
  alternativeName: string;
  primaryPerformance: number;
  primaryUnit: string;
  utilityScore: number;
  feasible: boolean;
  note: string;
}

const STORAGE_KEYS = {
  scenarios: 'whatif.v1.scenarios',
  workspace: 'whatif.v1.workspace',
  profile: 'whatif.v1.profile',
  runHistory: 'whatif.v1.runHistory'
} as const;

export const DEFAULT_LOCAL_PROFILE: LocalProfileSettings = {
  displayName: 'Local Planner',
  initials: 'LP',
  defaultMapView: '3d',
  motionPreference: 'system',
  persistHistory: true
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  activeScenarioId: DEFAULT_SCENARIOS[0]?.id || '',
  selectedAltIdByScenario: {},
  mapPlaceIdByScenario: {},
  mapViewMode: '3d'
};

function getSafeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probeKey = '__whatif_storage_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function stripForbiddenKeys(value: unknown, depth = 0): unknown {
  if (depth > 16) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.map((item) => stripForbiddenKeys(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const clean: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = stripForbiddenKeys(entry, depth + 1);
  }
  return clean;
}

function isValidScenarioCandidate(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<Scenario>;
  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) return false;
  if (typeof candidate.title !== 'string' || candidate.title.trim().length === 0) return false;
  if (candidate.domain !== 'traffic' && candidate.domain !== 'water' && candidate.domain !== 'energy') {
    return false;
  }
  if (!Array.isArray(candidate.alternatives)) return false;
  if (!Array.isArray(candidate.assumptions) || !Array.isArray(candidate.constraints)) return false;
  if (candidate.domain === 'traffic' && !candidate.trafficNetwork?.cells?.length) return false;
  if (candidate.domain === 'water' && !candidate.waterNetwork?.nodes?.length) return false;
  if (candidate.domain === 'energy' && !candidate.powerNetwork?.buses?.length) return false;
  return true;
}

export function deriveInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'W';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function loadScenariosFromStorage(storage: Storage | null = getSafeStorage()): Scenario[] {
  if (!storage) return DEFAULT_SCENARIOS;
  try {
    const raw = storage.getItem(STORAGE_KEYS.scenarios);
    if (!raw || raw.length > 2_500_000) return DEFAULT_SCENARIOS;
    const parsed = stripForbiddenKeys(JSON.parse(raw));
    if (!Array.isArray(parsed)) return DEFAULT_SCENARIOS;
    const valid = parsed.filter(isValidScenarioCandidate).slice(0, 40);
    return valid.length > 0 ? valid : DEFAULT_SCENARIOS;
  } catch {
    return DEFAULT_SCENARIOS;
  }
}

export function saveScenariosToStorage(
  scenarios: Scenario[],
  storage: Storage | null = getSafeStorage()
): boolean {
  if (!storage) return false;
  try {
    const safeList = scenarios.slice(0, 40);
    storage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(safeList));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspacePreferences(
  scenarios: Scenario[],
  storage: Storage | null = getSafeStorage()
): WorkspacePreferences {
  const fallbackScenarioId = scenarios[0]?.id || DEFAULT_SCENARIOS[0]?.id || '';
  if (!storage) {
    return { ...DEFAULT_WORKSPACE_PREFERENCES, activeScenarioId: fallbackScenarioId };
  }
  try {
    const raw = storage.getItem(STORAGE_KEYS.workspace);
    if (!raw) return { ...DEFAULT_WORKSPACE_PREFERENCES, activeScenarioId: fallbackScenarioId };
    const parsed = stripForbiddenKeys(JSON.parse(raw)) as Partial<WorkspacePreferences> | null;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_WORKSPACE_PREFERENCES, activeScenarioId: fallbackScenarioId };
    }
    const validScenarioId =
      typeof parsed.activeScenarioId === 'string' && scenarios.some((s) => s.id === parsed.activeScenarioId)
        ? parsed.activeScenarioId
        : fallbackScenarioId;
    const viewMode: MapViewMode =
      parsed.mapViewMode === '2d' || parsed.mapViewMode === 'holo' || parsed.mapViewMode === '3d'
        ? parsed.mapViewMode
        : '3d';
    const selectedAltIdByScenario: Record<string, string | null> = {};
    if (parsed.selectedAltIdByScenario && typeof parsed.selectedAltIdByScenario === 'object') {
      for (const [k, v] of Object.entries(parsed.selectedAltIdByScenario)) {
        if (typeof k === 'string' && (typeof v === 'string' || v === null)) {
          selectedAltIdByScenario[k] = v;
        }
      }
    }
    const mapPlaceIdByScenario: Record<string, string> = {};
    if (parsed.mapPlaceIdByScenario && typeof parsed.mapPlaceIdByScenario === 'object') {
      for (const [k, v] of Object.entries(parsed.mapPlaceIdByScenario)) {
        if (typeof k === 'string' && typeof v === 'string' && v.trim().length > 0) {
          mapPlaceIdByScenario[k] = v;
        }
      }
    }
    return {
      activeScenarioId: validScenarioId,
      selectedAltIdByScenario,
      mapPlaceIdByScenario,
      mapViewMode: viewMode
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFERENCES, activeScenarioId: fallbackScenarioId };
  }
}

export function saveWorkspacePreferences(
  prefs: WorkspacePreferences,
  storage: Storage | null = getSafeStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.workspace, JSON.stringify(prefs));
  } catch {
    // Ignore quota or storage restriction errors cleanly.
  }
}

export function loadLocalProfile(storage: Storage | null = getSafeStorage()): LocalProfileSettings {
  if (!storage) return DEFAULT_LOCAL_PROFILE;
  try {
    const raw = storage.getItem(STORAGE_KEYS.profile);
    if (!raw) return DEFAULT_LOCAL_PROFILE;
    const parsed = stripForbiddenKeys(JSON.parse(raw)) as Partial<LocalProfileSettings> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_LOCAL_PROFILE;
    const displayName =
      typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName.replace(/[<>]/g, '').trim().slice(0, 40)
        : DEFAULT_LOCAL_PROFILE.displayName;
    const initials =
      typeof parsed.initials === 'string' && parsed.initials.trim()
        ? parsed.initials.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || deriveInitials(displayName)
        : deriveInitials(displayName);
    const defaultMapView: MapViewMode =
      parsed.defaultMapView === '2d' || parsed.defaultMapView === 'holo' || parsed.defaultMapView === '3d'
        ? parsed.defaultMapView
        : DEFAULT_LOCAL_PROFILE.defaultMapView;
    const motionPreference: 'system' | 'reduced' =
      parsed.motionPreference === 'reduced' ? 'reduced' : 'system';
    return {
      displayName,
      initials,
      defaultMapView,
      motionPreference,
      persistHistory: parsed.persistHistory !== false
    };
  } catch {
    return DEFAULT_LOCAL_PROFILE;
  }
}

export function saveLocalProfile(
  profile: LocalProfileSettings,
  storage: Storage | null = getSafeStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  } catch {
    // Ignore storage restriction errors.
  }
}

export function loadRunHistory(storage: Storage | null = getSafeStorage()): SimulationRunLogEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEYS.runHistory);
    if (!raw) return [];
    const parsed = stripForbiddenKeys(JSON.parse(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is SimulationRunLogEntry => {
        if (!entry || typeof entry !== 'object') return false;
        const item = entry as Partial<SimulationRunLogEntry>;
        return (
          typeof item.id === 'string' &&
          typeof item.timestampIso === 'string' &&
          typeof item.scenarioId === 'string' &&
          typeof item.scenarioTitle === 'string' &&
          (item.domain === 'traffic' || item.domain === 'water' || item.domain === 'energy') &&
          typeof item.alternativeName === 'string' &&
          typeof item.primaryPerformance === 'number' &&
          Number.isFinite(item.primaryPerformance) &&
          typeof item.utilityScore === 'number' &&
          Number.isFinite(item.utilityScore) &&
          typeof item.feasible === 'boolean'
        );
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

export function saveRunHistory(
  entries: SimulationRunLogEntry[],
  storage: Storage | null = getSafeStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.runHistory, JSON.stringify(entries.slice(0, 40)));
  } catch {
    // Ignore storage restriction errors.
  }
}

export function clearAllLocalStorage(storage: Storage | null = getSafeStorage()): void {
  if (!storage) return;
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      storage.removeItem(key);
    }
  } catch {
    // Ignore errors.
  }
}

export function estimateLocalStorageBytes(storage: Storage | null = getSafeStorage()): number {
  if (!storage) return 0;
  let total = 0;
  for (const key of Object.values(STORAGE_KEYS)) {
    const val = storage.getItem(key);
    if (val) total += val.length * 2;
  }
  return total;
}

