import React from 'react';
import { ComparisonSummaryData } from '../models/comparisonChangeNavigator';
import {
  Sparkles,
  AlertTriangle,
  Wrench,
  Activity,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface ComparisonSummaryBarProps {
  summary: ComparisonSummaryData;
  alternativeName: string;
}

export const ComparisonSummaryBar: React.FC<ComparisonSummaryBarProps> = ({
  summary,
  alternativeName
}) => {
  const isFeasible = summary.feasibilityStatus === 'FEASIBLE';
  const isViolations = summary.feasibilityStatus === 'VIOLATIONS_REMAIN';

  return (
    <div className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-lg flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
      {/* Left: Alternative & Primary Metric */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="font-bold text-white truncate max-w-[200px]" title={alternativeName}>
            {alternativeName}
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
          <span className="text-slate-400 text-[10px] uppercase font-sans font-semibold">
            {summary.primaryMetricSummary.label}:
          </span>
          <span className="font-bold text-emerald-400">
            {summary.primaryMetricSummary.before.toFixed(1)} → {summary.primaryMetricSummary.after.toFixed(1)}{' '}
            {summary.primaryMetricSummary.unit}
          </span>
          <span className="font-semibold text-emerald-300">
            ({summary.primaryMetricSummary.deltaPct >= 0
              ? `+${summary.primaryMetricSummary.deltaPct}%`
              : `${summary.primaryMetricSummary.deltaPct}%`})
          </span>
        </div>
      </div>

      {/* Right: Summary Counts & Feasibility Badge */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 ml-auto">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold text-[10px]"
          title="Directly Modified Assets"
        >
          <Wrench className="w-3 h-3" />
          {summary.totalModified} Modified
        </span>

        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]"
          title="Improved Infrastructure Assets"
        >
          <Sparkles className="w-3 h-3" />
          {summary.totalImproved} Improved
        </span>

        {summary.totalDegraded > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold text-[10px]"
            title="Degraded Performance / Breached Assets"
          >
            <AlertTriangle className="w-3 h-3" />
            {summary.totalDegraded} Degraded
          </span>
        )}

        {summary.totalNewlyAffected > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold text-[10px]"
            title="Newly Stressed / Displaced Flow Assets"
          >
            <Activity className="w-3 h-3" />
            {summary.totalNewlyAffected} Displaced
          </span>
        )}

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        {/* Feasibility Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
            isFeasible
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : isViolations
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}
          title={summary.feasibilityReason}
        >
          {isFeasible ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : isViolations ? (
            <XCircle className="w-3.5 h-3.5" />
          ) : (
            <Clock className="w-3.5 h-3.5" />
          )}
          {summary.feasibilityStatus === 'FEASIBLE'
            ? 'Feasible (0 Violations)'
            : summary.feasibilityStatus === 'VIOLATIONS_REMAIN'
              ? `${summary.remainingViolations} Violation(s) Remain`
              : 'Partial Validation'}
        </span>
      </div>
    </div>
  );
};
