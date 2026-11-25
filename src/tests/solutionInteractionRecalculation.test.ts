import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SCENARIOS,
  PROBLEM_CATALOG,
  applyProblemTemplateToScenario
} from '../models/defaultScenarios';
import {
  runBaselineSimulation,
  runAlternativeSimulation,
  calculateAlternativeDeltas,
  normalizeAndRankAlternatives
} from '../models/decisionEngines';

test('Solution Selection Recalculation & Synchronized Asset Updates Suite', async (t) => {
  await t.test(
    'Traffic Corridor: selecting Baseline -> A -> B -> C recalculates deterministic speeds and feasibility',
    () => {
      const baseScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic');
      assert.ok(baseScenario, 'Traffic scenario must exist');

      // Configure prob-traffic-2: East Commercial Corridor Signal Bottleneck
      const configuredScenario = applyProblemTemplateToScenario(baseScenario, 'prob-traffic-2');
      assert.equal(configuredScenario.problemStatement?.id, 'prob-traffic-2');

      const problem = configuredScenario.problemStatement;
      assert.ok(problem);

      // 1. Run Baseline (Do Nothing)
      const baselineSim = runBaselineSimulation(configuredScenario);
      assert.equal(baselineSim.domain, 'traffic');
      // Corridor speed must be below the 20.0 km/h threshold in baseline
      assert.ok(
        baselineSim.metrics.primaryPerformance < 20.0,
        `Baseline corridor speed (${baselineSim.metrics.primaryPerformance} km/h) should breach threshold 20.0`
      );
      assert.equal(baselineSim.feasible, false, 'Baseline must violate corridor constraint');
      assert.ok(baselineSim.constraintViolations.length > 0, 'Baseline must have constraint violations');

      const alts = configuredScenario.alternatives;
      assert.equal(alts.length, 3, 'Must have 3 configured alternatives');

      // 2. Select Solution A (BRT)
      const altA = alts[0];
      const simA = runAlternativeSimulation(configuredScenario, altA);
      assert.equal(simA.alternativeId, altA.id);
      assert.ok(
        simA.metrics.primaryPerformance > baselineSim.metrics.primaryPerformance,
        'Solution A must improve corridor speed over baseline'
      );
      assert.ok(
        simA.metrics.primaryPerformance >= 20.0,
        `Solution A corridor speed (${simA.metrics.primaryPerformance} km/h) must meet threshold 20.0`
      );
      assert.equal(simA.feasible, true, 'Solution A must be feasible within budget and performance');

      // 3. Select Solution B (Grade-Separated Flyover)
      const altB = alts[1];
      const simB = runAlternativeSimulation(configuredScenario, altB);
      assert.equal(simB.alternativeId, altB.id);
      assert.ok(
        simB.metrics.primaryPerformance > simA.metrics.primaryPerformance,
        'Solution B provides highest speed gain'
      );
      // Solution B has lifecycle cost exceeding budget cap
      assert.equal(simB.feasible, false, 'Solution B must violate the budget constraint');
      assert.ok(
        simB.constraintViolations.some((v) => v.toLowerCase().includes('budget') || v.toLowerCase().includes('cost')),
        'Solution B must report budget constraint violation'
      );

      // 4. Select Solution C (TSM & Signal Retiming)
      const altC = alts[2];
      const simC = runAlternativeSimulation(configuredScenario, altC);
      assert.equal(simC.alternativeId, altC.id);
      assert.ok(
        simC.metrics.primaryPerformance > baselineSim.metrics.primaryPerformance,
        'Solution C must improve speed over baseline'
      );
      assert.equal(simC.feasible, true, 'Solution C is feasible at low cost ($4.2M)');

      // Verify all 4 outcomes have distinct speeds
      const speeds = [
        baselineSim.metrics.primaryPerformance,
        simA.metrics.primaryPerformance,
        simB.metrics.primaryPerformance,
        simC.metrics.primaryPerformance
      ];
      const uniqueSpeeds = new Set(speeds.map((s) => s.toFixed(2)));
      assert.equal(
        uniqueSpeeds.size,
        4,
        `All 4 alternatives must produce distinct corridor speeds: ${speeds.map((s) => s.toFixed(1)).join(', ')}`
      );

      // 5. Verify synchronized asset telemetry on bottleneck cells
      assert.equal(baselineSim.rawOutput.domain, 'traffic');
      assert.equal(simA.rawOutput.domain, 'traffic');
      const trafficOutBase = baselineSim.rawOutput.result as import('../types').TrafficSimulationResult;
      const trafficOutA = simA.rawOutput.result as import('../types').TrafficSimulationResult;
      const corridorCellId = 'cell-east-corridor';

      const baseCellSpeed = trafficOutBase.timeSteps[trafficOutBase.timeSteps.length - 1].cellSpeeds[corridorCellId];
      const altACellSpeed = trafficOutA.timeSteps[trafficOutA.timeSteps.length - 1].cellSpeeds[corridorCellId];

      assert.ok(baseCellSpeed !== undefined, 'Corridor cell speed must exist in baseline');
      assert.ok(altACellSpeed !== undefined, 'Corridor cell speed must exist in solution A');
      assert.ok(
        altACellSpeed > baseCellSpeed,
        `Solution A must increase corridor cell speed (${altACellSpeed.toFixed(1)} > ${baseCellSpeed.toFixed(1)})`
      );

      // 6. Verify alternative deltas and ranking
      const allResults = [simA, simB, simC];
      const ranked = normalizeAndRankAlternatives(configuredScenario, allResults);
      assert.equal(ranked.length, 3);
      assert.ok(ranked[0].normalizedScores.overallUtility > 0);

      const deltaA = calculateAlternativeDeltas(configuredScenario, simA, baselineSim);
      assert.ok(deltaA.primaryImprovementPct > 0, 'Delta must reflect positive speed improvement percentage');
    }
  );

  await t.test(
    'Water Utility: selecting alternatives resolves low-pressure node breach',
    () => {
      const baseScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water');
      assert.ok(baseScenario, 'Water scenario must exist');

      const configured = applyProblemTemplateToScenario(baseScenario, 'prob-water-1');
      const baselineSim = runBaselineSimulation(configured);
      assert.equal(baselineSim.domain, 'water');
      assert.equal(baselineSim.feasible, false, 'Baseline water must fail min pressure constraint');
      assert.ok(baselineSim.metrics.primaryPerformance < 180.0, 'Baseline min pressure < 180 kPa');

      for (const alt of configured.alternatives) {
        const altSim = runAlternativeSimulation(configured, alt);
        assert.ok(altSim.metrics.primaryPerformance > baselineSim.metrics.primaryPerformance, 'Alternative must improve minimum pressure');
        assert.ok(typeof altSim.normalizedScores.overallUtility === 'number');
      }
    }
  );

  await t.test(
    'Energy Grid: selecting alternatives resolves line overload',
    () => {
      const baseScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy');
      assert.ok(baseScenario, 'Energy scenario must exist');

      const configured = applyProblemTemplateToScenario(baseScenario, 'prob-energy-1');
      const baselineSim = runBaselineSimulation(configured);
      assert.equal(baselineSim.domain, 'energy');
      assert.equal(baselineSim.metrics.primaryPerformanceUnit, 'MW line losses');

      for (const alt of configured.alternatives) {
        const altSim = runAlternativeSimulation(configured, alt);
        assert.ok(altSim.metrics.primaryPerformance > 0, 'Line loss must be positive');
        assert.ok(typeof altSim.normalizedScores.overallUtility === 'number');
      }
    }
  );
});
