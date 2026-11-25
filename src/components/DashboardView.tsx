import React from 'react';
import { Compass, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { Scenario } from '../types';

interface DashboardViewProps {
  scenarios?: Scenario[];
  activeDomain?: 'traffic' | 'water' | 'energy';
  onSelectScenario?: (id: string) => void;
  onOpenCreateModal?: () => void;
  onOpenTemplates?: () => void;
  onOpenDecisionTools?: () => void;
  onOpenCompare?: () => void;
  onOpenSimulation: () => void;
  onContinueSimulation?: () => void;
  onOpenMap: (mode?: '2d' | '3d' | 'holo') => void;
  onSelectProblem?: (domain: 'traffic' | 'water' | 'energy', problemId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSimulation,
  onOpenMap,
  onSelectProblem
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between whatif-canvas-bg text-slate-100 max-w-5xl mx-auto w-full min-h-[calc(100vh-4rem)]">
      <div className="space-y-8 my-auto py-6">
        {/* Minimal Hero Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Decision Support for Infrastructure</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
            WHATIF
          </h1>

          <p className="text-base sm:text-lg text-slate-200 font-medium">
            Understand a problem. Explore possible changes. See what could happen.
          </p>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Explore places and understand how possible decisions may affect the surrounding area before making real-world changes.
          </p>
        </div>

        {/* Two Prominent Primary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-2">
          {/* Card 1: EXPLORE MAP with 3 Map Mode Options */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 shadow-xl hover:shadow-cyan-500/10 transition flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition">
                <Compass className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  EXPLORE MAP
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                  Explore places, buildings, roads, water, and power infrastructure across the region.
                </p>
              </div>

              {/* Map Mode Selector (2D Map, 3D Map, Holographic Map) */}
              <div className="pt-1 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Select Map Experience:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenMap('3d')}
                    className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-400/70 text-left transition cursor-pointer flex flex-col justify-between group/mode"
                    title="Realistic 3D digital twin"
                  >
                    <span className="text-xs font-bold text-white group-hover/mode:text-cyan-300">3D Map</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Realistic view</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMap('2d')}
                    className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-400/70 text-left transition cursor-pointer flex flex-col justify-between group/mode"
                    title="Lightweight 2D geographic map"
                  >
                    <span className="text-xs font-bold text-white group-hover/mode:text-cyan-300">2D Map</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Flat geographic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMap('holo')}
                    className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-cyan-950/60 border border-slate-700/80 hover:border-cyan-400/70 text-left transition cursor-pointer flex flex-col justify-between group/mode"
                    title="Holographic visualization"
                  >
                    <span className="text-xs font-bold text-white group-hover/mode:text-cyan-300">Holo Map</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Hologram twin</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenMap('3d')}
              className="w-full py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-400/50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              <span>Open 3D Map</span>
              <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition" />
            </button>
          </div>

          {/* Card 2: START A SIMULATION */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/40 hover:border-indigo-400/70 shadow-xl hover:shadow-indigo-500/15 transition flex flex-col justify-between space-y-6 group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 group-hover:scale-105 transition">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                START A SIMULATION
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Describe a problem or an idea and explore its possible outcomes.
              </p>
            </div>

            <div className="space-y-2.5">
              {onSelectProblem && (
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Quick start by sector">
                  <button
                    type="button"
                    onClick={() => onSelectProblem('traffic')}
                    className="py-1.5 px-2 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-cyan-200 transition cursor-pointer"
                  >
                    Road Traffic
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectProblem('water')}
                    className="py-1.5 px-2 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-indigo-200 transition cursor-pointer"
                  >
                    Water Network
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectProblem('energy')}
                    className="py-1.5 px-2 rounded-xl bg-slate-950/75 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-amber-200 transition cursor-pointer"
                  >
                    Power Grid
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onOpenSimulation}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/25"
              >
                <span>Start Simulation</span>
                <ArrowRight className="w-4 h-4 text-slate-950 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Professional Disclaimer Footer */}
      <footer className="pt-6 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <p className="flex items-center gap-1.5 justify-center sm:justify-start">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Real-world infrastructure work should be checked by qualified professionals before implementation.</span>
        </p>
        <span className="text-slate-400 font-medium">WhatIf Decision Support</span>
      </footer>
    </div>
  );
};
