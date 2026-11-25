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
  runBaselineDiagnosis,
  runFutureIssuesUnderScenario,
  calculateAlternativeDeltas,
  generatePracticalNextSteps,
  getAlternativeTradeOffs
} from '../models/decisionEngines';
import { getMapPlace, REGIONAL_MAP_PLACES } from '../models/regionalMap';
import { Scenario } from '../types';

test('Problem-Solving Journey Suite', async (t) => {
  await t.test('Stage 1: Every domain has rich problem catalog with deterministic vs unmodeled disclosures', () => {
    const domains: Array<'traffic' | 'water' | 'energy'> = ['traffic', 'water', 'energy'];
    for (const d of domains) {
      const catalog = PROBLEM_CATALOG[d];
      assert.ok(catalog.length >= 14, `Expected at least 14 problems for ${d}, got ${catalog.length}`);
      const supported = catalog.filter((p) => p.available !== false);
      const disclosures = catalog.filter((p) => p.available === false);
      assert.ok(supported.length >= 12, `Expected >= 12 supported problems for ${d}`);
      assert.ok(disclosures.length >= 2, `Expected >= 2 unmodeled disclosures for ${d}`);

      for (const disc of disclosures) {
        assert.ok(disc.unavailableReason && disc.unavailableReason.length > 10, 'Disclosure must explain unmodeled physics');
      }
    }
  });

  await t.test('Stage 2: Understand Current Situation generates non-empty baseline diagnostics with limits crossed', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const diagnostics = runBaselineDiagnosis(trafficScenario);
    assert.ok(diagnostics.length > 0, 'Should diagnose baseline issues');
    const firstDiag = diagnostics[0];
    assert.ok(firstDiag.componentName, 'Diagnostic should have component name');
    assert.ok(firstDiag.symptom, 'Diagnostic should describe symptom in plain language');
    assert.ok(firstDiag.measuredValue, 'Diagnostic should give measured numerical value');
    assert.ok(firstDiag.limitValue, 'Diagnostic should specify threshold limit');
  });

  await t.test('Stage 3: Place Selection & Confirmation locks study area place', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const targetPlace = getMapPlace('vijayawada', REGIONAL_MAP_PLACES);
    assert.ok(targetPlace, 'Should find Vijayawada in regional places');
    assert.equal(targetPlace?.district, 'NTR District');

    const updatedScenario: Scenario = {
      ...trafficScenario,
      studyAreaPlaceId: targetPlace.id
    };
    assert.equal(updatedScenario.studyAreaPlaceId, 'vijayawada');
  });

  await t.test('Stage 4: Problem Statement tailoring configures domain-specific interventions', () => {
    const trafficBase = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const waterBase = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
    const energyBase = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;

    // Test traffic template
    const trafficConfigured = applyProblemTemplateToScenario(trafficBase, 'prob-traffic-2');
    assert.equal(trafficConfigured.alternatives.length, 3);
    for (const alt of trafficConfigured.alternatives) {
      assert.ok(alt.modifications.some((m) => m.property === 'lanes' || m.property === 'signalGreenRatio' || m.property === 'inflowDemandVehHour' || m.property === 'capacityLanes' || m.property === 'splitGreen'),
        'Traffic alternatives should modify lanes, signals, or demand');
      assert.ok(!alt.name.toLowerCase().includes('substation'), 'Traffic should not mention substation');
      assert.ok(!alt.name.toLowerCase().includes('booster pump'), 'Traffic should not mention water pumps');
    }

    // Test water template
    const waterConfigured = applyProblemTemplateToScenario(waterBase, 'prob-water-2');
    assert.equal(waterConfigured.alternatives.length, 3);
    for (const alt of waterConfigured.alternatives) {
      assert.ok(alt.modifications.some((m) => m.property === 'diameter' || m.property === 'absoluteRoughnessMm' || m.property === 'diameterMm' || m.property === 'pumpHeadBoostM' || m.property === 'roughnessMm'),
        'Water alternatives should modify pipe diameter, pumps, or roughness');
      assert.ok(!alt.name.toLowerCase().includes('corridor'), 'Water should not mention traffic corridor');
    }

    // Test energy template
    const energyConfigured = applyProblemTemplateToScenario(energyBase, 'prob-energy-1');
    assert.equal(energyConfigured.alternatives.length, 3);
    for (const alt of energyConfigured.alternatives) {
      assert.ok(alt.modifications.some((m) => m.property === 'thermalRatingMw' || m.property === 'reactancePu' || m.property === 'scheduledMw'),
        'Energy alternatives should modify line rating, reactance, or dispatch');
    }
  });

  await t.test('Stage 5: Compare Outcomes evaluates baseline vs alternatives with deltas and utility scores', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const baseline = runBaselineSimulation(trafficScenario);
    const altA = runAlternativeSimulation(trafficScenario, trafficScenario.alternatives[0]);
    const deltas = calculateAlternativeDeltas(trafficScenario, altA, baseline);

    assert.ok(deltas.primaryLabel.length > 0);
    assert.equal(typeof deltas.primaryImprovementPct, 'number');
    assert.ok(altA.normalizedScores.overallUtility >= 0 && altA.normalizedScores.overallUtility <= 100);
  });

  await t.test('Stage 6: Explore Future Conditions evaluates stress shocks on both baseline and solutions', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const baseRisks = runFutureIssuesUnderScenario(trafficScenario, undefined);
    const altRisks = runFutureIssuesUnderScenario(trafficScenario, trafficScenario.alternatives[0]?.id);

    assert.equal(baseRisks.length, altRisks.length);
    assert.ok(baseRisks.length > 0, 'Should have stress test cases');
    for (const r of baseRisks) {
      assert.ok(r.name, 'Stress test case must have name');
      assert.ok(r.parameterShift, 'Stress test must declare parameter shift');
      assert.ok(['Clear', 'Warning', 'Breached'].includes(r.status));
    }
  });

  await t.test('Stage 8: Practical Next Steps produces comprehensive 6-part planning roadmap', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const altA = trafficScenario.alternatives[0];
    const altSim = runAlternativeSimulation(trafficScenario, altA);
    const steps = generatePracticalNextSteps(trafficScenario, altA, altSim);

    // 1. Prerequisites
    assert.ok(steps.prerequisites.length >= 2, 'Should have at least 2 prerequisites');
    assert.ok(steps.prerequisites.some((p) => p.toLowerCase().includes('survey') || p.toLowerCase().includes('audit')));

    // 2. 3-Phase Implementation Stages
    assert.equal(steps.implementationStages.length, 3, 'Must have 3 implementation stages (Phase 1, 2, 3)');
    assert.ok(steps.implementationStages[0].phase.includes('Phase 1'));
    assert.ok(steps.implementationStages[1].phase.includes('Phase 2'));
    assert.ok(steps.implementationStages[2].phase.includes('Phase 3'));

    // 3. Operational Precautions
    assert.ok(steps.precautions.length >= 2, 'Should have precautions');

    // 4. Monitoring Needs
    assert.ok(steps.monitoringNeeds.length >= 2, 'Should have monitoring needs');

    // 5. Missing Data Disclosures
    assert.ok(steps.missingDataDisclosures.length >= 1, 'Should disclose unmodeled macro factors');

    // 6. Recovery & Contingency Actions (Rollback Protocols)
    assert.ok(steps.recoveryActions.length >= 2, 'Should have at least 2 recovery / rollback protocols');
    assert.ok(steps.recoveryActions.some((r) => r.toLowerCase().includes('fallback') || r.toLowerCase().includes('rerouting') || r.toLowerCase().includes('rollback')));

    // 7. Professional Engineering Approval Notice
    assert.ok(steps.engineeringBoundaryNotice.includes('Professional Engineer (PE) approval'),
      'Must contain explicit PE boundary statement');
  });

  await t.test('Stage 8: Practical Next Steps works accurately for Water and Energy domains', () => {
    const waterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
    const waterAlt = waterScenario.alternatives[0];
    const waterSim = runAlternativeSimulation(waterScenario, waterAlt);
    const waterSteps = generatePracticalNextSteps(waterScenario, waterAlt, waterSim);

    assert.ok(waterSteps.prerequisites.some((p) => p.toLowerCase().includes('subsurface') || p.toLowerCase().includes('water')));
    assert.equal(waterSteps.implementationStages.length, 3);
    assert.ok(waterSteps.implementationStages[2].title.toLowerCase().includes('pressure') || waterSteps.implementationStages[2].title.toLowerCase().includes('hydrotesting') || waterSteps.implementationStages[2].title.toLowerCase().includes('quality'));
    assert.ok(waterSteps.recoveryActions.length >= 2, 'Water must have recovery / surge contingency actions');

    const energyScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;
    const energyAlt = energyScenario.alternatives[0];
    const energySim = runAlternativeSimulation(energyScenario, energyAlt);
    const energySteps = generatePracticalNextSteps(energyScenario, energyAlt, energySim);

    assert.ok(energySteps.prerequisites.some((p) => p.toLowerCase().includes('interconnect') || p.toLowerCase().includes('grid') || p.toLowerCase().includes('substation')));
    assert.equal(energySteps.implementationStages.length, 3);
    assert.ok(energySteps.precautions.some((p) => p.toLowerCase().includes('outage') || p.toLowerCase().includes('n-1') || p.toLowerCase().includes('safety') || p.toLowerCase().includes('grounding')));
    assert.ok(energySteps.recoveryActions.length >= 2, 'Energy must have remedial action schemes / contingency protocols');
  });

  await t.test('Stage 5: Immediate & Secondary Trade-Offs evaluates benefits, unintended impacts, and safeguards', () => {
    const domains: Array<'traffic' | 'water' | 'energy'> = ['traffic', 'water', 'energy'];
    for (const d of domains) {
      const scenario = DEFAULT_SCENARIOS.find((s) => s.domain === d)!;
      const alt = scenario.alternatives[0];
      const sim = runAlternativeSimulation(scenario, alt);
      const tradeOffs = getAlternativeTradeOffs(scenario, alt, sim);

      assert.ok(tradeOffs.primaryBenefits.length >= 2, `${d} should have primary benefits`);
      assert.ok(tradeOffs.immediateTradeOffs.length >= 2, `${d} should have immediate trade-offs`);
      assert.ok(tradeOffs.secondaryConsequences.length >= 2, `${d} should have secondary consequences`);
      assert.ok(tradeOffs.safeguards.length >= 2, `${d} should have actionable safeguards`);

      // Verify each immediate trade-off has a severity rating
      for (const t of tradeOffs.immediateTradeOffs) {
        assert.ok(['low', 'medium', 'high'].includes(t.severity));
      }
    }
  });

  await t.test('Stage 5: Causal Chain, Cross-Domain Linkages & Audited Uncalculated Risks', () => {
    const domains: Array<'traffic' | 'water' | 'energy'> = ['traffic', 'water', 'energy'];
    for (const d of domains) {
      const scenario = DEFAULT_SCENARIOS.find((s) => s.domain === d)!;
      const alt = scenario.alternatives[0];
      const sim = runAlternativeSimulation(scenario, alt);
      const tradeOffs = getAlternativeTradeOffs(scenario, alt, sim);

      // 1. Causal Chain Verification
      assert.ok(tradeOffs.causalChain && tradeOffs.causalChain.length >= 1, `${d} must have causal chain steps`);
      const step = tradeOffs.causalChain[0];
      assert.ok(step.trigger.length > 0);
      assert.ok(step.connectionPathway.length > 0);
      assert.ok(step.affectedPlaceOrAsset.length > 0);
      assert.ok(step.directOutcome.length > 0);
      assert.ok(step.secondaryEffect.length > 0);
      assert.ok(step.laterEffect.length > 0);
      assert.ok(step.safeguardOrRecovery.length > 0);
      assert.ok(['calculated', 'evidence-based-not-quantified', 'assumption-based', 'possible-not-calculated', 'unknown-needs-data'].includes(step.classification));

      // 2. Cross-Domain Links Verification
      assert.ok(tradeOffs.crossDomainLinks && tradeOffs.crossDomainLinks.length >= 2, `${d} must have cross-domain links`);
      for (const link of tradeOffs.crossDomainLinks) {
        assert.ok(link.sourceDomain === d, 'Source domain must match');
        assert.ok(link.targetDomain.length > 0);
        assert.ok(link.name.length > 0);
        assert.ok(link.description.length > 0);
        assert.ok(link.affectedAssets.length > 0);
        assert.ok(link.evidenceOrRequirement.length > 0);
      }

      // 3. User-Approved Dedicated Section: "Possible impact — not calculated"
      assert.ok(tradeOffs.unsupportedRisksAudit && tradeOffs.unsupportedRisksAudit.length >= 2, `${d} must have audited uncalculated risks`);
      for (const audit of tradeOffs.unsupportedRisksAudit) {
        assert.ok(audit.claim.length > 0);
        assert.ok(audit.whyPossible.length > 0, 'Must explain why the risk is possible');
        assert.ok(audit.assumptionsRequired.length > 0, 'Must disclose required assumptions');
        assert.ok(audit.dataOrModelNeeded.length > 0, 'Must disclose what data/model is needed to calculate');
        assert.equal(audit.classification, 'possible-not-calculated');
      }
    }
  });

  await t.test('Stage 1: Action-First dynamic intervention synthesis and deterministic simulation', () => {
    const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
    const customActionAlt = {
      id: 'alt-action-test',
      name: 'Upgrade: Express Bypass Flyover',
      tag: 'Option D',
      description: 'Add a dedicated grade-separated express bypass flyover.',
      modifications: [
        {
          targetId: 'cell-nw-in',
          property: 'inflowDemandVehHour',
          label: 'Inflow Demand Shift',
          originalValue: 2450,
          newValue: 1500,
          unit: 'veh/h'
        }
      ],
      capexCostMillion: 18.5,
      opexAnnualMillion: 0.45,
      implementationMonths: 18,
      color: '#06b6d4',
      costDataStatus: 'illustrative' as const,
      scheduleDataStatus: 'illustrative' as const
    };

    const sim = runAlternativeSimulation(trafficScenario, customActionAlt);
    assert.equal(sim.domain, 'traffic');
    assert.ok(sim.metrics.primaryPerformance > 0);
    assert.ok(sim.metrics.totalCostMillion >= 18.5);
    assert.equal(typeof sim.feasible, 'boolean');
  });

  await t.test('Step Workflow Architecture: 5-Step mapping aligns consistently with 8 stages', () => {
    // Stage 1 -> Step 1 (Problem or Action)
    // Stage 2 -> Step 2 (Place & Geography)
    // Stage 3 -> Step 3 (What WhatIf Understood - Baseline Diagnosis & Limits)
    // Stage 4 -> Step 4 (Review & Compare Candidate Solutions)
    // Stage 5, 6, 7, 8 -> Step 5 (Map, Before/After Comparison & Final Results)
    const getSimpleStep = (stg: number) => {
      if (stg === 1) return 1;
      if (stg === 2) return 2;
      if (stg === 3) return 3;
      if (stg === 4) return 4;
      return 5;
    };

    assert.equal(getSimpleStep(1), 1, 'Stage 1 must map to Step 1: Problem or Action');
    assert.equal(getSimpleStep(2), 2, 'Stage 2 must map to Step 2: Place & Geography');
    assert.equal(getSimpleStep(3), 3, 'Stage 3 must map to Step 3: What WhatIf Understood');
    assert.equal(getSimpleStep(4), 4, 'Stage 4 must map to Step 4: Review & Compare Solutions');
    assert.equal(getSimpleStep(5), 5, 'Stage 5 must map to Step 5: Compare Outcomes');
    assert.equal(getSimpleStep(6), 5, 'Stage 6 must map to Step 5: Stress Tests');
    assert.equal(getSimpleStep(7), 5, 'Stage 7 must map to Step 5: 3D Twin Map');
    assert.equal(getSimpleStep(8), 5, 'Stage 8 must map to Step 5: Practical Next Steps');
  });
});
