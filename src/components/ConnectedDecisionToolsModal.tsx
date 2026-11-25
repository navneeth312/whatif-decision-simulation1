import React, { useEffect, useRef, useState } from 'react';
import { useModalA11y } from '../utils/useModalA11y';
import {
  X,
  Ban,
  ShieldAlert,
  GitBranch,
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Compass,
  Sliders,
  Clock,
  Target,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { Scenario } from '../types';
import { formatCostEstimate } from '../utils/currencyFormatter';
import {
  runDecisionBreaker,
  calculateDecisionRobustnessScore,
  runSensitivityAnalysis,
  detectHiddenCosts,
  buildAssumptionDependencyGraph,
  runFutureCollisionDetector,
  runRippleEffectAnalyzer,
  runAdaptiveStressTesting,
  runDecisionReversalEngine,
  runReverseSolver,
  runRecoveryPlanner,
  runUncertaintyRadar,
  runFutureRegretExplorer,
  explainMyDecision
} from '../models/decisionEngines';

interface ConnectedDecisionToolsModalProps {
  scenario: Scenario;
  selectedAlternativeId?: string | null;
  onClose: () => void;
}

export type ToolTab =
  | 'breaker'
  | 'robustness'
  | 'dependency'
  | 'collisions'
  | 'ripple'
  | 'adaptive'
  | 'reversal'
  | 'reverse_solver'
  | 'regret'
  | 'recovery'
  | 'hiddencosts'
  | 'uncertainty'
  | 'sensitivity'
  | 'explain';

export const ConnectedDecisionToolsModal: React.FC<ConnectedDecisionToolsModalProps> = ({
  scenario,
  selectedAlternativeId,
  onClose
}) => {
  const [activeTool, setActiveTool] = useState<ToolTab>('breaker');
  const [evaluatedAltId, setEvaluatedAltId] = useState<string>(
    () =>
      (selectedAlternativeId && scenario.alternatives.some((a) => a.id === selectedAlternativeId)
        ? selectedAlternativeId
        : scenario.alternatives[0]?.id) || ''
  );

  useEffect(() => {
    const fallback =
      (selectedAlternativeId && scenario.alternatives.some((a) => a.id === selectedAlternativeId)
        ? selectedAlternativeId
        : scenario.alternatives[0]?.id) || '';
    setEvaluatedAltId(fallback);
  }, [scenario.id, scenario.alternatives, selectedAlternativeId]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(true, onClose, dialogRef);

  const preferredAlt =
    scenario.alternatives.find((a) => a.id === evaluatedAltId) ||
    scenario.alternatives[0];

  const [stressTrialCount] = useState(20);
  const [stressSeed, setStressSeed] = useState(101);
  const [targetPerfInput, setTargetPerfInput] = useState<string>(
    scenario.domain === 'traffic' ? '42.0' : scenario.domain === 'water' ? '210.0' : '8.5'
  );

  useEffect(() => {
    setTargetPerfInput(
      scenario.domain === 'traffic' ? '42.0' : scenario.domain === 'water' ? '210.0' : '8.5'
    );
  }, [scenario.domain, scenario.id]);

  if (!preferredAlt) {
    return (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Connected Decision Tools"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      >
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 text-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Connected Decision Tools</h2>
            <button type="button" onClick={onClose} aria-label="Close Decision Tools" className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-300">
            This scenario has no configured solution alternatives to evaluate with the 14 decision engines.
          </p>
        </div>
      </div>
    );
  }

  // Tool 1: Decision Breaker
  const breakerResult = runDecisionBreaker(scenario, preferredAlt.id);

  // Tool 2: Decision Robustness Score (DRS)
  const drsReport = calculateDecisionRobustnessScore(
    scenario,
    preferredAlt.id,
    stressTrialCount,
    stressSeed
  );

  // Tool 3: Assumption Dependency Graph
  const depGraph = buildAssumptionDependencyGraph(scenario);

  // Tool 4: Future Collision Detector
  const collisionReport = runFutureCollisionDetector(scenario, preferredAlt.id);

  // Tool 5: Ripple Effect Analyzer
  const rippleReport = runRippleEffectAnalyzer(scenario, preferredAlt.id);

  // Tool 6: Adaptive Stress Testing
  const adaptiveReport = runAdaptiveStressTesting(scenario, preferredAlt.id, 30, 2026);

  // Tool 7: Decision Reversal Engine
  const reversalReport = runDecisionReversalEngine(scenario, preferredAlt.id);

  // Tool 8: Reverse Solver
  const parsedTarget = parseFloat(targetPerfInput);
  const reverseSolverReport =
    targetPerfInput.trim() !== '' && !isNaN(parsedTarget)
      ? runReverseSolver(scenario, parsedTarget, preferredAlt.id)
      : {
          available: false,
          reason: 'target output not provided'
        };

  // Tool 9: Future Regret Explorer (calculated over seeded stress trials)
  const regretReport = runFutureRegretExplorer(
    scenario,
    preferredAlt.id,
    stressTrialCount,
    stressSeed
  );

  // Tool 10: Recovery Planner
  const recoveryReport = runRecoveryPlanner(scenario, preferredAlt.id);

  // Tool 11: Hidden Cost Detector
  const hiddenCostReport = detectHiddenCosts(scenario, preferredAlt.id);

  // Tool 12: Uncertainty Radar
  const uncertaintyReport = runUncertaintyRadar(scenario);

  // Tool 13: Sensitivity Analysis
  const sensitivityItems = runSensitivityAnalysis(scenario, preferredAlt.id);

  // Tool 14: Explain My Decision
  const explainReport = explainMyDecision(scenario, preferredAlt.id);

  const toolsList = [
    { id: 'breaker' as ToolTab, label: '1. Decision Breaker', icon: ShieldAlert },
    { id: 'dependency' as ToolTab, label: '2. Assumption Dependency Graph', icon: GitBranch },
    { id: 'collisions' as ToolTab, label: '3. Future Collision Detector', icon: Clock },
    { id: 'ripple' as ToolTab, label: '4. Ripple Effect Analyzer', icon: RefreshCw },
    { id: 'adaptive' as ToolTab, label: '5. Adaptive Stress Testing', icon: Sliders },
    { id: 'reversal' as ToolTab, label: '6. Decision Reversal Engine', icon: TrendingUp },
    { id: 'robustness' as ToolTab, label: '7. Decision Robustness Score (DRS)', icon: Activity },
    { id: 'reverse_solver' as ToolTab, label: '8. Reverse Solver', icon: Target },
    { id: 'regret' as ToolTab, label: '9. Future Regret Explorer', icon: Compass },
    { id: 'recovery' as ToolTab, label: '10. Recovery Planner', icon: CheckCircle2 },
    { id: 'hiddencosts' as ToolTab, label: '11. Hidden Cost Detector', icon: DollarSign },
    { id: 'uncertainty' as ToolTab, label: '12. Uncertainty Radar', icon: Layers },
    { id: 'sensitivity' as ToolTab, label: '13. Sensitivity Analysis', icon: Sliders },
    { id: 'explain' as ToolTab, label: '14. Explain My Decision', icon: FileCheck }
  ];

  // Dynamic available tools count strictly matching operational state
  const availableCount = toolsList.filter((t) => {
    if (t.id === 'reverse_solver') return reverseSolverReport.available;
    if (t.id === 'reversal') return reversalReport.available;
    return true;
  }).length;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Connected Decision Tools"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex flex-wrap items-center gap-2">
                Connected Decision Tools
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {availableCount} Functional Engines Active
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Mathematical stress-testing, rank reversal analysis, and explicit dependency tracing (Synthetic demo data)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span>Evaluate:</span>
              <select
                aria-label="Select alternative to analyze across tools"
                value={preferredAlt.id}
                onChange={(e) => setEvaluatedAltId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-semibold focus:outline-none"
              >
                {scenario.alternatives.map((alt) => (
                  <option key={alt.id} value={alt.id}>
                    {alt.tag}: {alt.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Decision Tools"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector: All 14 entries */}
        <div role="tablist" aria-label="Decision analysis tools" className="px-6 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold scrollbar-none">
          {toolsList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTool === tab.id;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                key={tab.id}
                onClick={() => setActiveTool(tab.id)}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shrink-0 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {scenario.problemStatement?.available === false && (
            <div role="alert" className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-500/45 text-rose-200 flex items-start gap-2.5 text-xs">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Unmodeled Physics Warning:</strong>{' '}
                {scenario.problemStatement.unavailableReason || 'Current problem is outside solver scope.'} Results below reflect only the base network equations.
              </div>
            </div>
          )}
          {/* TOOL 1: DECISION BREAKER */}
          {activeTool === 'breaker' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">
                  Exact Break Threshold Identification
                </span>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {breakerResult.explanation}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Critical Assumption</span>
                  <strong className="text-white text-sm">{breakerResult.criticalAssumptionName}</strong>
                  <span className="text-xs text-slate-400 block mt-1">
                    Nominal: {breakerResult.nominalValue} {breakerResult.unit}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Required Perturbation</span>
                  <strong className="text-cyan-400 text-base">+{breakerResult.pctShiftRequired}%</strong>
                  <span className="text-xs text-slate-400 block mt-1">
                    Break value: {breakerResult.breakThresholdValue} {breakerResult.unit}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Break Mode</span>
                  <strong className="text-amber-400 text-sm capitalize">
                    {breakerResult.breakType.replace('_', ' ')}
                  </strong>
                  <span className="text-xs text-slate-400 block mt-1">
                    Preferred: {preferredAlt.name}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TOOL 2: ROBUSTNESS (DRS) */}
          {activeTool === 'robustness' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold block">
                    Decision Robustness Score (DRS)
                  </span>
                  <div className="text-4xl font-black text-cyan-400 mt-1">
                    {drsReport.overallScore}
                    <span className="text-lg text-slate-400 font-normal"> / 100</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold block mt-1">
                    Calculated over {drsReport.trialsCount} explicit stress trials (Seed: {drsReport.seed})
                  </span>
                </div>

                <div className="text-right space-y-1">
                  <button
                    onClick={() => setStressSeed((s) => s + 1)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                  >
                    Re-seed PRNG ({drsReport.seed})
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
                DRS Formula: 100 × [1 − mean((1−f_s) + f_s × max(0, u*_s − u_s(a)))]
              </div>
            </div>
          )}

          {/* TOOL 3: ASSUMPTION DEPENDENCY GRAPH */}
          {activeTool === 'dependency' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Traces explicit input → formula → metric → decision dependencies without invented edges.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Model Components ({depGraph.nodes.length})
                  </span>
                  <div className="space-y-1.5">
                    {depGraph.nodes.map((n) => (
                      <div key={n.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between text-xs">
                        <span className="font-semibold text-white">{n.label}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">{n.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Deterministic Edges ({depGraph.edges.length})
                  </span>
                  <div className="space-y-1.5">
                    {depGraph.edges.map((e, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between">
                        <span className="text-slate-300"><strong>{e.from}</strong> → <strong>{e.to}</strong></span>
                        <span className="text-[10px] text-cyan-400 font-mono italic">{e.relation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TOOL 4: FUTURE COLLISION DETECTOR */}
          {activeTool === 'collisions' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase">Constraint Collision Interval Scan</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${collisionReport.collisionsDetected > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {collisionReport.collisionsDetected} Collisions Detected
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{collisionReport.crossDomainCouplingNote}</p>
              </div>

              {collisionReport.collisions.length > 0 ? (
                <div className="space-y-2">
                  {collisionReport.collisions.map((c, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <strong className="text-white block">{c.timeOrComponent}</strong>
                        <span className="text-[11px] text-slate-400">{c.constraintName} (Limit: {c.limit})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-400 font-mono font-bold block">{c.actual}</span>
                        <span className="text-[10px] uppercase font-bold text-red-400">{c.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-emerald-400">
                  No temporal or physical constraint collisions detected for {collisionReport.alternativeName}.
                </div>
              )}
            </div>
          )}

          {/* TOOL 5: RIPPLE EFFECT ANALYZER */}
          {activeTool === 'ripple' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Traces physical parameter modifications downstream through network topology and continuity.</p>
              <div className="space-y-2">
                {rippleReport.traces.map((t, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-white block">{t.origin} → {t.downstreamComponent}</strong>
                      <span className="text-[11px] text-slate-400">{t.metricAffected}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-mono font-bold">{t.delta}</span>
                      <span className="text-[10px] text-slate-400 block">{t.direction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOOL 6: ADAPTIVE STRESS TESTING */}
          {activeTool === 'adaptive' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Mean Outcome</span>
                  <strong className="text-white text-base font-mono">{adaptiveReport.mean}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Spread [Min .. Max]</span>
                  <strong className="text-cyan-400 text-base font-mono">[{adaptiveReport.min} .. {adaptiveReport.max}]</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Std Deviation (σ)</span>
                  <strong className="text-purple-400 text-base font-mono">{adaptiveReport.stdDev}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Feasibility Rate</span>
                  <strong className="text-emerald-400 text-base font-mono">{adaptiveReport.feasibilityRatePct}%</strong>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">{adaptiveReport.disclosure}</div>
            </div>
          )}

          {/* TOOL 7: DECISION REVERSAL ENGINE */}
          {activeTool === 'reversal' && (
            <div className="space-y-4">
              {reversalReport.available ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                  <span className="text-xs font-bold text-white block uppercase">Ranking Reversal Bisection Search</span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Critical Parameter</span>
                      <strong className="text-white">{reversalReport.crossingAssumption}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Reversal Threshold</span>
                      <strong className="text-cyan-400">{reversalReport.criticalThreshold}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Shift Required</span>
                      <strong className="text-amber-400">{reversalReport.shiftRequiredPct}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 italic pt-1">{reversalReport.method}</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400">
                  Unavailable for this model: {reversalReport.reason}
                </div>
              )}
            </div>
          )}

          {/* TOOL 8: REVERSE SOLVER */}
          {activeTool === 'reverse_solver' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label htmlFor="reverse-solver-target" className="text-xs text-slate-300 font-semibold">Target Output Performance:</label>
                <input
                  id="reverse-solver-target"
                  type="text"
                  placeholder="Enter target"
                  value={targetPerfInput}
                  onChange={(e) => setTargetPerfInput(e.target.value)}
                  className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 w-32 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {reverseSolverReport.available ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Control Parameter</span>
                      <strong className="text-white">{reverseSolverReport.parameter}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        {reverseSolverReport.solvable ? 'Solved Required Value' : 'Achievable Output Range'}
                      </span>
                      <strong className="text-cyan-400 font-mono">
                        {reverseSolverReport.solvable && 'requiredValue' in reverseSolverReport
                          ? `${reverseSolverReport.requiredValue} → ${reverseSolverReport.achievedPerformance}`
                          : reverseSolverReport.achievableRange || reverseSolverReport.achievedPerformance}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Residual Error</span>
                      <strong className="text-purple-400 font-mono">{reverseSolverReport.residual}</strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 pt-1">{reverseSolverReport.status}</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400">
                  Unavailable for this model: {reverseSolverReport.reason}
                </div>
              )}
            </div>
          )}

          {/* TOOL 9: FUTURE REGRET EXPLORER */}
          {activeTool === 'regret' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-300">
                  Calculated minimax & percentile utility regret of selecting{' '}
                  <strong className="text-white">'{preferredAlt.name}'</strong> versus the best feasible alternative across{' '}
                  <strong className="font-mono text-cyan-300">{regretReport.trialsCount}</strong> seeded stress trials (seed #{regretReport.seed}).
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Minimax Winner: {regretReport.minimaxWinner?.alternativeName}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Mean Expected Regret</span>
                  <strong className="text-cyan-400 font-bold text-lg font-mono">
                    {regretReport.selectedSummary?.meanPts.toFixed(1)} pts
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Zero-regret in {regretReport.selectedSummary?.zeroRegretCount}/{regretReport.trialsCount} trials
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">Worst-Case (Max) Regret</span>
                  <strong className="text-amber-400 font-bold text-lg font-mono">
                    {regretReport.selectedSummary?.maxPts.toFixed(1)} pts
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Maximum utility gap across stress envelope
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block">95th Percentile Regret</span>
                  <strong className="text-purple-400 font-bold text-lg font-mono">
                    {regretReport.selectedSummary?.p95Pts.toFixed(1)} pts
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Tail-risk regret bound
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Cross-Alternative Regret Matrix</span>
                  <span className="text-[10px] font-mono text-slate-400">{regretReport.formula}</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {regretReport.alternativesSummary.map((item) => (
                    <div
                      key={item.alternativeId}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800"
                    >
                      <span className="font-semibold text-white">
                        [{item.tag}] {item.alternativeName}
                      </span>
                      <div className="flex items-center gap-4 font-mono text-[11px]">
                        <span className="text-cyan-300">Mean: {item.meanPts.toFixed(1)} pts</span>
                        <span className="text-purple-300">P95: {item.p95Pts.toFixed(1)} pts</span>
                        <span className="text-amber-300">Max: {item.maxPts.toFixed(1)} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TOOL 10: RECOVERY PLANNER */}
          {activeTool === 'recovery' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Ranks feasible user-defined mitigation actions by recalculated model outcomes.</p>
              <div className="space-y-2">
                {recoveryReport.rankedMitigations.map((m, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-white block">{m.actionName}</strong>
                      <span className="text-[11px] text-slate-400">{m.mechanism}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-bold block">{m.recalculatedPerformance}</span>
                      <span className="text-[10px] text-slate-400">{m.feasible ? 'Feasible Mitigation' : 'Boundary Alert'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 italic">{recoveryReport.note}</p>
            </div>
          )}

          {/* TOOL 11: HIDDEN COSTS */}
          {activeTool === 'hiddencosts' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-white block">Configured Cost Line Items ({hiddenCostReport.alternativeName})</span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block">Estimated Cost</span>
                    <strong className="text-white font-mono">{hiddenCostReport.costDataStatus === 'not-estimated' ? 'Not estimated' : formatCostEstimate(hiddenCostReport.configuredCapexMillion)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Annual Upkeep</span>
                    <strong className="text-white font-mono">{hiddenCostReport.costDataStatus === 'not-estimated' ? 'Not estimated' : `${formatCostEstimate(hiddenCostReport.configuredOpexAnnualMillion)}/yr`}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">5-Yr Total</span>
                    <strong className="text-purple-400 font-mono">{hiddenCostReport.costDataStatus === 'not-estimated' ? 'Not available' : formatCostEstimate(hiddenCostReport.fiveYearLifecycleMillion)}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Unconfigured Cost Categories (Omitted from Totals)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {hiddenCostReport.missingCategories.map((c, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex justify-between items-center text-[11px]">
                      <span className="text-slate-300">{c.name}</span>
                      <span className="text-amber-400 font-semibold">{c.status}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 italic pt-1">{hiddenCostReport.warning}</p>
              </div>
            </div>
          )}

          {/* TOOL 12: UNCERTAINTY RADAR */}
          {activeTool === 'uncertainty' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">{uncertaintyReport.disclaimer}</p>
              <div className="space-y-2">
                {uncertaintyReport.items.map((u, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <strong className="text-white block">{u.assumption}</strong>
                      <span className="text-[11px] text-slate-400">Nominal: {u.nominal} • Distribution: {u.distributionType}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-cyan-400 font-mono font-bold block">{u.range}</span>
                      <span className="text-[10px] text-slate-400">{u.spreadPct} spread</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOOL 13: SENSITIVITY ANALYSIS */}
          {activeTool === 'sensitivity' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">One-at-a-time +15% finite difference parameter impact on preferred solution's score.</p>
              <div className="space-y-2.5">
                {sensitivityItems.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">{item.parameter}</div>
                      <div className="text-[11px] text-slate-400">Base: {item.baseValue} • Perturbation: +{item.deltaPct}%</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold ${item.impactOnScore > 0 ? 'text-emerald-400' : item.impactOnScore < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {item.impactOnScore > 0 ? `+${item.impactOnScore}` : item.impactOnScore} pts
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.criticality === 'high' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : item.criticality === 'medium' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400'}`}>
                        {item.criticality} criticality
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOOL 14: EXPLAIN MY DECISION */}
          {activeTool === 'explain' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <span className="text-xs font-bold text-white block uppercase">Deterministic Traceable Explanation</span>
                <p className="text-slate-200 text-xs leading-relaxed">{explainReport.traceableRationale}</p>
                <div className="pt-2 flex gap-4 text-[11px] text-slate-400 font-mono">
                  <span>Solver: <strong className="text-emerald-400">{explainReport.solverStatus}</strong></span>
                  <span>Model: <strong>{explainReport.modelVersion}</strong></span>
                  <span>Seed: <strong>{explainReport.reproducibleSeed}</strong></span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Traceable Metric Citations</span>
                {explainReport.metricDetails.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-mono text-cyan-400 font-bold block">{m.id}</span>
                      <span className="text-slate-300">{m.metric}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white font-mono font-bold block">{m.preferredValue}</span>
                      <span className="text-[10px] text-slate-500">Runner-up: {m.runnerUpValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
