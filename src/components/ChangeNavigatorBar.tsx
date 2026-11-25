import React, { useState } from 'react';
import { AssetComparisonChange } from '../models/comparisonChangeNavigator';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Minus,
  HelpCircle,
  Sparkles,
  AlertTriangle,
  Wrench,
  Activity,
  Layers,
  Info,
  CheckCircle2
} from 'lucide-react';

interface ChangeNavigatorBarProps {
  changes: AssetComparisonChange[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  onExplainClick: () => void;
  isDifferenceMode?: boolean;
}

export const ChangeNavigatorBar: React.FC<ChangeNavigatorBarProps> = ({
  changes,
  currentIndex,
  onSelectIndex,
  onExplainClick,
  isDifferenceMode = false
}) => {
  const [showLegend, setShowLegend] = useState(false);
  const [isBarMinimized, setIsBarMinimized] = useState(false);

  const totalChanges = changes.length;
  const currentChange: AssetComparisonChange | null =
    totalChanges > 0 && currentIndex >= 0 && currentIndex < totalChanges
      ? changes[currentIndex]
      : null;

  if (totalChanges === 0) {
    return (
      <div className="w-full bg-slate-950/95 border-t border-slate-800 p-2.5 sm:p-3 text-xs text-slate-400 flex items-center justify-between shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>No physical asset modifications or performance deviations detected between baseline and this alternative.</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500 uppercase">0 Changes</span>
      </div>
    );
  }

  if (isBarMinimized) {
    return (
      <div className="w-full bg-slate-950/95 border-t border-cyan-500/40 px-3 py-1.5 flex items-center justify-between text-xs text-slate-300 shadow-2xl backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold">
            CHANGE {currentIndex + 1} / {totalChanges}
          </span>
          <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-md">
            {currentChange?.assetName || 'Asset Change'}
          </span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            ({currentChange?.categoryLabel || 'Modified'})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsBarMinimized(false)}
          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[11px] font-bold cursor-pointer transition flex items-center gap-1.5 shadow"
          title="Expand Change Navigator"
          aria-label="Expand Change Navigator"
        >
          <span>Expand Navigator</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const isImproved = currentChange?.category === 'improved';
  const isDegraded = currentChange?.category === 'degraded';
  const isModified = currentChange?.category === 'directly-modified';

  return (
    <div className="w-full bg-slate-950/95 border-t border-cyan-500/30 shadow-2xl backdrop-blur-md shrink-0">
      {/* Legend Drawer for Difference-Only Mode */}
      {showLegend && isDifferenceMode && (
        <div className="px-3 sm:px-4 py-2 border-b border-slate-800/80 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2 text-[11px] animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
            <span className="text-cyan-400 font-bold uppercase tracking-wider text-[10px]">Legend:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" /> Improved Performance
            </span>
            <span className="inline-flex items-center gap-1 text-cyan-300">
              <Wrench className="w-3.5 h-3.5" /> Directly Modified
            </span>
            <span className="inline-flex items-center gap-1 text-amber-400">
              <Activity className="w-3.5 h-3.5" /> Newly Affected / Stressed
            </span>
            <span className="inline-flex items-center gap-1 text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Degraded / Breach
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Layers className="w-3.5 h-3.5" /> Unchanged (Subdued)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowLegend(false)}
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer ml-auto"
          >
            Hide
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left: Previous / Index / Next */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="whatif-change-nav-prev-btn"
            type="button"
            disabled={currentIndex <= 0}
            onClick={() => onSelectIndex(currentIndex - 1)}
            aria-label="Previous Change"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-slate-800 transition cursor-pointer"
            title="Previous Change (ArrowLeft)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 font-mono text-[11px] font-bold text-cyan-300 shrink-0">
            CHANGE {currentIndex + 1} / {totalChanges}
          </span>

          <button
            id="whatif-change-nav-next-btn"
            type="button"
            disabled={currentIndex >= totalChanges - 1}
            onClick={() => onSelectIndex(currentIndex + 1)}
            aria-label="Next Change"
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-slate-800 transition cursor-pointer"
            title="Next Change (ArrowRight)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Current Change summary */}
        {currentChange && (
          <div className="flex-1 min-w-[240px] flex items-center gap-2 overflow-hidden">
            <span
              className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                isImproved
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : isDegraded
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : isModified
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}
            >
              {isImproved ? (
                <Sparkles className="w-3 h-3" />
              ) : isDegraded ? (
                <AlertTriangle className="w-3 h-3" />
              ) : isModified ? (
                <Wrench className="w-3 h-3" />
              ) : (
                <Activity className="w-3 h-3" />
              )}
              {currentChange.categoryLabel}
            </span>

            <div className="truncate text-xs">
              <span className="font-bold text-white mr-1.5">{currentChange.assetName}:</span>
              <span className="font-mono text-slate-300 mr-1">
                {currentChange.beforeValue.toFixed(1)} → {currentChange.afterValue.toFixed(1)} {currentChange.unit}
              </span>
              <span
                className={`font-semibold mr-2 ${
                  currentChange.deltaPct >= 0
                    ? isImproved
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                    : isDegraded
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                }`}
              >
                ({currentChange.deltaPct >= 0 ? `+${currentChange.deltaPct}%` : `${currentChange.deltaPct}%`})
              </span>
              <span className="text-slate-400 hidden xl:inline truncate">
                • {currentChange.explanation.directBenefit}
              </span>
            </div>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {isDifferenceMode && (
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Legend</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExplainClick}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer flex items-center gap-1.5 shadow-md"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Explain This Change</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBarMinimized(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
            title="Minimize Change Navigator"
            aria-label="Minimize Change Navigator"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
