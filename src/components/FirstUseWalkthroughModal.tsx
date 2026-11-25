import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Car,
  Droplets,
  Zap,
  MapPin,
  TrendingUp,
  AlertTriangle,
  GitCompare,
  Clock,
  Layers,
  Sparkles,
  HelpCircle,
  Eye,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';

interface FirstUseWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  reducedMotion?: boolean;
}

interface WalkthroughStep {
  id: number;
  stageNumber: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  description: string;
  interfaceCallout: {
    targetElement: string;
    actionExplanation: string;
    keyTip: string;
  };
  details: string[];
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 1,
    stageNumber: 'Overview',
    title: 'What WhatIf is For',
    badge: 'Core Purpose',
    icon: HelpCircle,
    tagline: '“If I take this action here, what may improve, what else could happen, and what should I do next?”',
    description:
      'WhatIf is an executive decision-simulation command center. It helps planners, engineers, and decision-makers understand complex infrastructure problems, evaluate real-world solutions under true physics, and test future uncertainties before committing public capital.',
    interfaceCallout: {
      targetElement: 'Top Navigation Rail · 8 Connected Stages',
      actionExplanation: 'The 8-stage progress rail connects the problem to its solution, comparison, stress testing, and implementation roadmap.',
      keyTip: 'You can switch between the Guided 8-Stage Journey (recommended for first-time use) and the Full Command Center at any time.'
    },
    details: [
      'Deterministic in-browser physics solvers — no fabricated outputs or arbitrary random numbers.',
      'Explores road traffic congestion (CTM), municipal water hydraulics (Darcy-Weisbach), and power grid stability (Linearized DC Power Flow).',
      'All analysis runs locally on your single device using private local storage.'
    ]
  },
  {
    id: 2,
    stageNumber: 'Stage 1',
    title: 'Choose a Domain & Problem',
    badge: 'Sector Selection',
    icon: Car,
    tagline: 'Start by choosing an infrastructure sector and identifying the specific failure mode.',
    description:
      'Select Road Traffic, Municipal Water, or Electrical Power Grid. Each sector provides 14 curated problem templates detailing symptoms, thresholds, and affected assets, plus explicit unmodeled physics disclosures.',
    interfaceCallout: {
      targetElement: 'Stage 1: Sector Switcher & Problem Catalog',
      actionExplanation: 'Click a sector tab (Traffic / Water / Energy) to filter 42 domain problem statements.',
      keyTip: 'Problems labeled "Unmodeled Physics" transparently disclose phenomena outside the current model equations (such as water hammer or sub-cycle AC harmonics).'
    },
    details: [
      'Road Traffic: Cell Transmission Model evaluating flow, speed, and queue density on 16 corridor segments.',
      'Water Distribution: Darcy-Weisbach head loss and friction loss solving 14 junctions and 17 pipe mains.',
      'Electrical Power: DC Optimal Power Flow tracking thermal loading and bus angles across 12 buses and 18 lines.'
    ]
  },
  {
    id: 3,
    stageNumber: 'Stage 2',
    title: 'Understand Current Situation',
    badge: 'Baseline Evidence',
    icon: AlertTriangle,
    tagline: 'See what is failing right now, where it is located, and which limits are being breached.',
    description:
      'Before testing solutions, review the baseline diagnostics. WhatIf breaks the situation down into 4 plain-language questions: What is happening? Where is it located? What evidence and sensor inputs support it? Which engineering limits are crossed?',
    interfaceCallout: {
      targetElement: 'Stage 2: 4 Plain-Language Breakdown Cards & Diagnostics List',
      actionExplanation: 'Inspect current measured values (e.g. 15.7 km/h speed, 118 kPa pressure) beside required thresholds.',
      keyTip: 'Breached limits are highlighted in red; near-limit warnings appear in amber so you know where risk concentrates.'
    },
    details: [
      'Identifies specific affected physical assets (corridor cells, water nodes, or transmission lines).',
      'Discloses baseline model assumptions (demand inflow, peak multiplier, pipe roughness) with sensitivity sliders in Advanced Analysis.'
    ]
  },
  {
    id: 4,
    stageNumber: 'Stage 3',
    title: 'Select or Confirm Your Study Place',
    badge: 'Spatial Grounding',
    icon: MapPin,
    tagline: 'Ground your decision in real geographic space using verified OpenStreetMap data.',
    description:
      'WhatIf models the continuous capital region covering Nambur, Vijayawada, Guntur, Tenali, Amaravati, Mangalagiri, and surrounding settlements. Select a place and confirm it as the active study area.',
    interfaceCallout: {
      targetElement: 'Stage 3: Place Dropdown & [📍 Use this place] Button',
      actionExplanation: 'Choose a city, town, or mandal, then click "Use this place" to lock the location for decision analysis and smoothly center the camera.',
      keyTip: 'The map shows verified OSM footprints, roads, and waterways. Untagged building heights are clearly identified as visual estimates.'
    },
    details: [
      'Selecting a place updates the active study area context and repositions scenario assets.',
      'OSM coverage statistics display real footprint and road counts for the selected viewport.',
      'OpenStreetMap attribution is always credited under the ODbL license.'
    ]
  },
  {
    id: 5,
    stageNumber: 'Stage 4 & 5',
    title: 'Review Solutions & Compare Trade-offs',
    badge: 'Solution Evaluation',
    icon: GitCompare,
    tagline: 'Compare candidate engineering interventions side by side against the unmodified baseline.',
    description:
      'Stage 4 shows interventions targeting the problem (Baseline, Solution A, B, C). Stage 5 compares outcomes: primary performance improvement (±%), constraint satisfaction, capital cost ($M), schedule (months), and overall multi-criteria utility.',
    interfaceCallout: {
      targetElement: 'Stage 4 Solution Cards & Stage 5 Comparison Table',
      actionExplanation: 'Click any solution card to simulate it in-place and see instant delta gains and trade-offs.',
      keyTip: 'Look at the Executive Recommendation box to understand WHY an option is recommended based on feasibility and budget.'
    },
    details: [
      'Each solution explains "What it changes" (e.g. adding a dedicated lane, retiming signals, replacing a main).',
      'Breached constraints (e.g. budget cap violation) are flagged in red so you see immediate trade-offs.',
      'Rankings automatically exclude cost/delivery weights if financial data is marked not-estimated.'
    ]
  },
  {
    id: 6,
    stageNumber: 'Stage 6',
    title: 'Explore Future Stress Scenarios',
    badge: 'Risk & Resilience',
    icon: Clock,
    tagline: 'Test what could happen under future shocks: demand growth, extreme weather, and equipment outages.',
    description:
      'Good decisions withstand future shocks. WhatIf evaluates conditional stress cases (such as 5-year enrollment growth, summer heatwave, or facility trip) on both the Baseline and your chosen solution.',
    interfaceCallout: {
      targetElement: 'Stage 6: Conditional Future Stress Cards',
      actionExplanation: 'Review how your chosen option performs compared to the baseline under declared shock conditions.',
      keyTip: 'These are clearly labeled as conditional stress tests, NOT unconditional forecasts or prophecies.'
    },
    details: [
      'Shows whether an intervention keeps the system in the Clear, Warning, or Critical zone during a shock.',
      'Identifies potential follow-on bottlenecks or secondary issues created by the intervention.'
    ]
  },
  {
    id: 7,
    stageNumber: 'Stage 7',
    title: 'Digital Twin Map Controls',
    badge: '3D & Hologram Views',
    icon: Eye,
    tagline: 'Inspect spatial consequences, flows, and asset statuses on 2D, normal 3D, and holographic 3D maps.',
    description:
      'Selecting an option updates map asset colors, telemetry, and speed flows in-place without reloading. Switch between Normal 3D, Luminous Holographic 3D, and 2D views, and scrub through simulation time steps.',
    interfaceCallout: {
      targetElement: 'Stage 7: 3D / HOLO / 2D View Switcher & Timeline Scrubber',
      actionExplanation: 'Use left-click drag to orbit, Shift+drag to pan, and scroll wheel to zoom. Click [3D], [HOLO], or [2D] to switch visualization modes.',
      keyTip: 'Normal 3D provides crisp extruded architectural detail; Hologram 3D presents a luminous electric-blue holographic city over a spatial coordinate grid.'
    },
    details: [
      'Hover or click any network asset on the map to inspect live flow velocity, queue density, pressure, or line loading.',
      'Step scrubber (Step 0 to 30) with Play/Pause and 1x/2x/4x playback speeds lets you watch bottleneck propagation over time.',
      'Zoom-dependent labels reveal neighborhoods and landmarks as you zoom in without area names abruptly vanishing.'
    ]
  },
  {
    id: 8,
    stageNumber: 'Stage 8',
    title: 'Practical Next Steps & Advanced Tools',
    badge: 'Implementation & Depth',
    icon: FileCheck2,
    tagline: 'Translate simulated solutions into an actionable 6-part planning roadmap.',
    description:
      'Stage 8 provides an implementation checklist: prerequisites, 3-phase schedule with durations, operational precautions, post-deployment monitoring, and missing data disclosures, framed by the Professional Engineering (PE) approval boundary.',
    interfaceCallout: {
      targetElement: 'Stage 8 Implementation Cards & "Advanced Analysis" Drawer',
      actionExplanation: 'Review the planning roadmap, export decision reports, or open the Advanced Analysis drawer for governing physics equations and sensitivity sliders.',
      keyTip: 'Access 14 Advanced Decision Tools (TOPSIS, Monte Carlo, Robust Decision Making) and the Offline Assistant from the header buttons.'
    },
    details: [
      'Prerequisites specify alignment surveys, right-of-way, and sensor audits required before construction.',
      'Clear legal notice: WhatIf provides macro planning; final construction packages require licensed PE stamping.',
      'Progressive disclosure keeps the main journey clean while preserving all mathematical formulas and sensitivity controls.'
    ]
  }
];

