/**
 * Action-First Structured Parser & Engineering Safety Validator
 *
 * Implements deterministic semantic parsing, physics boundary checking,
 * and input safety sanitization for user-entered Action-First proposals.
 *
 * Classifies all user submissions into 4 unambiguous validation states:
 * 1. 'supported-complete': Mapped to active solver variables with equations and asset targets.
 * 2. 'relevant-unsupported': Real infrastructure concepts intentionally outside the deterministic solver.
 * 3. 'ambiguous-incomplete': Recognizable intent but missing specific asset, lever, or scope.
 * 4. 'unrelated-or-invalid': Non-infrastructure text, script injection, or empty inputs.
 */

import { DomainType, ParameterModification, Scenario, SolutionAlternative } from '../types';
import { DOMAIN_KNOWLEDGE_BASE } from './domainKnowledge';

export type ActionValidationStatus =
  | 'supported-complete'
  | 'relevant-unsupported'
  | 'ambiguous-incomplete'
  | 'unrelated-or-invalid';

export type ActionVerb = 'build' | 'change' | 'upgrade' | 'restrict';

export interface ClarificationOption {
  label: string;
  actionText: string;
  description: string;
  impactSummary: string;
}

export interface ParsedActionProposal {
  status: ActionValidationStatus;
  statusLabel: string;
  rawText: string;
  cleanedText: string;
  verb: ActionVerb;
  activeDomain: DomainType;
  detectedDomain: DomainType | 'unrelated';
  domainMismatch: boolean;
  confidenceScore: number;
  confidenceLabel?: string;

  // Multi-part / combined action decomposition
  isMultiPartAction?: boolean;
  modeledComponents?: Array<{
    component: string;
    assetId: string;
    parameter: string;
    delta: string;
  }>;
  unmodeledComponents?: Array<{
    component: string;
    reason: string;
    requiredDataOrModel: string;
  }>;

  // Supported & complete
  targetAssetId?: string;
  targetAssetName?: string;
  modifications?: ParameterModification[];
  governingEquation?: {
    name: string;
    formula: string;
    explanation: string;
  };
  estimatedCapexMillion?: number;
  estimatedOpexMillion?: number;
  deliveryMonths?: number;
  synthesizedAlternative?: SolutionAlternative;
  modeledMechanismSummary?: string;

  // Relevant but unsupported
  unmodeledPhenomenon?: string;
  whyUnmodeled?: string;
  requiredDataOrModel?: string;
  recommendedSupportedAlternative?: string;
  suggestedActionPrompt?: string;

  // Ambiguous / incomplete
  clarificationQuestion?: string;
  clarificationOptions?: ClarificationOption[];

  // Unrelated or invalid
  rejectionReason?: string;
  guidanceMessage?: string;
  examplePrompts?: string[];

  evidenceSummary: string;
  warnings: string[];
}

export interface ParseActionOptions {
  rawText: string;
  domain: DomainType;
  verb: ActionVerb;
  scale: number;
  timingMonths: number;
  capexMillion: number;
  scenario: Scenario;
}

// ---------------------------------------------------------------------------
// Security & Input Sanitization
// ---------------------------------------------------------------------------

/**
 * Strips script tags, HTML entities, ASCII control characters, and prototype pollution attempts.
 * Enforces a strict 500-character ceiling to prevent memory denial-of-service.
 */
