import { DomainType, ProblemStatement, Scenario, AlternativeRunRecord } from '../types';
import { DiagnosedProblem, FutureIssueOutcome } from './decisionEngines';

export interface OfflineProblemAssistantContext {
  scenario: Scenario;
  activeProblem?: ProblemStatement;
  baselineResult: AlternativeRunRecord;
  selectedResult: AlternativeRunRecord;
  alternatives: AlternativeRunRecord[];
  baselineProblems: DiagnosedProblem[];
  futureOutcomes: FutureIssueOutcome[];
}

const DOMAIN_TERMS: Record<DomainType, string[]> = {
  traffic: ['traffic', 'road', 'roads', 'congestion', 'queue', 'vehicle', 'vehicles', 'signal', 'junction', 'commute'],
  water: ['water', 'neellu', 'pressure', 'pipe', 'pipes', 'pipeline', 'reservoir', 'tank', 'supply'],
  energy: ['energy', 'power', 'electric', 'electricity', 'grid', 'voltage', 'generator', 'vidyut', 'blackout']
};

function detectRequestedDomain(question: string): DomainType | null {
  const q = question.toLocaleLowerCase();
  const scores = (Object.entries(DOMAIN_TERMS) as [DomainType, string[]][])
    .map(([domain, terms]) => ({
      domain,
      score: terms.reduce((total, term) => total + (q.includes(term) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].domain : null;
}

function describeDiagnostics(problems: DiagnosedProblem[]): string {
  if (problems.length === 0) {
    return 'The baseline solver found no configured threshold breach or warning for this problem.';
  }
  return problems.slice(0, 4).map((problem) =>
    '• ' + problem.componentName + ': ' + problem.metricName + ' is ' +
    problem.measuredValue + '; required ' + problem.limitValue + '. ' + problem.severity + '.'
  ).join('\n');
}

function summarizeFuture(outcomes: FutureIssueOutcome[]): string {
  if (outcomes.length === 0) return 'No future stress cases are configured for this scenario.';
  return outcomes.slice(0, 4).map((outcome) => {
    const detail = outcome.violationsList.length > 0
      ? outcome.violationsList.join('; ')
      : outcome.limitComparison;
    return '• ' + outcome.name + ' (+' + outcome.horizonYears + ' years): ' +
      outcome.measuredImpact + '; ' + outcome.status + '. ' + detail;
  }).join('\n');
}

function summarizeCurrentResult(context: OfflineProblemAssistantContext): string {
  const { selectedResult, scenario } = context;
  const selectedAlternative = scenario.alternatives.find((alternative) =>
    alternative.id === selectedResult.alternativeId
  );
  const title = selectedAlternative?.name || 'Baseline (do nothing)';
  const status = selectedResult.feasible
    ? 'within the configured hard constraints'
    : 'has at least one configured constraint breach';
  const violations = selectedResult.constraintViolations.length > 0
    ? ' Reported issues: ' + selectedResult.constraintViolations.slice(0, 3).join('; ') + '.'
    : '';
  const unverified = selectedResult.unverifiedConstraints?.length
    ? ' Not checked by this model: ' + selectedResult.unverifiedConstraints.slice(0, 3).join('; ') + '.'
    : '';
  return title + ' is ' + status + '. Its solver metric is ' +
    selectedResult.metrics.primaryPerformance.toFixed(1) + ' ' +
    selectedResult.metrics.primaryPerformanceUnit + '; utility score ' +
    selectedResult.normalizedScores.overallUtility.toFixed(1) + '/100.' +
    violations + unverified;
}

export function answerOfflineProblemQuestion(
  question: string,
  context: OfflineProblemAssistantContext
): string {
  const q = question.trim().toLocaleLowerCase();
  const { scenario, activeProblem, baselineProblems, baselineResult, alternatives, futureOutcomes } = context;
  if (!q) return 'Type a question about the selected problem, solver results, possible solutions, or future stress cases.';

  const requestedDomain = detectRequestedDomain(q);
  if (requestedDomain && requestedDomain !== scenario.domain) {
    const domainName = requestedDomain === 'energy' ? 'Electrical Energy / Power Grid'
      : requestedDomain === 'water' ? 'Water Distribution'
      : 'Road Traffic';
    return 'This workspace is currently using the ' + scenario.domain +
      ' solver. Your question sounds like ' + domainName +
      '. Switch to a ' + requestedDomain +
      ' scenario first so I can use the matching model and results.';
  }

  if (activeProblem?.available === false) {
    return activeProblem.title + ' is not calculated by the current ' + scenario.domain +
      ' model. ' + (activeProblem.unavailableReason || 'The required physics are not implemented in this solver.') +
      ' I will not invent a numerical answer.';
  }

  const asksFuture = /\b(future|later|years|eventually|what happens next|long.term|tarvatha|future lo)\b/.test(q);
  const asksSolution = /\b(solution|solve|fix|improve|best|recommend|alternative|option|ela solve|em cheyali)\b/.test(q);
  const asksNow = /\b(now|current|today|baseline|problem|issue|why|cause|ippudu|enduku)\b/.test(q);
  const asksComparison = /\b(compare|difference|versus| vs |better|which one)\b/.test(q);

  const problemSummary = activeProblem
    ? activeProblem.title + ': ' + activeProblem.description +
      '\nMeasurable symptom: ' + activeProblem.measurableSymptom +
      '\nConfigured limit: ' + activeProblem.thresholdConstraint
    : scenario.title + ': ' + scenario.description;

  if (asksFuture) {
    return 'Possible future effects are conditional stress-test results, not forecasts.\n' +
      summarizeFuture(futureOutcomes) +
      '\n\nThese values come from the selected scenario\'s declared future cases and the ' +
      scenario.domain + ' solver.';
  }

  if (asksSolution || asksComparison) {
    const sorted = [...alternatives].sort((a, b) =>
      Number(b.feasible) - Number(a.feasible) ||
      b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
    );
    const options = sorted.slice(0, 3).map((result, index) =>
      '• ' + (index + 1) + '. ' + result.alternativeName +
      ': utility ' + result.normalizedScores.overallUtility.toFixed(1) + '/100; ' +
      (result.feasible ? 'passes configured hard constraints' : 'has a configured constraint breach') +
      '; ' + result.metrics.primaryPerformance.toFixed(1) + ' ' +
      result.metrics.primaryPerformanceUnit + '.'
    ).join('\n');
    const recommendation = sorted[0]?.feasible
      ? 'Among the tested options, ' + sorted[0].alternativeName +
        ' ranks highest while passing the configured hard constraints.'
      : 'None of the tested options passes every configured hard constraint, so this ranking is for comparison and is not a safe-to-build recommendation.';
    return problemSummary + '\n\nSolver-tested options:\n' +
      (options || 'No alternative runs are available.') + '\n\n' +
      recommendation +
      '\nCost and schedule comparisons may be incomplete when the scenario marks those values as not estimated.';
  }

  const baselineText = baselineResult.feasible
    ? 'The baseline feasibility flag is pass.'
    : 'The baseline feasibility flag is fail.';
  const baselineSummary = baselineProblems.length > 0
    ? 'These diagnostics describe the unmodified baseline run; the selected alternative is evaluated separately.'
    : baselineText + ' No baseline threshold diagnostics were reported.';
  const leading = asksNow
    ? problemSummary
    : 'For the selected problem, here is the current solver-grounded summary.\n' + problemSummary;
  return leading + '\n\nConfigured baseline diagnostics (unmodified scenario):\n' +
    describeDiagnostics(baselineProblems) +
    '\n\n' + baselineSummary + ' Selected run: ' + summarizeCurrentResult(context) +
    '\n\nThe solver reports modeled symptoms and threshold checks; it does not prove an unmeasured real-world root cause.';
}
