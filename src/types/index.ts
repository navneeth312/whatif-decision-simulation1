export type DomainType = 'traffic' | 'water' | 'energy';

export interface BaseComponent {
  id: string;
  name: string;
  x: number; // schematic coordinate (0-100 or local grid)
  y: number;
  z?: number;
}

// ---------------- Water Distribution Types ----------------
export interface WaterNode extends BaseComponent {
  type: 'reservoir' | 'junction' | 'tank' | 'pump' | 'valve';
  elevation: number; // meters (m)
  baseDemand: number; // m³/s (positive = outflow)
  head?: number; // meters (m) fixed for reservoir
}

export interface WaterPipe {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  length: number; // meters (m)
  diameter: number; // meters (m)
  /** Darcy-Weisbach absolute internal roughness (mm). Use this for new data. */
  absoluteRoughnessMm?: number;
  /** Legacy import compatibility only. Converted to equivalent roughness when needed. */
  hazenWilliamsC?: number;
  maxPressureKPa?: number;
}

export interface WaterNetwork {
  nodes: WaterNode[];
  pipes: WaterPipe[];
  waterDensityKgM3: number; // default 1000 kg/m³
  gravityMs2: number; // default 9.81 m/s²
  /** Dynamic viscosity; water at ~20 °C is approximately 1.002e-3 Pa·s. */
  dynamicViscosityPaS?: number;
}

export interface WaterSimulationResult {
  converged: boolean;
  iterations: number;
  residualNorm: number;
  tolerance: number;
  nodeResults: Record<
    string,
    {
      head: number; // m
      pressureKPa: number; // kPa = ρg(H - elev)/1000
      demandSupplied: number; // m³/s
      unmetDemand: boolean;
      lowPressureWarning: boolean;
      negativePressureWarning: boolean;
    }
  >;
  pipeResults: Record<
    string,
    {
      flowM3s: number; // m³/s, sign indicates from->to
      velocityMs: number; // m/s
      headLossM: number; // m
      headLossPerKm: number; // m/km
      overloaded: boolean;
    }
  >;
  totalFlowM3s: number;
  maxHeadLossM: number;
  minPressureKPa: number;
  warnings: string[];
  solverNote: string;
}

// ---------------- Electrical Grid Types ----------------
export interface BusNode extends BaseComponent {
  baseKv: number; // kV
  isSlack?: boolean;
  isSubstation?: boolean;
  hasTransformer?: boolean;
}

export interface Generator {
  id: string;
  busId: string;
  minMw: number;
  maxMw: number;
  scheduledMw: number;
  costPerMwh?: number;
}

export interface Load {
  id: string;
  busId: string;
  mw: number;
}

export interface TransmissionLine {
  id: string;
  fromBusId: string;
  toBusId: string;
  reactancePu: number; // x > 0
  resistancePu?: number; // r optional for I²R post-process
  thermalRatingMw: number; // MW limit
}

export interface PowerGridNetwork {
  baseMva: number; // e.g. 100 MVA
  buses: BusNode[];
  generators: Generator[];
  loads: Load[];
  lines: TransmissionLine[];
  nominalPowerFactor?: number; // e.g. 0.95 optional
}

export interface PowerGridSimulationResult {
  converged: boolean;
  slackBusId: string;
  slackGenerationMw: number;
  busAnglesDeg: Record<string, number>;
  busNetInjectionsMw: Record<string, number>;
  lineFlowsMw: Record<
    string,
    {
      flowMw: number; // positive from->to
      loadingPct: number;
      thermalViolation: boolean;
      estimatedLossesMw?: number; // post-processed only
    }
  >;
  totalGenerationMw: number;
  totalLoadMw: number;
  totalEstimatedLossesMw: number;
  violations: string[];
  islandsCount: number;
  solverNote: string;
}