export const FirstUseWalkthroughModal: React.FC<FirstUseWalkthroughModalProps> = ({
  isOpen,
  onClose,
  reducedMotion = false
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentStepIndex((prev) => Math.min(WALKTHROUGH_STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStepIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStep = WALKTHROUGH_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = currentStepIndex === WALKTHROUGH_STEPS.length - 1;

  const handleFinish = () => {
    try {
      localStorage.setItem('whatif_walkthrough_seen', 'true');
    } catch {}
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-title"
      aria-describedby="walkthrough-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center text-cyan-300 shrink-0">
              <StepIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                  {currentStep.stageNumber}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {currentStep.badge}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hidden sm:inline-block">
                  Recommended First Tour
                </span>
              </div>
              <h2 id="walkthrough-title" className="text-lg sm:text-xl font-extrabold text-white tracking-tight mt-0.5">
                {currentStep.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            aria-label="Close walkthrough"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 text-xs sm:text-sm">
          {/* Tagline Callout */}
          <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-500/40 text-indigo-200">
            <p className="font-semibold italic text-xs sm:text-sm leading-relaxed">
              {currentStep.tagline}
            </p>
          </div>

          {/* Step Description */}
          <p id="walkthrough-description" className="text-slate-300 leading-relaxed text-xs sm:text-sm">
            {currentStep.description}
          </p>

          {/* Interface Callout: Points to the Actual App Controls */}
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-300 font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>On the Interface: {currentStep.interfaceCallout.targetElement}</span>
              </span>
              <span className="text-[10px] text-slate-500">Live Element</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentStep.interfaceCallout.actionExplanation}
            </p>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300/90 flex items-start gap-1.5">
              <span className="font-bold text-amber-400">💡 Pro Tip:</span>
              <span>{currentStep.interfaceCallout.keyTip}</span>
            </div>
          </div>

          {/* Key Checklist Details */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Key Concepts to Note
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {currentStep.details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Footer: Step Navigation & Progress Dots */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-0 z-10">
          {/* Progress Indicator */}
          <div className="flex items-center gap-1.5">
            {WALKTHROUGH_STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                aria-label={`Go to step ${idx + 1}: ${step.title}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  currentStepIndex === idx
                    ? 'w-6 bg-cyan-400'
                    : 'w-2 bg-slate-700 hover:bg-slate-500'
                }`}
              />
            ))}
            <span className="text-[11px] font-mono text-slate-400 ml-2">
              {currentStepIndex + 1} of {WALKTHROUGH_STEPS.length}
            </span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleFinish}
              className="py-2 px-3 rounded-xl bg-transparent hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              Skip Tour
            </button>

            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {!isLastStep ? (
              <button
                type="button"
                onClick={() => setCurrentStepIndex((prev) => prev + 1)}
                className="py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-cyan-500/20"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="py-2 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Start Exploring</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
