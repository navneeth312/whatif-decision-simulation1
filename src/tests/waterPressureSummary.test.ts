import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assessWaterPressureSummary } from '../utils/waterPressureSummary';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import { runAlternativeSimulation } from '../models/decisionEngines';
import { SimulationOutput } from '../types';

function makeWaterOutput(pressuresKPa: number[]): SimulationOutput {
  const nodeResults: {
    [nodeId: string]: {
      head: number;
      pressureKPa: number;
      demandSupplied: number;
      unmetDemand: boolean;
      lowPressureWarning: boolean;
      negativePressureWarning: boolean;
    };
  } = {};

  pressuresKPa.forEach((p, idx) => {
    nodeResults[`N${idx + 1}`] = {
      head: Number.isFinite(p) ? p / 9.81 : 0,
      pressureKPa: p,
      demandSupplied: 0.05,
      unmetDemand: p < 140,
      lowPressureWarning: p < 140,
      negativePressureWarning: p < 0
    };
  });

  const finitePressures = pressuresKPa.filter(Number.isFinite);
  return {
    domain: 'water',
    result: {
      converged: true,
      iterations: 6,
      residualNorm: 0.0001,
      tolerance: 0.001,
      nodeResults,
      pipeResults: {},
      totalFlowM3s: 0.25,
      maxHeadLossM: 4.2,
      minPressureKPa: finitePressures.length > 0 ? Math.min(...finitePressures) : 0,
      warnings: [],
      solverNote: 'Test output'
    }
  };
}

describe('Water Pressure Summary Helper', () => {
  it('omits overpressure risk note when pressures stay within safe limits', () => {
    const assessment = assessWaterPressureSummary(makeWaterOutput([185, 320, 490]), 18);
    assert.equal(assessment.maxExceeded, false);
    assert.equal(assessment.maxPressureKPa, 490);
    assert.match(assessment.whatMayImprove, /within safe operating limits/i);
    assert.equal(assessment.overpressureRiskNote, null);
  });

  it('includes PRV overpressure warning only when downstream pressure exceeds 550 kPa', () => {
    const assessment = assessWaterPressureSummary(makeWaterOutput([210, 582.4]), 24);
    assert.equal(assessment.maxExceeded, true);
    assert.equal(assessment.maxPressureKPa, 582.4);
    assert.match(assessment.whatMayImprove, /exceeds configured limits/i);
    assert.ok(assessment.overpressureRiskNote);
    assert.match(assessment.overpressureRiskNote, /pressure-reducing valves/i);
  });

  it('ignores non-finite pressure values gracefully', () => {
    const assessment = assessWaterPressureSummary(makeWaterOutput([260, Number.NaN, Number.POSITIVE_INFINITY]), 10);
    assert.equal(assessment.maxExceeded, false);
    assert.equal(assessment.maxPressureKPa, 260);
    assert.equal(assessment.overpressureRiskNote, null);
  });

  it('works with live water solver outputs without type casts', () => {
    const waterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water');
    assert.ok(waterScenario, 'Expected a default water scenario');
    const firstAlt = waterScenario.alternatives[0];
    assert.ok(firstAlt, 'Expected at least one water alternative');
    const simResult = runAlternativeSimulation(waterScenario, firstAlt);
    const assessment = assessWaterPressureSummary(simResult.rawOutput, 15);
    assert.ok(Number.isFinite(assessment.maxPressureKPa));
    if (assessment.maxExceeded) {
      assert.ok(assessment.overpressureRiskNote);
    } else {
      assert.equal(assessment.overpressureRiskNote, null);
    }
  });
});
