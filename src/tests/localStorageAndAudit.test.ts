import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAllLocalStorage,
  DEFAULT_LOCAL_PROFILE,
  deriveInitials,
  loadLocalProfile,
  loadRunHistory,
  loadScenariosFromStorage,
  loadWorkspacePreferences,
  saveLocalProfile,
  saveRunHistory,
  saveScenariosToStorage,
  saveWorkspacePreferences
} from '../models/localStorageStore';
import { DEFAULT_SCENARIOS, PROBLEM_CATALOG } from '../models/defaultScenarios';
import { runReverseSolver } from '../models/decisionEngines';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

describe('Local Storage Persistence, Profile Safety & Audit Disclosures', () => {
  it('saves, validates, and cleanly resets scenarios, preferences, profile, and run history', () => {
    const storage = createMemoryStorage();
    const customScenario = structuredClone(DEFAULT_SCENARIOS[0]);
    customScenario.id = 'scen-test-persist';
    customScenario.title = 'Persisted Corridor Test';

    assert.equal(saveScenariosToStorage([customScenario, ...DEFAULT_SCENARIOS], storage), true);
    const loadedScenarios = loadScenariosFromStorage(storage);
    assert.equal(loadedScenarios[0].id, 'scen-test-persist');

    saveWorkspacePreferences(
      {
        activeScenarioId: 'scen-test-persist',
        selectedAltIdByScenario: { 'scen-test-persist': customScenario.alternatives[0].id },
        mapPlaceIdByScenario: { 'scen-test-persist': 'guntur' },
        mapViewMode: 'holo'
      },
      storage
    );
    const loadedPrefs = loadWorkspacePreferences(loadedScenarios, storage);
    assert.equal(loadedPrefs.activeScenarioId, 'scen-test-persist');
    assert.equal(loadedPrefs.mapPlaceIdByScenario['scen-test-persist'], 'guntur');
    assert.equal(loadedPrefs.mapViewMode, 'holo');

    saveLocalProfile(
      {
        displayName: 'Ananya Rao',
        initials: deriveInitials('Ananya Rao'),
        defaultMapView: '2d',
        motionPreference: 'reduced',
        persistHistory: false
      },
      storage
    );
    const profile = loadLocalProfile(storage);
    assert.equal(profile.displayName, 'Ananya Rao');
    assert.equal(profile.initials, 'AR');
    assert.equal(profile.motionPreference, 'reduced');
    assert.equal(profile.persistHistory, false);

    saveRunHistory(
      [
        {
          id: 'run-1',
          timestampIso: '2026-11-11T16:00:00.000Z',
          scenarioId: 'scen-test-persist',
          scenarioTitle: 'Persisted Corridor Test',
          domain: 'traffic',
          alternativeId: customScenario.alternatives[0].id,
          alternativeName: 'Solution A',
          primaryPerformance: 38.2,
          primaryUnit: 'km/h',
          utilityScore: 84,
          feasible: true,
          note: 'Alternative selected'
        }
      ],
      storage
    );
    assert.equal(loadRunHistory(storage).length, 1);

    clearAllLocalStorage(storage);
    assert.equal(loadRunHistory(storage).length, 0);
    assert.equal(loadLocalProfile(storage).displayName, DEFAULT_LOCAL_PROFILE.displayName);
    assert.equal(loadScenariosFromStorage(storage).length, DEFAULT_SCENARIOS.length);
  });

  it('rejects polluted or malformed storage entries safely', () => {
    const storage = createMemoryStorage();
    storage.setItem('whatif.v1.scenarios', '{bad json');
    storage.setItem(
      'whatif.v1.profile',
      JSON.stringify({ displayName: '<script>x</script>Planner', __proto__: { polluted: true } })
    );
    const scenarios = loadScenariosFromStorage(storage);
    assert.equal(scenarios.length, DEFAULT_SCENARIOS.length);
    const profile = loadLocalProfile(storage);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.ok(!profile.displayName.includes('<'));
  });

  it('preserves explicit unmodeled physics disclosures and reverse-solver achieved outputs', () => {
    const unavailableTraffic = PROBLEM_CATALOG.traffic.filter((p) => p.available === false);
    const unavailableWater = PROBLEM_CATALOG.water.filter((p) => p.available === false);
    const unavailableEnergy = PROBLEM_CATALOG.energy.filter((p) => p.available === false);
    assert.ok(unavailableTraffic.length >= 2);
    assert.ok(unavailableWater.length >= 2);
    assert.ok(unavailableEnergy.length >= 2);

    const revReachable = runReverseSolver(
      DEFAULT_SCENARIOS[0],
      30,
      DEFAULT_SCENARIOS[0].alternatives[0].id
    );
    assert.equal(revReachable.available, true);
    assert.ok(typeof revReachable.status === 'string' && revReachable.status.length > 0);
    if (revReachable.solvable) {
      assert.ok(typeof revReachable.requiredValue === 'string' && revReachable.requiredValue.length > 0);
      assert.ok(typeof revReachable.achievedPerformance === 'string');
    }

    const revUnreachable = runReverseSolver(
      DEFAULT_SCENARIOS[0],
      999,
      DEFAULT_SCENARIOS[0].alternatives[0].id
    );
    assert.equal(revUnreachable.available, true);
    assert.equal(revUnreachable.solvable, false);
    assert.ok(typeof revUnreachable.achievableRange === 'string');
  });
});
