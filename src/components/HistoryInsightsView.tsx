import React, { useMemo } from 'react';
import {
  Sparkles,
  FileText,
  RotateCcw,
  CheckCircle2,
  Clock,
  Award,
  History
} from 'lucide-react';
import { Scenario } from '../types';
import { SimulationRunLogEntry } from '../models/localStorageStore';
import { formatCostEstimate } from '../utils/currencyFormatter';
import {
  runBaselineSimulation,
  runAlternativeSimulation,
  normalizeAndRankAlternatives,
  explainMyDecision,
  calculateAlternativeDeltas
} from '../models/decisionEngines';

interface HistoryInsightsViewProps {
  scenario: Scenario;
  runHistory?: SimulationRunLogEntry[];
  onSelectScenarioAndOpen?: (scenarioId: string, altId: string | null) => void;
  onOpenReportModal: () => void;
  onReopenRun: () => void;
}

export const HistoryInsightsView: React.FC<HistoryInsightsViewProps> = ({
  scenario,
  runHistory = [],
  onSelectScenarioAndOpen,
  onOpenReportModal,
  onReopenRun
}) => {
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

  const bestResult = useMemo(
    () =>
      [...rankedResults].sort((a, b) => {
        if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
        return b.normalizedScores.overallUtility - a.normalizedScores.overallUtility;
      })[0],
    [rankedResults]
  );

  const bestAlternative = useMemo(
    () =>
      scenario.alternatives.find((a) => a.id === bestResult?.alternativeId) ||
      scenario.alternatives[0],
    [scenario.alternatives, bestResult]
  );

  const explanation = useMemo(
    () =>
      explainMyDecision(
        scenario,
        bestResult?.alternativeId || scenario.alternatives[0]?.id || ''
      ),
    [scenario, bestResult]
  );

  const bestDeltas = useMemo(
    () => calculateAlternativeDeltas(scenario, bestResult, baselineResult),
    [scenario, bestResult, baselineResult]
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 whatif-canvas-bg text-slate-100">
      {/* Header matching Reference 05 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Decision Insights & History
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Synthetic demo data — deterministic trace
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Key takeaways, traceable solver recommendations, and run history for{' '}
            <strong className="text-slate-200">{scenario.title}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReopenRun}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reopen in 3D Twin</span>
          </button>
          <button
            type="button"
            onClick={onOpenReportModal}
            className="px-4 py-2 rounded-xl whatif-pill-primary text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Full Audit Report</span>
          </button>
        </div>
      </div>

      {/* Pro Recommendation Hero Card with Isometric City/Tower Illustration matching Reference 05 */}
      <div className="whatif-card-glow rounded-3xl p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-xs font-bold text-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>Deterministic Solver Recommendation</span>
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-white">
            {bestAlternative?.name} ({bestAlternative?.tag}) achieves the highest overall utility ({bestResult?.normalizedScores.overallUtility}/100)
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {explanation.traceableRationale}
          </p>

          <div className="pt-2 space-y-1.5">
            {explanation.metricDetails.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 text-xs text-slate-300"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white font-mono">[{item.id}]</strong>{' '}
                  {item.metric}:{' '}
                  <strong className="text-cyan-300 font-mono">
                    {item.preferredValue}
                  </strong>{' '}
                  (Runner-up: {item.runnerUpValue})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right (4 cols): Luminous Isometric Smart-City Pedestal Graphic matching Reference 05 */}
        <div className="lg:col-span-4 flex items-center justify-center">
          <svg
            viewBox="0 0 240 200"
            className="w-56 h-48 drop-shadow-[0_0_25px_rgba(139,92,246,0.45)]"
            role="img"
            aria-label="Isometric Infrastructure Recommendation Twin"
          >
            <defs>
              <linearGradient id="isoPlatform" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="isoTowerCyan" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#67e8f9" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="isoTowerViolet" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>

            <polygon
              points="120,175 215,135 120,95 25,135"
              fill="#0f172a"
              stroke="url(#isoPlatform)"
              strokeWidth="3"
            />
            <polygon
              points="120,183 222,140 120,98 18,140"
              fill="none"
              stroke="#22d3ee"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />

            <rect
              x="104"
              y="36"
              width="32"
              height="95"
              rx="4"
              fill="url(#isoTowerCyan)"
              opacity="0.92"
            />
            <rect
              x="68"
              y="64"
              width="28"
              height="68"
              rx="4"
              fill="url(#isoTowerViolet)"
              opacity="0.88"
            />
            <rect
              x="144"
              y="56"
              width="28"
              height="76"
              rx="4"
              fill="url(#isoTowerViolet)"
              opacity="0.88"
            />
            <rect
              x="88"
              y="88"
              width="24"
              height="48"
              rx="3"
              fill="#10b981"
              opacity="0.85"
            />
          </svg>
        </div>
      </div>

      {/* Key Insights 4-Column Row matching Reference 05 */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3">
          Key Calculated Insights (Synthetic Demo Data)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="whatif-card p-4 rounded-2xl text-center space-y-1">
            <div className={`text-xl sm:text-2xl font-extrabold font-mono ${bestDeltas.primaryImprovementPct >= 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
              {bestDeltas.primaryImprovementPct >= 0
                ? `↑ +${bestDeltas.primaryImprovementPct}%`
                : `↓ ${bestDeltas.primaryImprovementPct}%`}
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              {bestDeltas.primaryLabel}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {baselineResult.metrics.primaryPerformance.toFixed(1)} →{' '}
              {bestResult?.metrics.primaryPerformance.toFixed(1)}{' '}
              {bestResult?.metrics.primaryPerformanceUnit}
            </div>
          </div>

          <div className="whatif-card p-4 rounded-2xl text-center space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400">
              {bestDeltas.secondaryImprovementPct >= 0
                ? `↓ ${bestDeltas.secondaryImprovementPct}%`
                : `↑ ${Math.abs(bestDeltas.secondaryImprovementPct)}%`}
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              {bestDeltas.secondaryLabel}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Solver: {explanation.modelVersion}
            </div>
          </div>

          <div className="whatif-card p-4 rounded-2xl text-center space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-white">
              {bestResult?.costDataStatus === 'not-estimated' ? 'Not estimated' : formatCostEstimate(bestResult?.metrics.totalCostMillion ?? 0)}
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              Estimated 5-Yr Lifecycle Cost
            </div>
            <div className="text-[10px] text-amber-300 font-mono">
              {bestResult?.costDataStatus === 'not-estimated' ? 'Cost data needed' : 'Synthetic CAPEX + OPEX'}
            </div>
          </div>

          <div className="whatif-card p-4 rounded-2xl text-center space-y-1">
            <div className="text-xl sm:text-2xl font-extrabold text-cyan-300">
              {(bestResult?.metrics.userBenefitScore ?? 0) >= 80
                ? 'High'
                : 'Moderate'}
            </div>
            <div className="text-xs text-slate-300 font-semibold">
              User & Resilience Benefit
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Score: {Math.round(bestResult?.metrics.userBenefitScore ?? 0)}/100
            </div>
          </div>
        </div>
      </div>

      {/* Evaluated Solution Run Log matching Mobile Panel 06 History */}
      <div className="whatif-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Evaluated Simulation Run Log</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Click any run to reopen in Simulation Workspace
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scenario.alternatives.map((alt) => {
            const res = rankedResults.find((r) => r.alternativeId === alt.id);
            const isTop = res?.alternativeId === bestResult?.alternativeId;

            return (
              <button
                type="button"
                key={alt.id}
                onClick={onReopenRun}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition cursor-pointer flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">
                    {alt.tag}: {alt.name}
                  </span>
                  {isTop && (
                    <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                  <span className="text-cyan-300">
                    {res?.metrics.primaryPerformance.toFixed(1)}{' '}
                    {res?.metrics.primaryPerformanceUnit}
                  </span>
                  <span>
                    Utility: {res?.normalizedScores.overallUtility}/100
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Updated {scenario.updatedAt}</span>
                  <span className="text-amber-300/80">Synthetic</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {runHistory.length > 0 && (
        <div className="whatif-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Local Device Activity History ({runHistory.length})</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Stored locally on this browser only
            </span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {runHistory.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => onSelectScenarioAndOpen?.(entry.scenarioId, entry.alternativeId)}
                className="w-full text-left p-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition flex flex-wrap items-center justify-between gap-2 text-xs cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {entry.scenarioTitle} · <span className="text-cyan-300">{entry.alternativeName}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {entry.note} • {new Date(entry.timestampIso).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                  <span className="text-cyan-300">
                    {entry.primaryPerformance.toFixed(1)} {entry.primaryUnit}
                  </span>
                  <span className={entry.feasible ? 'text-emerald-400' : 'text-rose-300'}>
                    {entry.feasible ? 'Feasible' : 'Breach'} ({entry.utilityScore}/100)
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
