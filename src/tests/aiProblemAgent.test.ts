import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import {
  applyAIProblemDraftToScenario,
  buildAIProblemContext,
  getAIAllowedParameters,
  validateAIProblemDraft
} from '../models/aiProblemAgent';
import { cleanContext } from '../server/agentApp';
import {
  explainMyDecision,
  normalizeAndRankAlternatives,
  composeAlternativeSequence,
  runAlternativeSimulation,
  runBaselineSimulation,
  runFutureIssuesUnderScenario
} from '../models/decisionEngines';

describe('WhatIf AI scenario draft validation and solver handoff', () => {
  const traffic = DEFAULT_SCENARIOS.find((scenario) => scenario.domain === 'traffic')!;
  const available = getAIAllowedParameters(traffic);
  const signal = (assetId: string) => available.find((item) => item.targetId === assetId && item.property === 'signalGreenRatio')!;
  const lanes = (assetId: string) => available.find((item) => item.targetId === assetId && item.property === 'lanes')!;

  const validResponse = {
    title: 'Peak-hour campus access bottleneck',
    description: 'Demand exceeds the modeled arterial and signal capacity during the morning peak.',
    measurableSymptom: 'Queue density and speed limits are evaluated by the traffic solver.',
    baselineChanges: [
      { targetId: signal('cell-hub-1').targetId, property: 'signalGreenRatio', newValue: 0.42, rationale: 'Represent the reported short green phase.' }
    ],
    alternatives: [
      { name: 'Retimed signal plan', description: 'Adjust the constrained approach green time.', modifications: [{ targetId: signal('cell-hub-1').targetId, property: 'signalGreenRatio', newValue: 0.68, rationale: 'Increase available discharge time.' }] },
      { name: 'Add an approach lane', description: 'Expand modeled capacity at the gateway.', modifications: [{ targetId: lanes('cell-hub-1').targetId, property: 'lanes', newValue: 3, rationale: 'Increase modeled lane capacity.' }] },
      { name: 'Coordinate upstream inflow', description: 'Retune the upstream signal and protect downstream queue storage.', modifications: [{ targetId: signal('cell-hub-2').targetId, property: 'signalGreenRatio', newValue: 0.62, rationale: 'Coordinate the next junction.' }] }
    ],
    futureCases: [
      { name: 'Demand growth', horizonYears: 5, multiplier: 1.25, parameterShift: 'Peak demand +25%', description: 'Conditional demand stress case.' },
      { name: 'Event arrival surge', horizonYears: 8, multiplier: 1.4, parameterShift: 'Peak demand +40%', description: 'Conditional campus event stress case.', contingencyAssetId: 'cell-nw-in' },
      { name: 'Lane disruption', horizonYears: 3, multiplier: 1.15, parameterShift: 'Demand +15%', description: 'Conditional demand and link disruption case.', contingencyAssetId: 'cell-ring-north' }
    ],
    assumptions: ['Demand profile is a planning assumption until counts are supplied.'],
    missingData: ['Observed turning counts and calibrated origin-destination demand.']
  };

  it('sends only allowed solver inputs and calculates AI proposals with the traffic solver', () => {
    const context = buildAIProblemContext(traffic);
    assert.ok(context.parameters.length >= 30);
    assert.ok(context.parameters.every((parameter) => Number.isFinite(parameter.min) && parameter.max >= parameter.min));

    const draft = validateAIProblemDraft(validResponse, traffic);
    const scenario = applyAIProblemDraftToScenario(traffic, draft, 'nambur', 'New layout near Nambur');
    assert.equal(scenario.studyAreaPlaceId, 'nambur');
    assert.equal(scenario.studyAreaLabel, 'New layout near Nambur');
    assert.equal(scenario.alternatives.length, 3);
    assert.equal(scenario.futureScenarios?.length, 3);
    assert.equal(scenario.problemStatement?.dataSource.includes('synthetic solver topology'), true);
    assert.equal(scenario.alternatives[0].costDataStatus, 'not-estimated');
    assert.equal(scenario.alternatives[0].scheduleDataStatus, 'not-estimated');
    assert.equal(scenario.alternatives[0].capexCostMillion, 0);
    assert.equal(scenario.alternatives[0].implementationMonths, 0);

    const baseline = runBaselineSimulation(scenario);
    const optionResults = scenario.alternatives.map((alternative) => runAlternativeSimulation(scenario, alternative));
    const future = runFutureIssuesUnderScenario(scenario, scenario.alternatives[0].id);
    assert.equal(baseline.rawOutput.domain, 'traffic');
    assert.equal(optionResults.length, 3);
    assert.ok(optionResults.every((result) => result.rawOutput.domain === 'traffic'));
    assert.ok(optionResults.every((result) => result.costDataStatus === 'not-estimated'));
    assert.ok(optionResults.every((result) => result.metrics.totalCostMillion === 0));
    if (scenario.constraints.some((constraint) => constraint.metricKey === 'cost')) {
      assert.ok(optionResults.every((result) => result.unverifiedConstraints?.some((item) => item.includes('cost data not provided'))));
    }
    const ranked = normalizeAndRankAlternatives(scenario, optionResults);
    assert.ok(ranked.every((result) => result.normalizedScores.costNorm === 0.5));
    assert.ok(ranked.every((result) => result.normalizedScores.riskNorm === 0.5));
    const explanation = explainMyDecision(scenario, scenario.alternatives[0].id);
    assert.equal(explanation.metricDetails[1].preferredValue, 'Not estimated');
    assert.ok(explanation.traceableRationale.includes('Cost was excluded'));
    assert.equal(future.length, 3);
    assert.ok(future.every((result) => ['Breached', 'Warning', 'Clear'].includes(result.status)));
  });

  it('composes two interventions in order and re-solves the combined network', () => {
    const draft = validateAIProblemDraft(validResponse, traffic);
    const scenario = applyAIProblemDraftToScenario(traffic, draft, 'nambur');
    const first = scenario.alternatives[0];
    const laterValue = first.modifications[0].newValue === 0.72 ? 0.63 : 0.72;
    const followUp = {
      ...scenario.alternatives[1],
      modifications: [{ ...first.modifications[0], originalValue: -100, newValue: laterValue }]
    };
    const sequence = composeAlternativeSequence(first, followUp);
    assert.equal(sequence.modifications.length, first.modifications.length);
    assert.equal(sequence.modifications[0].originalValue, first.modifications[0].newValue);
    assert.equal(sequence.modifications[0].newValue, laterValue);
    assert.equal(sequence.costDataStatus, 'not-estimated');
    assert.equal(runAlternativeSimulation(scenario, sequence).rawOutput.domain, 'traffic');
  });

  it('rejects unsupported asset parameters and out-of-range AI proposals', () => {
    const invalidProperty = structuredClone(validResponse);
    invalidProperty.alternatives[0].modifications[0].property = 'inventedImpactScore';
    assert.throws(() => validateAIProblemDraft(invalidProperty, traffic), /unsupported parameter/);

    const invalidValue = structuredClone(validResponse);
    invalidValue.alternatives[0].modifications[0].newValue = 999;
    assert.throws(() => validateAIProblemDraft(invalidValue, traffic), /out-of-range/);
  });

  it('validates cleanContext compatibility across traffic, water, and energy domains', () => {
    for (const domain of ['traffic', 'water', 'energy'] as const) {
      const scenario = DEFAULT_SCENARIOS.find((s) => s.domain === domain)!;
      const context = buildAIProblemContext(scenario);
      const cleaned = cleanContext(context, domain);
      assert.equal(cleaned.parameters.length, context.parameters.length);
      if (domain === 'water') {
        assert.ok(cleaned.parameters.some((p) => p.property === 'absoluteRoughnessMm'));
      }
    }
  });
});
