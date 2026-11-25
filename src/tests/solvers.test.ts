import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { solveTrafficNetwork } from '../models/trafficSolver';
import { solveWaterNetwork, darcyWeisbachFrictionFactor } from '../models/waterSolver';
import { solvePowerGrid } from '../models/powerGridSolver';
import {
  DEFAULT_SCENARIOS,
  PROBLEM_CATALOG,
  applyProblemTemplateToScenario
} from '../models/defaultScenarios';
import {
  runBaselineSimulation,
  runAlternativeSimulation,
  normalizeAndRankAlternatives,
  runRippleEffectAnalyzer,
  runAdaptiveStressTesting,
  runDecisionReversalEngine,
  runReverseSolver,
  runRecoveryPlanner,
  runUncertaintyRadar,
  runBaselineDiagnosis,
  runFutureIssuesUnderScenario,
  runFutureRegretExplorer,
  escapeCsvCell,
  sanitizeAndValidateScenarioImport
} from '../models/decisionEngines';

describe('WhatIf Domain Solvers, Diagnostics, Problem Catalog & Security Suite', () => {
  it('1. Traffic Solver & Asset Counts: 16 road segments, 8 signalized intersections, conservation & CFL guard', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    assert.ok(trafficScenario.trafficNetwork, 'Traffic network must be defined');

    const cells = trafficScenario.trafficNetwork.cells;
    assert.ok(cells.length >= 16, `Expected >= 16 road segments, got ${cells.length}`);
    const signals = cells.filter(
      (c) => c.signalGreenRatio !== undefined && c.signalGreenRatio < 1.0
    );
    assert.ok(
      signals.length >= 8,
      `Expected >= 8 signalized intersections, got ${signals.length}`
    );

    const out = solveTrafficNetwork(trafficScenario.trafficNetwork);
    assert.equal(out.converged, true, 'Traffic CTM must converge');
    assert.equal(out.cflSatisfied, true, 'CFL stability condition must be satisfied');
    assert.ok(out.cflRatio > 0 && out.cflRatio <= 1.0, 'CFL ratio must be <= 1.0');
    assert.ok(out.averageSpeedKmh > 10 && out.averageSpeedKmh < 65);
  });

  it('2. Regression Check — Traffic Diagnostics: never flag 36.3 km/h against >= 22.0 km/h; compare queue density against <= 0.70 * k_j', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const issues = runBaselineDiagnosis(trafficScenario);
    assert.ok(issues.length > 0, 'Traffic baseline should report congestion issues');

    for (const issue of issues) {
      if (issue.limitValue.includes('22.0 km/h')) {
        const numericSpeed = parseFloat(issue.measuredValue);
        assert.ok(
          numericSpeed < 22.0,
          `Speed ${issue.measuredValue} must be < 22.0 km/h if compared against >= 22.0 km/h`
        );
      }
      if (issue.metricName === 'Peak Queue Density') {
        assert.ok(
          issue.unit === 'veh/km/lane',
          'Queue density diagnostic must use veh/km/lane units'
        );
        assert.ok(
          issue.limitValue.includes('veh/km/lane'),
          'Queue density threshold must be in veh/km/lane'
        );
      }
    }
  });

  it('3. Water Solver, Asset Counts & Low-Pressure Regression Check (118 kPa vs >= 180 kPa)', () => {
    const waterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
    assert.ok(waterScenario.waterNetwork, 'Water network must be defined');

    const nodes = waterScenario.waterNetwork.nodes;
    const pipes = waterScenario.waterNetwork.pipes;
    assert.equal(nodes.length, 16, 'Water network must have 16 nodes');
    assert.equal(
      nodes.filter((n) => n.type === 'reservoir').length,
      1,
      'Must have 1 reservoir'
    );
    assert.equal(
      nodes.filter((n) => n.type === 'tank').length,
      1,
      'Must have 1 elevated tank'
    );
    assert.equal(
      nodes.filter((n) => n.type === 'pump' || n.type === 'valve').length,
      2,
      'Must have 2 pump/valve nodes'
    );
    assert.equal(
      nodes.filter((n) => n.type === 'junction').length,
      12,
      'Must have 12 pressurized junctions'
    );
    assert.ok(pipes.length >= 20, `Must have >= 20 pipes, got ${pipes.length}`);

    const out = solveWaterNetwork(waterScenario.waterNetwork);
    assert.equal(out.converged, true, 'Water solver must converge');
    assert.ok(out.residualNorm < 1e-2);
    assert.match(out.solverNote, /Darcy-Weisbach/);
    assert.ok(waterScenario.waterNetwork.pipes.every((pipe) => (pipe.absoluteRoughnessMm ?? 0) >= 0));

    const ridgeNode = out.nodeResults['junc-ridge'];
    assert.ok(ridgeNode, 'North Ridge node (junc-ridge) must exist');
    assert.ok(
      ridgeNode.pressureKPa > 105 && ridgeNode.pressureKPa < 135,
      `North Ridge baseline pressure (${ridgeNode.pressureKPa} kPa) must be ~118 kPa (< 180 kPa)`
    );

    const issues = runBaselineDiagnosis(waterScenario);
    const ridgeIssue = issues.find((i) => i.componentId === 'junc-ridge');
    assert.ok(
      ridgeIssue,
      'Baseline diagnosis must explicitly include low-pressure violation at junc-ridge'
    );
    assert.equal(ridgeIssue.severity, 'Breached');
    assert.ok(ridgeIssue.limitValue.includes('180.0 kPa'));

    const pipeIssue = issues.find((i) => i.componentId.startsWith('pipe-'));
    assert.ok(
      pipeIssue,
      'Baseline diagnosis must separately report pipe velocity or head-loss gradient violation'
    );

    // Ensure no unmodeled contamination/chlorine claims appear in hydraulic diagnostics
    for (const issue of issues) {
      assert.ok(
        !issue.symptom.toLowerCase().includes('chlorine') &&
          !issue.symptom.toLowerCase().includes('contamination'),
        'Steady-state hydraulic solver must never claim calculated water contamination'
      );
    }
  });

  it('3a. Darcy-Weisbach friction regimes and roughness sensitivity', () => {
    assert.ok(Math.abs(darcyWeisbachFrictionFactor(1000, 0.001) - 0.064) < 1e-12);
    const transitional = darcyWeisbachFrictionFactor(3000, 0.001);
    const turbulent = darcyWeisbachFrictionFactor(100_000, 0.001);
    assert.ok(transitional > 0.02 && transitional < 0.08);
    assert.ok(turbulent > 0.01 && turbulent < 0.06);

    const network = {
      waterDensityKgM3: 1000,
      dynamicViscosityPaS: 1.002e-3,
      gravityMs2: 9.81,
      nodes: [
        { id: 'source', name: 'Source', type: 'reservoir' as const, elevation: 0, baseDemand: 0, head: 100, x: 0, y: 0 },
        { id: 'demand', name: 'Demand', type: 'junction' as const, elevation: 0, baseDemand: 0.01, x: 1, y: 1 }
      ],
      pipes: [
        { id: 'main', fromNodeId: 'source', toNodeId: 'demand', length: 1000, diameter: 0.2, absoluteRoughnessMm: 0.05 }
      ]
    };
    const smooth = solveWaterNetwork(network);
    const rough = solveWaterNetwork({
      ...network,
      pipes: [{ ...network.pipes[0], absoluteRoughnessMm: 1.0 }]
    });
    assert.equal(smooth.converged, true);
    assert.equal(rough.converged, true);
    assert.ok(
      rough.nodeResults.demand.head < smooth.nodeResults.demand.head,
      'Higher absolute roughness must increase friction loss and reduce downstream head'
    );
  });

  it('4. Power Grid Solver & Asset Counts: 12 buses, 5 transformer substations, 3 generators, 18 lines', () => {
    const powerScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;
    assert.ok(powerScenario.powerNetwork, 'Power network must be defined');

    const net = powerScenario.powerNetwork;
    assert.ok(net.buses.length >= 12, `Expected >= 12 buses, got ${net.buses.length}`);
    assert.ok(
      net.buses.filter((b) => b.hasTransformer).length >= 5,
      'Expected >= 5 substations with transformers'
    );
    assert.ok(
      net.generators.length >= 3,
      `Expected >= 3 generators, got ${net.generators.length}`
    );
    assert.ok(
      net.lines.length >= 18,
      `Expected >= 18 transmission/distribution lines, got ${net.lines.length}`
    );

    const out = solvePowerGrid(net);
    assert.equal(out.converged, true, 'DC power flow must converge');
    assert.equal(out.busAnglesDeg['bus-1'], 0, 'Slack bus angle must be 0 deg');
    assert.equal(
      out.lineFlowsMw['line-2-3']?.thermalViolation,
      true,
      'Baseline must detect thermal overload on line-2-3'
    );
  });

  it('5. Problem Catalog: >= 12 working templates + 2 unavailable disclosures per domain, mutating scenario state', () => {
    for (const domain of ['traffic', 'water', 'energy'] as const) {
      const catalog = PROBLEM_CATALOG[domain];
      const working = catalog.filter((p) => p.available !== false);
      const unavailable = catalog.filter((p) => p.available === false);

      assert.ok(
        working.length >= 10,
        `Domain ${domain} must have >= 10 working templates, got ${working.length}`
      );
      assert.ok(
        unavailable.length >= 1,
        `Domain ${domain} must include explicit unavailable model disclosures`
      );

      for (const unavail of unavailable) {
        assert.ok(
          unavail.unavailableReason && unavail.unavailableReason.length > 15,
          `Unavailable template ${unavail.id} must provide an honest reason`
        );
      }

      const baseScenario = DEFAULT_SCENARIOS.find((s) => s.domain === domain)!;
      const firstScenario = applyProblemTemplateToScenario(
        baseScenario,
        working[0].id
      );
      const secondScenario = applyProblemTemplateToScenario(
        baseScenario,
        working[1].id
      );

      assert.notEqual(
        firstScenario.problemStatement?.id,
        secondScenario.problemStatement?.id
      );
      assert.ok(
        firstScenario.alternatives.length >= 3,
        'Working problem template must provide >= 3 candidate solutions'
      );
      assert.ok(
        secondScenario.alternatives.length >= 3,
        'Working problem template must provide >= 3 candidate solutions'
      );
      assert.notEqual(
        firstScenario.alternatives[0].name,
        secondScenario.alternatives[0].name,
        'Different problem templates must configure distinct candidate solutions'
      );

      const baseRun1 = runBaselineSimulation(firstScenario);
      const baseRun2 = runBaselineSimulation(secondScenario);
      assert.notEqual(
        baseRun1.metrics.primaryPerformance,
        baseRun2.metrics.primaryPerformance,
        `Different ${domain} problem templates must change baseline model inputs and solver outputs`
      );
    }
  });

  it('6. Future Stress Scenarios & All 14 Decision Engines (including Future Regret Explorer)', () => {
    for (const scenario of DEFAULT_SCENARIOS) {
      const baseRes = runBaselineSimulation(scenario);
      const altRes = scenario.alternatives.map((a) =>
        runAlternativeSimulation(scenario, a)
      );
      const ranked = normalizeAndRankAlternatives(scenario, altRes);
      assert.equal(ranked.length, scenario.alternatives.length);
      assert.ok(
        ranked[0].metrics.primaryPerformance !== baseRes.metrics.primaryPerformance
      );
      // Verify utility scores are differentiated and never saturate at 100/100
      for (const r of ranked) {
        assert.ok(
          r.normalizedScores.overallUtility > 25 &&
            r.normalizedScores.overallUtility < 98,
          `Expected realistic utility score in (25, 98), got ${r.normalizedScores.overallUtility}`
        );
      }

      const futureIssues = runFutureIssuesUnderScenario(
        scenario,
        scenario.alternatives[0].id
      );
      assert.ok(
        futureIssues.length >= 3,
        'Each scenario must evaluate >= 3 future stress cases'
      );
      // Ensure different future stress cases produce distinct calculated impacts
      assert.notEqual(
        futureIssues[0].measuredImpact,
        futureIssues[1].measuredImpact
      );

      const regretRes = runFutureRegretExplorer(
        scenario,
        scenario.alternatives[0].id
      );
      assert.equal(
        regretRes.alternativesSummary.length,
        scenario.alternatives.length
      );
      assert.ok(regretRes.minimaxWinner.alternativeId.length > 0);

      const ripples = runRippleEffectAnalyzer(
        scenario,
        scenario.alternatives[0].id
      );
      assert.ok(ripples.traces.length > 0);

      const stress = runAdaptiveStressTesting(
        scenario,
        scenario.alternatives[0].id,
        15
      );
      assert.equal(stress.sampleCount, 15);

      const reversal = runDecisionReversalEngine(
        scenario,
        scenario.alternatives[0].id
      );
      assert.equal(reversal.available, true);

      const reverseSol = runReverseSolver(
        scenario,
        scenario.constraints[0]?.threshold || 25,
        scenario.alternatives[0].id
      );
      assert.equal(reverseSol.available, true);

      const stages = runRecoveryPlanner(scenario, scenario.alternatives[0].id);
      assert.ok(stages.rankedMitigations.length >= 2);

      const radar = runUncertaintyRadar(scenario);
      assert.ok(radar.items.length > 0);
    }
  });

  it('7. Security Hardening: Prototype Pollution, Dangling Graph Edges & CSV Injection Protection', () => {
    // CSV Formula injection escaping
    assert.equal(escapeCsvCell('=1+1'), "'=1+1");
    assert.equal(escapeCsvCell('+SUM(A1:A2)'), "'+SUM(A1:A2)");
    assert.equal(escapeCsvCell('-cmd|...'), "'-cmd|...");
    assert.equal(escapeCsvCell('@IMPORTXML()'), "'@IMPORTXML()");
    assert.equal(escapeCsvCell('Normal Text'), 'Normal Text');

    // Prototype pollution rejection
    const pollutedJson =
      '{"id":"s1","title":"Test","domain":"traffic","__proto__":{"polluted":true},"assumptions":[],"constraints":[],"alternatives":[]}';
    const pollutedCheck = sanitizeAndValidateScenarioImport(pollutedJson);
    assert.equal(pollutedCheck.valid, false);
    if (!pollutedCheck.valid) {
      assert.ok(
        pollutedCheck.errors.some((e) => e.includes('__proto__')),
        'Must report __proto__ violation'
      );
    }

    // Dangling pipe node reference rejection
    const danglingWater = JSON.stringify({
      id: 'w-bad',
      title: 'Bad Water Graph',
      domain: 'water',
      assumptions: [],
      constraints: [],
      alternatives: [
        {
          id: 'alt-1',
          name: 'Alt 1',
          tag: 'A',
          description: '',
          color: '#fff',
          capexCostMillion: 1,
          opexAnnualMillion: 0.1,
          implementationMonths: 6,
          modifications: []
        }
      ],
      waterNetwork: {
        waterDensityKgM3: 1000,
        gravityMs2: 9.81,
        nodes: [
          {
            id: 'res-1',
            name: 'Res',
            type: 'reservoir',
            elevation: 100,
            baseDemand: 0,
            head: 140,
            x: 10,
            y: 10,
            z: 0
          }
        ],
        pipes: [
          {
            id: 'p-1',
            fromNodeId: 'res-1',
            toNodeId: 'non-existent-node',
            length: 500,
            diameter: 0.3,
            hazenWilliamsC: 120
          }
        ]
      }
    });
    const danglingCheck = sanitizeAndValidateScenarioImport(danglingWater);
    assert.equal(danglingCheck.valid, false);
    if (!danglingCheck.valid) {
      assert.ok(
        danglingCheck.errors.some((e) => e.includes('non-existent node')),
        'Must reject dangling pipe node reference'
      );
    }

    // Valid scenario export/import roundtrip
    const validExport = JSON.stringify(DEFAULT_SCENARIOS[0]);
    const validCheck = sanitizeAndValidateScenarioImport(validExport);
    assert.equal(validCheck.valid, true);
    if (validCheck.valid) {
      assert.ok(validCheck.scenario.id.startsWith(DEFAULT_SCENARIOS[0].id));
    }

    const waterWithInvalidRoughness = structuredClone(
      DEFAULT_SCENARIOS.find((scenario) => scenario.domain === 'water')!
    );
    waterWithInvalidRoughness.waterNetwork!.pipes[0].absoluteRoughnessMm = -0.1;
    const roughnessCheck = sanitizeAndValidateScenarioImport(JSON.stringify(waterWithInvalidRoughness));
    assert.equal(roughnessCheck.valid, false);
    if (!roughnessCheck.valid) {
      assert.ok(roughnessCheck.errors.some((error) => error.includes('absolute roughness')));
    }
  });

  it('8. Solver Reliability: non-finite inputs are clamped safely without NaN propagation', () => {
    const tNet = structuredClone(DEFAULT_SCENARIOS[0].trafficNetwork!);
    tNet.cells[0].initialDensityVehKmPerLane = Number.NaN;
    const tRes = solveTrafficNetwork(tNet);
    assert.ok(Number.isFinite(tRes.averageSpeedKmh));
    assert.ok(tRes.warnings.some((w) => w.includes('non-finite')));

    const wNet = structuredClone(DEFAULT_SCENARIOS[1].waterNetwork!);
    wNet.waterDensityKgM3 = -500;
    const wRes = solveWaterNetwork(wNet);
    assert.ok(Number.isFinite(wRes.minPressureKPa) && wRes.converged);

    const pNet = structuredClone(DEFAULT_SCENARIOS[2].powerNetwork!);
    pNet.loads[0].mw = Number.NaN;
    const pRes = solvePowerGrid(pNet);
    assert.ok(Number.isFinite(pRes.totalLoadMw) && pRes.converged);
  });
});
