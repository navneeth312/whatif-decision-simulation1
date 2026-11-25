import {
  DomainType,
  FutureScenarioCase,
  ParameterModification,
  ProblemStatement,
  Scenario,
  SolutionAlternative
} from '../types';

export interface AIAllowedParameter {
  targetId: string;
  targetName: string;
  property: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
}

export interface AIProposedModification {
  targetId: string;
  property: string;
  newValue: number;
  rationale: string;
}

export interface AIProposedAlternative {
  name: string;
  tag: string;
  description: string;
  modifications: AIProposedModification[];
}

export interface AIProblemDraft {
  title: string;
  description: string;
  measurableSymptom: string;
  baselineChanges: AIProposedModification[];
  alternatives: AIProposedAlternative[];
  futureCases: Array<{
    name: string;
    horizonYears: number;
    multiplier: number;
    parameterShift: string;
    description: string;
    contingencyAssetId?: string;
  }>;
  assumptions: string[];
  missingData: string[];
}

export function getAIAllowedParameters(scenario: Scenario): AIAllowedParameter[] {
  const entries: AIAllowedParameter[] = [];
  const add = (
    targetId: string,
    targetName: string,
    property: string,
    label: string,
    value: number,
    unit: string,
    min: number,
    max: number
  ) => {
    if (Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max >= min) {
      entries.push({ targetId, targetName, property, label, value, unit, min, max });
    }
  };

  if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
    for (const cell of scenario.trafficNetwork.cells) {
      add(cell.id, cell.name, 'lanes', 'Lane count', cell.lanes, 'lanes', 1, 8);
      add(cell.id, cell.name, 'freeFlowSpeedKmh', 'Free-flow speed', cell.freeFlowSpeedKmh, 'km/h', 15, 120);
      add(cell.id, cell.name, 'initialDensityVehKmPerLane', 'Initial density', cell.initialDensityVehKmPerLane, 'veh/km/lane', 0, cell.jamDensityVehKmPerLane * 0.95);
      if (cell.signalGreenRatio !== undefined) {
        add(cell.id, cell.name, 'signalGreenRatio', 'Signal green ratio', cell.signalGreenRatio, 'ratio', 0.05, 0.95);
      }
      if (cell.inflowDemandVehHour !== undefined) {
        add(cell.id, cell.name, 'inflowDemandVehHour', 'Inflow demand', cell.inflowDemandVehHour, 'veh/h', 0, 20_000);
      }
    }
  } else if (scenario.domain === 'water' && scenario.waterNetwork) {
    for (const pipe of scenario.waterNetwork.pipes) {
      add(pipe.id, pipe.id, 'diameter', 'Pipe diameter', pipe.diameter, 'm', 0.05, 2.5);
      add(pipe.id, pipe.id, 'absoluteRoughnessMm', 'Absolute pipe roughness', pipe.absoluteRoughnessMm ?? 0.15, 'mm', 0.001, 10);
    }
    for (const node of scenario.waterNetwork.nodes) {
      add(node.id, node.name, 'baseDemand', 'Base demand', node.baseDemand, 'm³/s', 0, 1);
      if (node.head !== undefined) {
        add(node.id, node.name, 'head', 'Hydraulic head', node.head, 'm', 0, 500);
      }
    }
  } else if (scenario.domain === 'energy' && scenario.powerNetwork) {
    for (const line of scenario.powerNetwork.lines) {
      add(line.id, line.id, 'reactancePu', 'Line reactance', line.reactancePu, 'p.u.', 0.002, 5);
      add(line.id, line.id, 'thermalRatingMw', 'Thermal rating', line.thermalRatingMw, 'MW', 0.5, 2_000);
    }
    for (const generator of scenario.powerNetwork.generators) {
      add(generator.id, generator.id, 'scheduledMw', 'Scheduled generation', generator.scheduledMw, 'MW', generator.minMw, generator.maxMw);
    }
  }
  return entries;
}

