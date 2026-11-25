import React, { useRef } from 'react';
import { X, Printer, ShieldCheck, AlertTriangle, Ban } from 'lucide-react';
import { Scenario } from '../types';
import { runAlternativeSimulation, normalizeAndRankAlternatives } from '../models/decisionEngines';
import { formatCostEstimate } from '../utils/currencyFormatter';
import { useModalA11y } from '../utils/useModalA11y';

interface ReportModalProps {
  scenario: Scenario;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ scenario, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(true, onClose, dialogRef);

  const rawRuns = scenario.alternatives.map((alt) => runAlternativeSimulation(scenario, alt));
  const rankedUnsorted = normalizeAndRankAlternatives(scenario, rawRuns);
  const ranked = [...rankedUnsorted].sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return b.normalizedScores.overallUtility - a.normalizedScores.overallUtility;
  });
  const best = ranked[0];
  const problemUnavailable = scenario.problemStatement?.available === false;

  const domainModelLimitNote =
    scenario.domain === 'water'
      ? 'Steady-state Darcy–Weisbach hydraulics using synthetic demo inputs. Pump curves, pressure-reducing valves (PRVs), tank storage trajectories, transients, and water quality are not modeled.'
      : scenario.domain === 'energy'
      ? 'Linearized DC power-flow (Bθ) approximation using synthetic demo inputs. AC voltage magnitudes, reactive power flows (MVAr), and transient stability are not calculated.'
      : 'Macroscopic Cell Transmission Model (CTM) depending on configured cell capacity, demand, signal green ratios, and split assumptions. Scenario stress cases are not predictions.';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Simulation Decision Report"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-extrabold text-white">
              Scenario Simulation Summary
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-300">
              Demo data — synthetic, not real infrastructure data
            </span>
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Print Report"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Report"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Header block */}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex flex-wrap justify-between items-start gap-2">
              <div>
                <h1 className="text-xl font-black text-white">{scenario.title}</h1>
                <p className="text-slate-300 text-xs mt-1">
                  Domain: <strong>{scenario.domain.toUpperCase()}</strong> • Category: <strong>{scenario.category}</strong>
                  {scenario.studyAreaLabel ? ` • Study area: ${scenario.studyAreaLabel}` : ''}
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-400 font-mono">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Model: {best?.modelVersion || 'Deterministic Core v2.4'}</div>
              </div>
            </div>
          </div>

          {/* Mandatory Disclaimers per Trust Contract */}
          <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 text-amber-200 space-y-1.5 text-[11px]">
            <strong className="block font-bold text-amber-300">TRUST & SAFETY NOTICE:</strong>
            <p>
              This document contains output from an exploratory planning simulation. Calculations are generated from deterministic models (Darcy-Weisbach water hydraulics, DC load flow with approximate loss estimates, or Cell Transmission traffic). Network inputs are synthetic demo data — not verified utility records or certified engineering drawings. Validate models and source data with qualified licensed engineers before procurement or construction.
            </p>
            <p className="text-amber-100/90">
              <strong>Solver Scope:</strong> {domainModelLimitNote}
            </p>
          </div>

          {problemUnavailable && (
            <div role="alert" className="p-4 rounded-xl bg-rose-950/35 border border-rose-500/50 text-rose-200 flex items-start gap-2.5 text-[11px]">
              <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">Unmodeled Physics Disclosure:</strong>
                <span>{scenario.problemStatement?.unavailableReason || 'The selected problem requires physics not modeled by this prototype. Figures below reflect only the underlying steady-state/CTM baseline topology.'}</span>
              </div>
            </div>
          )}

          {/* Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Executive Evaluation Summary
            </h3>
            {best ? (
              <div className="space-y-1.5">
                <p className="leading-relaxed">
                  Alternative <strong>'{best.alternativeName}'</strong> ranked #1 with a normalized multi-criteria utility score of <strong>{best.normalizedScores.overallUtility}/100</strong>.{' '}
                  {(best.unverifiedConstraints?.length || 0) > 0 ? (
                    <span className="text-amber-300">
                      Evaluated physical constraints passed, though {best.unverifiedConstraints!.length} check(s) remain unverified ({best.unverifiedConstraints!.join('; ')}).
                    </span>
                  ) : best.feasible ? (
                    <span className="text-emerald-300">
                      It satisfied all evaluated operational constraints without boundary breaches.
                    </span>
                  ) : (
                    <span className="text-rose-300">
                      No feasible alternative eliminated all limit violations; this top-scoring option still triggered {best.constraintViolations.length} boundary breach(es): {best.constraintViolations.slice(0, 2).join('; ')}.
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="text-slate-400">No solution alternatives are configured for this scenario.</p>
            )}
          </div>

          {/* Comparative Results Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Alternative Ranking & Metric Summary
            </h3>
            <div className="rounded-xl border border-slate-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-300 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Rank & Alternative</th>
                    <th className="p-3">Primary Metric</th>
                    <th className="p-3">5-Yr Cost (Synthetic)</th>
                    <th className="p-3">Utility</th>
                    <th className="p-3">Feasibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                  {ranked.map((alt, i) => (
                    <tr key={alt.alternativeId}>
                      <td className="p-3 font-bold text-white">
                        #{i + 1} {alt.alternativeName}
                      </td>
                      <td className="p-3 font-mono text-cyan-300">
                        {alt.metrics.primaryPerformance.toFixed(1)} {alt.metrics.primaryPerformanceUnit}
                      </td>
                      <td className="p-3 font-mono text-purple-300">
                        {alt.costDataStatus === 'not-estimated' ? 'Not estimated' : formatCostEstimate(alt.metrics.totalCostMillion)}
                      </td>
                      <td className="p-3 font-bold text-white">
                        {alt.normalizedScores.overallUtility}/100
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            (alt.unverifiedConstraints?.length || 0) > 0
                              ? 'bg-amber-500/20 text-amber-300'
                              : alt.feasible
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {(alt.unverifiedConstraints?.length || 0) > 0
                            ? 'Partial check'
                            : alt.feasible
                            ? 'Pass'
                            : `Breach (${alt.constraintViolations.length})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ranked.some((r) => !r.feasible) && (
              <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-rose-300">Active Constraint Breaches Reported by Solver:</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {ranked.filter((r) => !r.feasible).map((r) => (
                      <li key={r.alternativeId}>
                        <strong>{r.alternativeName}:</strong> {r.constraintViolations.slice(0, 2).join('; ')}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Declared Assumptions & Limits */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Declared Assumptions & Boundary Conditions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {scenario.assumptions.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-300 block text-[10px]">{a.name}</span>
                  <strong className="text-white">
                    {a.value} {a.unit}
                  </strong>
                  <span className="text-slate-400 text-[10px] block mt-0.5">
                    Range: [{a.rangeMin} .. {a.rangeMax}]
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
