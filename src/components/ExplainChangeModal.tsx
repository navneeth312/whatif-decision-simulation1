import React, { useState } from 'react';
import { AssetComparisonChange } from '../models/comparisonChangeNavigator';
import {
  X,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Info,
  Wrench,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  Network
} from 'lucide-react';

interface ExplainChangeModalProps {
  change: AssetComparisonChange | null;
  totalChanges: number;
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
}

export const ExplainChangeModal: React.FC<ExplainChangeModalProps> = ({
  change,
  totalChanges,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  isOpen
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!isOpen || !change) return null;

  const { explanation } = change;
  const isImproved = change.category === 'improved';
  const isDegraded = change.category === 'degraded';
  const isModified = change.category === 'directly-modified';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/70 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isImproved
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : isDegraded
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : isModified
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              {isImproved ? (
                <Sparkles className="w-5 h-5" />
              ) : isDegraded ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isModified ? (
                <Wrench className="w-5 h-5" />
              ) : (
                <Activity className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                  CHANGE {currentIndex + 1} OF {totalChanges}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    isImproved
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : isDegraded
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : isModified
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {change.categoryLabel}
                </span>
              </div>
              <h2 id="explain-modal-title" className="text-base sm:text-lg font-bold text-white truncate max-w-md">
                {change.assetName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm text-slate-200">
          {/* Top Before vs After Pill */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase font-semibold text-slate-400 block">
                {change.metricLabel} Comparison
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm sm:text-base font-semibold text-slate-300">
                  {change.beforeValue.toFixed(1)} {change.unit}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <span
                  className={`font-mono text-sm sm:text-base font-bold ${
                    isImproved
                      ? 'text-emerald-400'
                      : isDegraded
                        ? 'text-rose-400'
                        : 'text-cyan-300'
                  }`}
                >
                  {change.afterValue.toFixed(1)} {change.unit}
                </span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    change.deltaPct >= 0
                      ? isImproved
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                      : isDegraded
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {change.deltaPct >= 0 ? `+${change.deltaPct}%` : `${change.deltaPct}%`}
                </span>
              </div>
            </div>
            {change.interventionLabel && (
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Intervention Action</span>
                <span className="text-xs font-medium text-cyan-300">{change.interventionLabel}</span>
              </div>
            )}
          </div>

          {/* 10-Point Plain-Language Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1 & 2: What & Where */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs uppercase tracking-wide">
                <Info className="w-3.5 h-3.5" /> 1. What Changed & 2. Where
              </div>
              <p className="text-slate-300 leading-relaxed">{explanation.whatChanged}</p>
              <p className="text-slate-400 text-xs italic">{explanation.whereChanged}</p>
            </div>

            {/* 3 & 4: Before vs After Situation */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs uppercase tracking-wide">
                <Layers className="w-3.5 h-3.5" /> 3. Before vs 4. After Situation
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-slate-200">Before:</strong> {explanation.situationBefore}
              </p>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-slate-200">After:</strong> {explanation.situationAfter}
              </p>
            </div>

            {/* 5: Why Did This Happen */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs uppercase tracking-wide">
                <Activity className="w-3.5 h-3.5" /> 5. Why Did This Change Happen?
              </div>
              <p className="text-slate-300 leading-relaxed">{explanation.whyHappened}</p>
            </div>

            {/* 6 & 7: Direct Benefit & Negative/Secondary Effects */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wide">
                <CheckCircle2 className="w-3.5 h-3.5" /> 6. Direct Benefit & 7. Secondary Effects
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-emerald-300">Benefit:</strong> {explanation.directBenefit}
              </p>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-amber-300">Secondary Effect:</strong> {explanation.negativeOrSecondaryEffects}
              </p>
            </div>

            {/* 8: Connected Assets Affected */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-purple-400 font-semibold text-xs uppercase tracking-wide">
                <Network className="w-3.5 h-3.5" /> 8. Connected Assets Affected
              </div>
              <p className="text-slate-300 leading-relaxed">{explanation.connectedAssetsAffected}</p>
            </div>

            {/* 9 & 10: Watch Out For & Practical Takeaway */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5" /> 9. Watch Out For & 10. Practical Takeaway
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-rose-300">Watch:</strong> {explanation.watchOutFor}
              </p>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-cyan-300">Takeaway:</strong> {explanation.practicalTakeaway}
              </p>
            </div>
          </div>

          {/* Expandable Technical & Audit Details */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-950/70 hover:bg-slate-950 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-xs font-bold text-slate-200">
                  Technical Details, Governing Equations & Audit Boundaries
                </span>
              </div>
              {showTechnicalDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="p-4 bg-slate-950/90 border-t border-slate-800 space-y-3.5 text-xs text-slate-300">
                {/* Calculated Results */}
                <div>
                  <h4 className="font-semibold text-emerald-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Calculated Solver Outputs (Mathematically Verified)
                  </h4>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300 font-mono text-[11px]">
                    {explanation.calculatedResults.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Inferred Explanations */}
                <div>
                  <h4 className="font-semibold text-cyan-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Inferred Topology Mechanisms
                  </h4>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300 text-[11px]">
                    {explanation.inferredExplanations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Unmodeled Risks */}
                <div>
                  <h4 className="font-semibold text-amber-400 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Unmodeled Real-World Phenomena (Honest Disclosures)
                  </h4>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400 text-[11px]">
                    {explanation.unmodeledRisks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Governing Equation */}
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Governing Physical Equation
                  </span>
                  <div className="mt-1 p-2 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto">
                    {explanation.governingEquations}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/70 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            {onPrev && (
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={onPrev}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer"
              >
                Previous Change
              </button>
            )}
            {onNext && (
              <button
                type="button"
                disabled={currentIndex >= totalChanges - 1}
                onClick={onNext}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer"
              >
                Next Change
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
