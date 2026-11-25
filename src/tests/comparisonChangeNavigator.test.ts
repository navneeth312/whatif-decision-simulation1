import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeComparisonChanges,
  getAssetCameraFocus
} from '../models/comparisonChangeNavigator';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import { runBaselineSimulation, runAlternativeSimulation } from '../models/decisionEngines';

const TRAFFIC_DEFAULT_SCENARIO = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
const WATER_DEFAULT_SCENARIO = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
const ENERGY_DEFAULT_SCENARIO = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;

describe('Advanced Before/After Comparison & Change Navigator Suite', () => {
  // ----------------------------------------------------
  // TEST 1: Traffic Domain Change Computation
  // ----------------------------------------------------
  test('1. Traffic Domain: Computes modified, improved, and newly affected cells with accurate deltas', () => {
    const scenario = TRAFFIC_DEFAULT_SCENARIO;
    const baseline = runBaselineSimulation(scenario);
    const altA = scenario.alternatives[0]; // Solution A
    const altResult = runAlternativeSimulation(scenario, altA);

    const { changes, summary } = computeComparisonChanges(scenario, baseline, altResult, altA);

    assert.ok(changes.length > 0, 'Expected at least 1 changed asset in Traffic Solution A');
    assert.ok(summary.totalModified > 0, 'Expected at least 1 directly modified asset');
    assert.ok(summary.totalImproved > 0, 'Expected at least 1 improved asset');
    assert.equal(summary.totalAssetsEvaluated, scenario.trafficNetwork!.cells.length);

    // Verify directly modified cell exists
    const directChange = changes.find((c) => c.isDirectModification);
    assert.ok(directChange, 'Expected to find directly modified cell');
    assert.equal(directChange.category, 'directly-modified');

    // Verify speed delta calculation
    assert.ok(typeof directChange.beforeValue === 'number');
    assert.ok(typeof directChange.afterValue === 'number');
    assert.ok(directChange.unit === 'km/h');
  });

  // ----------------------------------------------------
  // TEST 2: Water Domain Change Computation
  // ----------------------------------------------------
  test('2. Water Domain: Identifies pump/pipe upgrades and node pressure improvements', () => {
    const scenario = WATER_DEFAULT_SCENARIO;
    const baseline = runBaselineSimulation(scenario);
    const altA = scenario.alternatives[0]; // Solution A
    const altResult = runAlternativeSimulation(scenario, altA);

    const { changes, summary } = computeComparisonChanges(scenario, baseline, altResult, altA);

    assert.ok(changes.length > 0, 'Expected at least 1 changed asset in Water Solution A');
    assert.ok(summary.totalAssetsEvaluated > 0);

    // Check node pressure change
    const nodeChange = changes.find((c) => c.metricLabel === 'Junction Pressure');
    assert.ok(nodeChange, 'Expected to find a junction pressure change');
    assert.equal(nodeChange.unit, 'kPa');
    assert.ok(nodeChange.explanation.whatChanged.length > 0);
  });

  // ----------------------------------------------------
  // TEST 3: Energy Domain Change Computation
  // ----------------------------------------------------
  test('3. Energy Domain: Detects line re-conductoring and thermal load reductions', () => {
    const scenario = ENERGY_DEFAULT_SCENARIO;
    const baseline = runBaselineSimulation(scenario);
    const altA = scenario.alternatives[0];
    const altResult = runAlternativeSimulation(scenario, altA);

    const { changes, summary } = computeComparisonChanges(scenario, baseline, altResult, altA);

    assert.ok(changes.length > 0, 'Expected at least 1 changed line in Energy Solution A');
    assert.ok(summary.totalModified > 0);

    const lineChange = changes.find((c) => c.metricLabel === 'Thermal Loading');
    assert.ok(lineChange, 'Expected to find a line thermal loading change');
    assert.equal(lineChange.unit, '%');
  });

  // ----------------------------------------------------
  // TEST 4: Camera Focus Calculation
  // ----------------------------------------------------
  test('4. getAssetCameraFocus: Computes world coordinates and tight framing distance', () => {
    const scenario = TRAFFIC_DEFAULT_SCENARIO;
    const firstCell = scenario.trafficNetwork!.cells[0];

    const focus = getAssetCameraFocus(scenario, firstCell.id, 'nambur');
    assert.ok(focus !== null, 'Expected non-null focus for valid cell ID');
    assert.ok(typeof focus.x === 'number');
    assert.ok(typeof focus.z === 'number');
    assert.ok(focus.distance > 0 && focus.distance <= 25);

    // Non-existent asset returns null
    const invalidFocus = getAssetCameraFocus(scenario, 'non-existent-asset-999');
    assert.equal(invalidFocus, null);
  });

  // ----------------------------------------------------
  // TEST 5: 10-Point Explanation & Engineering Honesty
  // ----------------------------------------------------
  test('5. 10-Point Explanation: Contains all required explanation sections with calculated vs unmodeled separation', () => {
    const scenario = TRAFFIC_DEFAULT_SCENARIO;
    const baseline = runBaselineSimulation(scenario);
    const altA = scenario.alternatives[0];
    const altResult = runAlternativeSimulation(scenario, altA);

    const { changes } = computeComparisonChanges(scenario, baseline, altResult, altA);
    const change = changes[0];
    const exp = change.explanation;

    // Verify all 10 explanation dimensions
    assert.ok(exp.whatChanged && exp.whatChanged.length > 10, '1. What changed');
    assert.ok(exp.whereChanged && exp.whereChanged.length > 10, '2. Where changed');
    assert.ok(exp.situationBefore && exp.situationBefore.length > 10, '3. Situation before');
    assert.ok(exp.situationAfter && exp.situationAfter.length > 10, '4. Situation after');
    assert.ok(exp.whyHappened && exp.whyHappened.length > 10, '5. Why happened');
    assert.ok(exp.directBenefit && exp.directBenefit.length > 10, '6. Direct benefit');
    assert.ok(exp.negativeOrSecondaryEffects && exp.negativeOrSecondaryEffects.length > 5, '7. Negative/secondary effects');
    assert.ok(exp.connectedAssetsAffected && exp.connectedAssetsAffected.length > 5, '8. Connected assets');
    assert.ok(exp.watchOutFor && exp.watchOutFor.length > 10, '9. Watch out for');
    assert.ok(exp.practicalTakeaway && exp.practicalTakeaway.length > 10, '10. Practical takeaway');

    // Verify Engineering Audit Breakdown
    assert.ok(exp.calculatedResults.length >= 2, 'Expected calculated numerical outputs');
    assert.ok(exp.inferredExplanations.length >= 1, 'Expected inferred physical mechanism');
    assert.ok(exp.unmodeledRisks.length >= 1, 'Expected explicit unmodeled risk disclosures');
    assert.ok(exp.governingEquations.length > 5, 'Expected governing physical equations');
  });

  // ----------------------------------------------------
  // TEST 6: Graceful Handling of Zero Changes
  // ----------------------------------------------------
  test('6. Zero Changes: Gracefully handles null alternative and identical baseline states', () => {
    const scenario = TRAFFIC_DEFAULT_SCENARIO;
    const baseline = runBaselineSimulation(scenario);

    const { changes, summary } = computeComparisonChanges(scenario, baseline, baseline, null);

    assert.equal(changes.length, 0, 'Baseline compared with baseline should yield 0 changes');
    assert.equal(summary.totalModified, 0);
    assert.equal(summary.totalImproved, 0);
    assert.equal(summary.totalDegraded, 0);
  });
});
