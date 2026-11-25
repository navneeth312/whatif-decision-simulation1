import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import {
  runAlternativeSimulation,
  runBaselineDiagnosis,
  runBaselineSimulation,
  runFutureIssuesUnderScenario,
  normalizeAndRankAlternatives
} from '../models/decisionEngines';
import { answerOfflineProblemQuestion } from '../models/offlineProblemAssistant';

describe('offline WhatIf problem assistant', () => {
  const scenario = DEFAULT_SCENARIOS.find((entry) => entry.domain === 'traffic')!;
  const baselineResult = runBaselineSimulation(scenario);
  const alternatives = normalizeAndRankAlternatives(
    scenario,
    scenario.alternatives.map((alternative) => runAlternativeSimulation(scenario, alternative))
  );
  const selectedResult = alternatives[0] || baselineResult;
  const futureOutcomes = runFutureIssuesUnderScenario(scenario, selectedResult.alternativeId);
  const context = {
    scenario,
    activeProblem: scenario.problemStatement,
    baselineResult,
    selectedResult,
    alternatives,
    baselineProblems: runBaselineDiagnosis(scenario),
    futureOutcomes
  };

  it('answers current-problem questions with configured solver diagnostics', () => {
    const answer = answerOfflineProblemQuestion('What is happening now?', context);
    assert.ok(answer.includes(scenario.problemStatement?.title || scenario.title));
    assert.ok(answer.includes('Configured baseline diagnostics (unmodified scenario)'));
    if (context.baselineProblems.length > 0) {
      assert.ok(answer.includes('selected alternative is evaluated separately'));
      assert.ok(!answer.includes('The baseline feasibility flag is pass.'));
    }
    assert.ok(answer.includes('threshold'));
  });

  it('compares solver-run alternatives and avoids claiming a safe option when none is feasible', () => {
    const answer = answerOfflineProblemQuestion('Which solution is best?', context);
    assert.ok(answer.includes('Solver-tested options'));
    assert.ok(answer.includes('/100'));
    assert.ok(answer.includes('hard constraints'));
  });

  it('describes future outcomes as conditional stress tests, not forecasts', () => {
    const answer = answerOfflineProblemQuestion('What could happen in the future?', context);
    assert.ok(answer.includes('conditional stress-test results, not forecasts'));
    assert.ok(answer.includes(futureOutcomes[0]?.name || 'No future stress cases'));
  });

  it('requires the matching domain model when a question is for another domain', () => {
    const answer = answerOfflineProblemQuestion('Why is water pressure low?', context);
    assert.ok(answer.includes('currently using the traffic solver'));
    assert.ok(answer.includes('Water Distribution'));
  });

  it('refuses numerical answers for explicitly unmodeled problem statements', () => {
    const unsupportedProblem = {
      ...scenario.problemStatement!,
      title: 'Water contamination',
      available: false,
      unavailableReason: 'Water quality is not modeled by this solver.'
    };
    const answer = answerOfflineProblemQuestion('What is happening now?', {
      ...context,
      activeProblem: unsupportedProblem
    });
    assert.ok(answer.includes('not calculated'));
    assert.ok(answer.includes('will not invent a numerical answer'));
  });

  it('answers cause/bottleneck, risk/trade-off, and next-step/cost questions deterministically', () => {
    const causeAnswer = answerOfflineProblemQuestion('What is causing this bottleneck?', context);
    assert.ok(causeAnswer.includes('Solver-observed bottleneck mechanisms'));
    assert.ok(causeAnswer.includes('Baseline threshold diagnostics'));

    const riskAnswer = answerOfflineProblemQuestion('What could go wrong?', context);
    assert.ok(riskAnswer.includes('Risks, trade-offs, and safeguards'));
    assert.ok(riskAnswer.includes('Model constraint check:'));

    const nextStepsAnswer = answerOfflineProblemQuestion('What should we do next and what does it cost?', context);
    assert.ok(nextStepsAnswer.includes('Practical next steps & planning estimate'));
    assert.ok(nextStepsAnswer.includes('Budget & timeline:'));
  });
});