export function sanitizeActionText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .slice(0, 500)
    .replace(/<[^>]*>?/gm, '') // Strip HTML/XML tags
    .replace(/[<>'"`;(){}[\]\\/]/g, ' ') // Strip executable code tokens
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Strip non-printable control chars
    .replace(/\b(__proto__|constructor|prototype)\b/gi, '') // Prevent prototype pollution
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// Domain Keywords & Signatures
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORDS: Record<DomainType, string[]> = {
  traffic: [
    'traffic', 'road', 'corridor', 'arterial', 'highway', 'expressway', 'lane', 'lanes',
    'speed', 'velocity', 'signal', 'green split', 'green wave', 'cycle', 'intersection',
    'flyover', 'bypass', 'brt', 'transit', 'bus', 'ramp', 'metering', 'queue', 'congestion',
    'flow', 'inflow', 'capacity', 'density', 'delay', 'car', 'vehicle', 'bottleneck', 'detour',
    'junction', 'roundabout', 'overpass', 'underpass', 'gridlock', 'freeway'
  ],
  water: [
    'water', 'pipe', 'pipeline', 'conduit', 'main', 'mains', 'trunk', 'diameter', 'pump',
    'pumping', 'booster', 'reservoir', 'tank', 'valve', 'pressure', 'head loss', 'friction',
    'roughness', 'flow', 'distribution', 'supply', 'storage', 'elevation', 'leak', 'hydraulic',
    'darcy', 'weisbach', 'c-factor', 'potable', 'aqueduct', 'chlorine', 'gravity feed'
  ],
  energy: [
    'power', 'grid', 'electricity', 'energy', 'line', 'lines', 'feeder', 'feeders', 'cable',
    'transmission', 'substation', 'transformer', 'bus', 'buses', 'generator', 'generation',
    'solar', 'battery', 'storage', 'mw', 'mvar', 'thermal', 'capacity', 'reactance', 'impedance',
    'reconductor', 'voltage', 'load', 'shedding', 'curtailment', 'inverter', 'megawatt', 'dispatch'
  ]
};

// ---------------------------------------------------------------------------
// Unmodeled Physics Knowledge Patterns
// ---------------------------------------------------------------------------

interface UnmodeledPhysicsRule {
  domain: DomainType;
  matchPatterns: RegExp[];
  phenomenon: string;
  whyUnmodeled: string;
  requiredDataOrModel: string;
  recommendedSupportedAlternative: string;
  suggestedActionPrompt: string;
}

const UNMODELED_RULES: UnmodeledPhysicsRule[] = [
  // Traffic unmodeled
  {
    domain: 'traffic',
    matchPatterns: [/\b(pavement|asphalt|pothole|rutting|cracking|resurfac)\b/i],
    phenomenon: 'Pavement Structural Deterioration & Geotechnical Settling',
    whyUnmodeled:
      'The active Lighthill-Whitham-Richards macroscopic solver models vehicle conservation and density-speed hydrodynamics, not structural asphalt mechanics.',
    requiredDataOrModel:
      'Pavement Distress Index (PDI) surveys, sub-base core sampling, and Falling Weight Deflectometer (FWD) geotechnical profiles.',
    recommendedSupportedAlternative: 'Add Corridor Lanes or Signal Green-Wave Split Optimization',
    suggestedActionPrompt: 'Upgrade arterial capacity by adding a dedicated transit lane and optimizing signal green splits'
  },
  {
    domain: 'traffic',
    matchPatterns: [/\b(emission|emissions|air pollution|plume|dispersion|tailpipe|exhaust|co2|pm2\.5|nox)\b/i],
    phenomenon: 'Atmospheric Micro-Scale Emissions Dispersion',
    whyUnmodeled:
      'Calculating localized ground-level pollutant concentrations requires 3D Computational Fluid Dynamics (CFD) and micro-meteorological wind field simulation.',
    requiredDataOrModel:
      'Hourly atmospheric boundary layer wind vectors, thermal inversion heights, and EPA MOVES fleet-emission lookups.',
    recommendedSupportedAlternative: 'Corridor Flow Optimization & Idling Reduction',
    suggestedActionPrompt: 'Coordinate traffic signals to create a continuous green wave, reducing queue stop-and-go delay'
  },
  {
    domain: 'traffic',
    matchPatterns: [/\b(land acquisition|eminent domain|property dispute|court order|compensation)\b/i],
    phenomenon: 'Legal & Property Acquisition Proceedings',
    whyUnmodeled:
      'WhatIf simulates physical engineering capacity and hydrodynamics. Real estate acquisition legal disputes are non-physical institutional factors.',
    requiredDataOrModel:
      'Cadastral parcel registry data, title records, and municipal municipal land valuation boards.',
    recommendedSupportedAlternative: 'Signal Retiming & Within-Right-of-Way Rechannelization',
    suggestedActionPrompt: 'Restripe existing cross-section to introduce dedicated turn lanes without requiring new right-of-way'
  },

  // Water unmodeled
  {
    domain: 'water',
    matchPatterns: [/\b(water hammer|surge|acoustic transient|transient wave|rupture surge)\b/i],
    phenomenon: 'Joukowsky Acoustic Water Hammer & Fluid Transients',
    whyUnmodeled:
      'The active hydraulic solver evaluates quasi-steady-state Darcy-Weisbach head loss, not sub-second acoustic shockwaves traveling at ~1,000 m/s.',
    requiredDataOrModel:
      'Elastic pipe wall modulus, rapid valve closure closure curves (<100ms), and method-of-characteristics (MOC) transient solvers.',
    recommendedSupportedAlternative: 'Pipe Diameter Upsizing & High-Head Booster Staging',
    suggestedActionPrompt: 'Upgrade trunk main diameter from 0.48m to 0.60m to reduce baseline head loss and friction gradient'
  },
  {
    domain: 'water',
    matchPatterns: [/\b(chlorin|disinfection|trihalomethane|thms|biofilm|water quality|bacteria|pathogen)\b/i],
    phenomenon: 'Chlorine Decay Kinetics & Chemical Water Quality Reactions',
    whyUnmodeled:
      'WhatIf models physical pressure and volumetric discharge. Second-order chemical disinfectant decay and biofilm reactions require spatial advection-reaction modeling.',
    requiredDataOrModel:
      'Bulk water temperature decay coefficients, pipe wall kinetic reaction constants, and reservoir residence age profiles.',
    recommendedSupportedAlternative: 'Elevation Head Relief & Booster Flow Balancing',
    suggestedActionPrompt: 'Install variable-speed booster pumps to maintain minimum 200 kPa pressure across downstream delivery nodes'
  },
  {
    domain: 'water',
    matchPatterns: [/\b(corrosion|cathodic|soil acidity|trench collapse|soil settlement)\b/i],
    phenomenon: 'Geotechnical Pipe Soil Corrosion & Subsidence',
    whyUnmodeled:
      'Subsurface electrochemical soil interactions require localized soil resistivity and chemical analysis, outside steady-state pipe hydraulics.',
    requiredDataOrModel:
      'Geotechnical soil borehole logs, sulfate/chloride ion concentrations, and cathodic stray current testing.',
    recommendedSupportedAlternative: 'Replace Old Mains with Smooth High-Capacity Trunk Conduit',
    suggestedActionPrompt: 'Replace ductile trunk line with smooth HDPE pipe (roughness 0.009mm) to eliminate head loss'
  },

  // Energy unmodeled
  {
    domain: 'energy',
    matchPatterns: [/\b(reactive power|mvar|var|voltage collapse|reactive compensation|power factor)\b/i],
    phenomenon: 'AC Reactive Power (MVAR) & Non-linear Voltage Stability',
    whyUnmodeled:
      'The active power engine employs a linearized DC Power Flow (B-Matrix) model assuming nominal 1.0 p.u. voltage and negligible reactive power.',
    requiredDataOrModel:
      'Bus shunt susceptances, generator reactive capability curves (P-Q limits), and full AC Newton-Raphson nonlinear power flow.',
    recommendedSupportedAlternative: 'Line Reconductoring & Active MW Thermal Capacity Upgrade',
    suggestedActionPrompt: 'Upgrade transmission branch line thermal rating from 60 MW to 120 MW to relieve thermal overloading'
  },
  {
    domain: 'energy',
    matchPatterns: [/\b(frequency|inertia|rotor angle|swing equation|droop|transient stability)\b/i],
    phenomenon: 'Sub-Cycle Generator Rotor Angle & Frequency Dynamics',
    whyUnmodeled:
      'Linearized DC Power Flow solves quasi-static MW power flow equilibrium. Rotor inertia swings (H = 3-5s) require electromechanical time-domain differential equation integration.',
    requiredDataOrModel:
      'Generator machine inertia constants (H), governor droop speed response curves, and exciter control block diagrams.',
    recommendedSupportedAlternative: 'Deploy Utility-Scale Battery Storage Dispatch',
    suggestedActionPrompt: 'Deploy 40 MW battery energy storage system (BESS) at the central substation bus to absorb peak demand'
  },
  {
    domain: 'energy',
    matchPatterns: [/\b(harmonic|harmonics|thd|power quality|pwm|inverter resonance|flicker)\b/i],
    phenomenon: 'Harmonic Distortion & High-Frequency Power Quality',
    whyUnmodeled:
      'Linearized DC Power Flow calculates 50 Hz fundamental frequency power distribution. High-frequency inverter switching harmonics require PSCAD / EMT modeling.',
    requiredDataOrModel:
      'Inverter pulse-width-modulation carrier frequencies, filter inductance-capacitance resonance networks, and THD meters.',
    recommendedSupportedAlternative: 'Transmission Line Reactance Optimization',
    suggestedActionPrompt: 'Series-compensate the 132kV transmission branch to reduce series reactance by 25%'
  }
];

// ---------------------------------------------------------------------------
// Ambiguous Action Intent Patterns
// ---------------------------------------------------------------------------

interface AmbiguousPattern {
  matchPatterns: RegExp[];
  clarificationQuestion: string;
  options: Record<DomainType, ClarificationOption[]>;
}

const AMBIGUOUS_PATTERNS: AmbiguousPattern[] = [
  {
    matchPatterns: [
      /\b(make it faster|speed up|speed it up|faster flow|improve flow|reduce delay|reduce delays)\b/i
    ],
    clarificationQuestion: 'What specific physical engineering mechanism should be applied to speed up flow?',
    options: {
      traffic: [
        {
          label: 'Synchronize Corridor Signals (Green Wave)',
          actionText: 'Optimize arterial signal green split to 0.72 for coordinated green wave progression',
          description: 'Adjust traffic signal timing splits to maximize progression bandwidth.',
          impactSummary: '+35% arterial speed without civil construction'
        },
        {
          label: 'Add Dedicated Transit / BRT Lane',
          actionText: 'Build a dedicated arterial bus rapid transit lane with exclusive right-of-way',
          description: 'Dedicate one travel lane to high-occupancy transit vehicles to shift demand.',
          impactSummary: 'Reduces peak inflow queue density by 30%'
        },
        {
          label: 'Grade-Separated Flyover',
          actionText: 'Construct a grade-separated arterial flyover over the central bottleneck intersection',
          description: 'Elevate through-traffic over the most congested cross-street.',
          impactSummary: 'Eliminates cross-street conflicts and quadruples through-capacity'
        }
      ],
      water: [
        {
          label: 'Boost Pump Discharge Head',
          actionText: 'Increase pump station operational head by 25m to accelerate delivery flow',
          description: 'Ramp pump speed or stage additional impeller to overcome head losses.',
          impactSummary: 'Raises terminal pressure above 220 kPa'
        },
        {
          label: 'Upsize Conduit Diameter',
          actionText: 'Upgrade primary trunk conduit diameter to 0.60m to reduce hydraulic resistance',
          description: 'Widen main distribution pipe to lower velocity and friction losses.',
          impactSummary: 'Reduces head loss gradient from 12 m/km to 3 m/km'
        }
      ],
      energy: [
        {
          label: 'Reconductor Transmission Line',
          actionText: 'Reconductor transmission branch with high-temperature low-sag composite core',
          description: 'Replace line conductors to double thermal ampacity limit.',
          impactSummary: 'Increases transfer limit from 60 MW to 120 MW'
        },
        {
          label: 'Deploy Battery Peak Shaving',
          actionText: 'Install 30 MW / 60 MWh battery storage system at the industrial load substation',
          description: 'Inject power during peak hours to unload congested lines.',
          impactSummary: 'Relieves downstream line loading by 35 MW'
        }
      ]
    }
  },
  {
    matchPatterns: [
      /\b(upgrade system|system upgrade|improve system|fix problem|fix it|solve problem|modernize)\b/i,
      /\b(increase capacity|more capacity|add capacity|expand capacity|expand)\b/i
    ],
    clarificationQuestion: 'Which engineering asset in the active corridor would you like to upgrade?',
    options: {
      traffic: [
        {
          label: 'Corridor Expansion (+1 Lane)',
          actionText: 'Add an additional travel lane to the critical arterial entry segment',
          description: 'Widen cross-section from 2 lanes to 3 lanes to raise jam density.',
          impactSummary: '+50% vehicle carrying capacity'
        },
        {
          label: 'Adaptive Signal Control System',
          actionText: 'Deploy real-time dynamic signal coordination across all 8 intersections',
          description: 'Install vehicle loop sensors and automated cycle-split optimization.',
          impactSummary: 'Cuts intersection delay by 42%'
        }
      ],
      water: [
        {
          label: 'Trunk Main Replacement',
          actionText: 'Replace aged 0.48m cast iron trunk with 0.60m smooth ductile iron pipe',
          description: 'Improve roughness factor and eliminate internal tuberculation.',
          impactSummary: 'Eliminates localized pressure drop across northern zone'
        },
        {
          label: 'Booster Pump Station Installation',
          actionText: 'Construct a new 45 kW intermediate booster pumping station at node J1',
          description: 'Provide mechanical head boost to feed elevated peripheral settlements.',
          impactSummary: 'Guarantees >= 180 kPa service standard'
        }
      ],
      energy: [
        {
          label: 'Substation Transformer Augmentation',
          actionText: 'Upgrade substation step-down transformer capacity from 50 MVA to 100 MVA',
          description: 'Prevent transformer thermal overloading during summer peak.',
          impactSummary: 'Provides 100% N-1 contingency compliance'
        },
        {
          label: 'Series Compensation Capacitor Bank',
          actionText: 'Install series capacitive reactance compensation on long 132kV transmission branch',
          description: 'Lower electrical line reactance from 0.065 to 0.045 p.u.',
          impactSummary: 'Increases stable MW power transfer margin'
        }
      ]
    }
  },
  {
    matchPatterns: [
      /\b(restrict demand|limit access|slow down traffic|cut demand|ration demand|reduce overall traffic|limit peak|ration supply)\b/i
    ],
    clarificationQuestion: 'What restriction mechanism should be enacted to control demand?',
    options: {
      traffic: [
        {
          label: 'Ramp Metering / Inflow Throttling',
          actionText: 'Implement dynamic ramp metering to throttle vehicle entry during peak 2 hours',
          description: 'Meter expressway entry signals to keep mainline density below critical jam threshold.',
          impactSummary: 'Maintains free-flow speeds on main corridor'
        },
        {
          label: 'Peak Hour Heavy Vehicle Ban',
          actionText: 'Enforce peak-hour commercial freight restriction along the central urban corridor',
          description: 'Divert multi-axle freight vehicles to the outer regional bypass.',
          impactSummary: 'Frees up 22% effective lane capacity'
        }
      ],
      water: [
        {
          label: 'Pressure Reducing Valve (PRV) Throttling',
          actionText: 'Install and throttle PRV stations in high-pressure downhill zones',
          description: 'Modulate valve head loss to reduce excessive background pipe burst risk.',
          impactSummary: 'Cuts pipe leakage rate by 28%'
        },
        {
          label: 'Commercial Demand Management',
          actionText: 'Implement volumetric water rationing for non-essential industrial consumers',
          description: 'Restrict commercial withdrawals to protect baseline domestic potable water reserves.',
          impactSummary: 'Conserves 4,500 m3/day during drought'
        }
      ],
      energy: [
        {
          label: 'Industrial Peak Load Shedding',
          actionText: 'Contract interruptible industrial tariffs to shed 25 MW during peak hours',
          description: 'Compensate heavy industrial users to curtail load during grid strain.',
          impactSummary: 'Prevents automatic under-frequency load shedding'
        },
        {
          label: 'Thermal Generation Curtailment',
          actionText: 'Curtail coal generation dispatch by 30 MW and import clean hydro',
          description: 'Rebalance dispatch stack under transmission boundary constraints.',
          impactSummary: 'Safeguards line loading below 90% MVA rating'
        }
      ]
    }
  }
];

// ---------------------------------------------------------------------------
// Default Example Prompts by Domain
// ---------------------------------------------------------------------------

export const DOMAIN_EXAMPLE_PROMPTS: Record<DomainType, string[]> = {
  traffic: [
    'Add a dedicated BRT priority lane and optimize green-wave signal timing',
    'Construct a grade-separated arterial flyover over the central bottleneck',
    'Deploy smart ramp metering to throttle peak inflow onto the northern arterial'
  ],
  water: [
    'Upgrade trunk main conduit diameter from 0.48m to 0.60m to lower friction head loss',
    'Install a 45 kW booster pumping station to maintain minimum 200 kPa pressure',
    'Replace tuberculated distribution pipes with smooth C-130 HDPE pipe'
  ],
  energy: [
    'Reconductor the 132kV transmission branch line to double thermal rating to 120 MW',
    'Deploy a 40 MW / 80 MWh battery energy storage system at the central substation bus',
    'Install series capacitive compensation to reduce line reactance by 25%'
  ]
};

// ---------------------------------------------------------------------------
// Core Parser & Validation Logic
// ---------------------------------------------------------------------------

export function detectDomainRelevance(text: string): {
  domain: DomainType | 'unrelated';
  confidence: number;
  matchedKeywords: Record<DomainType, string[]>;
} {
  const lower = text.toLowerCase();
  const matched: Record<DomainType, string[]> = {
    traffic: [],
    water: [],
    energy: []
  };

  for (const domain of ['traffic', 'water', 'energy'] as DomainType[]) {
    for (const kw of DOMAIN_KEYWORDS[domain]) {
      const regex = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (regex.test(lower)) {
        matched[domain].push(kw);
      }
    }
  }

  const counts: Record<DomainType, number> = {
    traffic: matched.traffic.length,
    water: matched.water.length,
    energy: matched.energy.length
  };

  const sorted = (['traffic', 'water', 'energy'] as DomainType[]).sort(
    (a, b) => counts[b] - counts[a]
  );
  const bestDomain = sorted[0];
  const bestCount = counts[bestDomain];

  if (bestCount === 0) {
    return { domain: 'unrelated', confidence: 0, matchedKeywords: matched };
  }

  const totalMatches = counts.traffic + counts.water + counts.energy;
  const confidence = Math.min(1.0, +(bestCount / Math.max(totalMatches, 1)).toFixed(2));

  return {
    domain: bestDomain,
    confidence,
    matchedKeywords: matched
  };
}

export function parseAndValidateActionProposal(options: ParseActionOptions): ParsedActionProposal {
  const { rawText, domain, verb, scale, timingMonths, capexMillion, scenario } = options;
  const cleaned = sanitizeActionText(rawText);
  const verbLabel = verb.charAt(0).toUpperCase() + verb.slice(1);

  // -------------------------------------------------------------------------
  // 1. Guard against empty, trivial, or gibberish inputs ('unrelated-or-invalid')
  // -------------------------------------------------------------------------
  if (!cleaned || cleaned.length < 4 || /^([^a-zA-Z0-9]+)$/.test(cleaned)) {
    return {
      status: 'unrelated-or-invalid',
      statusLabel: 'Input Required or Invalid',
      rawText,
      cleanedText: cleaned,
      verb,
      activeDomain: domain,
      detectedDomain: 'unrelated',
      domainMismatch: false,
      confidenceScore: 0,
      rejectionReason: 'Please enter a clear engineering action proposal describing what to build, change, upgrade, or restrict.',
      guidanceMessage: `WhatIf simulates deterministic physical networks for ${domain.toUpperCase()}. Choose one of the verified examples below or describe an infrastructure intervention.`,
      examplePrompts: DOMAIN_EXAMPLE_PROMPTS[domain],
      evidenceSummary: 'Input was empty, shorter than 4 characters, or lacked valid alphanumeric tokens.',
      warnings: ['No simulation can be performed until an engineering action is specified.']
    };
  }

  // Detect domain relevance
  const relevance = detectDomainRelevance(cleaned);

  // Check for off-topic non-infrastructure text (e.g. food, finance, software, gaming, crypto)
  const offTopicRegex = /\b(crypto|bitcoin|ethereum|nft|pizza|burger|shoe|shoes|movie|actor|song|recipe|cake|stock|stocks|forex|dating|chatgpt|game|casino)\b/i;
  if (offTopicRegex.test(cleaned) && relevance.domain === 'unrelated') {
    return {
      status: 'unrelated-or-invalid',
      statusLabel: 'Non-Infrastructure Proposal Blocked',
      rawText,
      cleanedText: cleaned,
      verb,
      activeDomain: domain,
      detectedDomain: 'unrelated',
      domainMismatch: false,
      confidenceScore: 0,
      rejectionReason: `"${cleaned}" refers to topics outside physical civil infrastructure. WhatIf only models deterministic traffic, water, and power networks.`,
      guidanceMessage: 'To evaluate an action, propose a physical intervention affecting roads, signals, pipes, pumps, transmission lines, or substations.',
      examplePrompts: DOMAIN_EXAMPLE_PROMPTS[domain],
      evidenceSummary: 'Proposal matched off-topic non-infrastructure keywords.',
      warnings: ['Simulation rejected safely to protect model integrity.']
    };
  }

  // -------------------------------------------------------------------------
  // 2. Domain Mismatch Detection
  // -------------------------------------------------------------------------
  if (relevance.domain !== 'unrelated' && relevance.domain !== domain && relevance.confidence >= 0.7) {
    const foreignDomain = relevance.domain;
    return {
      status: 'unrelated-or-invalid',
      statusLabel: `Domain Mismatch: ${foreignDomain.toUpperCase()} in ${domain.toUpperCase()} Workspace`,
      rawText,
      cleanedText: cleaned,
      verb,
      activeDomain: domain,
      detectedDomain: foreignDomain,
      domainMismatch: true,
      confidenceScore: relevance.confidence,
      rejectionReason: `Your proposed action describes ${foreignDomain.toUpperCase()} infrastructure, but the active workspace is configured for the ${domain.toUpperCase()} domain.`,
      guidanceMessage: `To simulate this proposal, switch your active scenario to a ${foreignDomain.toUpperCase()} network, or reframe your action to address ${domain.toUpperCase()} assets.`,
      examplePrompts: DOMAIN_EXAMPLE_PROMPTS[domain],
      evidenceSummary: `Detected keywords for ${foreignDomain}: ${relevance.matchedKeywords[foreignDomain].slice(0, 4).join(', ')}.`,
      warnings: [
        `Cannot execute a ${foreignDomain} intervention on a ${domain} mathematical solver.`
      ]
    };
  }

  // -------------------------------------------------------------------------
  // 3. Unmodeled Physics Knowledge Rule Check ('relevant-unsupported')
  // -------------------------------------------------------------------------
  for (const rule of UNMODELED_RULES) {
    if (rule.domain === domain) {
      for (const pattern of rule.matchPatterns) {
        if (pattern.test(cleaned)) {
          return {
            status: 'relevant-unsupported',
            statusLabel: 'Authentic Phenomenon — Model Boundary Reached',
            rawText,
            cleanedText: cleaned,
            verb,
            activeDomain: domain,
            detectedDomain: domain,
            domainMismatch: false,
            confidenceScore: 0.9,
            unmodeledPhenomenon: rule.phenomenon,
            whyUnmodeled: rule.whyUnmodeled,
            requiredDataOrModel: rule.requiredDataOrModel,
            recommendedSupportedAlternative: rule.recommendedSupportedAlternative,
            suggestedActionPrompt: rule.suggestedActionPrompt,
            evidenceSummary: `Matched unmodeled boundary rule: "${rule.phenomenon}".`,
            warnings: [
              'This phenomenon is physically real but cannot be simulated without external non-deterministic data.',
              'WhatIf refuses to invent fictional numbers for unmodeled physics.'
            ]
          };
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Ambiguous / Incomplete Intent Check ('ambiguous-incomplete')
  // -------------------------------------------------------------------------
  const hasSpecificAssetTarget =
    domain === 'traffic'
      ? /\b(brt|lane|lanes|signal|signals|flyover|bypass|corridor|ramp|intersection|junction)\b/i.test(cleaned)
      : domain === 'water'
        ? /\b(pipe|pipes|conduit|diameter|pump|pumps|reservoir|tank|valve|roughness|main|mains)\b/i.test(cleaned)
        : /\b(line|lines|feeder|feeders|substation|transformer|bus|buses|generator|solar|battery|reconductor|reactance)\b/i.test(cleaned);

  // Ambiguity applies when user has NOT named a specific concrete asset target, OR text is a short generic goal
  const isGenericGoal = cleaned.split(' ').length <= 6 || !hasSpecificAssetTarget;
  if (isGenericGoal) {
    for (const ambig of AMBIGUOUS_PATTERNS) {
      for (const pat of ambig.matchPatterns) {
        if (pat.test(cleaned)) {
          const domainOptions = ambig.options[domain] || ambig.options.traffic;
          return {
            status: 'ambiguous-incomplete',
            statusLabel: 'Clarification Needed — Multiple Engineering Pathways',
            rawText,
            cleanedText: cleaned,
            verb,
            activeDomain: domain,
            detectedDomain: domain,
            domainMismatch: false,
            confidenceScore: 0.5,
            clarificationQuestion: ambig.clarificationQuestion,
            clarificationOptions: domainOptions,
            evidenceSummary: `Proposal matches generic intent "${cleaned}". Specific engineering lever or asset target is required.`,
            warnings: [
              'Multiple physical levers exist for this objective. Please select one of the suggested pathways below.'
            ]
          };
        }
      }
    }
  }

  // If text is somewhat short (< 18 chars) and has no domain keywords, ask for clarification
  if (cleaned.length < 18 && relevance.matchedKeywords[domain].length === 0) {
    return {
      status: 'ambiguous-incomplete',
      statusLabel: 'Clarification Needed — Specify Asset or Intervention',
      rawText,
      cleanedText: cleaned,
      verb,
      activeDomain: domain,
      detectedDomain: domain,
      domainMismatch: false,
      confidenceScore: 0.4,
      clarificationQuestion: `How would you like to apply "${cleaned}" to the active ${domain.toUpperCase()} network?`,
      clarificationOptions: (AMBIGUOUS_PATTERNS[1].options[domain] || AMBIGUOUS_PATTERNS[1].options.traffic),
      evidenceSummary: 'Input lacks sufficient specificity to assign physical solver parameters.',
      warnings: ['Select a modeled engineering pathway to proceed with simulation.']
    };
  }

  // -------------------------------------------------------------------------
  // 5. Supported & Complete Proposal ('supported-complete')
  // -------------------------------------------------------------------------
  const knowledge = DOMAIN_KNOWLEDGE_BASE[domain];
  let targetAssetId = '';
  let targetAssetName = '';
  let modifications: ParameterModification[] = [];
  let governingEquation = knowledge.governingEquations[0];
  let mechanismSummary = '';

  const safeScale = Math.max(1, Math.min(4, Math.round(scale)));
  const safeMonths = Math.max(3, Math.min(36, Math.round(timingMonths)));
  const safeCapex = Math.max(1.0, Math.min(35.0, +capexMillion.toFixed(1)));
  const safeOpex = +(safeCapex * 0.045).toFixed(2);

  if (domain === 'traffic') {
    const isSignalFocus = /\b(signal|green|timing|cycle|split|coordinat)\b/i.test(cleaned);
    const isWidenFocus = /\b(lane|lanes|widen|flyover|bypass|brt|capacity|expand)\b/i.test(cleaned);
    const isSpeedFocus = /\b(speed|limit|slow|restrict|calm)\b/i.test(cleaned);

    const firstCell = scenario.trafficNetwork?.cells[0];
    const secondCell = scenario.trafficNetwork?.cells[1];
    targetAssetId = isSignalFocus ? (secondCell?.id || 'cell-hub-1') : (firstCell?.id || 'cell-nw-in');
    targetAssetName = isSignalFocus
      ? (secondCell?.name || 'Central Arterial Signalized Node')
      : (firstCell?.name || 'North Arterial Inflow Segment');

    if (isSignalFocus) {
      governingEquation = knowledge.governingEquations[0]; // Godunov Flow
      const currentGreen = 0.48;
      const newGreen = Math.min(0.85, +(currentGreen + safeScale * 0.08).toFixed(2));
      modifications = [
        {
          targetId: targetAssetId,
          property: 'signalGreenRatio',
          label: `${verbLabel} Signal Priority Split`,
          originalValue: currentGreen,
          newValue: newGreen,
          unit: 'ratio'
        }
      ];
      mechanismSummary = `Adjusts effective arterial green ratio from ${currentGreen} to ${newGreen} (+${Math.round((newGreen - currentGreen) * 100)}%), raising intersection saturation discharge capacity.`;
    } else if (isSpeedFocus) {
      governingEquation = knowledge.governingEquations[2]; // Greenshields
      const currentSpeed = 50;
      const newSpeed = verb === 'restrict' ? Math.max(30, currentSpeed - safeScale * 5) : Math.min(80, currentSpeed + safeScale * 5);
      modifications = [
        {
          targetId: targetAssetId,
          property: 'speedLimitKmh',
          label: `${verbLabel} Speed Regulation`,
          originalValue: currentSpeed,
          newValue: newSpeed,
          unit: 'km/h'
        }
      ];
      mechanismSummary = `Modifies free-flow posted velocity parameter v_f to ${newSpeed} km/h, altering the triangular fundamental diagram slope.`;
    } else {
      governingEquation = knowledge.governingEquations[1]; // Vehicle Conservation & Jam density
      const currentDemand = 2450;
      const deltaDemand = safeScale * 320;
      const newDemand = Math.max(900, currentDemand - deltaDemand);
      modifications = [
        {
          targetId: targetAssetId,
          property: 'inflowDemandVehHour',
          label: `${verbLabel} Inflow Relief`,
          originalValue: currentDemand,
          newValue: newDemand,
          unit: 'veh/h'
        },
        {
          targetId: secondCell?.id || 'cell-hub-1',
          property: 'signalGreenRatio',
          label: 'Progression Coordination',
          originalValue: 0.48,
          newValue: Math.min(0.80, +(0.48 + safeScale * 0.06).toFixed(2)),
          unit: 'ratio'
        }
      ];
      mechanismSummary = `Expands corridor throughput by shedding ${deltaDemand} veh/h from the critical inflow cell and synchronizing downstream signal progression.`;
    }
  } else if (domain === 'water') {
    const isPipeFocus = /\b(pipe|conduit|diameter|widen|trunk|main|replace|mains)\b/i.test(cleaned);
    const firstPipe = scenario.waterNetwork?.pipes[0];
    const firstNode = scenario.waterNetwork?.nodes[1] || scenario.waterNetwork?.nodes[0];

    targetAssetId = isPipeFocus ? (firstPipe?.id || 'pipe-trunk-1') : (firstNode?.id || 'node-j1');
    targetAssetName = isPipeFocus
      ? (firstPipe?.id || 'Primary Trunk Conduit')
      : (firstNode?.name || 'Central Delivery Node J1');

    governingEquation = knowledge.governingEquations[0]; // Darcy-Weisbach

    if (isPipeFocus) {
      const currentDiam = 0.48;
      const newDiam = +(currentDiam + safeScale * 0.05).toFixed(2);
      modifications = [
        {
          targetId: targetAssetId,
          property: 'diameter',
          label: `${verbLabel} Pipe Diameter`,
          originalValue: currentDiam,
          newValue: newDiam,
          unit: 'm'
        }
      ];
      mechanismSummary = `Increases trunk conduit diameter to ${newDiam}m, reducing Darcy-Weisbach friction head loss proportional to (1/D^5).`;
    } else {
      const currentElev = 35;
      const newElev = Math.max(10, currentElev - safeScale * 4);
      modifications = [
        {
          targetId: targetAssetId,
          property: 'elevation',
          label: `${verbLabel} Pressure Head Boost`,
          originalValue: currentElev,
          newValue: newElev,
          unit: 'm'
        }
      ];
      mechanismSummary = `Delivers mechanical pressure head boost at ${targetAssetName}, resolving low-pressure threshold violations in peripheral zones.`;
    }
  } else {
    // Energy domain
    const isStorageFocus = /\b(battery|storage|bess|mwh)\b/i.test(cleaned);
    const firstLine = scenario.powerNetwork?.lines[0];
    targetAssetId = firstLine?.id || 'line-1-2';
    targetAssetName = `Transmission Feeder ${targetAssetId}`;

    governingEquation = knowledge.governingEquations[0]; // Linearized DC Power Flow

    if (isStorageFocus) {
      modifications = [
        {
          targetId: targetAssetId,
          property: 'thermalRatingMw',
          label: 'Battery Peak Shaving Capacity Relief',
          originalValue: 60,
          newValue: Math.round(60 + safeScale * 25),
          unit: 'MW'
        }
      ];
      mechanismSummary = `Deploys ${safeScale * 20} MW battery energy storage to shave branch line peak loading below thermal limit.`;
    } else {
      const currentRating = 60;
      const newRating = Math.round(60 + safeScale * 20);
      const currentReactance = 0.065;
      const newReactance = +(Math.max(0.02, currentReactance - safeScale * 0.008)).toFixed(3);
      modifications = [
        {
          targetId: targetAssetId,
          property: 'thermalRatingMw',
          label: `${verbLabel} Line Thermal Rating`,
          originalValue: currentRating,
          newValue: newRating,
          unit: 'MW'
        },
        {
          targetId: targetAssetId,
          property: 'reactancePu',
          label: `${verbLabel} Series Reactance`,
          originalValue: currentReactance,
          newValue: newReactance,
          unit: 'p.u.'
        }
      ];
      mechanismSummary = `Reconductors transmission feeder branch, raising thermal rating to ${newRating} MW and lowering series reactance X_ij to ${newReactance} p.u.`;
    }
  }

  const newAltId = `alt-action-${Date.now()}`;
  const title = cleaned.length > 55 ? cleaned.slice(0, 52) + '...' : cleaned;
  const letterTag = String.fromCharCode(65 + (scenario.alternatives.length % 26));

  // ---------------------------------------------------------------------------
  // Multi-Part / Combined Action Decomposition
  // ---------------------------------------------------------------------------
  const isCompoundSentence = /\b(and|with|plus|combined with|together with|as well as)\b/i.test(cleaned);
  let isMultiPartAction = false;
  const modeledComponents: Array<{ component: string; assetId: string; parameter: string; delta: string }> = [];
  const unmodeledComponents: Array<{ component: string; reason: string; requiredDataOrModel: string }> = [];

  // Register primary modeled component
  modeledComponents.push({
    component: modifications[0]?.label || `${verbLabel} Physical Asset Intervention`,
    assetId: targetAssetName,
    parameter: modifications.map((m) => m.property).join(', '),
    delta: modifications.map((m) => `${m.originalValue} → ${m.newValue} ${m.unit}`).join(', ')
  });

  if (isCompoundSentence) {
    isMultiPartAction = true;
    if (modifications.length > 1) {
      modeledComponents.push({
        component: modifications[1]?.label || 'Coordinated Network Progression',
        assetId: targetAssetName,
        parameter: modifications[1]?.property || '',
        delta: `${modifications[1]?.originalValue} → ${modifications[1]?.newValue} ${modifications[1]?.unit}`
      });
    }

    // Check for unmodeled aspects in compound actions
    if (domain === 'traffic' && /\b(toll|pricing|charge|congestion fee|tax|fine|fare|survey|willingness)\b/i.test(cleaned)) {
      unmodeledComponents.push({
        component: 'Congestion Pricing / Road User Tolling Policy',
        reason: 'Econometric driver price elasticity and willingness-to-pay are unmodeled in the hydrodynamic Cell Transmission Model.',
        requiredDataOrModel: 'Stated-preference willingness-to-pay econometric survey'
      });
    } else if (domain === 'water' && /\b(chlorine|disinfectant|corrosion|soil|transient|water hammer|surge)\b/i.test(cleaned)) {
      unmodeledComponents.push({
        component: 'Chemical Disinfectant Decay or Transient Water Hammer',
        reason: 'EPANET multispecies wall reaction kinetics and acoustic pressure wave dynamics are outside steady-state continuity.',
        requiredDataOrModel: 'EPANET multispecies tracer calibration or MOC acoustic transient model'
      });
    } else if (domain === 'energy' && /\b(reactive|mvar|voltage collapse|inertia|frequency|harmonic|resonan)\b/i.test(cleaned)) {
      unmodeledComponents.push({
        component: 'AC Reactive Power & Dynamic Rotor Angle Stability',
        reason: 'Linear DC Load Flow assumes flat 1.0 p.u. voltage; reactive VAR compensation and transient swing dynamics are unmodeled.',
        requiredDataOrModel: 'Full AC Newton-Raphson and dynamic transient stability engine'
      });
    }
  }

  const synthesizedAlternative: SolutionAlternative = {
    id: newAltId,
    name: `${verbLabel}: ${title}`,
    tag: `Option ${letterTag}`,
    description: cleaned,
    modifications,
    capexCostMillion: safeCapex,
    opexAnnualMillion: safeOpex,
    implementationMonths: safeMonths,
    color: '#06b6d4',
    costDataStatus: 'illustrative',
    scheduleDataStatus: 'illustrative'
  };

  const actionWarnings: string[] = [
    'Cost and timeline figures are illustrative estimates for comparative planning and require detailed municipal engineering review.'
  ];
  if (unmodeledComponents.length > 0) {
    actionWarnings.push(
      'Multi-part action proposal detected: Only physical components are simulated by the deterministic solver. Unmodeled policy/chemical/transient components are labeled as "Possible component — not simulated".'
    );
  }

  return {
    status: 'supported-complete',
    statusLabel: 'Supported & Ready to Simulate',
    rawText,
    cleanedText: cleaned,
    verb,
    activeDomain: domain,
    detectedDomain: domain,
    domainMismatch: false,
    confidenceScore: 0.95,
    confidenceLabel: 'Semantic Match: Supported Action Template · Physical calculation subject to model assumptions',
    isMultiPartAction,
    modeledComponents,
    unmodeledComponents,
    targetAssetId,
    targetAssetName,
    modifications,
    governingEquation: {
      name: governingEquation.equationName,
      formula: governingEquation.latexFormula,
      explanation: governingEquation.plainExplanation
    },
    estimatedCapexMillion: safeCapex,
    estimatedOpexMillion: safeOpex,
    deliveryMonths: safeMonths,
    synthesizedAlternative,
    modeledMechanismSummary: mechanismSummary,
    evidenceSummary: `Successfully mapped "${cleaned}" to ${modifications.length} deterministic parameter deltas on asset "${targetAssetName}".`,
    warnings: actionWarnings
  };
}
