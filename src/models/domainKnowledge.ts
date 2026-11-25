import { DomainType } from '../types';

export interface ModelVariableMetadata {
  key: string;
  name: string;
  unit: string;
  description: string;
  governingRole: string;
  normalRange: string;
}

export interface UnmodeledPhysicsBoundary {
  phenomenon: string;
  whyUnmodeled: string;
  requiredDataOrModel: string;
}

export interface EngineeringReference {
  title: string;
  authors: string;
  year: number;
  publisherOrStandard: string;
  provenanceNote: string;
  linkOrCitation: string;
}

export interface ActionKnowledgeItem {
  actionVerb: 'build' | 'change' | 'upgrade' | 'restrict';
  name: string;
  description: string;
  targetAssetTypes: string[];
  solverVariablesChanged: Array<{
    variableKey: string;
    propertyName: string;
    unit: string;
    directionOfImpact: string;
  }>;
  requiredInputs: string[];
  engineeringConstraints: string[];
  directEffects: string[];
  secondaryRisks: string[];
  delayedOrDisplacedEffects: string[];
  safeguardsAndPrecautions: string[];
  monitoringNeeds: string[];
  recoveryOrRollback: string[];
}

export interface DomainKnowledgeProfile {
  domain: DomainType;
  formalName: string;
  governingTheory: string;
  activeSolverName: string;
  isOptimizationSolver: boolean;
  governingEquations: Array<{
    equationName: string;
    latexFormula: string;
    plainExplanation: string;
  }>;
  modeledVariables: ModelVariableMetadata[];
  unmodeledPhysics: UnmodeledPhysicsBoundary[];
  authoritativeReferences: EngineeringReference[];
  actions: Record<'build' | 'change' | 'upgrade' | 'restrict', ActionKnowledgeItem>;
}

