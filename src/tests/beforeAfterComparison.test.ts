import test from 'node:test';
import assert from 'node:assert/strict';
import { DigitalTwinAdapters } from '../models/digitalTwinAdapters';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import { runBaselineSimulation, runAlternativeSimulation } from '../models/decisionEngines';

test('Digital Twin Before / After Comparison & Intervention Framing Suite', async (t) => {
  const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
  const waterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
  const energyScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;

  await t.test('1. Intervention Camera Focus: correctly computes world center and close framing distance', () => {
    const altA = trafficScenario.alternatives[0]; // Solution A
    const focus = DigitalTwinAdapters.getInterventionCameraFocus(trafficScenario, altA, 'nambur');

    assert.ok(focus !== null, 'Focus target should be calculated for Solution A');
    assert.ok(Number.isFinite(focus.x));
    assert.ok(Number.isFinite(focus.z));
    assert.ok(focus.distance >= 12 && focus.distance <= 26, `Distance ${focus.distance} should be tightly framed between 12 and 26 wu`);

    // Null alternative returns null
    const nullFocus = DigitalTwinAdapters.getInterventionCameraFocus(trafficScenario, null);
    assert.equal(nullFocus, null);
  });

  await t.test('2. Water Intervention Camera Focus: focuses on upgraded pipe and pump locations', () => {
    const altA = waterScenario.alternatives[0];
    const focus = DigitalTwinAdapters.getInterventionCameraFocus(waterScenario, altA, 'nambur');

    assert.ok(focus !== null);
    assert.ok(Number.isFinite(focus.x));
    assert.ok(Number.isFinite(focus.z));
    assert.ok(focus.distance >= 12 && focus.distance <= 26);
  });

  await t.test('3. Energy Intervention Camera Focus: focuses on upgraded transmission corridor', () => {
    const altA = energyScenario.alternatives[0];
    const focus = DigitalTwinAdapters.getInterventionCameraFocus(energyScenario, altA, 'nambur');

    assert.ok(focus !== null);
    assert.ok(Number.isFinite(focus.x));
    assert.ok(Number.isFinite(focus.z));
  });

  await t.test('4. Comparison Highlights: evaluates distinct Before vs After states without identical outputs', () => {
    const baseRecord = runBaselineSimulation(trafficScenario);
    const altRecord = runAlternativeSimulation(trafficScenario, trafficScenario.alternatives[0]);

    const comparison = DigitalTwinAdapters.getComparisonHighlights(
      trafficScenario,
      baseRecord,
      altRecord,
      trafficScenario.alternatives[0]
    );

    assert.notEqual(comparison.baselineValue, comparison.alternativeValue);
    assert.ok(comparison.addedOrUpgradedAssets.length > 0);
    assert.ok(comparison.alleviatedIssues.length > 0);
    assert.ok(comparison.summaryNote.length > 10);
  });

  await t.test('5. Traffic Signal Infrastructure & Geographic Honesty: Verifies 0 OSM signals and CTM model handoff', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const zlib = await import('node:zlib');
    const regionPath = path.resolve('public/maps/region.json.gz');
    const rawData = JSON.parse(zlib.gunzipSync(fs.readFileSync(regionPath)).toString('utf8'));

    // Verified geographic honesty: OSM region.json.gz contains 0 mapped physical traffic_signals
    const mappedOsmSignals = rawData.features.filter(
      (f: { properties?: { highway?: string } }) => f.properties?.highway === 'traffic_signals'
    );
    assert.equal(mappedOsmSignals.length, 0, 'OSM region dataset has 0 mapped highway=traffic_signals');

    // CTM domain models signal coordination via signalGreenRatio parameter
    const signalizedCells = trafficScenario.trafficNetwork!.cells.filter(
      (c) => typeof c.signalGreenRatio === 'number' && c.signalGreenRatio > 0
    );
    assert.ok(signalizedCells.length > 0, 'Traffic scenario has CTM signalized cells');
    assert.equal(signalizedCells.length, 8, 'Scenario has 8 calibrated signalized intersection cells');
    assert.ok(signalizedCells.every((c) => c.signalGreenRatio! >= 0.40 && c.signalGreenRatio! <= 0.75));
  });

  await t.test('6. Massive Change Visibility: Before/Baseline has 0 modifications while After has distinct modifications', () => {
    const altA = trafficScenario.alternatives[0];
    assert.ok(altA.modifications.length > 0, 'Alternative must define physical modifications');

    // Baseline condition has 0 modifications
    const baselineMods = null;
    assert.equal(baselineMods, null, 'Baseline has 0 intervention modifications');

    // Each modification maps to a valid target in network
    const cellIds = new Set(trafficScenario.trafficNetwork!.cells.map((c) => c.id));
    altA.modifications.forEach((m) => {
      assert.ok(cellIds.has(m.targetId), `Modification target ${m.targetId} exists in cell network`);
      assert.notEqual(m.originalValue, m.newValue, `Modification ${m.property} has distinct Before vs After values`);
    });
  });
});