export function buildAIProblemContext(scenario: Scenario) {
  const parameters = getAIAllowedParameters(scenario);
  return {
    domain: scenario.domain,
    currentConstraints: scenario.constraints.map((constraint) => ({
      name: constraint.name,
      operator: constraint.operator,
      threshold: constraint.threshold,
      unit: constraint.unit
    })),
    parameters
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textField(value: unknown, key: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`AI response is missing ${key}.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error(`AI response has an invalid ${key}.`);
  return trimmed;
}

function validateModifications(
  value: unknown,
  allowed: Map<string, AIAllowedParameter>,
  label: string,
  minCount: number,
  maxCount: number
): AIProposedModification[] {
  if (!Array.isArray(value) || value.length < minCount || value.length > maxCount) {
    throw new Error(`AI response must include ${minCount}–${maxCount} ${label}.`);
  }
  const seen = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item)) throw new Error(`AI response contains an invalid ${label} item.`);
    const targetId = textField(item.targetId, 'asset ID', 80);
    const property = textField(item.property, 'parameter name', 80);
    const key = `${targetId}:${property}`;
    const parameter = allowed.get(key);
    if (!parameter) throw new Error(`AI proposed an unsupported parameter (${key}); please try a more specific problem.`);
    if (seen.has(key)) throw new Error(`AI repeated parameter ${key}.`);
    seen.add(key);
    const newValue = Number(item.newValue);
    if (!Number.isFinite(newValue) || newValue < parameter.min || newValue > parameter.max) {
      throw new Error(`AI proposed an out-of-range value for ${parameter.label}.`);
    }
    return {
      targetId,
      property,
      newValue: property === 'lanes' ? Math.round(newValue) : newValue,
      rationale: textField(item.rationale, 'rationale', 280)
    };
  });
}

export function validateAIProblemDraft(
  value: unknown,
  scenario: Scenario
): AIProblemDraft {
  if (!isRecord(value)) throw new Error('AI did not return a usable scenario draft.');
  const allowedParameters = getAIAllowedParameters(scenario);
  const allowed = new Map(allowedParameters.map((parameter) => [`${parameter.targetId}:${parameter.property}`, parameter]));
  const baselineChanges = value.baselineChanges === undefined
    ? []
    : validateModifications(value.baselineChanges, allowed, 'baseline changes', 0, 6);

  if (!Array.isArray(value.alternatives) || value.alternatives.length < 3 || value.alternatives.length > 5) {
    throw new Error('AI must propose at least three solver-ready alternatives.');
  }
  const alternatives = value.alternatives.map((item, index): AIProposedAlternative => {
    if (!isRecord(item)) throw new Error('AI returned an invalid solution option.');
    return {
      name: textField(item.name, 'alternative name', 90),
      tag: `Solution ${String.fromCharCode(65 + index)}`,
      description: textField(item.description, 'alternative description', 500),
      modifications: validateModifications(item.modifications, allowed, 'alternative changes', 1, 5)
    };
  });

  if (!Array.isArray(value.futureCases) || value.futureCases.length < 3 || value.futureCases.length > 5) {
    throw new Error('AI must propose at least three future stress cases.');
  }
  const outageIds = new Set(allowedParameters
    .filter((parameter) => scenario.domain === 'traffic'
      ? parameter.property === 'lanes'
      : scenario.domain === 'water'
      ? parameter.property === 'diameter'
      : parameter.property === 'reactancePu')
    .map((parameter) => parameter.targetId));
  const futureCases = value.futureCases.map((item, index) => {
    if (!isRecord(item)) throw new Error('AI returned an invalid future stress case.');
    const horizonYears = Number(item.horizonYears);
    const multiplier = Number(item.multiplier);
    if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 30) {
      throw new Error('AI returned a future horizon outside the supported 1–30 year range.');
    }
    if (!Number.isFinite(multiplier) || multiplier < 1.01 || multiplier > 2.5) {
      throw new Error('AI returned a demand stress multiplier outside the supported range.');
    }
    const contingencyAssetId = item.contingencyAssetId === undefined || item.contingencyAssetId === ''
      ? undefined
      : textField(item.contingencyAssetId, 'contingency asset ID', 80);
    if (contingencyAssetId && !outageIds.has(contingencyAssetId)) {
      throw new Error('AI selected an unsupported future contingency asset.');
    }
    return {
      id: `ai-future-${index + 1}`,
      name: textField(item.name, 'future stress case name', 90),
      horizonYears,
      multiplier,
      parameterShift: textField(item.parameterShift, 'future stress description', 180),
      description: textField(item.description, 'future stress notes', 360),
      contingencyAssetId
    };
  });

  const assumptions = Array.isArray(value.assumptions)
    ? value.assumptions.slice(0, 8).map((item) => textField(item, 'assumption', 220))
    : [];
  const missingData = Array.isArray(value.missingData)
    ? value.missingData.slice(0, 8).map((item) => textField(item, 'missing data item', 220))
    : [];

  return {
    title: textField(value.title, 'problem title', 100),
    description: textField(value.description, 'problem description', 700),
    measurableSymptom: textField(value.measurableSymptom, 'problem symptom', 220),
    baselineChanges,
    alternatives,
    futureCases,
    assumptions,
    missingData
  };
}

function getCurrentValue(scenario: Scenario, targetId: string, property: string): number | undefined {
  if (scenario.domain === 'traffic') {
    const cell = scenario.trafficNetwork?.cells.find((entry) => entry.id === targetId);
    const value = cell?.[property as keyof typeof cell];
    return typeof value === 'number' ? value : undefined;
  }
  if (scenario.domain === 'water') {
    const pipe = scenario.waterNetwork?.pipes.find((entry) => entry.id === targetId);
    const node = scenario.waterNetwork?.nodes.find((entry) => entry.id === targetId);
    const value = pipe?.[property as keyof typeof pipe] ?? node?.[property as keyof typeof node];
    return typeof value === 'number' ? value : undefined;
  }
  const line = scenario.powerNetwork?.lines.find((entry) => entry.id === targetId);
  const generator = scenario.powerNetwork?.generators.find((entry) => entry.id === targetId);
  const value = line?.[property as keyof typeof line] ?? generator?.[property as keyof typeof generator];
  return typeof value === 'number' ? value : undefined;
}

function applyNetworkValue(scenario: Scenario, targetId: string, property: string, newValue: number): void {
  if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
    const cell = scenario.trafficNetwork.cells.find((entry) => entry.id === targetId);
    if (!cell) throw new Error(`Unknown traffic asset ${targetId}.`);
    (cell as unknown as Record<string, number>)[property] = newValue;
  } else if (scenario.domain === 'water' && scenario.waterNetwork) {
    const pipe = scenario.waterNetwork.pipes.find((entry) => entry.id === targetId);
    const node = scenario.waterNetwork.nodes.find((entry) => entry.id === targetId);
    const asset = pipe || node;
    if (!asset) throw new Error(`Unknown water asset ${targetId}.`);
    (asset as unknown as Record<string, number>)[property] = newValue;
  } else if (scenario.domain === 'energy' && scenario.powerNetwork) {
    const line = scenario.powerNetwork.lines.find((entry) => entry.id === targetId);
    const generator = scenario.powerNetwork.generators.find((entry) => entry.id === targetId);
    const asset = line || generator;
    if (!asset) throw new Error(`Unknown energy asset ${targetId}.`);
    (asset as unknown as Record<string, number>)[property] = newValue;
  }
}

function buildParameterModification(
  scenario: Scenario,
  proposed: AIProposedModification
): ParameterModification {
  const parameter = getAIAllowedParameters(scenario).find((entry) =>
    entry.targetId === proposed.targetId && entry.property === proposed.property
  );
  const originalValue = getCurrentValue(scenario, proposed.targetId, proposed.property);
  if (!parameter || originalValue === undefined) throw new Error(`AI selected an unavailable parameter (${proposed.targetId}:${proposed.property}).`);
  return {
    targetId: proposed.targetId,
    property: proposed.property,
    label: `${parameter.targetName} · ${parameter.label}`,
    originalValue,
    newValue: proposed.newValue,
    unit: parameter.unit
  };
}

export function applyAIProblemDraftToScenario(
  baseScenario: Scenario,
  draft: AIProblemDraft,
  studyAreaPlaceId: string,
  studyAreaLabel?: string
): Scenario {
  const scenario = JSON.parse(JSON.stringify(baseScenario)) as Scenario;
  const baselineModifications = draft.baselineChanges.map((change) => buildParameterModification(scenario, change));
  for (const change of baselineModifications) {
    applyNetworkValue(scenario, change.targetId, change.property, change.newValue);
  }

  const alternatives: SolutionAlternative[] = draft.alternatives.map((proposed, index) => {
    const modifications = proposed.modifications.map((change) => buildParameterModification(scenario, change));
    const templateCost = baseScenario.alternatives[index] || baseScenario.alternatives[0];
    return {
      id: `ai-${scenario.domain}-${Date.now()}-${index + 1}`,
      name: proposed.name,
      tag: proposed.tag,
      description: proposed.description,
      modifications,
      capexCostMillion: 0,
      opexAnnualMillion: 0,
      implementationMonths: 0,
      color: templateCost?.color || ['#22d3ee', '#a78bfa', '#34d399'][index % 3],
      costDataStatus: 'not-estimated',
      scheduleDataStatus: 'not-estimated'
    };
  });

  const futureScenarios: FutureScenarioCase[] = draft.futureCases.map((stress, index) => ({
    id: `ai-future-${scenario.domain}-${index + 1}`,
    name: stress.name,
    horizonYears: stress.horizonYears,
    multiplier: stress.multiplier,
    parameterShift: stress.parameterShift,
    description: stress.description,
    contingencyAssetId: stress.contingencyAssetId
  }));
  const affectedAssetIds = Array.from(new Set([
    ...baselineModifications.map((modification) => modification.targetId),
    ...alternatives.flatMap((alternative) => alternative.modifications.map((modification) => modification.targetId))
  ]));
  const dataSource = 'AI-assisted concept draft · synthetic solver topology and assumptions · not surveyed utility GIS';
  const problemStatement: ProblemStatement = {
    id: `prob-ai-${scenario.domain}-${Date.now()}`,
    title: draft.title,
    description: draft.description,
    domain: scenario.domain as DomainType,
    affectedAssetIds,
    measurableSymptom: draft.measurableSymptom,
    thresholdConstraint: scenario.constraints.map((constraint) =>
      `${constraint.name} ${constraint.operator} ${constraint.threshold} ${constraint.unit}`
    ).join('; '),
    horizon: 'Future stress cases are conditional scenarios, not forecasts',
    units: scenario.domain === 'traffic'
      ? 'km/h, veh/km/lane, veh/h'
      : scenario.domain === 'water'
      ? 'kPa, m/s, m/km, m³/s'
      : 'MW, p.u., % thermal loading',
    dataSource,
    baselineInputsSummary: [
      `Study area: ${studyAreaLabel || studyAreaPlaceId}`,
      'Solver values are illustrative until site survey and utility data are supplied.',
      ...draft.assumptions.map((assumption) => `AI assumption: ${assumption}`),
      ...draft.missingData.map((missing) => `Missing data: ${missing}`)
    ].join(' '),
    available: true,
    baselineModifications,
    alternativesOverride: alternatives,
    futureScenariosOverride: futureScenarios
  };

  return {
    ...scenario,
    id: `scen-ai-${scenario.domain}-${Date.now()}`,
    title: draft.title,
    description: draft.description,
    category: scenario.domain === 'traffic'
      ? 'Transportation'
      : scenario.domain === 'water'
      ? 'Water Utility'
      : 'Energy',
    updatedAt: new Date().toISOString(),
    status: 'draft',
    studyAreaPlaceId,
    studyAreaLabel: studyAreaLabel?.trim() || studyAreaPlaceId,
    problemStatement,
    alternatives,
    futureScenarios
  };
}