export const DOMAIN_KNOWLEDGE_BASE: Record<DomainType, DomainKnowledgeProfile> = {
  traffic: {
    domain: 'traffic',
    formalName: 'Macroscopic Arterial Corridor Hydrodynamics',
    governingTheory: 'Lighthill-Whitham-Richards (LWR) kinematic wave theory & Daganzo Cell Transmission Model',
    activeSolverName: 'Cell Transmission Model (CTM) v2.4 (Godunov Flux Split)',
    isOptimizationSolver: false,
    governingEquations: [
      {
        equationName: 'CTM Godunov Inter-Cell Numerical Flow',
        latexFormula: 'q_{i \\to i+1}(t) = \\min\\left(D_i(t), S_{i+1}(t)\\right) = \\min\\left(v_f k_i, q_{\\max}, w (k_j - k_{i+1})\\right)',
        plainExplanation: 'Flow between roadway segments equals the minimum of upstream sending demand and downstream receiving capacity.'
      },
      {
        equationName: 'Hydrodynamic Vehicle Conservation',
        latexFormula: '\\frac{\\partial k}{\\partial t} + \\frac{\\partial q}{\\partial x} = 0 \\implies k_i(t+1) = k_i(t) + \\frac{\\Delta t}{L} \\left(q_{in} - q_{out}\\right)',
        plainExplanation: 'Vehicles cannot appear or vanish; segment density changes exactly by the difference between entering and exiting traffic.'
      },
      {
        equationName: 'Greenshields Density-Speed Relation',
        latexFormula: 'v(k) = \\max\\left(v_{\\min}, v_f \\left(1 - \\frac{k}{k_j}\\right)\\right)',
        plainExplanation: 'Travel speed declines linearly with vehicle accumulation until reaching jam density where gridlock occurs.'
      }
    ],
    modeledVariables: [
      {
        key: 'inflowDemandVehHour',
        name: 'Corridor Inflow Demand',
        unit: 'veh/h',
        description: 'Vehicular arrival rate entering the corridor entry cells from upstream gateways or highways.',
        governingRole: 'Drives sending demand D_i at boundary cells.',
        normalRange: '800 - 3,600 veh/h'
      },
      {
        key: 'signalGreenRatio',
        name: 'Intersection Effective Green Split (g/C)',
        unit: 'ratio (0..1)',
        description: 'Proportion of signal cycle allocated to the priority arterial movement.',
        governingRole: 'Multiplies cell saturation flow rate to establish boundary discharge capacity.',
        normalRange: '0.35 - 0.85'
      },
      {
        key: 'lanes',
        name: 'Cross-Sectional Lane Count',
        unit: 'lanes',
        description: 'Number of active moving lanes per travel direction.',
        governingRole: 'Directly scales jam density (k_j) and maximum discharge capacity (q_max).',
        normalRange: '1 - 5 lanes'
      },
      {
        key: 'speedLimitKmh',
        name: 'Posted Free-Flow Velocity',
        unit: 'km/h',
        description: 'Maximum unrestricted speed under free-flow low-density conditions.',
        governingRole: 'Sets free-flow velocity parameter v_f in triangular fundamental diagram.',
        normalRange: '30 - 80 km/h'
      }
    ],
    unmodeledPhysics: [
      {
        phenomenon: 'Heterogeneous Traffic & Microscopic Lane Seepage',
        whyUnmodeled: 'Macro CTM assumes homogeneous passenger car equivalents (PCE) and cannot resolve individual two-wheeler gap acceptance.',
        requiredDataOrModel: 'Requires microscopic multi-class agent simulation (e.g. SUMO or VISSIM) with local trajectory video audits.'
      },
      {
        phenomenon: 'Subsurface Pavement Deterioration & Geotechnical Settlement',
        whyUnmodeled: 'Pavement structural life depends on axle load repetitions (ESALs) and subgrade moisture, outside flow dynamics.',
        requiredDataOrModel: 'Requires falling weight deflectometer (FWD) test and geotechnical borehole soil profile.'
      },
      {
        phenomenon: 'Localized Atmospheric Tailpipe Dispersion',
        whyUnmodeled: 'CTM computes vehicular speeds, not micro-meteorological Gaussian plume dispersion.',
        requiredDataOrModel: 'Requires AERMOD dispersion modeling coupled with local anemometer wind vectors.'
      }
    ],
    authoritativeReferences: [
      {
        title: 'The cell transmission model: A dynamic representation of highway traffic consistent with the hydrodynamic theory',
        authors: 'Carlos F. Daganzo',
        year: 1994,
        publisherOrStandard: 'Transportation Research Part B: Methodological, Vol. 28, No. 4, pp. 269–287',
        provenanceNote: 'Canonical formulation of cell transmission conservation equations used by WhatIf traffic solver.',
        linkOrCitation: 'https://doi.org/10.1016/0191-2615(94)90002-7'
      },
      {
        title: 'Highway Capacity Manual (HCM 6th Edition): A Guide for Multimodal Mobility Analysis',
        authors: 'Transportation Research Board (TRB)',
        year: 2016,
        publisherOrStandard: 'National Academies of Sciences, Engineering, and Medicine, Washington, D.C.',
        provenanceNote: 'Establishes level-of-service (LOS) speed thresholds, jam densities (90-120 veh/km/lane), and signal saturation flow rates.',
        linkOrCitation: 'https://www.trb.org/Main/Blurbs/175169.aspx'
      }
    ],
    actions: {
      build: {
        actionVerb: 'build',
        name: 'Construct Bypass or Grade-Separated Facility',
        description: 'Build new dedicated bypass roadway, flyover slip-ramp, or elevated corridor segment to physically separate conflicting movements.',
        targetAssetTypes: ['cell-nw-in', 'cell-gateway', 'corridor-link'],
        solverVariablesChanged: [
          { variableKey: 'lanes', propertyName: 'Dedicated Lane Count', unit: 'lanes', directionOfImpact: '+Capacity' },
          { variableKey: 'inflowDemandVehHour', propertyName: 'Mainline Diverted Demand', unit: 'veh/h', directionOfImpact: '-Bottleneck Demand' }
        ],
        requiredInputs: ['Right-of-way alignment bounds', 'Pier footing geometry', 'Interchange merge angles'],
        engineeringConstraints: ['Minimum design speed >= 50 km/h', 'Maximum grade <= 4.0%', 'Clear vertical clearance >= 5.5 m'],
        directEffects: ['Relieves bottleneck queue accumulation by splitting directional flow', 'Increases average corridor speed'],
        secondaryRisks: ['Downstream merge friction where flyover merges back to ground grade', 'High capital outlay'],
        delayedOrDisplacedEffects: ['Induced vehicular demand over 3-5 years if regional transit alternatives remain unimproved'],
        safeguardsAndPrecautions: ['Install auxiliary merge acceleration lane >= 180m', 'Deploy overhead dynamic lane control signs'],
        monitoringNeeds: ['Loop detector velocity profiling at merge taper', 'CCTV queue detection on approach'],
        recoveryOrRollback: ['Temporary ramp metering or slip-ramp gate closure during downstream incidents']
      },
      change: {
        actionVerb: 'change',
        name: 'Reconfigure Signal Timing & Priority Phasing',
        description: 'Optimize green wave coordination, adjust cycle splits, or implement transit/emergency preemption along the arterial spine.',
        targetAssetTypes: ['cell-hub-1', 'cell-hub-2', 'signalized-intersection'],
        solverVariablesChanged: [
          { variableKey: 'signalGreenRatio', propertyName: 'Effective Green Split (g/C)', unit: 'ratio', directionOfImpact: '+Discharge Rate' }
        ],
        requiredInputs: ['Cycle length (C)', 'Yellow change + red clearance intervals', 'Cross-street minimum pedestrian walk times'],
        engineeringConstraints: ['Minimum pedestrian walk phase >= 15 seconds', 'Cycle length <= 140 seconds to prevent cross-street frustration'],
        directEffects: ['Increases green-wave throughput for priority traffic', 'Eliminates stop-and-go platoon shockwaves'],
        secondaryRisks: ['Increases queue delay and wait times for minor cross-street vehicles and pedestrian crossings'],
        delayedOrDisplacedEffects: ['Minor side-street cut-through diversion if cross-street queues become excessive'],
        safeguardsAndPrecautions: ['Maintain pedestrian countdown signals', 'Cap maximum cross-street red wait at 90 seconds'],
        monitoringNeeds: ['High-resolution signal controller event logs', 'Pedestrian pushbutton actuation frequency'],
        recoveryOrRollback: ['Instant remote automated fallback to time-of-day (TOD) baseline signal timing plans']
      },
      upgrade: {
        actionVerb: 'upgrade',
        name: 'Widen Cross-Section or Designate Dedicated Lane',
        description: 'Add physical travel lane, rechannelize shoulder into peak-period running lane, or dedicate exclusive bus/HOV lane.',
        targetAssetTypes: ['cell-campus-main', 'cell-nw-in', 'arterial-link'],
        solverVariablesChanged: [
          { variableKey: 'lanes', propertyName: 'Active Lane Count', unit: 'lanes', directionOfImpact: '+Discharge & Jam Capacity' }
        ],
        requiredInputs: ['Pavement width (m)', 'Shoulder clearance (m)', 'Curbside drainage structure capacity'],
        engineeringConstraints: ['Minimum lane width >= 3.25 m', 'Clear recovery zone >= 1.5 m from barrier'],
        directEffects: ['Increases maximum discharge capacity (q_max) by 1,400-1,800 veh/h per added lane', 'Reduces density'],
        secondaryRisks: ['Construction staging lane restrictions create temporary work-zone travel friction (15-25% delay during works)'],
        delayedOrDisplacedEffects: ['May induce additional private vehicle trips if bottleneck was previously suppressing demand'],
        safeguardsAndPrecautions: ['Enforce night-time only work closures', 'Provide temporary concrete barriers with retroreflective crash cushions'],
        monitoringNeeds: ['Radar speed sensors upstream of work zone', 'Work-zone travel time delay index'],
        recoveryOrRollback: ['Reopen auxiliary shoulder as temporary general lane during traffic incident']
      },
      restrict: {
        actionVerb: 'restrict',
        name: 'Demand Management & Heavy Vehicle Access Control',
        description: 'Implement peak-hour freight delivery restrictions, commercial cordon pricing, or managed turn bans at congested junctions.',
        targetAssetTypes: ['cell-nw-in', 'cell-hub-1', 'urban-cordon'],
        solverVariablesChanged: [
          { variableKey: 'inflowDemandVehHour', propertyName: 'Inflow Demand Arrival Rate', unit: 'veh/h', directionOfImpact: '-Arrival Demand' }
        ],
        requiredInputs: ['Truck trip generation rate', 'Alternate perimeter bypass routes', 'Enforcement ANPR camera locations'],
        engineeringConstraints: ['Alternate truck bypass route must satisfy bridge weight ratings and height clearances'],
        directEffects: ['Reduces total vehicular arrivals below intersection saturation capacity during critical peak window'],
        secondaryRisks: ['Displaces freight delivery hours to evening/night or shifts heavy vehicles to secondary perimeter roads'],
        delayedOrDisplacedEffects: ['Supply-chain scheduling friction for commercial logistics operators'],
        safeguardsAndPrecautions: ['Coordinate designated off-peak loading windows with local merchant associations', 'Signpost truck bypass clearly'],
        monitoringNeeds: ['Automated Number Plate Recognition (ANPR) compliance checks', 'Perimeter route pavement wear tracking'],
        recoveryOrRollback: ['Immediate administrative suspension of restriction during regional arterial emergencies']
      }
    }
  },

  water: {
    domain: 'water',
    formalName: 'Municipal Pressurized Water Distribution Hydraulics',
    governingTheory: 'Darcy-Weisbach head-loss friction theory & Mass/Energy Conservation in closed conduit networks',
    activeSolverName: 'Darcy-Weisbach Damped Newton-Raphson Hydraulic Engine v2.0',
    isOptimizationSolver: false,
    governingEquations: [
      {
        equationName: 'Darcy-Weisbach Pipe Friction Head Loss',
        latexFormula: 'h_f = f \\cdot \\frac{L}{D} \\cdot \\frac{v^2}{2g} = f \\cdot \\frac{8 L Q^2}{\\pi^2 g D^5}',
        plainExplanation: 'Friction head loss is proportional to pipe length, roughness friction factor, and flow squared, and inversely proportional to diameter to the fifth power.'
      },
      {
        equationName: 'Colebrook-White Friction Factor Implicit Formulation',
        latexFormula: '\\frac{1}{\\sqrt{f}} = -2 \\log_{10}\\left(\\frac{\\varepsilon}{3.7 D} + \\frac{2.51}{\\text{Re}\\sqrt{f}}\\right)',
        plainExplanation: 'Determines the hydraulic friction factor across transitional and fully rough turbulent pipe flow regimes based on conduit roughness.'
      },
      {
        equationName: 'Junction Hydraulic Grade & Pressure Head',
        latexFormula: 'P_i = \\rho g \\left(H_i - z_i\\right) \\cdot 10^{-3} \\quad [\\text{kPa}]',
        plainExplanation: 'Delivered service pressure equals fluid density times gravity times the difference between piezometric hydraulic head and ground elevation.'
      }
    ],
    modeledVariables: [
      {
        key: 'diameter',
        name: 'Conduit Internal Diameter',
        unit: 'meters (m)',
        description: 'Internal bore diameter of pressurized distribution pipe.',
        governingRole: 'Drives flow velocity and inversely reduces friction head loss by power of 5 (D^5).',
        normalRange: '0.10 - 1.20 m'
      },
      {
        key: 'absoluteRoughnessMm',
        name: 'Conduit Absolute Roughness (ε)',
        unit: 'millimeters (mm)',
        description: 'Equivalent sand-grain roughness height of pipe interior wall.',
        governingRole: 'Directly enters Colebrook-White equation to determine friction factor f.',
        normalRange: '0.01 mm (Smooth HDPE) to 1.50 mm (Tuberculated Cast Iron)'
      },
      {
        key: 'elevation',
        name: 'Node Ground Elevation (z)',
        unit: 'meters (m)',
        description: 'Topographic elevation above mean sea level at customer junction.',
        governingRole: 'Subtracted from hydraulic grade line (HGL) to compute local delivery pressure.',
        normalRange: '5 - 120 m'
      },
      {
        key: 'baseDemandM3s',
        name: 'Customer Withdrawal Demand (Q_dem)',
        unit: 'm³/s',
        description: 'Peak withdrawal rate consumed by connected service connections.',
        governingRole: 'Withdrawal sink boundary condition in nodal mass conservation continuity balance.',
        normalRange: '0.005 - 0.250 m³/s'
      }
    ],
    unmodeledPhysics: [
      {
        phenomenon: 'Joukowsky Fast-Transient Water Hammer Surge',
        whyUnmodeled: 'The hydraulic engine solves steady-state continuity and energy, not elastic hyperbolic wave equations (dp = rho*a*dv).',
        requiredDataOrModel: 'Requires method-of-characteristics (MOC) acoustic transient simulation with valve closure timing and pipe elasticity.'
      },
      {
        phenomenon: 'Chlorine Disinfectant Kinetic Wall Decay & Disinfection Byproducts',
        whyUnmodeled: 'EPANET water quality multispecies kinetics are not included in this hydraulic continuity solver.',
        requiredDataOrModel: 'Requires bulk reaction coefficients (k_b) and wall reaction coefficients (k_w) with tracer sampling.'
      },
      {
        phenomenon: 'Subsurface Pipe Soil Corrosion & Mechanical Joint Leakage Rate',
        whyUnmodeled: 'Underground corrosion depends on soil resistivity, redox potential, and Stray DC currents, not hydraulic head.',
        requiredDataOrModel: 'Requires soil corrosivity resistivity surveys and acoustic leak detection survey.'
      }
    ],
    authoritativeReferences: [
      {
        title: 'Turbulent flow in pipes, with particular reference to the transition region between the smooth and rough pipe laws',
        authors: 'Cyril F. Colebrook',
        year: 1939,
        publisherOrStandard: 'Journal of the Institution of Civil Engineers, Vol. 11, No. 4, pp. 133–156',
        provenanceNote: 'Establishes universal pipe friction law across transitional and rough pipe flow regimes.',
        linkOrCitation: 'https://doi.org/10.1680/ijoti.1939.13150'
      },
      {
        title: 'EPANET 2 Users Manual: Modeling Water Distribution Systems',
        authors: 'Lewis A. Rossman',
        year: 2000,
        publisherOrStandard: 'U.S. Environmental Protection Agency (EPA), EPA/600/R-00/057',
        provenanceNote: 'Standard reference for nodal pressure thresholds (>= 180 kPa), maximum pipe velocities (<= 2.0 m/s), and network continuity.',
        linkOrCitation: 'https://www.epa.gov/water-research/epanet'
      }
    ],
    actions: {
      build: {
        actionVerb: 'build',
        name: 'Construct Parallel Ductile Distribution Loop or Storage Tank',
        description: 'Build new parallel dedicated water transmission main or elevated storage balancing reservoir.',
        targetAssetTypes: ['pipe-trunk-1', 'pipe-valley-prv', 'storage-tank'],
        solverVariablesChanged: [
          { variableKey: 'diameter', propertyName: 'Loop Diameter', unit: 'm', directionOfImpact: '+Conveyance' },
          { variableKey: 'elevation', propertyName: 'Reservoir Head', unit: 'm', directionOfImpact: '+Static Head' }
        ],
        requiredInputs: ['Conduit length (L)', 'Pipe class pressure rating (PN10/PN16)', 'Trench bedding profile'],
        engineeringConstraints: ['Minimum pipe burial depth >= 1.2 m below grade', 'Velocity <= 2.0 m/s under peak flow'],
        directEffects: ['Provides redundant hydraulic conveyance path', 'Eliminates peak-hour delivery deficits to elevated ridges'],
        secondaryRisks: ['Subsurface utility clashes with buried telecom and electrical conduits during trenching'],
        delayedOrDisplacedEffects: ['Increased pressure in older downstream distribution zones can provoke micro-joint leakage'],
        safeguardsAndPrecautions: ['Conduct Ground-Penetrating Radar (GPR) utility potholing before trenching', 'Install air-release vacuum valves'],
        monitoringNeeds: ['Electromagnetic flow meters at loop bifurcation', 'Real-time pressure transducer telemetry at summit nodes'],
        recoveryOrRollback: ['Isolation valves allow immediate section shutdown without interrupting baseline trunk feed']
      },
      change: {
        actionVerb: 'change',
        name: 'Adjust Pressure Reducing Valve (PRV) Setting & Pump Schedules',
        description: 'Modulate PRV downstream setpoint pressure or reprogram booster pump operational dispatch hours.',
        targetAssetTypes: ['pipe-valley-prv', 'pipe-pump-boost', 'control-valve'],
        solverVariablesChanged: [
          { variableKey: 'baseDemandM3s', propertyName: 'Peak Withdrawal Draw', unit: 'm³/s', directionOfImpact: 'Rebalanced' }
        ],
        requiredInputs: ['Target downstream head (H_set)', 'Valve cavitation index (sigma)', 'Motor VFD frequency curve'],
        engineeringConstraints: ['Maintain minimum residual pressure >= 180 kPa for fire flow and multi-story supply'],
        directEffects: ['Smooths hydraulic pressure variations across diurnal cycles', 'Reduces excessive head in low-elevation valley'],
        secondaryRisks: ['Excessive throttling increases valve seat cavitation wear and can starve higher elevation nodes'],
        delayedOrDisplacedEffects: ['Cavitation pitting on valve trim if pressure ratio exceeds manufacturer limits'],
        safeguardsAndPrecautions: ['Install multi-stage pressure reduction or anti-cavitation trim', 'Equip with pilot bypass'],
        monitoringNeeds: ['High-frequency pressure transducers (10 Hz) upstream and downstream of valve', 'Acoustic vibration sensors'],
        recoveryOrRollback: ['Automated solenoid override opens valve pilot to safe baseline fixed position']
      },
      upgrade: {
        actionVerb: 'upgrade',
        name: 'Upsize Conduit Diameter or Re-line Rough Corroded Pipes',
        description: 'Replace tuberculated cast-iron pipe with smooth high-density polyethylene (HDPE) or install variable frequency booster pump.',
        targetAssetTypes: ['pipe-prv-ridge', 'pipe-trunk-1', 'booster-pump'],
        solverVariablesChanged: [
          { variableKey: 'diameter', propertyName: 'Internal Diameter', unit: 'm', directionOfImpact: '+Cross-sectional Area' },
          { variableKey: 'absoluteRoughnessMm', propertyName: 'Wall Absolute Roughness', unit: 'mm', directionOfImpact: '-Friction Factor f' }
        ],
        requiredInputs: ['Existing pipe internal condition survey', 'Available right-of-way corridor width'],
        engineeringConstraints: ['Maximum allowable flow velocity <= 2.2 m/s', 'Standard pressure rating >= 1.0 MPa'],
        directEffects: ['Cuts friction head loss dramatically (by factor of D^5)', 'Restores service pressure above 220 kPa'],
        secondaryRisks: ['Open-cut trenching causes roadway lane closures and temporary municipal transit disruption'],
        delayedOrDisplacedEffects: ['Downstream velocity surge if downstream pipes are narrower, causing local scouring'],
        safeguardsAndPrecautions: ['Provide temporary overland bypass piping for affected customers during re-lining', 'Flushing protocol'],
        monitoringNeeds: ['Hydrostatic pressure proof test (1.5x working pressure for 2 hours)', 'Turbidity test after recharge'],
        recoveryOrRollback: ['Temporary cross-tie valves remain available to backfeed zone from neighboring pressure district']
      },
      restrict: {
        actionVerb: 'restrict',
        name: 'Mandatory Non-Essential Water Conservation Cordon',
        description: 'Impose restriction on automated irrigation, industrial cooling make-up, and commercial wash basins during peak draw.',
        targetAssetTypes: ['node-ridge', 'node-commercial', 'service-district'],
        solverVariablesChanged: [
          { variableKey: 'baseDemandM3s', propertyName: 'Peak Withdrawal Draw', unit: 'm³/s', directionOfImpact: '-Peak Consumption (15-30%)' }
        ],
        requiredInputs: ['Customer billing meter class breakdown', 'Public communication reach channels'],
        engineeringConstraints: ['Ensure essential public health, hospital, and residential drinking needs remain 100% satisfied'],
        directEffects: ['Lowers total network withdrawal, eliminating hydraulic pressure deficit without capital cost'],
        secondaryRisks: ['Commercial production slowdowns for water-dependent light industries'],
        delayedOrDisplacedEffects: ['Revenue reduction for municipal water utility from lower volumetric sales'],
        safeguardsAndPrecautions: ['Exempt essential medical, educational, and fire protection accounts from restrictions'],
        monitoringNeeds: ['District Metered Area (DMA) inflow telemetry', 'Smart AMI commercial meter interval data'],
        recoveryOrRollback: ['Immediate cancellation of conservation restrictions once reservoir storage recovers to nominal curve']
      }
    }
  },

  energy: {
    domain: 'energy',
    formalName: 'High-Voltage Transmission Network Power Flow',
    governingTheory: 'Linear AC Angle Relaxation & DC Load Flow (DC-PF) Susceptance Matrix Formulation',
    activeSolverName: 'DC Load Flow (DC-PF) B-Matrix Susceptance Solver v1.2',
    isOptimizationSolver: false,
    governingEquations: [
      {
        equationName: 'Nodal Susceptance Matrix Power-Flow Balance',
        latexFormula: '\\mathbf{B} \\boldsymbol{\\theta} = \\mathbf{P}_{\\text{net}} \\implies \\sum_{j \\in N_i} \\frac{\\theta_i - \\theta_j}{x_{ij}} = P_{g,i} - P_{d,i}',
        plainExplanation: 'Direct linear algebraic matrix solver computing nodal voltage phase angles from net bus power injections using the bus susceptance matrix B (slack bus reference θ_ref = 0°).'
      },
      {
        equationName: 'DC Power Flow Transmission Line Approximation',
        latexFormula: 'P_{ij} = \\frac{\\theta_i - \\theta_j}{x_{ij}} \\quad [\\text{MW}]',
        plainExplanation: 'Active MW power flow along each transmission branch equals the angular phase displacement divided by branch inductive series reactance.'
      },
      {
        equationName: 'Post-Processed Conductor Thermal Loss Estimation',
        latexFormula: 'P_{\\text{loss}, ij} \\approx I_{ij}^2 r_{ij} \\approx \\left(\\frac{P_{ij}}{V_{\\text{nom}}}\\right)^2 r_{ij} \\quad [\\text{MW}]',
        plainExplanation: 'The primary DC power-flow solver assumes lossless branches to maintain linear algebraic solvability; resistive I²R line losses are post-processed from calculated branch flows.'
      }
    ],
    modeledVariables: [
      {
        key: 'thermalRatingMw',
        name: 'Line Continuous Thermal Rating (MVA/MW)',
        unit: 'MW',
        description: 'Maximum continuous active power transfer limit governed by conductor thermal annealing and ground clearance sag.',
        governingRole: 'Enforces hard transmission capacity constraint |P_ij| <= P_max in optimization solver.',
        normalRange: '40 - 500 MW'
      },
      {
        key: 'reactancePu',
        name: 'Line Series Reactance (x_ij)',
        unit: 'p.u. (100 MVA base)',
        description: 'Inductive series reactance of overhead transmission conductor geometry.',
        governingRole: 'Determines the admittance B_ij = 1/x_ij that governs power flow split along parallel paths.',
        normalRange: '0.015 - 0.150 p.u.'
      },
      {
        key: 'scheduledMw',
        name: 'Generator Active Dispatch Output',
        unit: 'MW',
        description: 'Active electrical power injected by dispatchable generator or battery storage system.',
        governingRole: 'Generation variable P_g dispatched in Linearized DC Power Flow (B-Matrix).',
        normalRange: '10 - 600 MW'
      },
      {
        key: 'loadMw',
        name: 'Substation Active Customer Demand',
        unit: 'MW',
        description: 'Peak electrical active load consumed by downstream distribution feeders.',
        governingRole: 'Constant power withdrawal P_d,i at bus i in nodal energy balance.',
        normalRange: '5 - 250 MW'
      }
    ],
    unmodeledPhysics: [
      {
        phenomenon: 'AC Reactive Power (MVAR), Voltage Collapse & Ferranti Effect',
        whyUnmodeled: 'DC Load Flow assumes 1.0 p.u. flat voltage profiles and zero reactive power, ignoring VAR support, shunt capacitance, and voltage instability.',
        requiredDataOrModel: 'Requires full AC Newton-Raphson power flow with generator reactive limits (Q_min, Q_max) and capacitor bank states.'
      },
      {
        phenomenon: 'Transient Rotor Angle & Frequency Inertia Dynamics',
        whyUnmodeled: 'DC Load Flow solves steady-state algebraic energy equilibrium (B·θ = P), not dynamic swing equations (M d²δ/dt² = P_m - P_e) during sudden generator or line tripping.',
        requiredDataOrModel: 'Requires dynamic transient stability simulation with generator inertia constants (H) and governor response models.'
      },
      {
        phenomenon: 'Sub-synchronous Resonance & Inverter-Based Resource (IBR) Control Interactions',
        whyUnmodeled: 'High-frequency control interactions of grid-following inverters require electromagnetic transient (EMT) solvers.',
        requiredDataOrModel: 'Requires EMT simulation (e.g. PSCAD) with detailed manufacturer OEM inverter control firmware algorithms.'
      }
    ],
    authoritativeReferences: [
      {
        title: 'Power System Analysis',
        authors: 'John J. Grainger & William D. Stevenson, Jr.',
        year: 1994,
        publisherOrStandard: 'McGraw-Hill Electrical and Computer Engineering Series, New York',
        provenanceNote: 'Standard formulation of DC power flow assumptions (flat voltage profile, small angle approximation sin(θ) ≈ θ, negligible resistance R << X).',
        linkOrCitation: 'https://www.mheducation.com'
      },
      {
        title: 'Power Generation, Operation, and Control (3rd Edition)',
        authors: 'Allen J. Wood, Bruce F. Wollenberg, & Gerald B. Sheblé',
        year: 2013,
        publisherOrStandard: 'John Wiley & Sons, Hoboken, NJ',
        provenanceNote: 'Establishes linear DC power flow susceptance matrix inversion, transmission thermal constraints, and slack bus angle reference formulation.',
        linkOrCitation: 'https://doi.org/10.1002/9781118733820'
      }
    ],
    actions: {
      build: {
        actionVerb: 'build',
        name: 'Construct New Transmission Spur or Battery Energy Storage System (BESS)',
        description: 'Construct new 132/220 kV transmission line circuit or interconnect multi-megawatt battery energy storage facility.',
        targetAssetTypes: ['line-1-2', 'substation-transformer', 'battery-facility'],
        solverVariablesChanged: [
          { variableKey: 'thermalRatingMw', propertyName: 'Branch Power Rating', unit: 'MW', directionOfImpact: '+Transfer Capability' },
          { variableKey: 'scheduledMw', propertyName: 'Storage Discharge Power', unit: 'MW', directionOfImpact: '+Local Injection' }
        ],
        requiredInputs: ['Substation interconnection bay availability', 'Conductor ampacity specification', 'BESS inverter MVA rating'],
        engineeringConstraints: ['Line loading <= 100% under normal operation', 'N-1 contingency line loading <= 120%'],
        directEffects: ['Relieves line congestion and thermal overload', 'Avoids expensive out-of-merit peaker dispatch'],
        secondaryRisks: ['Parallel loop flows: changing impedance alters flow split across un-upgraded parallel network paths'],
        delayedOrDisplacedEffects: ['Electrochemical capacity degradation of lithium-ion BESS over 10-year cycle life'],
        safeguardsAndPrecautions: ['Install dedicated remedial action scheme (RAS) intertrips', 'BESS thermal runaway containment system'],
        monitoringNeeds: ['Phasor Measurement Unit (PMU) angle tracking', 'Continuous conductor temperature sag monitoring'],
        recoveryOrRollback: ['Automated circuit breaker trip isolates line; generation redispatches automatically']
      },
      change: {
        actionVerb: 'change',
        name: 'Re-dispatch Generation & Adjust Bus Voltage Angle Schedule',
        description: 'Shift unit commitment order, reallocate generation from overloaded corridors, or deploy dynamic line rating.',
        targetAssetTypes: ['gen-solar-1', 'gen-gas-peaker', 'substation-bus'],
        solverVariablesChanged: [
          { variableKey: 'scheduledMw', propertyName: 'Generator Scheduled Injection', unit: 'MW', directionOfImpact: 'Re-dispatched' }
        ],
        requiredInputs: ['Generator marginal heat rates ($/MWh)', 'Ramp rates (MW/min)', 'Minimum up/down times'],
        engineeringConstraints: ['Generator P_min <= P_g <= P_max', 'System generation must equal system load plus losses'],
        directEffects: ['Immediately clears line thermal violations by altering power flow injections at electrical buses'],
        secondaryRisks: ['Dispatches higher-cost thermal generation, increasing operational system production expenditure'],
        delayedOrDisplacedEffects: ['Increased cumulative carbon emissions if gas peaker replaces distant hydro/solar import'],
        safeguardsAndPrecautions: ['Verify spinning reserve margin >= largest single contingency (N-1 generation reserve)'],
        monitoringNeeds: ['SCADA telemetry refresh rate <= 4 seconds', 'Area Control Error (ACE) frequency monitoring'],
        recoveryOrRollback: ['Operator manual override restores automatic generation control (AGC) merit-order dispatch']
      },
      upgrade: {
        actionVerb: 'upgrade',
        name: 'Reconductor Transmission Feeder with High-Temperature Low-Sag (HTLS)',
        description: 'Replace existing ACSR conductor with advanced composite-core HTLS conductor on existing towers.',
        targetAssetTypes: ['line-2-3', 'line-1-2', 'transmission-corridor'],
        solverVariablesChanged: [
          { variableKey: 'thermalRatingMw', propertyName: 'Thermal Continuous Capacity', unit: 'MW', directionOfImpact: '+70-100% MW Rating' },
          { variableKey: 'reactancePu', propertyName: 'Series Reactance', unit: 'p.u.', directionOfImpact: '-Impedance' }
        ],
        requiredInputs: ['Tower structural dead-end tension rating', 'Insulator string electrical clearance'],
        engineeringConstraints: ['Conductor operating temperature <= 180°C', 'Maintain statutory ground clearance at maximum sag'],
        directEffects: ['Doubles line power carrying capacity within existing right-of-way without acquiring new land corridors'],
        secondaryRisks: ['Construction clearance outage requires N-1 operation of parallel lines during re-conductoring phase'],
        delayedOrDisplacedEffects: ['Shifts downstream bottleneck to terminal substation transformer bays'],
        safeguardsAndPrecautions: ['Execute reconductoring in planned low-demand seasons with pre-positioned emergency generation'],
        monitoringNeeds: ['Dynamic Line Rating (DLR) tension and ambient wind monitoring stations along right-of-way'],
        recoveryOrRollback: ['Temporary mobile substation and emergency bridging towers on standby during works']
      },
      restrict: {
        actionVerb: 'restrict',
        name: 'Contractual Demand Response & Industrial Load Curtailment',
        description: 'Activate automated industrial demand response (ADR) agreements or temporary interruptible tariffs during peak.',
        targetAssetTypes: ['load-industrial', 'substation-bus', 'service-feeder'],
        solverVariablesChanged: [
          { variableKey: 'loadMw', propertyName: 'Active Bus Withdrawal', unit: 'MW', directionOfImpact: '-Load Demand (10-35 MW)' }
        ],
        requiredInputs: ['Customer curtailment contract terms', 'Notification window (15-60 min)', 'Financial baseline energy baseline'],
        engineeringConstraints: ['Maximum curtailment duration <= 4 consecutive hours', 'Essential hospital/public safety loads strictly exempt'],
        directEffects: ['Instantly drops line loadings below 90% threshold without spinning up fossil generation'],
        secondaryRisks: ['Commercial production disruptions for participating manufacturing facilities'],
        delayedOrDisplacedEffects: ['Post-curtailment "snapback" / rebound surge when industrial facilities restart machinery simultaneously'],
        safeguardsAndPrecautions: ['Stagger industrial resumption schedules over a 90-minute ramp window to prevent rebound shocks'],
        monitoringNeeds: ['Revenue-grade interval metering (15-min settlement data)', 'Grid frequency stability monitoring'],
        recoveryOrRollback: ['Immediate notification to participants ending event early if grid conditions normalize']
      }
    }
  }
};

export function getDomainKnowledge(domain: DomainType): DomainKnowledgeProfile {
  return DOMAIN_KNOWLEDGE_BASE[domain];
}

export function getActionKnowledge(domain: DomainType, actionVerb: 'build' | 'change' | 'upgrade' | 'restrict'): ActionKnowledgeItem {
  return DOMAIN_KNOWLEDGE_BASE[domain].actions[actionVerb];
}