// ---------------- Road Traffic CTM Types ----------------
export interface TrafficCell extends BaseComponent {
  lengthKm: number; // Δx km
  lanes: number;
  freeFlowSpeedKmh: number; // v_f
  jamDensityVehKmPerLane: number; // k_j
  backwardWaveSpeedKmh: number; // w
  initialDensityVehKmPerLane: number;
  signalGreenRatio?: number; // 0..1 (default 1.0)
  signalCycleSec?: number;
  nextCellIds: string[];
  inflowDemandVehHour?: number; // external input demand at entrance
}

export interface TrafficNetwork {
  timeStepSeconds: number; // Δt
  totalSteps: number;
  cells: TrafficCell[];
}

export interface TrafficTimeStepData {
  timeSec: number;
  cellDensities: Record<string, number>; // veh/km/lane
  cellSpeeds: Record<string, number>; // km/h
  cellFlows: Record<string, number>; // veh/h
  cellVehicles: Record<string, number>; // total vehicles in cell
  totalVehicles: number;
  bottlenecks: string[];
}

export interface TrafficSimulationResult {
  converged: boolean;
  cflSatisfied: boolean;
  cflRatio: number; // Δt / (Δx / max(v_f, w))
  timeSteps: TrafficTimeStepData[];
  averageSpeedKmh: number;
  maxCongestionDensityVehKm: number;
  totalDelayVehicleHours: number;
  bottleneckCells: string[];
  warnings: string[];
  solverNote: string;
}

// ---------------- Unified Simulation Data & Alternatives ----------------
export type SimulationOutput =
  | { domain: 'water'; result: WaterSimulationResult }
  | { domain: 'energy'; result: PowerGridSimulationResult }
  | { domain: 'traffic'; result: TrafficSimulationResult };

export interface ParameterModification {
  targetId: string; // ID of pipe, node, cell, line, generator
  property: string; // e.g. "lanes", "diameter", "scheduledMw", "signalGreenRatio"
  label: string;
  originalValue: number;
  newValue: number;
  unit: string;
}

export interface SolutionAlternative {
  id: string;
  name: string;
  description: string;
  tag: string; // e.g. 'Solution A', 'Metro Stop', 'High-Pressure Loop'
  modifications: ParameterModification[];
  capexCostMillion: number; // in Millions ($ or local unit)
  opexAnnualMillion: number;
  implementationMonths: number;
  color: string;
  costDataStatus?: 'illustrative' | 'not-estimated';
  scheduleDataStatus?: 'illustrative' | 'not-estimated';
}

export interface ScenarioObjective {
  id: string;
  name: string;
  unit: string;
  direction: 'minimize' | 'maximize';
  weight: number; // 0..1, sum of weights = 1
  description: string;
}

export interface ScenarioAssumption {
  id: string;
  name: string;
  category: 'demand' | 'physics' | 'cost' | 'policy';
  value: number;
  unit: string;
  rangeMin: number;
  rangeMax: number;
  description: string;
}

export interface ScenarioConstraint {
  id: string;
  name: string;
  metricKey: string;
  threshold: number;
  operator: '<=' | '>=' | '<' | '>';
  unit: string;
  severity: 'hard' | 'soft';
}

export interface FutureScenarioCase {
  id: string;
  name: string;
  horizonYears: number;
  parameterShift: string;
  multiplier: number;
  description: string;
  contingencyAssetId?: string;
}

