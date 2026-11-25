import { DomainType, ProblemStatement, Scenario, AlternativeRunRecord } from '../types';
import { formatCostEstimate } from '../utils/currencyFormatter';
import {
  DiagnosedProblem,
  FutureIssueOutcome,
  generatePracticalNextSteps,
  getAlternativeTradeOffs
} from './decisionEngines';

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

function summarizeRootBottlenecks(context: OfflineProblemAssistantContext): string[] {
  const { scenario, baselineResult } = context;
  const findings: string[] = [];
  const raw = baselineResult.rawOutput;

  if (raw.domain === 'traffic' && scenario.trafficNetwork) {
    const bottlenecks = raw.result.bottleneckCells;
    if (bottlenecks.length > 0) {
      const names = bottlenecks.slice(0, 3).map((id) => {
        const cell = scenario.trafficNetwork?.cells.find((c) => c.id === id);
        return cell ? `${cell.name} (${id})` : id;
      });
      findings.push(`Primary CTM bottleneck cell(s): ${names.join(', ')}.`);
    }
    const lastStep = raw.result.timeSteps[raw.result.timeSteps.length - 1];
    if (lastStep) {
      const slowest = Object.entries(lastStep.cellSpeeds).sort((a, b) => a[1] - b[1])[0];
      if (slowest) {
        const cell = scenario.trafficNetwork.cells.find((c) => c.id === slowest[0]);
        findings.push(
          `Slowest modeled segment at peak horizon: ${cell?.name || slowest[0]} at ${slowest[1].toFixed(1)} km/h ` +
          `(density ${(lastStep.cellDensities[slowest[0]] ?? 0).toFixed(1)} veh/km/lane).`
        );
      }
    }
  } else if (raw.domain === 'water' && scenario.waterNetwork) {
    const lowNodes = Object.entries(raw.result.nodeResults)
      .filter(([, n]) => n.lowPressureWarning || n.negativePressureWarning)
      .sort((a, b) => a[1].pressureKPa - b[1].pressureKPa);
    if (lowNodes.length > 0) {
      const worst = lowNodes[0];
      const nodeMeta = scenario.waterNetwork.nodes.find((n) => n.id === worst[0]);
      findings.push(
        `Lowest baseline service pressure: ${nodeMeta?.name || worst[0]} at ${worst[1].pressureKPa.toFixed(1)} kPa.`
      );
    }
    const topHeadLossPipe = Object.entries(raw.result.pipeResults)
      .sort((a, b) => b[1].headLossPerKm - a[1].headLossPerKm)[0];
    if (topHeadLossPipe) {
      findings.push(
        `Highest friction gradient: pipe ${topHeadLossPipe[0]} (${topHeadLossPipe[1].headLossPerKm.toFixed(1)} m/km, ` +
        `velocity ${topHeadLossPipe[1].velocityMs.toFixed(2)} m/s).`
      );
    }
  } else if (raw.domain === 'energy' && scenario.powerNetwork) {
    const topLines = Object.entries(raw.result.lineFlowsMw)
      .sort((a, b) => b[1].loadingPct - a[1].loadingPct)
      .slice(0, 2);
    if (topLines.length > 0) {
      const desc = topLines.map(([id, line]) => `${id} (${line.loadingPct.toFixed(1)}% thermal load)`);
      findings.push(`Most heavily loaded transmission corridor(s): ${desc.join(', ')}.`);
    }
  }
  return findings;
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

/**
 * Answers user questions locally and deterministically using verified solver metrics,
 * root bottlenecks, modeled trade-offs, and practical next steps without calling external AI.
 */
export function answerOfflineProblemQuestion(
  question: string,
  context: OfflineProblemAssistantContext
): string {
  const q = question.trim().toLocaleLowerCase();
  const { scenario, activeProblem, baselineProblems, baselineResult, selectedResult, alternatives, futureOutcomes } = context;
  if (!q) return 'Type a question about the selected problem, solver results, possible solutions, risks, or future stress cases.';

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
  const asksRisk = /\b(wrong|risk|risks|side effect|secondary|trade.?off|downside|danger|hazard|unintended|safe|violat|breach|limit)\b/.test(q);
  const asksNextSteps = /\b(next step|next steps|cost|budget|price|rupee|inr|timeline|schedule|how long|phase|plan|implement|should we do)\b/.test(q);
  const asksCause = /\b(why|cause|causing|root|bottleneck|reason|which part|where is|enduku)\b/.test(q);
  const asksSolution = /\b(solution|solve|fix|improve|best|recommend|alternative|option|ela solve|em cheyali)\b/.test(q);
  const asksComparison = /\b(compare|difference|versus| vs |better|which one)\b/.test(q);
  const asksNow = /\b(now|current|today|baseline|problem|issue|happening|ippudu)\b/.test(q);

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

  if (asksRisk) {
    const activeAlt = scenario.alternatives.find((a) => a.id === selectedResult.alternativeId) || null;
    const tradeOffs = getAlternativeTradeOffs(scenario, activeAlt, selectedResult);
    const title = activeAlt ? `${activeAlt.tag}: ${activeAlt.name}` : 'Baseline (do nothing)';
    const risksList = [
      ...tradeOffs.immediateTradeOffs.slice(0, 2).map((item) => `• Direct trade-off (${item.label}): ${item.detail}`),
      ...tradeOffs.secondaryConsequences.slice(0, 2).map((item) => `• Secondary effect (${item.label}): ${item.detail}`),
      ...tradeOffs.safeguards.slice(0, 2).map((safeguard) => `• Recommended safeguard: ${safeguard}`)
    ];
    return `Risks, trade-offs, and safeguards for ${title}:\n` +
      (risksList.length > 0 ? risksList.join('\n') : '• No additional secondary warnings flagged in configured checks.') +
      `\n\nModel constraint check: ${summarizeCurrentResult(context)}` +
      '\nUnmodeled field factors (soil conditions, transients, human compliance, permitting) require engineering verification before construction.';
  }

  if (asksNextSteps) {
    const activeAlt = scenario.alternatives.find((a) => a.id === selectedResult.alternativeId) || null;
    const roadmap = generatePracticalNextSteps(scenario, activeAlt, selectedResult);
    const costSummary = !activeAlt
      ? 'No capital outlay (Baseline do-nothing).'
      : activeAlt.costDataStatus === 'not-estimated'
        ? 'Cost not estimated — engineering unit rates must be supplied.'
        : `${formatCostEstimate(activeAlt.capexCostMillion)} CAPEX, delivery ${activeAlt.scheduleDataStatus === 'not-estimated' ? 'not estimated' : activeAlt.implementationMonths + ' months'}.`;
    const phasesText = roadmap.implementationStages
      .slice(0, 3)
      .map((stage) => `• ${stage.phase} — ${stage.title} (${stage.duration}): ${stage.description}`)
      .join('\n');
    return `Practical next steps & planning estimate:\n• Budget & timeline: ${costSummary}\n` +
      phasesText +
      `\n• First prerequisite: ${roadmap.prerequisites[0] || 'Conduct field survey and sensor calibration.'}` +
      `\n• Engineering boundary: ${roadmap.engineeringBoundaryNotice}`;
  }

  if (asksCause && !asksSolution && !asksComparison) {
    const causes = summarizeRootBottlenecks(context);
    return problemSummary +
      '\n\nSolver-observed bottleneck mechanisms:\n' +
      (causes.length > 0 ? causes.map((c) => `• ${c}`).join('\n') : '• No bottleneck hotspots isolated in baseline run.') +
      '\n\nBaseline threshold diagnostics:\n' +
      describeDiagnostics(baselineProblems) +
      '\n\nNote: These explain the modeled bottlenecks under synthetic demo assumptions; real-world field causes require local sensor checks.';
  }

  if (asksSolution || asksComparison) {
    const sorted = [...alternatives].sort((a, b) =>
      Number(b.feasible) - Number(a.feasible) ||
      b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
    );
    const options = sorted.slice(0, 3).map((result, index) => {
      const alt = scenario.alternatives.find((a) => a.id === result.alternativeId);
      const costSuffix = !alt || result.costDataStatus === 'not-estimated'
        ? 'cost not estimated'
        : formatCostEstimate(alt.capexCostMillion);
      return '• ' + (index + 1) + '. ' + result.alternativeName +
        ': utility ' + result.normalizedScores.overallUtility.toFixed(1) + '/100; ' +
        (result.feasible ? 'passes configured hard constraints' : 'has a configured constraint breach') +
        '; ' + result.metrics.primaryPerformance.toFixed(1) + ' ' +
        result.metrics.primaryPerformanceUnit + ' (' + costSuffix + ').';
    }).join('\n');
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
  const causes = summarizeRootBottlenecks(context);
  const leading = asksNow
    ? problemSummary
    : 'For the selected problem, here is the current solver-grounded summary.\n' + problemSummary;
  return leading + '\n\nConfigured baseline diagnostics (unmodified scenario):\n' +
    describeDiagnostics(baselineProblems) +
    (causes.length > 0 ? '\n\nModeled bottleneck focus:\n' + causes.map((c) => `• ${c}`).join('\n') : '') +
    '\n\n' + baselineSummary + ' Selected run: ' + summarizeCurrentResult(context) +
    '\n\nThe solver reports modeled symptoms and threshold checks; it does not prove an unmeasured real-world root cause.';
}
