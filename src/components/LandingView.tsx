import React, { useMemo } from 'react';
import {
  Play,
  ArrowRight,
  Cpu,
  ShieldCheck,
  Layers,
  Sparkles,
  Activity,
  Droplets,
  Zap,
  Car
} from 'lucide-react';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import {
  runBaselineSimulation,
  runAlternativeSimulation,
  normalizeAndRankAlternatives
} from '../models/decisionEngines';
import { formatCostEstimate } from '../utils/currencyFormatter';

interface LandingViewProps {
  onGetStarted: () => void;
  onExploreScenario: (domain: 'traffic' | 'water' | 'energy') => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onExploreScenario
}) => {
  // Compute real deterministic solver metrics for the 3 domain cards around the hero globe
  const domainCards = useMemo(() => {
    return DEFAULT_SCENARIOS.map((scen) => {
      const baseline = runBaselineSimulation(scen);
      const rawResults = scen.alternatives.map((alt) =>
        runAlternativeSimulation(scen, alt)
      );
      const ranked = normalizeAndRankAlternatives(scen, rawResults);
      const best = [...ranked].sort(
        (a, b) =>
          b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
      )[0];
      const bestAlt = scen.alternatives.find(
        (a) => a.id === best?.alternativeId
      );

      return {
        domain: scen.domain,
        title: scen.title,
        category: scen.category,
        bestAltName: bestAlt?.name || 'Solution A',
        utilityScore: best?.normalizedScores.overallUtility ?? 0,
        baselineVal: baseline.metrics.primaryPerformance.toFixed(1),
        bestVal: (
          best?.metrics.primaryPerformance ??
          baseline.metrics.primaryPerformance
        ).toFixed(1),
        unit: baseline.metrics.primaryPerformanceUnit,
        costLabel: bestAlt
          ? `${formatCostEstimate(bestAlt.capexCostMillion)} (Estimated)`
          : 'N/A',
        solverName:
          scen.domain === 'traffic'
            ? 'CTM Macroscopic Flow'
            : scen.domain === 'water'
            ? 'Darcy-Weisbach Network'
            : 'DC Power Flow (Bθ)'
      };
    });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto whatif-canvas-bg text-slate-100 flex flex-col justify-between relative">
      {/* Ambient Background Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-28 left-1/4 w-[520px] h-[520px] bg-indigo-600/15 rounded-full blur-[130px]" />
        <div className="absolute top-1/3 right-10 w-[460px] h-[460px] bg-cyan-500/15 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[320px] bg-purple-600/12 rounded-full blur-[120px]" />
      </div>

      {/* Main Hero Section matching Reference 01 */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 pt-6 pb-10 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center my-auto">
        {/* Left Column: Copy & CTAs */}
        <div className="lg:col-span-6 space-y-5 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-amber-300 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Future Decision Intelligence Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight leading-[1.1] text-white">
            Simulate Today.
            <span className="block text-white mt-1">Explore Possibilities.</span>
            <span className="block mt-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-300 bg-clip-text text-transparent">
              Build a Better Tomorrow.
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed">
            An interactive infrastructure simulation workspace to test alternative engineering solutions, evaluate calculated outcomes, inspect capital costs and operational risks, and choose the resilient path for complex network challenges.
          </p>

          {/* Primary & Secondary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <button
              onClick={onGetStarted}
              className="px-6 py-3.5 rounded-full whatif-pill-primary text-white font-bold text-sm flex items-center gap-2.5 transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onExploreScenario('traffic')}
              className="px-6 py-3.5 rounded-full bg-slate-900/90 hover:bg-slate-800/90 text-slate-100 font-semibold text-sm border border-slate-700/80 hover:border-cyan-400/50 flex items-center gap-2.5 transition cursor-pointer shadow-lg"
            >
              <span>Launch Decision Simulation</span>
              <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
            </button>
          </div>

          {/* Truthful Disclosure Pill */}
          <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-medium">
              Synthetic demo data — not real infrastructure data
            </span>
            <span>•</span>
            <span>Single-device local workspace • No cloud account required</span>
          </div>

          {/* Bottom Capability Row matching Reference 01 */}
          <div className="pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">3 Physics Solvers</div>
                <div className="text-[10px] text-slate-400">Water, Grid & Traffic</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Traceable Math</div>
                <div className="text-[10px] text-slate-400">Residual & CFL checks</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">14 Decision Tools</div>
                <div className="text-[10px] text-slate-400">Stress & Ripple engines</div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/90 flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">2D & 3D Twin</div>
                <div className="text-[10px] text-slate-400">Synchronized state</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Luminous Holographic Globe & Floating Domain Cards matching Reference 01 */}
        <div className="lg:col-span-6 relative flex flex-col items-center justify-center min-h-[420px] sm:min-h-[480px]">
          {/* Glowing Holographic Globe Centerpiece */}
          <div className="relative w-[290px] h-[290px] sm:w-[360px] sm:h-[360px] flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-600/25 via-cyan-500/20 to-purple-500/25 blur-2xl" />

            <svg
              viewBox="0 0 400 420"
              className="w-full h-full drop-shadow-[0_0_35px_rgba(34,211,238,0.35)]"
              role="img"
              aria-label="Holographic Infrastructure Digital Twin Globe"
            >
              <defs>
                <radialGradient id="globeCore" cx="50%" cy="45%" r="48%">
                  <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#0f172a" stopOpacity="0.95" />
                  <stop offset="88%" stopColor="#0284c7" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
                </radialGradient>
                <linearGradient id="ringCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="continentGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.85" />
                </linearGradient>
              </defs>

              <ellipse cx="200" cy="368" rx="145" ry="26" fill="none" stroke="url(#ringCyan)" strokeWidth="2.5" />
              <ellipse cx="200" cy="368" rx="110" ry="18" fill="rgba(6,182,212,0.12)" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="6 4" />
              <ellipse cx="200" cy="368" rx="72" ry="11" fill="rgba(99,102,241,0.28)" stroke="#a855f7" strokeWidth="2" />
              <path
                d="M90,365 L45,210 L355,210 L310,365 Z"
                fill="url(#ringCyan)"
                opacity="0.12"
              />

              <circle cx="200" cy="185" r="142" fill="url(#globeCore)" stroke="#38bdf8" strokeWidth="2" />

              <ellipse cx="200" cy="185" rx="142" ry="52" fill="none" stroke="#38bdf8" strokeOpacity="0.28" strokeWidth="1" />
              <ellipse cx="200" cy="185" rx="142" ry="102" fill="none" stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="1" />
              <ellipse cx="200" cy="185" rx="52" ry="142" fill="none" stroke="#38bdf8" strokeOpacity="0.28" strokeWidth="1" />
              <ellipse cx="200" cy="185" rx="102" ry="142" fill="none" stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="1" />
              <line x1="58" y1="185" x2="342" y2="185" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1.2" />
              <line x1="200" y1="43" x2="200" y2="327" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1.2" />

              <path
                d="M115,120 Q145,95 175,125 T235,115 T285,155"
                fill="none"
                stroke="url(#continentGlow)"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
              <path
                d="M105,195 Q160,165 205,205 T295,190"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
              />
              <path
                d="M135,255 Q195,220 255,250"
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
              />

              {[
                { cx: 125, cy: 122, r: 5, color: '#fbbf24' },
                { cx: 175, cy: 125, r: 4.5, color: '#22d3ee' },
                { cx: 235, cy: 115, r: 5.5, color: '#fbbf24' },
                { cx: 280, cy: 155, r: 4.5, color: '#38bdf8' },
                { cx: 150, cy: 185, r: 6, color: '#34d399' },
                { cx: 205, cy: 205, r: 6, color: '#fbbf24' },
                { cx: 265, cy: 195, r: 5, color: '#a855f7' },
                { cx: 165, cy: 242, r: 4.5, color: '#22d3ee' },
                { cx: 240, cy: 245, r: 5, color: '#34d399' }
              ].map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.cx} cy={pt.cy} r={pt.r * 2.4} fill={pt.color} opacity="0.22" />
                  <circle cx={pt.cx} cy={pt.cy} r={pt.r} fill={pt.color} />
                </g>
              ))}

              <ellipse
                cx="200"
                cy="195"
                rx="178"
                ry="48"
                fill="none"
                stroke="url(#ringCyan)"
                strokeWidth="2"
                transform="rotate(-14 200 195)"
              />
            </svg>
          </div>

          {/* 3 Interactive Floating Infrastructure Cards around/below the Globe */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 relative z-20">
            {domainCards.map((card) => {
              const Icon =
                card.domain === 'traffic'
                  ? Car
                  : card.domain === 'water'
                  ? Droplets
                  : Zap;
              const accentBorder =
                card.domain === 'traffic'
                  ? 'hover:border-indigo-400/80 border-indigo-500/35'
                  : card.domain === 'water'
                  ? 'hover:border-cyan-400/80 border-cyan-500/35'
                  : 'hover:border-purple-400/80 border-purple-500/35';
              const badgeColor =
                card.domain === 'traffic'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : card.domain === 'water'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/40';

              return (
                <button
                  type="button"
                  key={card.domain}
                  onClick={() => onExploreScenario(card.domain)}
                  className={`text-left whatif-card p-3.5 rounded-2xl border ${accentBorder} transition-all cursor-pointer group flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${badgeColor} flex items-center gap-1`}>
                        <Icon className="w-3 h-3" />
                        {card.domain}
                      </span>
                      <span className="text-[10px] font-mono text-amber-300/90 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded">
                        Synthetic demo
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                      {card.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Solver: {card.solverName}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px]">Baseline → Best:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {card.baselineVal} → {card.bestVal} {card.unit}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px]">Calculated Utility:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {card.utilityScore}/100 ({card.costLabel})
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