export interface ProblemStatement {
  id: string;
  title: string;
  description: string;
  domain: DomainType;
  affectedAssetIds: string[];
  measurableSymptom: string;
  thresholdConstraint: string;
  horizon: string;
  units: string;
  dataSource: string;
  baselineInputsSummary: string;
  available?: boolean; // defaults to true; false when physics not modeled
  unavailableReason?: string;
  baselineModifications?: ParameterModification[];
  constraintsOverride?: ScenarioConstraint[];
  assumptionsOverride?: ScenarioAssumption[];
  alternativesOverride?: SolutionAlternative[];
  futureScenariosOverride?: FutureScenarioCase[];
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category: 'Urban Planning' | 'Environment' | 'Transportation' | 'Energy' | 'Water Utility';
  domain: DomainType;
  updatedAt: string;
  status: 'draft' | 'running' | 'completed';
  studyAreaPlaceId?: string;
  studyAreaLabel?: string;
  problemStatement?: ProblemStatement;
  futureScenarios?: FutureScenarioCase[];
  objectives: ScenarioObjective[];
  assumptions: ScenarioAssumption[];
  constraints: ScenarioConstraint[];
  alternatives: SolutionAlternative[];
  // Domain network data
  waterNetwork?: WaterNetwork;
  powerNetwork?: PowerGridNetwork;
  trafficNetwork?: TrafficNetwork;
}

export interface HydraulicConstraintCheck {
  minPressureStatus: 'passed' | 'failed';
  minPressureValue: number;
  minPressureThreshold: number;
  minPressureMessage: string;

  maxPressureStatus: 'passed' | 'failed';
  maxPressureValue: number;
  maxPressureThreshold: number;
  maxPressureNodeId: string;
  maxPressureMessage: string;

  velocityStatus: 'passed' | 'failed';
  maxVelocityValue: number;
  velocityThreshold: number;
  highVelocityPipeCount: number;
  velocityMessage: string;

  headLossStatus: 'passed' | 'failed';
  maxHeadLossValue: number;
  headLossThreshold: number;
  highHeadLossPipeCount: number;
  headLossMessage: string;

  missingOrUnconfiguredConstraints: string[];
  overallFeasibilityStatus: 'feasible' | 'breached';
}

export interface AlternativeRunRecord {
  alternativeId: string;
  alternativeName: string;
  domain: DomainType;
  runTimestamp: string;
  modelVersion: string;
  seed: number;
  executionMs: number;
  feasible: boolean;
  feasibilityStatus?: 'feasible' | 'breached' | 'incomplete';
  feasibilityLabel?: string;
  constraintViolations: string[];
  unverifiedConstraints?: string[];
  hydraulicStatus?: HydraulicConstraintCheck;
  costDataStatus?: 'illustrative' | 'not-estimated';
  scheduleDataStatus?: 'illustrative' | 'not-estimated';
  metrics: {
    primaryPerformance: number; // e.g. delay reduction %, pressure variance, loss MW
    primaryPerformanceUnit: string;
    totalCostMillion: number;
    environmentalImpactScore: number; // 0-100 or metric
    implementationRiskScore: number; // 0-100
    userBenefitScore: number; // 0-100
  };
  normalizedScores: {
    performanceNorm: number;
    costNorm: number;
    envNorm: number;
    riskNorm: number;
    benefitNorm: number;
    overallUtility: number; // weighted sum (0-100)
  };
  rawOutput: SimulationOutput;
}

export interface SensitivityItem {
  parameter: string;
  baseValue: number;
  deltaPct: number;
  impactOnScore: number;
  direction: 'positive' | 'negative' | 'neutral';
  criticality: 'low' | 'medium' | 'high';
}

export interface DecisionRobustnessReport {
  overallScore: number; // 0-100 DRS formula
  trialsCount: number;
  seed: number;
  stressDistribution: string;
  trials: {
    trialId: number;
    perturbationSummary: string;
    feasibleCount: number;
    topSolutionId: string;
    utilitySelected: number;
    utilityBestFeasible: number;
  }[];
  assumptionsTested: string[];
  notes: string;
}

export interface DecisionBreakerResult {
  preferredAlternativeId: string;
  criticalAssumptionId: string;
  criticalAssumptionName: string;
  nominalValue: number;
  breakThresholdValue: number;
  pctShiftRequired: number;
  unit: string;
  breakType: 'infeasibility' | 'rank_reversal';
  newWinnerAlternativeId?: string;
  explanation: string;
}
