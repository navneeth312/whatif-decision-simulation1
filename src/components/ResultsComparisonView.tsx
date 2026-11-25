import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  FileText,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Ban
} from 'lucide-react';
import { Scenario, AlternativeRunRecord } from '../types';
import { formatCostEstimate } from '../utils/currencyFormatter';
import {
  runBaselineSimulation,
  runAlternativeSimulation,
  normalizeAndRankAlternatives,
  calculateAlternativeDeltas,
  detectHiddenCosts,
  runFutureIssuesUnderScenario
} from '../models/decisionEngines';

interface ResultsComparisonViewProps {
  scenario: Scenario;
  selectedAlternativeId?: string | null;
  onSelectAlternative?: (altId: string) => void;
  onOpenDecisionTools: () => void;
  onOpenReportModal: () => void;
}

const formatSignedPct = (pct: number) => (pct >= 0 ? `+${pct}%` : `${pct}%`);

export const ResultsComparisonView: React.FC<ResultsComparisonViewProps> = ({
  scenario,
  selectedAlternativeId,
  onSelectAlternative,
  onOpenDecisionTools,
  onOpenReportModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'overview' | 'impact' | 'cost' | 'risk' | 'detailed'
  >('overview');

  const baselineResult = useMemo(
    () => runBaselineSimulation(scenario),
    [scenario]
  );

  const rankedResults = useMemo(() => {
    const raw = scenario.alternatives.map((alt) =>
      runAlternativeSimulation(scenario, alt)
    );
    return normalizeAndRankAlternatives(scenario, raw);
  }, [scenario]);

  const sortedByScore = useMemo(
    () =>
      [...rankedResults].sort((a, b) => {
        if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
        return b.normalizedScores.overallUtility - a.normalizedScores.overallUtility;
      }),
    [rankedResults]
  );

  const bestResult = sortedByScore[0];
  const bestAlternative = scenario.alternatives.find(
    (a) => a.id === bestResult?.alternativeId
  );

  const [inspectedAltId, setInspectedAltId] = useState<string>(
    selectedAlternativeId && scenario.alternatives.some((a) => a.id === selectedAlternativeId)
      ? selectedAlternativeId
      : bestResult?.alternativeId || scenario.alternatives[0]?.id || ''
  );

  useEffect(() => {
    const nextId =
      selectedAlternativeId && scenario.alternatives.some((a) => a.id === selectedAlternativeId)
        ? selectedAlternativeId
        : bestResult?.alternativeId || scenario.alternatives[0]?.id || '';
    setInspectedAltId(nextId);
  }, [scenario.id, bestResult?.alternativeId, selectedAlternativeId, scenario.alternatives]);

  const activeInspectResult: AlternativeRunRecord | undefined =
    rankedResults.find((r) => r.alternativeId === inspectedAltId) ||
    bestResult ||
    rankedResults[0];
  const activeInspectAlt =
    scenario.alternatives.find(
      (a) => a.id === activeInspectResult?.alternativeId
    ) || bestAlternative;

  const activeDeltas = useMemo(
    () =>
      activeInspectResult
        ? calculateAlternativeDeltas(scenario, activeInspectResult, baselineResult)
        : {
            primaryLabel: 'Primary Metric',
            primaryDelta: 0,
            primaryImprovementPct: 0,
            secondaryLabel: 'Relief',
            secondaryImprovementPct: 0
          },
    [scenario, activeInspectResult, baselineResult]
  );

  const hiddenCostInfo = useMemo(
    () =>
      activeInspectAlt
        ? detectHiddenCosts(scenario, activeInspectAlt.id)
        : null,
    [scenario, activeInspectAlt]
  );

  const futureRiskOutcomes = useMemo(
    () =>
      activeInspectAlt
        ? runFutureIssuesUnderScenario(scenario, activeInspectAlt.id)
        : [],
    [scenario, activeInspectAlt]
  );

  // Compute 5 radar axes (0-100) from real deterministic solver scores
  const buildRadarPolygon = (res?: AlternativeRunRecord) => {
    if (!res) return '150,150 150,150 150,150 150,150 150,150';
    const axes = [
      Math.round(res.normalizedScores.performanceNorm * 95),
      Math.round(res.normalizedScores.costNorm * 95),
      res.feasible ? 90 : 45,
      Math.round(res.metrics.userBenefitScore),
      Math.round(res.metrics.environmentalImpactScore)
    ];

    const cx = 150;
    const cy = 145;
    const maxR = 92;

    return axes
      .map((val, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const r = (Math.max(18, Math.min(100, val)) / 100) * maxR;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 whatif-canvas-bg text-slate-100">
      {/* Header Row matching Reference 06 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Results & Comparison
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Synthetic demo data — not real infrastructure data
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Compare deterministic solver outcomes, lifecycle costs, and constraint risks across alternatives for{' '}
            <strong className="text-white">{scenario.title}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDecisionTools}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>14 Decision Tools</span>
          </button>
          <button
            type="button"
            onClick={onOpenReportModal}
            className="px-4 py-2 rounded-xl whatif-pill-primary text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {scenario.problemStatement?.available === false && (
        <div role="alert" className="p-3.5 rounded-2xl bg-rose-950/35 border border-rose-500/50 text-rose-200 flex items-start gap-2.5 text-xs">
          <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block">Unmodeled Physics Disclosure ({scenario.problemStatement.title}):</strong>
            <span>{scenario.problemStatement.unavailableReason || 'The selected problem requires physics beyond this solver. Figures shown reflect base topology only.'}</span>
          </div>
        </div>
      )}

      {/* Category Pill Tabs (Overview | Impact | Cost | Risk | Detailed) */}
      <div role="tablist" aria-label="Comparison view categories" className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'impact', label: 'Impact' },
            { id: 'cost', label: 'Cost' },
            { id: 'risk', label: 'Risk' },
            { id: 'detailed', label: 'Detailed' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSubTab === tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeSubTab === tab.id
                ? 'whatif-pill-primary text-white shadow'
                : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Center Comparison Stage: Pentagon Radar Chart + Overall Comparison Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-6 whatif-card rounded-2xl p-5 flex flex-col justify-between">
          {activeSubTab === 'overview' && (
            <>
              <div className="w-full flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Multi-Criteria Trade-Off Profile
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Normalized solver axes (0–100 scale) • Cyan: {activeInspectAlt?.tag || 'N/A'} vs Purple: Runner-Up
                  </p>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded max-w-[160px] truncate">
                  {activeInspectAlt?.name}
                </span>
              </div>

              <svg
                viewBox="0 0 300 280"
                className="w-full max-w-[330px] h-auto my-1 mx-auto overflow-visible"
                role="img"
                aria-label="Multi-Criteria Pentagon Radar Chart"
              >
                {[0.25, 0.5, 0.75, 1].map((scale, sIdx) => {
                  const pts = [0, 1, 2, 3, 4]
                    .map((i) => {
                      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                      const r = 92 * scale;
                      return `${(150 + r * Math.cos(angle)).toFixed(1)},${(
                        145 +
                        r * Math.sin(angle)
                      ).toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <polygon
                      key={sIdx}
                      points={pts}
                      fill="none"
                      stroke="rgba(100, 116, 139, 0.3)"
                      strokeWidth="1"
                    />
                  );
                })}

                {[
                  { label: 'Performance', x: 150, y: 34 },
                  { label: 'Cost Efficiency', x: 262, y: 112 },
                  { label: 'Feasibility', x: 224, y: 248 },
                  { label: 'User Benefit', x: 76, y: 248 },
                  { label: 'Env. & Relief', x: 38, y: 112 }
                ].map((axis, i) => {
                  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                  const xEnd = 150 + 92 * Math.cos(angle);
                  const yEnd = 145 + 92 * Math.sin(angle);
                  return (
                    <g key={i}>
                      <line
                        x1="150"
                        y1="145"
                        x2={xEnd}
                        y2={yEnd}
                        stroke="rgba(100, 116, 139, 0.35)"
                        strokeWidth="1"
                      />
                      <text
                        x={axis.x}
                        y={axis.y}
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontSize="10"
                        fontWeight="600"
                      >
                        {axis.label}
                      </text>
                    </g>
                  );
                })}

                {sortedByScore[1] && (
                  <polygon
                    points={buildRadarPolygon(sortedByScore[1])}
                    fill="rgba(168, 85, 247, 0.18)"
                    stroke="#a855f7"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                )}

                <polygon
                  points={buildRadarPolygon(activeInspectResult)}
                  fill="rgba(34, 211, 238, 0.28)"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                />
              </svg>

              <div className="w-full flex items-center justify-between text-[11px] text-slate-300 border-t border-slate-800/80 pt-2.5">
                <span>Click any solution on the right to inspect its radar polygon</span>
                <span className="font-mono text-emerald-400">
                  Score: {activeInspectResult?.normalizedScores.overallUtility ?? 0}/100
                </span>
              </div>
            </>
          )}

          {activeSubTab === 'impact' && activeInspectResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Physical System Impact ({activeInspectAlt?.tag})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Measured change relative to baseline network state
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {formatSignedPct(activeDeltas.primaryImprovementPct)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Unmodified Baseline</span>
                  <strong className="font-mono text-white text-sm">
                    {baselineResult.metrics.primaryPerformance.toFixed(2)} {baselineResult.metrics.primaryPerformanceUnit}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30">
                  <span className="text-[10px] text-slate-400 block">Selected Intervention</span>
                  <strong className="font-mono text-cyan-300 text-sm">
                    {activeInspectResult.metrics.primaryPerformance.toFixed(2)} {activeInspectResult.metrics.primaryPerformanceUnit}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Env. & Efficiency Score</span>
                  <strong className="font-mono text-emerald-400 text-sm">
                    {Math.round(activeInspectResult.metrics.environmentalImpactScore)} / 100
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">User Benefit Index</span>
                  <strong className="font-mono text-indigo-300 text-sm">
                    {Math.round(activeInspectResult.metrics.userBenefitScore)} / 100
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] space-y-1">
                <div className="font-bold text-slate-200">Solver Execution Trace</div>
                <p className="text-slate-400">
                  Baseline had {baselineResult.constraintViolations.length} boundary breach(es); {activeInspectAlt?.name} has{' '}
                  {activeInspectResult.constraintViolations.length} breach(es).
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'cost' && activeInspectAlt && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-purple-400" />
                    Lifecycle Cost Breakdown ({activeInspectAlt.tag})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    CAPEX, 5-year OPEX & omitted project cost disclosures
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {activeInspectAlt.costDataStatus === 'not-estimated' ? 'Not estimated' : 'Synthetic estimate'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Estimated Cost</span>
                  <strong className="font-mono text-white">
                    {activeInspectAlt.costDataStatus === 'not-estimated' ? 'Not estimated' : formatCostEstimate(activeInspectAlt.capexCostMillion)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Annual Upkeep</span>
                  <strong className="font-mono text-white">
                    {activeInspectAlt.costDataStatus === 'not-estimated' ? 'Not estimated' : `${formatCostEstimate(activeInspectAlt.opexAnnualMillion)}/yr`}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/30">
                  <span className="text-[10px] text-slate-400 block">5-Yr Total</span>
                  <strong className="font-mono text-purple-300">
                    {activeInspectAlt.costDataStatus === 'not-estimated' || !activeInspectResult ? 'Not estimated' : formatCostEstimate(activeInspectResult.metrics.totalCostMillion)}
                  </strong>
                </div>
              </div>

              {hiddenCostInfo && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5 text-[11px]">
                  <div className="font-bold text-amber-300">Omitted Real-World Cost Items (Not Included in Totals):</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {hiddenCostInfo.missingCategories.map((cat, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                        <span className="text-slate-300 truncate">{cat.name}</span>
                        <span className="text-amber-300 shrink-0 ml-1">{cat.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'risk' && activeInspectResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Constraint & Future Stress Risks ({activeInspectAlt?.tag})
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Hard constraint compliance & conditional stress tests (not forecasts)
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeInspectResult.feasible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                  {(activeInspectResult.unverifiedConstraints?.length || 0) > 0
                    ? 'Partial check'
                    : activeInspectResult.feasible
                    ? 'Feasible'
                    : `${activeInspectResult.constraintViolations.length} Violation(s)`}
                </span>
              </div>

              {activeInspectResult.constraintViolations.length > 0 ? (
                <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-[11px] text-rose-200 space-y-1">
                  {activeInspectResult.constraintViolations.map((v, i) => (
                    <div key={i}>• {v}</div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/35 text-[11px] text-emerald-300">
                  No nominal hard constraint violations triggered under current assumptions.
                </div>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {futureRiskOutcomes.map((risk) => (
                  <div key={risk.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{risk.name} (+{risk.horizonYears}y)</div>
                      <div className="text-[10px] text-slate-400 truncate">{risk.parameterShift}</div>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${risk.status === 'Clear' ? 'text-emerald-400' : risk.status === 'Warning' ? 'text-amber-300' : 'text-rose-400'}`}>
                      {risk.measuredImpact} · {risk.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'detailed' && activeInspectAlt && activeInspectResult && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Detailed Engineering Parameter & Weight Ledger
                </h2>
                <p className="text-[11px] text-slate-400">
                  Solver inputs modified by {activeInspectAlt.name} & normalized weight scores
                </p>
              </div>

              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {activeInspectAlt.modifications.map((mod, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-white block">{mod.label}</span>
                      <span className="text-[10px] font-mono text-slate-400">{mod.targetId}.{mod.property}</span>
                    </div>
                    <span className="font-mono text-cyan-300 font-bold shrink-0">
                      {mod.originalValue} → {mod.newValue} {mod.unit}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono pt-1">
                {[
                  { k: 'Perf', v: activeInspectResult.normalizedScores.performanceNorm },
                  { k: 'Cost', v: activeInspectResult.normalizedScores.costNorm },
                  { k: 'Env', v: activeInspectResult.normalizedScores.envNorm },
                  { k: 'Risk', v: activeInspectResult.normalizedScores.riskNorm },
                  { k: 'Benefit', v: activeInspectResult.normalizedScores.benefitNorm }
                ].map((s) => (
                  <div key={s.k} className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-slate-400">{s.k}</div>
                    <div className="text-white font-bold">{(s.v * 100).toFixed(0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right (6 cols): Overall Comparison Ranking Card */}
        <div className="lg:col-span-6 whatif-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Overall Comparison
                </h2>
                <p className="text-[11px] text-slate-400">
                  Ranked by feasibility & weighted multi-objective utility (Synthetic demo data)
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-300">
                Baseline: {baselineResult.metrics.primaryPerformance.toFixed(1)}{' '}
                {baselineResult.metrics.primaryPerformanceUnit}
              </span>
            </div>

            <div className="space-y-3">
              {scenario.alternatives.map((alt, idx) => {
                const res = rankedResults.find(
                  (r) => r.alternativeId === alt.id
                );
                const isBest = res?.alternativeId === bestResult?.alternativeId;
                const isInspected = alt.id === activeInspectAlt?.id;
                const letter =
                  alt.tag.replace('Solution ', '').trim() ||
                  String.fromCharCode(65 + idx);

                return (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => {
                      setInspectedAltId(alt.id);
                      onSelectAlternative?.(alt.id);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                      isInspected
                        ? 'bg-indigo-950/80 border-indigo-400 text-white shadow-[0_0_24px_rgba(99,102,241,0.22)]'
                        : 'bg-slate-950/75 border-slate-800/90 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          isBest
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {letter}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {alt.name}
                        </div>
                        <div className="text-[11px] text-slate-300 font-mono">
                          {res?.metrics.primaryPerformance.toFixed(1)}{' '}
                          {res?.metrics.primaryPerformanceUnit} •{' '}
                          {res?.costDataStatus === 'not-estimated' ? 'Cost not estimated' : `$${res?.metrics.totalCostMillion.toFixed(1)}M 5-yr cost`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-sm sm:text-base font-extrabold font-mono text-white">
                        {res?.normalizedScores.overallUtility}
                        <span className="text-xs text-slate-400 font-normal">
                          /100
                        </span>
                      </span>
                      {isBest && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/50">
                          Best
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs flex items-center justify-between text-slate-300">
            <span>
              Top Recommendation:{' '}
              <strong className="text-cyan-300">
                {bestAlternative?.tag} ({bestAlternative?.name})
              </strong>
            </span>
            <span className="font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activeInspectResult?.modelVersion}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="whatif-card p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">
              {activeDeltas.primaryLabel}
            </div>
            <div className="text-lg font-extrabold font-mono text-emerald-400">
              {formatSignedPct(activeDeltas.primaryImprovementPct)}{' '}
              <span className="text-xs text-slate-300">
                ({activeInspectResult?.metrics.primaryPerformance.toFixed(1)})
              </span>
            </div>
          </div>
        </div>

        <div className="whatif-card p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">
              {activeInspectResult?.costDataStatus === 'not-estimated' ? '5-Yr Cost (not estimated)' : 'Estimated 5-Yr Cost (Synthetic)'}
            </div>
            <div className="text-lg font-extrabold font-mono text-white">
              {activeInspectResult?.costDataStatus === 'not-estimated' ? 'Not estimated' : `$${activeInspectResult?.metrics.totalCostMillion.toFixed(2)}M`}
            </div>
          </div>
        </div>

        <div className="whatif-card p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">
              {activeDeltas.secondaryLabel}
            </div>
            <div className="text-lg font-extrabold font-mono text-emerald-400">
              ↓ {activeDeltas.secondaryImprovementPct}%
            </div>
          </div>
        </div>

        <div className="whatif-card p-4 rounded-2xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">
              User & Network Benefit
            </div>
            <div className="text-lg font-extrabold text-cyan-300">
              {(activeInspectResult?.metrics.userBenefitScore ?? 0) >= 80
                ? 'High'
                : 'Moderate'}{' '}
              <span className="text-xs font-mono text-slate-300">
                ({Math.round(activeInspectResult?.metrics.userBenefitScore ?? 0)}/100)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
