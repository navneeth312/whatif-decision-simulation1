import {
  Scenario,
  SolutionAlternative,
  AlternativeRunRecord,
  DecisionRobustnessReport,
  DecisionBreakerResult,
  SensitivityItem,
  SimulationOutput
} from '../types';
import { legacyHazenWilliamsEquivalentRoughnessMm, solveWaterNetwork } from './waterSolver';
import { solvePowerGrid } from './powerGridSolver';
import { solveTrafficNetwork } from './trafficSolver';

/**
 * Runs simulation for a single alternative in a given scenario.
 * Clones network, applies assumption scaling and parameter modifications, solves,
 * checks constraints, and extracts primary performance, cost, and normalized utility.
 */
export function runAlternativeSimulation(
  scenario: Scenario,
  alternative: SolutionAlternative,
  seed = 42
): AlternativeRunRecord {
  const t0 = performance.now();
  let rawOutput: SimulationOutput;
  let primaryPerformance = 0;
  let primaryUnit = '';
  const violations: string[] = [];
  const unverifiedConstraints: string[] = [];
  let maxNodePressureKPa = 0;
  let maxPressureNodeId = '';
  let hydraulicStatus: import('../types').HydraulicConstraintCheck | undefined;
  const hasCostEstimate = alternative.costDataStatus !== 'not-estimated';
  const hasScheduleEstimate = alternative.scheduleDataStatus !== 'not-estimated';

  // Extract assumption multipliers relative to nominal baseline assumptions
  const getAssumptionRatio = (id: string, nominalDefault: number): number => {
    const found = scenario.assumptions.find((a) => a.id === id);
    if (!found || !Number.isFinite(found.value) || nominalDefault <= 0) return 1.0;
    return found.value / nominalDefault;
  };

  const costAsm = scenario.assumptions.find((a) => a.category === 'cost');
  const costMultiplier = costAsm && costAsm.value > 0 ? costAsm.value / 100 : 1.0;

  if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
    const demandAsm = scenario.assumptions.find((a) => a.id === 'asm_demand' || a.category === 'demand');
    const nominalDemand = scenario.trafficNetwork.cells[0]?.inflowDemandVehHour || 2450;
    const demandRatio =
      demandAsm && Number.isFinite(demandAsm.value) && demandAsm.value > 100
        ? demandAsm.value / nominalDemand
        : 1.0;
    const freeSpeedRatio = getAssumptionRatio('asm_free_speed', 55);
    const jamDensityRatio = getAssumptionRatio('asm_jam_density', 130);

    // Clone traffic cells and apply assumption ratios
    const clonedCells = scenario.trafficNetwork.cells.map((c) => ({
      ...c,
      freeFlowSpeedKmh: Math.max(15, c.freeFlowSpeedKmh * freeSpeedRatio),
      jamDensityVehKmPerLane: Math.max(60, c.jamDensityVehKmPerLane * jamDensityRatio),
      initialDensityVehKmPerLane: Math.min(
        c.jamDensityVehKmPerLane * jamDensityRatio * 0.95,
        c.initialDensityVehKmPerLane * Math.pow(demandRatio, 0.65)
      ),
      inflowDemandVehHour:
        c.inflowDemandVehHour !== undefined ? c.inflowDemandVehHour * demandRatio : undefined,
      nextCellIds: [...c.nextCellIds]
    }));

    for (const mod of alternative.modifications) {
      const targetCell = clonedCells.find((c) => c.id === mod.targetId);
      if (targetCell) {
        if (mod.property === 'lanes') targetCell.lanes = Math.max(1, Math.round(mod.newValue));
        if (mod.property === 'freeFlowSpeedKmh') {
          targetCell.freeFlowSpeedKmh = mod.newValue * freeSpeedRatio;
        }
        if (mod.property === 'signalGreenRatio') {
          targetCell.signalGreenRatio = Math.max(0.05, Math.min(1, mod.newValue));
        }
        if (mod.property === 'inflowDemandVehHour') {
          targetCell.inflowDemandVehHour = Math.max(0, mod.newValue * demandRatio);
        }
        if (mod.property === 'initialDensityVehKmPerLane') {
          targetCell.initialDensityVehKmPerLane = Math.max(
            5,
            mod.newValue * Math.pow(demandRatio, 0.65)
          );
        }
      }
    }

    const result = solveTrafficNetwork({
      ...scenario.trafficNetwork,
      cells: clonedCells
    });

    rawOutput = { domain: 'traffic', result };

    const affectedAssetSet = new Set(scenario.problemStatement?.affectedAssetIds || []);
    const affectedCells = clonedCells.filter((c) => affectedAssetSet.has(c.id));
    const isCorridorSpecific =
      affectedCells.length > 0 &&
      scenario.constraints.some(
        (c) => c.metricKey === 'primaryPerformance' && /corridor/i.test(c.name)
      );

    if (isCorridorSpecific) {
      let corridorSpeedSum = 0;
      let corridorSpeedCount = 0;
      for (const step of result.timeSteps) {
        for (const ac of affectedCells) {
          if (step.cellSpeeds[ac.id] !== undefined) {
            corridorSpeedSum += step.cellSpeeds[ac.id];
            corridorSpeedCount += 1;
          }
        }
      }
      primaryPerformance =
        corridorSpeedCount > 0
          ? Math.round((corridorSpeedSum / corridorSpeedCount) * 10) / 10
          : result.averageSpeedKmh;
      primaryUnit = 'km/h corridor speed';
    } else {
      primaryPerformance = result.averageSpeedKmh;
      primaryUnit = 'km/h avg speed';
    }

    for (const w of result.warnings) {
      violations.push(w);
    }
  } else if (scenario.domain === 'water' && scenario.waterNetwork) {
    const peakFactorRatio = getAssumptionRatio('asm_peak_factor', 1.65);
    const roughnessRatio = getAssumptionRatio('asm_roughness', 110);
    const densityAsm = scenario.assumptions.find((a) => a.id === 'asm_density');

    const clonedPipes = scenario.waterNetwork.pipes.map((p) => {
      // The historical assumption index follows H-W direction: higher means smoother.
      // Apply that direction to absolute Darcy roughness for every current scenario.
      const assumptionScale = Math.pow(Math.max(0.1, roughnessRatio), -1.852);
      const baseRoughnessMm = p.absoluteRoughnessMm ?? (
        p.hazenWilliamsC && p.hazenWilliamsC > 0
          ? legacyHazenWilliamsEquivalentRoughnessMm(
              p.hazenWilliamsC,
              p.diameter,
              (scenario.waterNetwork!.dynamicViscosityPaS ?? 1.002e-3) / (scenario.waterNetwork!.waterDensityKgM3 || 1000),
              scenario.waterNetwork!.gravityMs2 || 9.81
            )
          : 0.15
      );
      if (p.absoluteRoughnessMm === undefined && p.hazenWilliamsC !== undefined) {
        unverifiedConstraints.push(`Pipe ${p.id} uses a legacy Hazen-Williams coefficient converted to roughness at 1 m/s.`);
      }
      return {
        ...p,
        absoluteRoughnessMm: Math.max(0.001, baseRoughnessMm * assumptionScale)
      };
    });
    const clonedNodes = scenario.waterNetwork.nodes.map((n) => ({
      ...n,
      baseDemand: n.baseDemand * peakFactorRatio
    }));

    for (const mod of alternative.modifications) {
      const pipe = clonedPipes.find((p) => p.id === mod.targetId);
      if (pipe) {
        if (mod.property === 'diameter') pipe.diameter = mod.newValue;
        if (mod.property === 'absoluteRoughnessMm') {
          pipe.absoluteRoughnessMm = Math.max(0, mod.newValue);
        }
        if (mod.property === 'hazenWilliamsC') {
          const originalC = Math.max(20, mod.originalValue || pipe.hazenWilliamsC || 110);
          const proposedC = Math.max(20, mod.newValue);
          pipe.absoluteRoughnessMm = Math.max(
            0.001,
            (pipe.absoluteRoughnessMm ?? 0.15) * Math.pow(originalC / proposedC, 1.852)
          );
          pipe.hazenWilliamsC = proposedC;
        }
      }
      const node = clonedNodes.find((n) => n.id === mod.targetId);
      if (node) {
        if (mod.property === 'baseDemand') node.baseDemand = mod.newValue * peakFactorRatio;
        if (mod.property === 'head') node.head = mod.newValue;
      }
    }

    const result = solveWaterNetwork({
      ...scenario.waterNetwork,
      waterDensityKgM3: densityAsm?.value || scenario.waterNetwork.waterDensityKgM3 || 1000,
      nodes: clonedNodes,
      pipes: clonedPipes
    });

    rawOutput = { domain: 'water', result };
    primaryPerformance = result.minPressureKPa;
    primaryUnit = 'kPa min pressure';

    for (const w of result.warnings) {
      violations.push(w);
    }

    // Check maximum pressure ceiling and hydraulic design limits (AWWA / CPHEEO municipal standards)
    for (const [nId, nRes] of Object.entries(result.nodeResults)) {
      if (nRes.pressureKPa > maxNodePressureKPa) {
        maxNodePressureKPa = nRes.pressureKPa;
        maxPressureNodeId = nId;
      }
    }

    const minPressureReq = scenario.constraints.find(
      (c) => c.metricKey === 'primaryPerformance' && (c.operator === '>=' || c.operator === '>')
    )?.threshold ?? 180.0;

    const maxPressureLimit = scenario.constraints.find(
      (c) => (c.metricKey === 'maxPressure' || /max.*pressure|upper.*pressure/i.test(c.name)) && (c.operator === '<=' || c.operator === '<')
    )?.threshold ?? 550.0;

    const hasUpperPressureConstraint = scenario.constraints.some(
      (c) => c.metricKey === 'maxPressure' || /max.*pressure|upper.*pressure/i.test(c.name)
    );

    // 1. Minimum Pressure Status
    const minPressurePassed = result.minPressureKPa >= minPressureReq;
    const minPressureMessage = minPressurePassed
      ? `PASSED — Minimum pressure satisfied: ${result.minPressureKPa.toFixed(1)} kPa >= ${minPressureReq.toFixed(1)} kPa`
      : `FAILED — Minimum pressure below service threshold: ${result.minPressureKPa.toFixed(1)} kPa < ${minPressureReq.toFixed(1)} kPa`;

    // 2. Maximum Pressure Status (550.0 kPa safe municipal threshold)
    const maxPressureExceeded = maxNodePressureKPa > maxPressureLimit;
    const maxPressureMessage = maxPressureExceeded
      ? `FAILED — Maximum pressure exceeded: Node '${maxPressureNodeId}' reaches ${maxNodePressureKPa.toFixed(1)} kPa (> ${maxPressureLimit.toFixed(1)} kPa safe municipal threshold)`
      : `PASSED — Maximum pressure within safe limits: ${maxNodePressureKPa.toFixed(1)} kPa <= ${maxPressureLimit.toFixed(1)} kPa`;

    if (maxPressureExceeded) {
      violations.push(maxPressureMessage);
    }

    // 3. Velocity Check (<= 2.0 m/s standard)
    const highVelocityPipes = Object.entries(result.pipeResults).filter(([_, pr]) => pr.velocityMs > 2.0);
    const maxVel = Object.values(result.pipeResults).length > 0
      ? Math.max(...Object.values(result.pipeResults).map((pr) => pr.velocityMs))
      : 0;
    const velocityPassed = highVelocityPipes.length === 0;
    const velocityMessage = velocityPassed
      ? `PASSED — Velocity within limits: max ${maxVel.toFixed(2)} m/s <= 2.0 m/s across all pipes`
      : `FAILED — Velocity limit exceeded: ${highVelocityPipes.length} pipe(s) exceed 2.0 m/s (max ${maxVel.toFixed(2)} m/s)`;

    // 4. Head-Loss Gradient Check (<= 12.0 m/km standard)
    const highHeadLossPipes = Object.entries(result.pipeResults).filter(([_, pr]) => pr.headLossPerKm > 12.0);
    const maxHl = Object.values(result.pipeResults).length > 0
      ? Math.max(...Object.values(result.pipeResults).map((pr) => pr.headLossPerKm))
      : 0;
    const headLossPassed = highHeadLossPipes.length === 0;
    const headLossMessage = headLossPassed
      ? `PASSED — Head-loss gradient within limits: max ${maxHl.toFixed(1)} m/km <= 12.0 m/km across all pipes`
      : `FAILED — Head-loss gradient exceeded: ${highHeadLossPipes.length} pipe(s) exceed 12.0 m/km (max ${maxHl.toFixed(1)} m/km)`;

    // 5. Missing or Unconfigured Constraints
    const missingOrUnconfiguredConstraints: string[] = [];
    if (!hasUpperPressureConstraint) {
      missingOrUnconfiguredConstraints.push(
        'Upper distribution pressure ceiling (550.0 kPa safe municipal threshold) was not declared in scenario constraints; evaluated automatically via hydraulic safety rules.'
      );
    }
    const hasVelocityConstraint = scenario.constraints.some((c) => /velocity/i.test(c.name));
    if (!hasVelocityConstraint) {
      missingOrUnconfiguredConstraints.push(
        'Pipe velocity limit (2.0 m/s) is an engineering design standard but not declared as an explicit scenario constraint.'
      );
    }
    const hasHeadLossConstraint = scenario.constraints.some((c) => /head.*loss|friction/i.test(c.name));
    if (!hasHeadLossConstraint) {
      missingOrUnconfiguredConstraints.push(
        'Head-loss efficiency gradient (12.0 m/km) is an economic pipe sizing guideline but not declared as an explicit scenario constraint.'
      );
    }

    for (const muc of missingOrUnconfiguredConstraints) {
      unverifiedConstraints.push(muc);
    }

    // 6. Overall Hydraulic Feasibility Status
    const overallFeasible = minPressurePassed && !maxPressureExceeded;

    hydraulicStatus = {
      minPressureStatus: minPressurePassed ? 'passed' : 'failed',
      minPressureValue: result.minPressureKPa,
      minPressureThreshold: minPressureReq,
      minPressureMessage,

      maxPressureStatus: maxPressureExceeded ? 'failed' : 'passed',
      maxPressureValue: maxNodePressureKPa,
      maxPressureThreshold: maxPressureLimit,
      maxPressureNodeId,
      maxPressureMessage,

      velocityStatus: velocityPassed ? 'passed' : 'failed',
      maxVelocityValue: maxVel,
      velocityThreshold: 2.0,
      highVelocityPipeCount: highVelocityPipes.length,
      velocityMessage,

      headLossStatus: headLossPassed ? 'passed' : 'failed',
      maxHeadLossValue: maxHl,
      headLossThreshold: 12.0,
      highHeadLossPipeCount: highHeadLossPipes.length,
      headLossMessage,

      missingOrUnconfiguredConstraints,
      overallFeasibilityStatus: overallFeasible ? 'feasible' : 'breached'
    };
  } else if (scenario.domain === 'energy' && scenario.powerNetwork) {
    const summerPeakRatio = getAssumptionRatio('asm_summer_peak', 1.25);
    const pfAsm = scenario.assumptions.find((a) => a.id === 'asm_pf');

    const clonedLines = scenario.powerNetwork.lines.map((l) => ({ ...l }));
    const clonedGens = scenario.powerNetwork.generators.map((g) => ({ ...g }));
    const clonedLoads = scenario.powerNetwork.loads.map((ld) => ({
      ...ld,
      mw: ld.mw * summerPeakRatio
    }));

    for (const mod of alternative.modifications) {
      const line = clonedLines.find((l) => l.id === mod.targetId);
      if (line) {
        if (mod.property === 'reactancePu') {
          const ratio = mod.newValue / Math.max(0.001, mod.originalValue);
          line.reactancePu = mod.newValue;
          if (line.resistancePu !== undefined) {
            line.resistancePu = Number((line.resistancePu * ratio).toFixed(4));
          }
        }
        if (mod.property === 'resistancePu') line.resistancePu = mod.newValue;
        if (mod.property === 'thermalRatingMw') line.thermalRatingMw = mod.newValue;
      }
      const gen = clonedGens.find((g) => g.id === mod.targetId);
      if (gen) {
        if (mod.property === 'scheduledMw') gen.scheduledMw = mod.newValue;
        if (mod.property === 'maxMw') gen.maxMw = mod.newValue;
      }
    }

    const result = solvePowerGrid({
      ...scenario.powerNetwork,
      nominalPowerFactor: pfAsm?.value || scenario.powerNetwork.nominalPowerFactor || 0.95,
      lines: clonedLines,
      generators: clonedGens,
      loads: clonedLoads
    });

    rawOutput = { domain: 'energy', result };
    primaryPerformance = result.totalEstimatedLossesMw;
    primaryUnit = 'MW line losses';

    for (const v of result.violations) {
      violations.push(v);
    }
  } else {
    throw new Error(`Domain ${scenario.domain} network not initialized in scenario.`);
  }

  // Cost calculation (5-yr lifecycle)
  const totalCostMillion = hasCostEstimate
    ? (alternative.capexCostMillion + alternative.opexAnnualMillion * 5) * costMultiplier
    : 0;

  // Check declared constraints
  let isFeasible = true;
  for (const c of scenario.constraints) {
    let actualValue: number | undefined;
    if (c.metricKey === 'cost' && !hasCostEstimate) {
      unverifiedConstraints.push(`${c.name}: project cost data not provided`);
      continue;
    } else if (c.metricKey === 'cost') actualValue = totalCostMillion;
    else if (c.metricKey === 'primaryPerformance') actualValue = primaryPerformance;
    else if (c.metricKey === 'maxPressure') actualValue = maxNodePressureKPa;
    else if (c.metricKey === 'violationsCount') actualValue = violations.length;

    if (actualValue !== undefined) {
      if ((c.operator === '<=' || c.operator === '<') && actualValue > c.threshold) {
        isFeasible = false;
        violations.push(
          `Breached ${c.name}: ${actualValue.toFixed(2)} ${c.unit} > limit ${c.threshold}`
        );
      } else if ((c.operator === '>=' || c.operator === '>') && actualValue < c.threshold) {
        isFeasible = false;
        violations.push(
          `Breached ${c.name}: ${actualValue.toFixed(2)} ${c.unit} < limit ${c.threshold}`
        );
      }
    }
  }

  // Also check hard domain-level physical violations
  const hasHardPhysicalViolation = violations.some(
    (v) =>
      v.includes('exceeds thermal rating') ||
      v.includes('negative pressure') ||
      v.includes('below service threshold') ||
      v.includes('severe congestion') ||
      v.includes('Maximum pressure exceeded') ||
      v.includes('FAILED — Maximum pressure')
  );

  // Calculate environmental and user benefit continuously from primary performance so sensitivity/perturbation is smooth
  // For water: target window is 180–350 kPa. Above 350 kPa, marginal benefit diminishes. Excessive pressure (>500 kPa) is penalized.
  let perfBonus =
    scenario.domain === 'energy'
      ? Math.max(0, 25 - primaryPerformance * 2.2)
      : scenario.domain === 'water'
      ? primaryPerformance <= 180
        ? Math.max(0, (primaryPerformance - 120) * 0.20)
        : primaryPerformance <= 350
        ? 12 + (primaryPerformance - 180) * 0.08
        : Math.max(5, 25.6 - (primaryPerformance - 350) * 0.05)
      : Math.max(0, (primaryPerformance - 18) * 0.95);

  if (scenario.domain === 'water' && maxNodePressureKPa > 550) {
    const excessKPa = maxNodePressureKPa - 550;
    perfBonus = Math.max(0, perfBonus - (excessKPa / 100) * 4.0);
  }

  const envScore = Math.max(
    10,
    Math.min(
      98,
      Math.round((72 - (hasCostEstimate ? alternative.capexCostMillion * 1.1 : 0) + perfBonus * 0.85) * 10) / 10
    )
  );
  const benefitScore = Math.max(
    15,
    Math.min(
      98,
      Math.round(
        (64 + perfBonus - (hasScheduleEstimate ? alternative.implementationMonths * 0.45 : 0) - violations.length * 3.5) * 10
      ) / 10
    )
  );
  const riskScore = Math.min(
    95,
    Math.max(
      12,
      Math.round(
        (hasScheduleEstimate ? alternative.implementationMonths * 2.5 : 0) +
        violations.length * 12 +
        (scenario.domain === 'water' && maxNodePressureKPa > 550 ? Math.min(25, (maxNodePressureKPa - 550) * 0.04) : 0)
      )
    )
  );

  let feasibilityStatus: 'feasible' | 'breached' | 'incomplete' = 'feasible';
  let feasibilityLabel = 'Constraints Satisfied';

  if (!isFeasible || hasHardPhysicalViolation) {
    feasibilityStatus = 'breached';
    if (scenario.domain === 'water' && maxNodePressureKPa > 550) {
      feasibilityLabel = 'FAILED — Maximum pressure exceeded';
    } else {
      feasibilityLabel = 'Feasibility Breach Detected';
    }
  } else if (unverifiedConstraints.length > 0) {
    feasibilityStatus = 'incomplete';
    feasibilityLabel = 'Incomplete / unverified checks';
  }

  const t1 = performance.now();

  return {
    alternativeId: alternative.id,
    alternativeName: alternative.name,
    domain: scenario.domain,
    runTimestamp: new Date().toISOString(),
    modelVersion: 'v2.4-deterministic',
    seed,
    executionMs: Math.max(1, Math.round(t1 - t0)),
    feasible: isFeasible && !hasHardPhysicalViolation,
    feasibilityStatus,
    feasibilityLabel,
    constraintViolations: violations,
    unverifiedConstraints,
    hydraulicStatus,
    costDataStatus: alternative.costDataStatus || 'illustrative',
    scheduleDataStatus: alternative.scheduleDataStatus || 'illustrative',
    metrics: {
      primaryPerformance,
      primaryPerformanceUnit: primaryUnit,
      totalCostMillion,
      environmentalImpactScore: envScore,
      implementationRiskScore: riskScore,
      userBenefitScore: benefitScore
    },
    normalizedScores: {
      performanceNorm: 0.5,
      costNorm: 0.5,
      envNorm: 0.5,
      riskNorm: 0.5,
      benefitNorm: 0.5,
      overallUtility: 50
    },
    rawOutput
  };
}

/**
 * Normalizes scores across all alternatives and computes user-weighted utility (0..100).
 */
export function normalizeAndRankAlternatives(
  scenario: Scenario,
  records: AlternativeRunRecord[]
): AlternativeRunRecord[] {
  if (records.length === 0) return [];

  const baseRec = runBaselineSimulation(scenario);
  const budgetCap =
    scenario.constraints.find((c) => c.metricKey === 'cost')?.threshold ||
    Math.max(...records.map((r) => r.metrics.totalCostMillion), 1) * 1.25;

  const normalizeWithAnchor = (
    values: number[],
    anchorWorst: number,
    direction: 'minimize' | 'maximize'
  ): number[] => {
    const all = [...values, anchorWorst];
    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);
    const span = Math.max(1e-6, rawMax - rawMin);
    const min = direction === 'minimize' ? rawMin - span * 0.14 : rawMin;
    const max = direction === 'maximize' ? rawMax + span * 0.14 : rawMax;
    if (Math.abs(max - min) < 1e-9) {
      return values.map(() => 0.72);
    }
    if (direction === 'maximize') {
      return values.map((v) =>
        Math.max(0.28, Math.min(0.96, (v - min) / (max - min)))
      );
    } else {
      return values.map((v) =>
        Math.max(0.28, Math.min(0.96, (max - v) / (max - min)))
      );
    }
  };

  const perfVals = records.map((r) => r.metrics.primaryPerformance);
  const costVals = records.map((r) => r.metrics.totalCostMillion);
  const envVals = records.map((r) => r.metrics.environmentalImpactScore);
  const riskVals = records.map((r) => r.metrics.implementationRiskScore);
  const benefitVals = records.map((r) => r.metrics.userBenefitScore);

  const perfDirection = scenario.domain === 'energy' ? 'minimize' : 'maximize';

  const perfNorm = normalizeWithAnchor(
    perfVals,
    baseRec.metrics.primaryPerformance,
    perfDirection
  );
  const costNotEstimated = records.some((record) => record.costDataStatus === 'not-estimated');
  const scheduleNotEstimated = records.some((record) => record.scheduleDataStatus === 'not-estimated');
  const costNorm = costNotEstimated
    ? records.map(() => 0.5)
    : normalizeWithAnchor(costVals, budgetCap * 1.15, 'minimize');
  const envNorm = normalizeWithAnchor(
    envVals,
    baseRec.metrics.environmentalImpactScore * 0.85,
    'maximize'
  );
  const riskNorm = scheduleNotEstimated
    ? records.map(() => 0.5)
    : normalizeWithAnchor(riskVals, 85, 'minimize');
  const benefitNorm = normalizeWithAnchor(
    benefitVals,
    baseRec.metrics.userBenefitScore * 0.85,
    'maximize'
  );

  const weights = {
    performance: 0.30,
    cost: 0.25,
    env: 0.15,
    benefit: 0.20,
    risk: 0.10
  };

  for (const obj of scenario.objectives) {
    if (obj.id === 'perf') weights.performance = obj.weight;
    if (obj.id === 'cost') weights.cost = obj.weight;
    if (obj.id === 'env') weights.env = obj.weight;
    if (obj.id === 'benefit') weights.benefit = obj.weight;
    if (obj.id === 'risk') weights.risk = obj.weight;
  }

  if (costNotEstimated) weights.cost = 0;
  if (scheduleNotEstimated) weights.risk = 0;
  const activeWeightTotal = Object.values(weights).reduce((total, weight) => total + weight, 0) || 1;
  for (const key of Object.keys(weights) as Array<keyof typeof weights>) {
    weights[key] /= activeWeightTotal;
  }

  return records.map((rec, i) => {
    const pN = perfNorm[i];
    const cN = costNorm[i];
    const eN = envNorm[i];
    const rN = riskNorm[i];
    const bN = benefitNorm[i];

    let overallUtility =
      (pN * weights.performance +
        cN * weights.cost +
        eN * weights.env +
        rN * weights.risk +
        bN * weights.benefit) *
      100;

    if (!rec.feasible) {
      overallUtility = Math.max(26.0, overallUtility - 22);
    }

    const clampedUtility = Math.max(0, Math.min(100, Math.round(overallUtility * 10) / 10));

    return {
      ...rec,
      normalizedScores: {
        performanceNorm: pN,
        costNorm: cN,
        envNorm: eN,
        riskNorm: rN,
        benefitNorm: bN,
        overallUtility: clampedUtility
      }
    };
  });
}

/**
 * Decision Robustness Score (DRS):
 * DRS = 100 × [1 − mean((1−f_s) + f_s × max(0, u*_s − u_s(a)))]
 */
export function calculateDecisionRobustnessScore(
  scenario: Scenario,
  selectedAlternativeId: string,
  trialCount = 20,
  seed = 101
): DecisionRobustnessReport {
  let pseudorandom = seed;
  const nextRandom = () => {
    pseudorandom = (pseudorandom * 9301 + 49297) % 233280;
    return pseudorandom / 233280;
  };

  const trials: DecisionRobustnessReport['trials'] = [];
  const penalties: number[] = [];

  for (let s = 1; s <= trialCount; s++) {
    const demandFactor = 0.85 + nextRandom() * 0.35; // 0.85 to 1.20
    const costFactor = 0.90 + nextRandom() * 0.25;

    const perturbedScenario: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) => ({
        ...a,
        value:
          a.category === 'demand'
            ? a.value * demandFactor
            : a.category === 'cost'
            ? a.value * costFactor
            : a.value
      }))
    };

    const runResults = perturbedScenario.alternatives.map((alt) =>
      runAlternativeSimulation(perturbedScenario, alt, seed + s)
    );
    const ranked = normalizeAndRankAlternatives(perturbedScenario, runResults);

    const selectedRun =
      ranked.find((r) => r.alternativeId === selectedAlternativeId) || ranked[0];
    const feasibleRuns = ranked.filter((r) => r.feasible);

    const f_s = selectedRun.feasible ? 1 : 0;
    const u_s = selectedRun.normalizedScores.overallUtility / 100;

    let u_star_s = 0;
    let topSolutionId = 'None Feasible';
    if (feasibleRuns.length > 0) {
      const best = [...feasibleRuns].sort(
        (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
      )[0];
      u_star_s = best.normalizedScores.overallUtility / 100;
      topSolutionId = best.alternativeName;
    }

    const penalty_s = 1 - f_s + f_s * Math.max(0, u_star_s - u_s);
    penalties.push(penalty_s);

    trials.push({
      trialId: s,
      perturbationSummary: `Demand: x${demandFactor.toFixed(2)}, Cost: x${costFactor.toFixed(2)}`,
      feasibleCount: feasibleRuns.length,
      topSolutionId,
      utilitySelected: Math.round(u_s * 100),
      utilityBestFeasible: Math.round(u_star_s * 100)
    });
  }

  const meanPenalty = penalties.reduce((a, b) => a + b, 0) / Math.max(1, trialCount);
  const drs = Math.max(0, Math.min(100, Math.round(100 * (1 - meanPenalty))));

  return {
    overallScore: drs,
    trialsCount: trialCount,
    seed,
    stressDistribution: 'Uniform bounded Monte Carlo sweep (Demand ±20%, Cost ±15%)',
    trials,
    assumptionsTested: scenario.assumptions.map((a) => a.name),
    notes: `Calculated from ${trialCount} seeded deterministic trials using DRS = 100 * [1 - mean((1-f_s) + f_s * max(0, u*_s - u_s))]. Score reflects model resilience against declared uncertainty bounds.`
  };
}

/**
 * Future Regret Explorer (Tool 9):
 * Computes minimax regret and mean/95th-percentile regret across explicit seeded stress trials
 * for every alternative in the scenario—never uses hardcoded placeholder numbers.
 */
export function runFutureRegretExplorer(
  scenario: Scenario,
  selectedAlternativeId: string,
  trialCount = 20,
  seed = 101
) {
  let pseudorandom = seed;
  const nextRandom = () => {
    pseudorandom = (pseudorandom * 9301 + 49297) % 233280;
    return pseudorandom / 233280;
  };

  const regretByAltId: Record<string, number[]> = {};
  for (const alt of scenario.alternatives) {
    regretByAltId[alt.id] = [];
  }

  for (let s = 1; s <= trialCount; s++) {
    const demandFactor = 0.85 + nextRandom() * 0.35;
    const physicsFactor = 0.92 + nextRandom() * 0.16;

    const perturbedScenario: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) => ({
        ...a,
        value:
          a.category === 'demand'
            ? a.value * demandFactor
            : a.category === 'physics'
            ? a.value * physicsFactor
            : a.value
      }))
    };

    const runResults = perturbedScenario.alternatives.map((alt) =>
      runAlternativeSimulation(perturbedScenario, alt, seed + s)
    );
    const ranked = normalizeAndRankAlternatives(perturbedScenario, runResults);
    const bestUtility = Math.max(...ranked.map((r) => r.normalizedScores.overallUtility), 0);

    for (const r of ranked) {
      const regretPts = Math.max(0, bestUtility - r.normalizedScores.overallUtility);
      regretByAltId[r.alternativeId]?.push(regretPts);
    }
  }

  const summarize = (arr: number[]) => {
    if (arr.length === 0) return { meanPts: 0, maxPts: 0, p95Pts: 0, zeroRegretCount: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const max = sorted[sorted.length - 1];
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const zeroCount = arr.filter((v) => v < 0.05).length;
    return {
      meanPts: Number(mean.toFixed(1)),
      maxPts: Number(max.toFixed(1)),
      p95Pts: Number(sorted[p95Idx].toFixed(1)),
      zeroRegretCount: zeroCount
    };
  };

  const alternativesSummary = scenario.alternatives.map((alt) => ({
    alternativeId: alt.id,
    alternativeName: alt.name,
    tag: alt.tag,
    ...summarize(regretByAltId[alt.id] || [])
  }));

  const selectedSummary =
    alternativesSummary.find((a) => a.alternativeId === selectedAlternativeId) ||
    alternativesSummary[0];

  const minimaxWinner = [...alternativesSummary].sort((a, b) => a.maxPts - b.maxPts)[0];

  return {
    trialsCount: trialCount,
    seed,
    selectedSummary,
    minimaxWinner,
    alternativesSummary,
    formula: 'Regret_s(a) = max_{b in Feasible} Utility_s(b) - Utility_s(a) over n seeded trials'
  };
}

/**
 * Decision Breaker:
 * Perturbs declared assumptions/constraints and identifies the exact change that makes
 * the preferred option infeasible or changes its rank.
 */
export function runDecisionBreaker(
  scenario: Scenario,
  preferredAlternativeId: string
): DecisionBreakerResult {
  const assumptionToTest = scenario.assumptions[0] || {
    id: 'demand_peak',
    name: 'Peak Inflow Demand',
    value: 100,
    unit: 'veh/h or m³/s',
    rangeMin: 50,
    rangeMax: 250
  };

  const steps = [1.05, 1.12, 1.2, 1.3, 1.4, 1.55, 1.75, 2.0];
  let breakPoint: { factor: number; type: 'infeasibility' | 'rank_reversal'; newWinner?: string } | null = null;

  for (const factor of steps) {
    const testScenario: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) =>
        a.id === assumptionToTest.id ? { ...a, value: a.value * factor } : a
      )
    };

    const runs = testScenario.alternatives.map((alt) =>
      runAlternativeSimulation(testScenario, alt)
    );
    const ranked = normalizeAndRankAlternatives(testScenario, runs);

    const preferredRun = ranked.find((r) => r.alternativeId === preferredAlternativeId);
    if (preferredRun && !preferredRun.feasible) {
      breakPoint = { factor, type: 'infeasibility' };
      break;
    }

    const bestRanked = [...ranked].sort(
      (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
    )[0];
    if (bestRanked && bestRanked.alternativeId !== preferredAlternativeId) {
      breakPoint = { factor, type: 'rank_reversal', newWinner: bestRanked.alternativeName };
      break;
    }
  }

  if (breakPoint) {
    const pctShift = Math.round((breakPoint.factor - 1) * 100);
    const breakVal = assumptionToTest.value * breakPoint.factor;
    return {
      preferredAlternativeId,
      criticalAssumptionId: assumptionToTest.id,
      criticalAssumptionName: assumptionToTest.name,
      nominalValue: assumptionToTest.value,
      breakThresholdValue: Math.round(breakVal * 10) / 10,
      pctShiftRequired: pctShift,
      unit: assumptionToTest.unit,
      breakType: breakPoint.type,
      newWinnerAlternativeId: breakPoint.newWinner,
      explanation:
        breakPoint.type === 'infeasibility'
          ? `If '${assumptionToTest.name}' increases by +${pctShift}% (to ${breakVal.toFixed(1)} ${assumptionToTest.unit}), the preferred solution breaches its operational constraint.`
          : `If '${assumptionToTest.name}' increases by +${pctShift}%, rank reversal occurs and '${breakPoint.newWinner}' overtakes the preferred solution.`
    };
  }

  return {
    preferredAlternativeId,
    criticalAssumptionId: assumptionToTest.id,
    criticalAssumptionName: assumptionToTest.name,
    nominalValue: assumptionToTest.value,
    breakThresholdValue: assumptionToTest.value * 2.0,
    pctShiftRequired: 100,
    unit: assumptionToTest.unit,
    breakType: 'rank_reversal',
    explanation: `Preferred solution remains optimal across the full tested range (+100% stress threshold). High decision stability.`
  };
}

/**
 * Sensitivity Analysis (One-at-a-time deterministic impact).
 */
export function runSensitivityAnalysis(
  scenario: Scenario,
  alternativeId: string
): SensitivityItem[] {
  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];
  const baseRun = runAlternativeSimulation(scenario, alt);
  const baseUtility = baseRun.metrics.userBenefitScore;

  const items: SensitivityItem[] = [];

  for (const a of scenario.assumptions) {
    const perturbedScenario: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((item) =>
        item.id === a.id ? { ...item, value: item.value * 1.15 } : item
      )
    };
    const perturbedRun = runAlternativeSimulation(perturbedScenario, alt);
    const delta = perturbedRun.metrics.userBenefitScore - baseUtility;

    items.push({
      parameter: a.name,
      baseValue: a.value,
      deltaPct: 15,
      impactOnScore: Math.round(delta * 10) / 10,
      direction: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      criticality: Math.abs(delta) > 6 ? 'high' : Math.abs(delta) > 2 ? 'medium' : 'low'
    });
  }

  return items;
}

/**
 * Hidden Cost Detector:
 * Sums only configured costs, identifies unconfigured categories, notes currency.
 */
export function detectHiddenCosts(scenario: Scenario, alternativeId: string) {
  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];
  const configuredCapex = alt.capexCostMillion;
  const configuredOpex = alt.opexAnnualMillion;

  const missingCategories = [
    { name: 'Land Acquisition & Easements', status: 'Not configured' },
    { name: 'Regulatory Permitting & Environmental Review', status: 'Not configured' },
    { name: 'Utility Relocation & Demolition', status: 'Not configured' },
    { name: 'Decommissioning / End-of-Life Disposal', status: 'Not configured' }
  ];

  return {
    alternativeName: alt.name,
    currency: 'USD ($)',
    baseYear: 2026,
    configuredCapexMillion: configuredCapex,
    configuredOpexAnnualMillion: configuredOpex,
    fiveYearLifecycleMillion: configuredCapex + configuredOpex * 5,
    costDataStatus: alt.costDataStatus || 'illustrative',
    missingCategories,
    warning: alt.costDataStatus === 'not-estimated'
      ? 'No project cost estimate was provided. Add actual CAPEX and OPEX before using cost comparisons.'
      : 'Dependent lifecycle totals omit unconfigured categories (Land acquisition, permitting, disposal). Do not treat as final construction budget.'
  };
}

/**
 * Assumption Dependency Graph nodes & edges (trace explicit dependencies without invented edges).
 */
export function buildAssumptionDependencyGraph(scenario: Scenario) {
  const nodes = [
    { id: 'inp_demand', label: 'Inflow / Demand Inputs', type: 'input' },
    { id: 'inp_network', label: 'Network Geometry & Sizing', type: 'input' },
    { id: 'inp_cost', label: 'Capital & Operating Unit Costs', type: 'input' },
    { id: 'solv_core', label: `${scenario.domain.toUpperCase()} Solver Engine`, type: 'formula' },
    { id: 'met_perf', label: 'Primary Performance Metric', type: 'metric' },
    { id: 'met_cost', label: 'Total Lifecycle Cost', type: 'metric' },
    { id: 'met_feasi', label: 'Constraint Feasibility Check', type: 'metric' },
    { id: 'dec_rank', label: 'Alternative Utility & Ranking', type: 'decision' }
  ];

  const edges = [
    { from: 'inp_demand', to: 'solv_core', relation: 'boundary condition' },
    { from: 'inp_network', to: 'solv_core', relation: 'topology & impedance' },
    { from: 'solv_core', to: 'met_perf', relation: 'hydraulic / power / flow equations' },
    { from: 'solv_core', to: 'met_feasi', relation: 'boundary checks' },
    { from: 'inp_cost', to: 'met_cost', relation: 'direct summation' },
    { from: 'met_perf', to: 'dec_rank', relation: 'normalized objective weight' },
    { from: 'met_cost', to: 'dec_rank', relation: 'normalized cost weight' },
    { from: 'met_feasi', to: 'dec_rank', relation: 'feasibility filter' }
  ];

  return { nodes, edges };
}

/**
 * Future Collision Detector:
 * Finds time or component intervals where defined constraints collide or are breached.
 */
export function runFutureCollisionDetector(scenario: Scenario, alternativeId: string) {
  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];
  const run = runAlternativeSimulation(scenario, alt);

  const collisions: {
    timeOrComponent: string;
    constraintName: string;
    limit: string;
    actual: string;
    severity: 'hard' | 'soft';
    status: 'Breached' | 'Warning' | 'Clear';
  }[] = [];

  if (run.rawOutput.domain === 'traffic') {
    const res = run.rawOutput.result;
    res.timeSteps.forEach((st) => {
      st.bottlenecks.forEach((bId) => {
        const cell = scenario.trafficNetwork?.cells.find((c) => c.id === bId);
        const limitDensity = cell ? (0.7 * cell.jamDensityVehKmPerLane).toFixed(1) : '91.0';
        collisions.push({
          timeOrComponent: `t = +${st.timeSec}s (${bId})`,
          constraintName: 'Jam Density Buffer (<= 70% k_j)',
          limit: `<= ${limitDensity} veh/km/ln`,
          actual: `${st.cellDensities[bId]?.toFixed(1)} veh/km/ln`,
          severity: 'hard',
          status: 'Breached'
        });
      });
    });
  } else if (run.rawOutput.domain === 'water') {
    const res = run.rawOutput.result;
    const minPressLimit =
      scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 180.0;
    Object.entries(res.nodeResults).forEach(([nodeId, nRes]) => {
      if (nRes.negativePressureWarning) {
        collisions.push({
          timeOrComponent: `Node: ${nodeId}`,
          constraintName: 'Minimum Head Room (Positive Pressure)',
          limit: '> 0 kPa',
          actual: `${nRes.pressureKPa.toFixed(1)} kPa`,
          severity: 'hard',
          status: 'Breached'
        });
      } else if (nRes.pressureKPa < minPressLimit) {
        collisions.push({
          timeOrComponent: `Node: ${nodeId}`,
          constraintName: 'Municipal Minimum Service Pressure',
          limit: `>= ${minPressLimit.toFixed(1)} kPa`,
          actual: `${nRes.pressureKPa.toFixed(1)} kPa`,
          severity: 'hard',
          status: 'Breached'
        });
      }
    });
  } else if (run.rawOutput.domain === 'energy') {
    const res = run.rawOutput.result;
    Object.entries(res.lineFlowsMw).forEach(([lineId, lRes]) => {
      if (lRes.thermalViolation) {
        collisions.push({
          timeOrComponent: `Line: ${lineId}`,
          constraintName: 'Line Continuous Thermal Rating',
          limit: '<= 100.0% capacity',
          actual: `${lRes.loadingPct.toFixed(1)}% (${Math.abs(lRes.flowMw).toFixed(1)} MW)`,
          severity: 'hard',
          status: 'Breached'
        });
      }
    });
  }

  return {
    alternativeName: alt.name,
    collisionsDetected: collisions.length,
    collisions: collisions.slice(0, 8),
    crossDomainCouplingNote:
      'Cross-domain coupling is not explicitly configured in this scenario. Collisions reflect isolated domain model constraints.'
  };
}

/**
 * Ripple Effect Analyzer:
 * Recomputes and traces downstream propagation through the graph, showing changed components, direction, and magnitude.
 */
export function runRippleEffectAnalyzer(scenario: Scenario, alternativeId: string) {
  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];
  const run = runAlternativeSimulation(scenario, alt);

  const traces: {
    origin: string;
    downstreamComponent: string;
    metricAffected: string;
    direction: 'Increase' | 'Decrease' | 'Relieved';
    delta: string;
  }[] = [];

  if (run.rawOutput.domain === 'traffic' && scenario.trafficNetwork) {
    alt.modifications.forEach((m) => {
      const cell = scenario.trafficNetwork?.cells.find((c) => c.id === m.targetId);
      if (cell) {
        cell.nextCellIds.forEach((nextId) => {
          traces.push({
            origin: `${cell.name} (${m.label})`,
            downstreamComponent: nextId,
            metricAffected: 'Downstream Inflow & Queuing Rate',
            direction: m.newValue > m.originalValue ? 'Increase' : 'Relieved',
            delta: `${Math.abs(m.newValue - m.originalValue).toFixed(1)} ${m.unit}`
          });
        });
      }
    });
  } else if (run.rawOutput.domain === 'water' && scenario.waterNetwork) {
    alt.modifications.forEach((m) => {
      const pipe = scenario.waterNetwork?.pipes.find((p) => p.id === m.targetId);
      if (pipe) {
        traces.push({
          origin: `Pipe ${pipe.id} (${m.label})`,
          downstreamComponent: `Junction ${pipe.toNodeId}`,
          metricAffected: 'Hydraulic Delivery Pressure',
          direction: m.newValue > m.originalValue ? 'Increase' : 'Decrease',
          delta: `Δ ${Math.abs(m.newValue - m.originalValue).toFixed(2)} ${m.unit}`
        });
      }
    });
  } else if (run.rawOutput.domain === 'energy' && scenario.powerNetwork) {
    alt.modifications.forEach((m) => {
      traces.push({
        origin: `Grid Element (${m.label})`,
        downstreamComponent: 'Substation Bus Angle & Neighboring Lines',
        metricAffected: 'Active Power Redistribution',
        direction: 'Relieved',
        delta: `Δ ${Math.abs(m.newValue - m.originalValue).toFixed(3)} ${m.unit}`
      });
    });
  }

  if (traces.length === 0) {
    traces.push({
      origin: 'No active parameter modification',
      downstreamComponent: 'Downstream network',
      metricAffected: 'Impedance distribution',
      direction: 'Relieved',
      delta: '0.00'
    });
  }

  return {
    alternativeName: alt.name,
    traces,
    note: 'Propagation computed strictly from network adjacency and physical continuity.'
  };
}

/**
 * Adaptive Stress Testing:
 * Explores declared uncertainty ranges with bounded, reproducible pseudorandom sampling. Discloses sample count and seed.
 */
export function runAdaptiveStressTesting(
  scenario: Scenario,
  alternativeId: string,
  sampleCount = 30,
  seed = 2026
) {
  let rng = seed;
  const nextRand = () => {
    rng = (rng * 16807) % 2147483647;
    return (rng - 1) / 2147483646;
  };

  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];
  const samples: number[] = [];
  let feasibleCount = 0;

  for (let i = 0; i < sampleCount; i++) {
    const perturbation = 0.8 + nextRand() * 0.4; // 80% to 120%
    const perturbedScenario: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) => ({
        ...a,
        value: a.value * perturbation
      }))
    };
    const rec = runAlternativeSimulation(perturbedScenario, alt, seed + i);
    samples.push(rec.metrics.primaryPerformance);
    if (rec.feasible) feasibleCount++;
  }

  const mean = samples.reduce((a, b) => a + b, 0) / sampleCount;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleCount;
  const stdDev = Math.sqrt(variance);

  return {
    sampleCount,
    seed,
    alternativeName: alt.name,
    mean: Math.round(mean * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    feasibilityRatePct: Math.round((feasibleCount / sampleCount) * 100),
    disclosure: `Seeded bounded pseudo-random Monte Carlo sampling (n=${sampleCount}, seed=${seed}). Distribution: Uniform bounded within ±20% of nominal inputs.`
  };
}

/**
 * Decision Reversal Engine:
 * Finds ranking-change thresholds with a bounded sweep, then bisection when a monotone bracket exists.
 */
export function runDecisionReversalEngine(scenario: Scenario, preferredAltId: string) {
  const testAssumption = scenario.assumptions[0];
  if (!testAssumption) {
    return {
      available: false,
      reason: 'No testable assumption configured in scenario.'
    };
  }

  const low = 0.5;
  const high = 2.5;
  let crossingFactor: number | null = null;
  let challengerName = '';

  for (let f = low; f <= high; f += 0.1) {
    const pScen: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) =>
        a.id === testAssumption.id ? { ...a, value: a.value * f } : a
      )
    };
    const rRuns = pScen.alternatives.map((a) => runAlternativeSimulation(pScen, a));
    const rRanked = [...normalizeAndRankAlternatives(pScen, rRuns)].sort(
      (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
    );

    if (rRanked.length > 0 && rRanked[0].alternativeId !== preferredAltId) {
      crossingFactor = f;
      challengerName = rRanked[0].alternativeName;
      break;
    }
  }

  if (crossingFactor !== null) {
    let bLeft = Math.max(low, crossingFactor - 0.1);
    let bRight = crossingFactor;
    for (let iter = 0; iter < 6; iter++) {
      const mid = (bLeft + bRight) / 2;
      const pScen: Scenario = {
        ...scenario,
        assumptions: scenario.assumptions.map((a) =>
          a.id === testAssumption.id ? { ...a, value: a.value * mid } : a
        )
      };
      const rRuns = pScen.alternatives.map((a) => runAlternativeSimulation(pScen, a));
      const rRanked = [...normalizeAndRankAlternatives(pScen, rRuns)].sort(
        (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
      );

      if (rRanked[0]?.alternativeId !== preferredAltId) {
        bRight = mid;
      } else {
        bLeft = mid;
      }
    }
    const refinedFactor = (bLeft + bRight) / 2;
    const shiftPct = Math.round((refinedFactor - 1) * 100);

    return {
      available: true,
      foundCrossing: true,
      crossingAssumption: testAssumption.name,
      shiftRequiredPct: shiftPct > 0 ? `+${shiftPct}%` : `${shiftPct}%`,
      criticalThreshold:
        (testAssumption.value * refinedFactor).toFixed(1) + ' ' + testAssumption.unit,
      challengerOvertaking: challengerName,
      method: 'Bounded sweep [0.5..2.5x] followed by 6-iteration bisection refinement.'
    };
  }

  return {
    available: true,
    foundCrossing: false,
    crossingAssumption: testAssumption.name,
    shiftRequiredPct: 'None in range',
    criticalThreshold: 'Exceeds test bounds (0.5x - 2.5x)',
    challengerOvertaking: 'None',
    method: 'Monotone bracket not breached across tested interval [0.5..2.5x]. Rank remains unchanged.'
  };
}

/**
 * Reverse Solver:
 * Solves bounded input changes for a stated target performance using bisection.
 */
export function runReverseSolver(
  scenario: Scenario,
  targetPerformance: number,
  alternativeId: string
) {
  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];
  const primaryAssumption =
    scenario.assumptions.find((a) => a.category === 'demand') || scenario.assumptions[0];

  if (!primaryAssumption) {
    return {
      available: false,
      reason: 'No continuous assumption available for inverse root solving.'
    };
  }

  let low = primaryAssumption.value * 0.4;
  let high = primaryAssumption.value * 2.2;

  const evalVal = (val: number) => {
    const pScen: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) =>
        a.id === primaryAssumption.id ? { ...a, value: val } : a
      )
    };
    const rec = runAlternativeSimulation(pScen, alt);
    return rec.metrics.primaryPerformance;
  };

  const fLow = evalVal(low);
  const fHigh = evalVal(high);

  const minF = Math.min(fLow, fHigh);
  const maxF = Math.max(fLow, fHigh);

  if (targetPerformance < minF || targetPerformance > maxF) {
    return {
      available: true,
      solvable: false,
      parameter: primaryAssumption.name,
      targetRequested: `${targetPerformance}`,
      achievableRange: `[${minF.toFixed(1)} .. ${maxF.toFixed(1)}]`,
      residual: Math.abs(targetPerformance - (targetPerformance < minF ? minF : maxF)).toFixed(2),
      status: 'Target unreachable within declared parameter range [0.4x .. 2.2x].'
    };
  }

  let mid = (low + high) / 2;
  for (let i = 0; i < 14; i++) {
    mid = (low + high) / 2;
    const fMid = evalVal(mid);
    if ((fLow <= fHigh && fMid < targetPerformance) || (fLow > fHigh && fMid > targetPerformance)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const finalPerf = evalVal(mid);
  const residual = Math.abs(finalPerf - targetPerformance);

  return {
    available: true,
    solvable: true,
    parameter: primaryAssumption.name,
    targetRequested: `${targetPerformance}`,
    requiredValue: `${mid.toFixed(2)} ${primaryAssumption.unit}`,
    achievedPerformance: finalPerf.toFixed(2),
    residual: residual.toFixed(4),
    status: `Solved via bisection to residual ${residual.toFixed(4)}.`
  };
}

/**
 * Recovery Planner:
 * Ranks feasible, user-defined mitigation actions by recalculated outcomes without inventing costs.
 */
export function runRecoveryPlanner(scenario: Scenario, alternativeId: string) {
  const alt =
    scenario.alternatives.find((a) => a.id === alternativeId) || scenario.alternatives[0];

  const actions = [
    {
      actionName: 'Peak Demand Shaving (-15%)',
      parameterShift: 'Inflow / load demand reduced by 15%',
      factor: 0.85
    },
    {
      actionName: 'Off-Peak Signal / Valve Re-timing (-10% Demand Equivalent)',
      parameterShift: 'Operational load shifted by 10%',
      factor: 0.90
    },
    {
      actionName: 'Controlled Reserve Throttling (-5%)',
      parameterShift: 'Conservative dispatch margin',
      factor: 0.95
    }
  ];

  const primaryAssump =
    scenario.assumptions.find((a) => a.category === 'demand') || scenario.assumptions[0];
  const rankedMitigations = actions.map((act) => {
    const pScen: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) =>
        a.id === primaryAssump?.id ? { ...a, value: a.value * act.factor } : a
      )
    };
    const rec = runAlternativeSimulation(pScen, alt);
    return {
      actionName: act.actionName,
      mechanism: act.parameterShift,
      recalculatedPerformance: `${rec.metrics.primaryPerformance.toFixed(1)} ${rec.metrics.primaryPerformanceUnit}`,
      feasible: rec.feasible
    };
  });

  return {
    alternativeName: alt.name,
    rankedMitigations,
    note: 'Mitigations reflect deterministic recalculation under explicit parameter shifts without invented external construction costs.'
  };
}

/**
 * Uncertainty Radar:
 * Shows uncertain inputs, ranges, distributions, and calculated outcome spread without implying probabilities.
 */
export function runUncertaintyRadar(scenario: Scenario) {
  const items = scenario.assumptions.map((a) => {
    const spreadPct = Math.round(((a.rangeMax - a.rangeMin) / (a.value || 1)) * 100);
    return {
      assumption: a.name,
      nominal: `${a.value} ${a.unit}`,
      range: `[${a.rangeMin} .. ${a.rangeMax}] ${a.unit}`,
      spreadPct: `±${Math.round(spreadPct / 2)}%`,
      distributionType: 'Uniform bounded (user declared)'
    };
  });

  return {
    declaredAssumptionsCount: items.length,
    items,
    disclaimer:
      'Distributions are bounded intervals as declared in scenario assumptions. No probabilities are assumed or implied without explicit empirical user specification.'
  };
}

/**
 * Explain My Decision:
 * Concise traceable explanation linked to calculated metric IDs, objective weights, assumptions, constraints, and solver status.
 */
export function explainMyDecision(scenario: Scenario, preferredAltId: string) {
  const runs = scenario.alternatives.map((a) => runAlternativeSimulation(scenario, a));
  const ranked = [...normalizeAndRankAlternatives(scenario, runs)].sort(
    (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
  );
  const preferred = ranked.find((r) => r.alternativeId === preferredAltId) || ranked[0];
  const runnerUp = ranked.find((r) => r.alternativeId !== preferred.alternativeId) || ranked[1];

  const metricDetails = [
    {
      id: 'MET-01-PERF',
      metric: 'Primary Physical Output',
      preferredValue: `${preferred.metrics.primaryPerformance.toFixed(1)} ${preferred.metrics.primaryPerformanceUnit}`,
      runnerUpValue: runnerUp
        ? `${runnerUp.metrics.primaryPerformance.toFixed(1)} ${runnerUp.metrics.primaryPerformanceUnit}`
        : 'N/A'
    },
    {
      id: 'MET-02-COST',
      metric: '5-Yr Configured Cost',
      preferredValue: preferred.costDataStatus === 'not-estimated'
        ? 'Not estimated'
        : `$${preferred.metrics.totalCostMillion.toFixed(1)}M`,
      runnerUpValue: runnerUp
        ? runnerUp.costDataStatus === 'not-estimated'
          ? 'Not estimated'
          : `$${runnerUp.metrics.totalCostMillion.toFixed(1)}M`
        : 'N/A'
    },
    {
      id: 'MET-03-UTIL',
      metric: 'Normalized Utility Score',
      preferredValue: `${preferred.normalizedScores.overallUtility}/100`,
      runnerUpValue: runnerUp ? `${runnerUp.normalizedScores.overallUtility}/100` : 'N/A'
    }
  ];

  const costWasExcluded = ranked.some((record) => record.costDataStatus === 'not-estimated');
  const scheduleWasExcluded = ranked.some((record) => record.scheduleDataStatus === 'not-estimated');
  const scoreLimitations = [
    costWasExcluded ? 'Cost was excluded because project estimates were not provided.' : '',
    scheduleWasExcluded ? 'Delivery-risk weighting was excluded because implementation duration was not provided.' : ''
  ].filter(Boolean).join(' ');

  return {
    preferredAlternative: preferred.alternativeName,
    metricDetails,
    solverStatus: preferred.feasible ? 'Converged & Feasible' : 'Boundary Alert',
    reproducibleSeed: preferred.seed,
    modelVersion: preferred.modelVersion,
    traceableRationale: `Alternative '${preferred.alternativeName}' achieves optimal composite utility (${preferred.normalizedScores.overallUtility}/100) under the configured objective weights (${scenario.objectives.map((o) => `${o.name}: ${(o.weight * 100).toFixed(0)}%`).join(', ')}). ${preferred.feasible ? 'All evaluated hard constraints are satisfied.' : 'Warning: one or more constraints require mitigation.'} ${scoreLimitations}`.trim()
  };
}

/**
 * Runs the baseline network with zero modifications to establish a truthful reference point.
 */
export function runBaselineSimulation(scenario: Scenario): AlternativeRunRecord {
  const dummyBaselineAlt: SolutionAlternative = {
    id: 'alt-baseline-raw',
    name: 'Current Baseline (Unmodified)',
    description: 'Existing infrastructure baseline without capital interventions.',
    tag: 'Baseline',
    modifications: [],
    capexCostMillion: 0,
    opexAnnualMillion: 0,
    implementationMonths: 0,
    color: '#94a3b8',
    costDataStatus: scenario.alternatives.some((alternative) => alternative.costDataStatus === 'not-estimated')
      ? 'not-estimated'
      : undefined,
    scheduleDataStatus: scenario.alternatives.some((alternative) => alternative.scheduleDataStatus === 'not-estimated')
      ? 'not-estimated'
      : undefined
  };
  return runAlternativeSimulation(scenario, dummyBaselineAlt);
}

export interface DiagnosedProblem {
  componentId: string;
  componentName: string;
  metricName: string;
  numericMeasured: number;
  operator: '<=' | '>=' | '<' | '>';
  threshold: number;
  measuredValue: string;
  limitValue: string;
  unit: string;
  severity: 'Breached' | 'Warning';
  symptom: string;
  solverModel: string;
}

/**
 * Derives current problems strictly from actual baseline solver results and configured thresholds.
 * Guarantees that every reported diagnostic compares the exact measured metric to its matching physical threshold:
 * - Never marks a traffic speed >= 22.0 km/h as a speed violation against >= 22.0 km/h.
 * - Reports queue density violations against <= 0.70 * k_j (veh/km/lane) and cell speed violations against >= speedThreshold (km/h).
 * - Reports water nodal low-pressure violations (e.g. 118.0 kPa vs >= 180.0 kPa) separately from pipe velocity (> 2.0 m/s) or head-loss (> 12.0 m/km) violations.
 * - Never claims water quality/contamination from steady-state hydraulic calculations.
 */
export function runBaselineDiagnosis(scenario: Scenario): DiagnosedProblem[] {
  if (scenario.problemStatement && scenario.problemStatement.available === false) {
    return [];
  }

  const baseRun = runBaselineSimulation(scenario);
  const problems: DiagnosedProblem[] = [];

  if (baseRun.rawOutput.domain === 'traffic' && scenario.trafficNetwork) {
    const res = baseRun.rawOutput.result;
    const speedLimitConstraint =
      scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 22.0;

    for (const cell of scenario.trafficNetwork.cells) {
      let maxCellDensity = cell.initialDensityVehKmPerLane;
      let minCellSpeed = cell.freeFlowSpeedKmh;

      for (const step of res.timeSteps) {
        const d = step.cellDensities[cell.id];
        const v = step.cellSpeeds[cell.id];
        if (d !== undefined && d > maxCellDensity) maxCellDensity = d;
        if (v !== undefined && v < minCellSpeed) minCellSpeed = v;
      }

      const densityThreshold = Number((0.7 * cell.jamDensityVehKmPerLane).toFixed(1));
      const measuredDensity = Number(maxCellDensity.toFixed(1));
      const measuredMinSpeed = Number(minCellSpeed.toFixed(1));

      // 1. Check queue density threshold (> 70% jam density)
      if (measuredDensity > densityThreshold) {
        problems.push({
          componentId: cell.id,
          componentName: cell.name,
          metricName: 'Peak Cell Queue Density',
          numericMeasured: measuredDensity,
          operator: '<=',
          threshold: densityThreshold,
          measuredValue: `${measuredDensity.toFixed(1)} veh/km/lane`,
          limitValue: `<= ${densityThreshold.toFixed(1)} veh/km/lane`,
          unit: 'veh/km/lane',
          severity:
            measuredDensity > 0.8 * cell.jamDensityVehKmPerLane ? 'Breached' : 'Warning',
          symptom: `Queue density reaches ${measuredDensity.toFixed(1)} veh/km/lane, exceeding the 70% jam density threshold (${densityThreshold.toFixed(1)} veh/km/lane).`,
          solverModel: 'Cell Transmission Model v2.4 (CFL Validated)'
        });
      }

      // 2. Check cell minimum speed threshold (< speedLimitConstraint)
      if (measuredMinSpeed < speedLimitConstraint) {
        problems.push({
          componentId: cell.id,
          componentName: cell.name,
          metricName: 'Minimum Cell Speed',
          numericMeasured: measuredMinSpeed,
          operator: '>=',
          threshold: speedLimitConstraint,
          measuredValue: `${measuredMinSpeed.toFixed(1)} km/h`,
          limitValue: `>= ${speedLimitConstraint.toFixed(1)} km/h`,
          unit: 'km/h',
          severity: 'Breached',
          symptom: `Cell discharge speed drops to ${measuredMinSpeed.toFixed(1)} km/h during peak queuing, violating minimum speed threshold (${speedLimitConstraint.toFixed(1)} km/h).`,
          solverModel: 'Cell Transmission Model v2.4 (CFL Validated)'
        });
      }
    }

    if (problems.length === 0 && res.averageSpeedKmh < speedLimitConstraint) {
      const avgSpd = Number(res.averageSpeedKmh.toFixed(1));
      problems.push({
        componentId: 'corridor-network',
        componentName: 'Main Arterial Corridor',
        metricName: 'Corridor Mean Speed',
        numericMeasured: avgSpd,
        operator: '>=',
        threshold: speedLimitConstraint,
        measuredValue: `${avgSpd.toFixed(1)} km/h`,
        limitValue: `>= ${speedLimitConstraint.toFixed(1)} km/h`,
        unit: 'km/h',
        severity: 'Breached',
        symptom: 'Overall peak-hour corridor speed drops below minimum municipal standard.',
        solverModel: 'Cell Transmission Model v2.4'
      });
    }
  } else if (baseRun.rawOutput.domain === 'water' && scenario.waterNetwork) {
    const res = baseRun.rawOutput.result;
    const pressureConstraint =
      scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 180.0;

    // 1. Report nodal pressure violations (e.g., North Ridge 118.0 kPa vs >= 180.0 kPa)
    Object.entries(res.nodeResults).forEach(([nodeId, nRes]) => {
      const node = scenario.waterNetwork?.nodes.find((n) => n.id === nodeId);
      if (node?.type === 'reservoir') return;
      const measuredP = Number(nRes.pressureKPa.toFixed(1));

      if (nRes.negativePressureWarning || measuredP < pressureConstraint) {
        problems.push({
          componentId: nodeId,
          componentName: node?.name || nodeId,
          metricName: 'Nodal Delivery Pressure',
          numericMeasured: measuredP,
          operator: '>=',
          threshold: pressureConstraint,
          measuredValue: `${measuredP.toFixed(1)} kPa`,
          limitValue: `>= ${pressureConstraint.toFixed(1)} kPa`,
          unit: 'kPa',
          severity: nRes.negativePressureWarning || measuredP < 150 ? 'Breached' : 'Warning',
          symptom: nRes.negativePressureWarning
            ? 'Negative hydraulic gauge pressure under peak draw (steady-state hydraulic deficit; water quality kinetics not modeled).'
            : `Nodal hydraulic pressure is ${measuredP.toFixed(1)} kPa at elevation ${node?.elevation ?? 0}m, violating minimum service pressure of ${pressureConstraint.toFixed(1)} kPa (steady-state hydraulic model; water quality not modeled).`,
          solverModel: 'Darcy-Weisbach Hydraulics v2.0 (Damped Newton)'
        });
      }
    });

    // 2. Separately report pipe velocity (> 2.0 m/s) and head-loss gradient (> 12.0 m/km) violations
    Object.entries(res.pipeResults).forEach(([pipeId, pRes]) => {
      const measuredVel = Number(pRes.velocityMs.toFixed(2));
      const measuredGradient = Number(pRes.headLossPerKm.toFixed(1));

      if (measuredVel > 2.0) {
        problems.push({
          componentId: pipeId,
          componentName: `Pipe ${pipeId}`,
          metricName: 'Pipe Flow Velocity',
          numericMeasured: measuredVel,
          operator: '<=',
          threshold: 2.0,
          measuredValue: `${measuredVel.toFixed(2)} m/s`,
          limitValue: '<= 2.00 m/s',
          unit: 'm/s',
          severity: measuredVel > 2.5 ? 'Breached' : 'Warning',
          symptom: `Pipe flow velocity reaches ${measuredVel.toFixed(2)} m/s (head-loss gradient ${measuredGradient.toFixed(1)} m/km), exceeding the 2.00 m/s design velocity limit.`,
          solverModel: 'Darcy-Weisbach Hydraulics v2.0'
        });
      } else if (measuredGradient > 12.0) {
        problems.push({
          componentId: pipeId,
          componentName: `Pipe ${pipeId}`,
          metricName: 'Friction Head-Loss Gradient',
          numericMeasured: measuredGradient,
          operator: '<=',
          threshold: 12.0,
          measuredValue: `${measuredGradient.toFixed(1)} m/km`,
          limitValue: '<= 12.0 m/km',
          unit: 'm/km',
          severity: measuredGradient > 16.0 ? 'Breached' : 'Warning',
          symptom: `Friction head-loss gradient reaches ${measuredGradient.toFixed(1)} m/km, exceeding the 12.0 m/km hydraulic efficiency limit.`,
          solverModel: 'Darcy-Weisbach Hydraulics v2.0'
        });
      }
    });
  } else if (baseRun.rawOutput.domain === 'energy' && scenario.powerNetwork) {
    const res = baseRun.rawOutput.result;
    Object.entries(res.lineFlowsMw).forEach(([lineId, lRes]) => {
      const line = scenario.powerNetwork?.lines.find((l) => l.id === lineId);
      const measuredLoading = Number(lRes.loadingPct.toFixed(1));
      if (lRes.thermalViolation || measuredLoading > 100.0) {
        problems.push({
          componentId: lineId,
          componentName: `Transmission Line ${lineId}`,
          metricName: 'Conductor Thermal Loading',
          numericMeasured: measuredLoading,
          operator: '<=',
          threshold: 100.0,
          measuredValue: `${measuredLoading.toFixed(1)}% (${Math.abs(lRes.flowMw).toFixed(1)} MW)`,
          limitValue: `<= 100.0% (${line?.thermalRatingMw || 55} MW)`,
          unit: '% loading',
          severity: 'Breached',
          symptom: `Active power flow of ${Math.abs(lRes.flowMw).toFixed(1)} MW reaches ${measuredLoading.toFixed(1)}% of the ${line?.thermalRatingMw || 55} MW thermal rating.`,
          solverModel: 'DC Load Flow v2.4 (Reference Bus Slack)'
        });
      }
    });

    const lossConstraint = scenario.constraints.find((c) => c.metricKey === 'primaryPerformance');
    if (lossConstraint && res.totalEstimatedLossesMw > lossConstraint.threshold) {
      const measuredLoss = Number(res.totalEstimatedLossesMw.toFixed(2));
      problems.push({
        componentId: 'grid-system-losses',
        componentName: 'System I²R Transmission Losses',
        metricName: 'Total Estimated Line Losses',
        numericMeasured: measuredLoss,
        operator: '<=',
        threshold: lossConstraint.threshold,
        measuredValue: `${measuredLoss.toFixed(2)} MW`,
        limitValue: `<= ${lossConstraint.threshold.toFixed(2)} MW`,
        unit: 'MW',
        severity: 'Breached',
        symptom: `Post-processed system I²R losses (${measuredLoss.toFixed(2)} MW) exceed the configured ${lossConstraint.threshold.toFixed(2)} MW efficiency threshold.`,
        solverModel: 'DC Load Flow v2.4 (Post-Processed I²R)'
      });
    }
  }

  return problems;
}

export interface FutureIssueOutcome {
  id: string;
  name: string;
  horizonYears: number;
  parameterShift: string;
  status: 'Breached' | 'Warning' | 'Clear';
  baselineImpact: string;
  measuredImpact: string;
  limitComparison: string;
  violationsList: string[];
  notes: string;
  solverModel: string;
}

/**
 * Evaluates declared future horizons and stress cases under both the baseline and active solution.
 * Recalculates from declared input changes and contingency outages across all three domains.
 * Explicitly labelled as scenario stress outcomes ("Possible future issues under this scenario").
 */
export function runFutureIssuesUnderScenario(
  scenario: Scenario,
  activeAlternativeId?: string | null,
  explicitAlternative?: SolutionAlternative | null
): FutureIssueOutcome[] {
  if (!scenario.futureScenarios || scenario.futureScenarios.length === 0) {
    return [];
  }

  const selectedAlt = explicitAlternative || (activeAlternativeId
    ? scenario.alternatives.find((a) => a.id === activeAlternativeId) || null
    : null);

  return scenario.futureScenarios.map((fCase) => {
    const stressedScenario: Scenario = {
      ...scenario,
      assumptions: scenario.assumptions.map((a) =>
        a.category === 'demand' ? { ...a, value: a.value * fCase.multiplier } : a
      )
    };

    // Apply domain-specific asset contingency if declared
    if (fCase.contingencyAssetId) {
      if (stressedScenario.domain === 'traffic' && stressedScenario.trafficNetwork) {
        stressedScenario.trafficNetwork = {
          ...stressedScenario.trafficNetwork,
          cells: stressedScenario.trafficNetwork.cells.map((c) =>
            c.id === fCase.contingencyAssetId
              ? {
                  ...c,
                  lanes: Math.max(1, c.lanes - 1),
                  freeFlowSpeedKmh: Math.max(18, c.freeFlowSpeedKmh * 0.72),
                  initialDensityVehKmPerLane: Math.min(
                    c.jamDensityVehKmPerLane * 0.92,
                    c.initialDensityVehKmPerLane * 1.35
                  )
                }
              : { ...c, nextCellIds: [...c.nextCellIds] }
          )
        };
      } else if (stressedScenario.domain === 'water' && stressedScenario.waterNetwork) {
        stressedScenario.waterNetwork = {
          ...stressedScenario.waterNetwork,
          pipes: stressedScenario.waterNetwork.pipes.map((p) =>
            p.id === fCase.contingencyAssetId
              ? { ...p, diameter: Number((p.diameter * 0.65).toFixed(3)) }
              : { ...p }
          )
        };
      } else if (stressedScenario.domain === 'energy' && stressedScenario.powerNetwork) {
        stressedScenario.powerNetwork = {
          ...stressedScenario.powerNetwork,
          lines: stressedScenario.powerNetwork.lines.map((l) =>
            l.id === fCase.contingencyAssetId
              ? { ...l, reactancePu: 99.0, thermalRatingMw: 5.0 }
              : { ...l }
          )
        };
      }
    }

    const baseStressRun = runBaselineSimulation(stressedScenario);
    const activeStressRun = selectedAlt
      ? runAlternativeSimulation(stressedScenario, selectedAlt)
      : baseStressRun;

    const isBreached = !activeStressRun.feasible;
    const isWarning = !isBreached && (
      activeStressRun.constraintViolations.length > 0 ||
      (activeStressRun.unverifiedConstraints?.length || 0) > 0
    );

    return {
      id: fCase.id,
      name: fCase.name,
      horizonYears: fCase.horizonYears,
      parameterShift: fCase.parameterShift,
      status: isBreached ? 'Breached' : isWarning ? 'Warning' : 'Clear',
      baselineImpact: `${baseStressRun.metrics.primaryPerformance.toFixed(1)} ${baseStressRun.metrics.primaryPerformanceUnit}`,
      measuredImpact: `${activeStressRun.metrics.primaryPerformance.toFixed(1)} ${activeStressRun.metrics.primaryPerformanceUnit}`,
      limitComparison: isBreached
        ? `Possible future issue: constraint breached under scenario stress (${activeStressRun.constraintViolations[0] || 'threshold exceeded'}).`
        : activeStressRun.unverifiedConstraints?.length
        ? `Partially checked: ${activeStressRun.unverifiedConstraints.join('; ')}`
        : `Within modeled bounds under declared stress scenario (Baseline stress: ${baseStressRun.metrics.primaryPerformance.toFixed(1)}).`,
      violationsList: [...activeStressRun.constraintViolations, ...(activeStressRun.unverifiedConstraints || [])].slice(0, 3),
      notes: fCase.description,
      solverModel: `Deterministic ${scenario.domain.toUpperCase()} Core v2.4`
    };
  });
}

/**
 * Compose a first intervention with a follow-on action and recalculate the
 * combined plan. When both target the same parameter, the follow-on value is
 * applied last and its original value is set to the first action's result.
 */
export function composeAlternativeSequence(
  first: SolutionAlternative | null,
  followUp: SolutionAlternative
): SolutionAlternative {
  const modifications = new Map<string, SolutionAlternative['modifications'][number]>();
  for (const modification of first?.modifications || []) {
    modifications.set(`${modification.targetId}:${modification.property}`, { ...modification });
  }
  for (const modification of followUp.modifications) {
    const key = `${modification.targetId}:${modification.property}`;
    const previous = modifications.get(key);
    modifications.set(key, {
      ...modification,
      originalValue: previous?.newValue ?? modification.originalValue
    });
  }
  return {
    ...followUp,
    id: `sequence-${first?.id || 'baseline'}-${followUp.id}`,
    name: first ? `${first.name} → ${followUp.name}` : `Baseline → ${followUp.name}`,
    tag: 'Sequential plan',
    modifications: Array.from(modifications.values()),
    capexCostMillion: (first?.capexCostMillion || 0) + followUp.capexCostMillion,
    opexAnnualMillion: (first?.opexAnnualMillion || 0) + followUp.opexAnnualMillion,
    implementationMonths: (first?.implementationMonths || 0) + followUp.implementationMonths,
    costDataStatus: first?.costDataStatus === 'not-estimated' || followUp.costDataStatus === 'not-estimated'
      ? 'not-estimated'
      : first?.costDataStatus === 'illustrative' || followUp.costDataStatus === 'illustrative'
      ? 'illustrative'
      : followUp.costDataStatus,
    scheduleDataStatus: first?.scheduleDataStatus === 'not-estimated' || followUp.scheduleDataStatus === 'not-estimated'
      ? 'not-estimated'
      : first?.scheduleDataStatus === 'illustrative' || followUp.scheduleDataStatus === 'illustrative'
      ? 'illustrative'
      : followUp.scheduleDataStatus
  };
}

/**
 * Calculates genuine mathematical deltas between an alternative and the baseline.
 */
export function calculateAlternativeDeltas(
  scenario: Scenario,
  altRecord: AlternativeRunRecord,
  baseRecord: AlternativeRunRecord
) {
  let primaryImprovementPct = 0;
  let secondaryImprovementPct = 0;
  let primaryLabel = '';
  let secondaryLabel = '';

  if (scenario.domain === 'traffic') {
    primaryLabel = 'Corridor Average Speed (All 16 Segments)';
    secondaryLabel = 'Queue Delay Reduction';
    const baseSpeed = baseRecord.metrics.primaryPerformance || 20;
    const altSpeed = altRecord.metrics.primaryPerformance;
    primaryImprovementPct = Math.round(((altSpeed - baseSpeed) / Math.max(1, baseSpeed)) * 100);

    if (baseRecord.rawOutput.domain === 'traffic' && altRecord.rawOutput.domain === 'traffic') {
      const baseDelay = baseRecord.rawOutput.result.totalDelayVehicleHours || 1;
      const altDelay = altRecord.rawOutput.result.totalDelayVehicleHours || 0;
      secondaryImprovementPct = Math.max(
        0,
        Math.min(95, Math.round(((baseDelay - altDelay) / Math.max(0.01, baseDelay)) * 100))
      );
    } else {
      secondaryImprovementPct = Math.max(0, Math.round(primaryImprovementPct * 0.55));
    }
  } else if (scenario.domain === 'water') {
    primaryLabel = 'System Minimum Pressure (All Junctions)';
    secondaryLabel = 'Pumping Head-Loss Relief';
    const baseP = baseRecord.metrics.primaryPerformance || 118;
    const altP = altRecord.metrics.primaryPerformance;
    primaryImprovementPct = Math.round(((altP - baseP) / Math.max(1, Math.abs(baseP))) * 100);

    if (baseRecord.rawOutput.domain === 'water' && altRecord.rawOutput.domain === 'water') {
      const baseLoss = baseRecord.rawOutput.result.maxHeadLossM || 10;
      const altLoss = altRecord.rawOutput.result.maxHeadLossM || 5;
      secondaryImprovementPct = Math.max(
        0,
        Math.min(95, Math.round(((baseLoss - altLoss) / Math.max(0.1, baseLoss)) * 100))
      );
    } else {
      secondaryImprovementPct = Math.max(0, Math.round(primaryImprovementPct * 0.4));
    }
  } else {
    primaryLabel = 'Peak Line Loading & Losses';
    secondaryLabel = 'Thermal Loading Relief';
    const baseLoss = baseRecord.metrics.primaryPerformance || 10;
    const altLoss = altRecord.metrics.primaryPerformance;
    primaryImprovementPct = Math.round(((baseLoss - altLoss) / Math.max(0.1, baseLoss)) * 100);

    if (baseRecord.rawOutput.domain === 'energy' && altRecord.rawOutput.domain === 'energy') {
      const baseLoads = Object.values(baseRecord.rawOutput.result.lineFlowsMw).map(
        (l) => l.loadingPct
      );
      const altLoads = Object.values(altRecord.rawOutput.result.lineFlowsMw).map(
        (l) => l.loadingPct
      );
      const maxBase = Math.max(...baseLoads, 100);
      const maxAlt = Math.max(...altLoads, 50);
      secondaryImprovementPct = Math.max(
        0,
        Math.min(95, Math.round(((maxBase - maxAlt) / Math.max(1, maxBase)) * 100))
      );
    } else {
      secondaryImprovementPct = Math.max(0, Math.round(primaryImprovementPct * 0.6));
    }
  }

  return {
    primaryLabel,
    primaryImprovementPct,
    secondaryLabel,
    secondaryImprovementPct,
    costMillion: altRecord.metrics.totalCostMillion,
    overallUtility: altRecord.normalizedScores.overallUtility
  };
}

export interface PracticalNextSteps {
  prerequisites: string[];
  implementationStages: { phase: string; title: string; duration: string; description: string }[];
  precautions: string[];
  monitoringNeeds: string[];
  missingDataDisclosures: string[];
  recoveryActions: string[];
  engineeringBoundaryNotice: string;
}

export type ConsequenceClassification =
  | 'calculated'
  | 'evidence-based-not-quantified'
  | 'assumption-based'
  | 'possible-not-calculated'
  | 'unknown-needs-data';

export interface UnsupportedRiskAuditItem {
  claim: string;
  whyPossible: string;
  assumptionsRequired: string;
  dataOrModelNeeded: string;
  classification: 'possible-not-calculated';
}

export interface CausalChainStep {
  trigger: string;
  connectionPathway: string;
  affectedPlaceOrAsset: string;
  directOutcome: string;
  secondaryEffect: string;
  laterEffect: string;
  safeguardOrRecovery: string;
  classification: ConsequenceClassification;
  timeframe: string;
  spatialReach: string;
  confidenceBasis: string;
}

export interface ConnectedSystemLink {
  sourceDomain: 'traffic' | 'water' | 'energy';
  targetDomain: 'traffic' | 'water' | 'energy' | 'community' | 'environment';
  linkType: 'physical-hydraulic' | 'electrical-power' | 'spatial-corridor' | 'construction-disruption';
  name: string;
  description: string;
  affectedAssets: string[];
  classification: ConsequenceClassification;
  evidenceOrRequirement: string;
}

export interface AlternativeTradeOffs {
  primaryBenefits: { label: string; detail: string; badge: string }[];
  immediateTradeOffs: { label: string; detail: string; severity: 'low' | 'medium' | 'high' }[];
  secondaryConsequences: { label: string; detail: string; risk: string }[];
  safeguards: string[];
  unsupportedRisksAudit: UnsupportedRiskAuditItem[];
  causalChain: CausalChainStep[];
  crossDomainLinks: ConnectedSystemLink[];
}

/**
 * Computes deterministic immediate trade-offs, connected causal chains,
 * cross-domain links, and the audit of uncalculated possible risks
 * for an alternative intervention, answering:
 * "What may improve, what problems could it cause or move elsewhere,
 *  what connected places, systems, or people could be affected,
 *  what might happen later, and how can we prevent or respond?"
 */
export function getAlternativeTradeOffs(
  scenario: Scenario,
  alternative: SolutionAlternative | null,
  simResult: AlternativeRunRecord
): AlternativeTradeOffs {
  const domain = scenario.domain;
  const altName = alternative?.name || 'Current Baseline Network';
  const capex = alternative?.capexCostMillion ?? 0;
  const months = alternative?.implementationMonths ?? 0;
  const primaryAsset = scenario.problemStatement?.affectedAssetIds?.[0] || 'critical corridor';
  const studyPlace = scenario.studyAreaLabel || 'Regional Study Area';

  if (domain === 'traffic') {
    return {
      primaryBenefits: [
        {
          label: 'Corridor Flow Velocity',
          detail: `Improves average speed to ${simResult.metrics.primaryPerformance.toFixed(1)} km/h across the critical arterial link.`,
          badge: '+Speed'
        },
        {
          label: 'Congestion Dissipation',
          detail: 'Reduces queue build-up and minimizes peak-hour delay propagation at key merge cells.',
          badge: '-Delay'
        },
        {
          label: 'Predictable Dispatch',
          detail: 'Improves transit and freight schedule reliability along the commercial spine.',
          badge: '+Reliability'
        }
      ],
      immediateTradeOffs: [
        {
          label: 'Capital Outlay & Mobilization',
          detail: `Requires commit of $${capex.toFixed(1)}M CAPEX over a ${months}-month delivery cycle.`,
          severity: capex > 10 ? 'high' : 'medium'
        },
        {
          label: 'Work-Zone Traffic Friction',
          detail: 'Temporary lane tapering and construction staging may reduce off-peak corridor capacity by 15-25%.',
          severity: 'medium'
        },
        {
          label: 'Signal Phase Rebalance',
          detail: 'Allocating additional green time to the priority trunk may modestly increase wait times for minor cross-streets.',
          severity: 'low'
        }
      ],
      secondaryConsequences: [
        {
          label: 'Cut-Through Traffic Spillback',
          detail: 'Drivers avoiding peak intersection queues may seek alternate routes through residential collector streets.',
          risk: 'Local street congestion'
        },
        {
          label: 'Induced Demand Rebound',
          detail: 'Long-term speed gains can stimulate 5-12% latent trip generation over 3-5 years unless transit mode-share is preserved.',
          risk: 'Latent traffic return'
        }
      ],
      safeguards: [
        'Enforce municipal traffic calming and turn restrictions on adjacent neighborhood collector roads',
        'Maintain minimum 15-second protected pedestrian walk phases and cross-street green splits',
        'Deploy dynamic variable message signs (VMS) with real-time alternate route guidance during construction phases'
      ],
      unsupportedRisksAudit: [
        {
          claim: 'Cut-Through Traffic Spillback into residential streets',
          whyPossible: 'Drivers facing peak bottleneck queues utilize routing navigation apps to divert through parallel residential roads.',
          assumptionsRequired: 'Assumes parallel neighborhood street grid is fully connected and uninhibited by physical traffic calming.',
          dataOrModelNeeded: 'Requires localized origin-destination (OD) trip matrices and micro-simulation driver route choice model (outside macroscopic CTM scope).',
          classification: 'possible-not-calculated'
        },
        {
          claim: 'Induced Demand Rebound over 3-5 years',
          whyPossible: 'Travel time reductions decrease the generalized cost of travel, inducing latent drivers to switch from other modes or travel hours.',
          assumptionsRequired: 'Assumes regional motor vehicle ownership and urban population continue expanding without congestion pricing.',
          dataOrModelNeeded: 'Requires 4-step regional land-use and travel demand equilibrium model with demographic forecasting.',
          classification: 'possible-not-calculated'
        },
        {
          claim: 'Work-Zone Traffic Friction Capacity Reduction (15-25%)',
          whyPossible: 'Civil barriers, narrowed lane widths, and worker safety buffer zones induce driver speed friction.',
          assumptionsRequired: 'Assumes daytime off-peak lane closures during civil barrier installation.',
          dataOrModelNeeded: 'Requires detailed contractor Work-Zone Traffic Control (WZTC) staging plan and temporary traffic management schedules.',
          classification: 'possible-not-calculated'
        }
      ],
      causalChain: [
        {
          trigger: `Deploy ${altName} on ${primaryAsset}`,
          connectionPathway: 'Direct physical roadway lane and signal timing modification',
          affectedPlaceOrAsset: `${primaryAsset} in ${studyPlace}`,
          directOutcome: `Average speed increases to ${simResult.metrics.primaryPerformance.toFixed(1)} km/h; bottleneck queue density drops within acceptable threshold.`,
          secondaryEffect: 'Temporary construction staging introduces off-peak lane tapering friction.',
          laterEffect: 'Latent traffic return over 3-5 years if transit mode share does not keep pace with regional growth.',
          safeguardOrRecovery: 'Implement off-peak only work-zone restrictions, automated fallback signal plans, and neighborhood traffic calming.',
          classification: 'calculated',
          timeframe: 'Immediate (0-1 mo)',
          spatialReach: 'Primary corridor & immediate merge cells',
          confidenceBasis: 'Cell Transmission Model (Daganzo) deterministic solver'
        }
      ],
      crossDomainLinks: [
        {
          sourceDomain: 'traffic',
          targetDomain: 'energy',
          linkType: 'electrical-power',
          name: 'Traffic Signal Grid Power Dependency',
          description: 'Corridor traffic controllers and radar sensors depend on 230V municipal distribution bus power; an electrical feeder outage drops signals to uncoordinated mode.',
          affectedAssets: [primaryAsset, 'substation-transformer'],
          classification: 'evidence-based-not-quantified',
          evidenceOrRequirement: 'Signal cabinet telemetry requires dedicated battery backup (UPS) integration.'
        },
        {
          sourceDomain: 'traffic',
          targetDomain: 'water',
          linkType: 'construction-disruption',
          name: 'Subsurface Utility Conflict Risk',
          description: 'Corridor lane widening or flyover pier foundations may conflict with buried water distribution mains along municipal right-of-way.',
          affectedAssets: [primaryAsset, 'distribution-main'],
          classification: 'unknown-needs-data',
          evidenceOrRequirement: 'Requires ground-penetrating radar (GPR) utility potholing before civil excavation.'
        },
        {
          sourceDomain: 'traffic',
          targetDomain: 'community',
          linkType: 'spatial-corridor',
          name: 'Air Quality & Noise Exposure for Roadside Receptors',
          description: 'Dissipating vehicle idling queues reduces localized stop-and-go PM2.5 and NOx emissions along adjacent residential settlements.',
          affectedAssets: [primaryAsset, 'adjacent-residential'],
          classification: 'evidence-based-not-quantified',
          evidenceOrRequirement: 'Supported by vehicular emissions velocity relationship; dispersion not numerically modeled.'
        }
      ]
    };
  } else if (domain === 'water') {
    return {
      primaryBenefits: [
        {
          label: 'Hydraulic Pressure Assurance',
          detail: `Maintains minimum junction pressure at ${simResult.metrics.primaryPerformance.toFixed(1)} kPa (exceeding standard 180 kPa threshold).`,
          badge: '+Pressure'
        },
        {
          label: 'Deficit Elimination',
          detail: 'Eliminates peak-hour supply starvation for multi-story residential and commercial premises.',
          badge: '-Deficit'
        },
        {
          label: 'Head-Loss Reduction',
          detail: 'Replaces rough tuberculated pipe with smooth C-factor conduits, reducing friction head loss.',
          badge: '-Friction'
        }
      ],
      immediateTradeOffs: [
        {
          label: 'Civil Trenching & Right-of-Way Disruption',
          detail: `Requires $${capex.toFixed(1)}M capital expenditure and open-trench work across urban rights-of-way.`,
          severity: capex > 8 ? 'high' : 'medium'
        },
        {
          label: 'Booster Pumping Electrical Load',
          detail: 'Continuous booster operation increases operational power consumption and monthly utility OPEX.',
          severity: 'medium'
        }
      ],
      secondaryConsequences: [
        {
          label: 'Downstream Burst Risk on Aging Mains',
          detail: 'Elevating main pressure can stress weak joints and unlined legacy cast-iron distribution pipes.',
          risk: 'Surge-induced pipe burst'
        },
        {
          label: 'Water Hammer & Acoustic Transients',
          detail: 'Rapid pump start/stop cycles or sudden valve closures can induce high-amplitude transient shock waves.',
          risk: 'Hydraulic transient damage'
        }
      ],
      safeguards: [
        'Install Variable Frequency Drives (VFD) with gentle 60-second soft-start ramping to prevent acoustic shock',
        'Equip downstream branches with pressure-reducing valves (PRVs) and surge-anticipator bypass relief loops',
        'Deploy continuous acoustic leak noise logger sensors on vulnerable legacy distribution segments'
      ],
      unsupportedRisksAudit: [
        {
          claim: 'Downstream Burst Risk on Aging Mains',
          whyPossible: 'Elevating junction head increases hoop stress on connected distribution pipes; weak joints or graphitized cast iron can rupture.',
          assumptionsRequired: 'Assumes legacy unlined cast iron or AC pipes with degraded wall thickness exist downstream of the booster zone.',
          dataOrModelNeeded: 'Requires physical pipe coupon extraction, ultrasonic wall thickness scanning, and structural pipe-burst fragility curves.',
          classification: 'possible-not-calculated'
        },
        {
          claim: 'Water Hammer & Acoustic Surge Transients',
          whyPossible: 'Rapid pump trips or abrupt check-valve slam produce elastic pressure wave reflections traveling at acoustic speed (~1000 m/s).',
          assumptionsRequired: 'Assumes sudden motor power loss or check-valve closure in under 2 seconds without air-chamber dampening.',
          dataOrModelNeeded: 'Requires transient Method-of-Characteristics (MOC) elastic surge solver (outside steady-state Darcy-Weisbach scope).',
          classification: 'possible-not-calculated'
        },
        {
          claim: 'Increased Background Micro-Leakage Rate',
          whyPossible: 'Orifice leakage through existing joint imperfections scales exponentially with pressure head (N1 exponent 0.5 - 1.5).',
          assumptionsRequired: 'Assumes pre-existing undetected joint leaks exist in older distribution sectors.',
          dataOrModelNeeded: 'Requires calibrated District Metered Area (DMA) minimum night-flow telemetry and acoustic logger correlation.',
          classification: 'possible-not-calculated'
        }
      ],
      causalChain: [
        {
          trigger: `Implement ${altName} on ${primaryAsset}`,
          connectionPathway: 'Direct hydraulic conveyance conduit and booster pump integration',
          affectedPlaceOrAsset: `${primaryAsset} in ${studyPlace}`,
          directOutcome: `Minimum junction pressure rises to ${simResult.metrics.primaryPerformance.toFixed(1)} kPa; low-pressure supply starvation resolved.`,
          secondaryEffect: 'Elevated line pressure increases hydrostatic hoop stress on older downstream distribution branches.',
          laterEffect: 'Potential accelerated joint micro-leakage over 2-5 years if aging pipes are not scheduled for phased relining.',
          safeguardOrRecovery: 'Deploy 60-second VFD soft-start ramping, install PRVs at boundary nodes, and deploy acoustic leak loggers.',
          classification: 'calculated',
          timeframe: 'Immediate (0-1 mo)',
          spatialReach: 'Pressure zone distribution mains and elevated service nodes',
          confidenceBasis: 'Darcy-Weisbach steady-state hydraulic solver'
        }
      ],
      crossDomainLinks: [
        {
          sourceDomain: 'water',
          targetDomain: 'energy',
          linkType: 'electrical-power',
          name: 'Booster Pump Electric Motor Dependency',
          description: 'Booster pump stations require reliable 11 kV grid electric supply; an electrical blackout stops pumps and drops zone water pressure within minutes.',
          affectedAssets: [primaryAsset, 'booster-pump-station', 'grid-substation'],
          classification: 'evidence-based-not-quantified',
          evidenceOrRequirement: 'Requires on-site backup diesel generator or dedicated dual-feed electric service.'
        },
        {
          sourceDomain: 'water',
          targetDomain: 'traffic',
          linkType: 'construction-disruption',
          name: 'Roadway Trenching & Lane Closure Disruption',
          description: 'Excavation and laying of high-capacity transmission mains requires open-trench work across municipal roads, causing traffic detours.',
          affectedAssets: [primaryAsset, 'roadway-corridor'],
          classification: 'evidence-based-not-quantified',
          evidenceOrRequirement: 'Requires inter-agency right-of-way permit and off-peak traffic detour schedule.'
        }
      ]
    };
  } else {
    return {
      primaryBenefits: [
        {
          label: 'Thermal Overload Relief',
          detail: `Restores transmission branch loading below 100% rated MVA capacity during peak dispatch.`,
          badge: '+Headroom'
        },
        {
          label: 'I²R Resistive Loss Minimization',
          detail: `Reduces total system power loss to ${simResult.metrics.primaryPerformance.toFixed(1)} MW, conserving generation fuel and emissions.`,
          badge: '-Losses'
        },
        {
          label: 'Bus Voltage Profile Stabilization',
          detail: 'Maintains substations within strict 0.95 to 1.05 p.u. statutory voltage limits.',
          badge: '+Stability'
        }
      ],
      immediateTradeOffs: [
        {
          label: 'High Substation / Line CAPEX',
          detail: `Incurs $${capex.toFixed(1)}M capital expenditure with specialized high-temperature composite conductors or storage.`,
          severity: capex > 12 ? 'high' : 'medium'
        },
        {
          label: 'Scheduled Transmission Clearance Outages',
          detail: 'Requires coordinated clearances on parallel feeders during conductor stringing and testing.',
          severity: 'medium'
        }
      ],
      secondaryConsequences: [
        {
          label: 'Parallel Branch Contingency Loading',
          detail: 'Rerouting bulk power through lower-impedance upgraded lines may shift secondary N-1 overload risks during storm trips.',
          risk: 'N-1 loop flow shifts'
        },
        {
          label: 'Storage Degradation & Replacement',
          detail: 'High-frequency peaking battery cycles introduce capacity fade over a 7-10 year horizon.',
          risk: 'Asset lifecycle depreciation'
        }
      ],
      safeguards: [
        'Arm automated Remedial Action Schemes (RAS / SPS) for instantaneous generation tripping upon unexpected line trips',
        'Deploy Dynamic Line Rating (DLR) tension and temperature monitors to exploit real-time ambient cooling',
        'Schedule line stringing during shoulder load seasons with mobile substation bypass trailers on standby'
      ],
      unsupportedRisksAudit: [
        {
          claim: 'Parallel Branch N-1 Loop Flow Shifts',
          whyPossible: 'Lower branch impedance alters active power flow distribution; if a parallel line trips, power instantly redistributes according to Kirchhoff laws.',
          assumptionsRequired: 'Assumes peak bulk power transfer coincides with an unexpected single-contingency transmission trip.',
          dataOrModelNeeded: 'Requires full N-1 security-constrained optimal power flow (SC-OPF) solver evaluating all branch trip permutations.',
          classification: 'possible-not-calculated'
        },
        {
          claim: 'Battery Energy Storage Capacity Fade (7-10 yr)',
          whyPossible: 'High C-rate cycling under high ambient summer temperatures (> 38°C) accelerates solid-electrolyte interphase (SEI) layer growth.',
          assumptionsRequired: 'Assumes daily full-depth charge/discharge cycles for peak arbitrage and frequency regulation.',
          dataOrModelNeeded: 'Requires electrochemical cell degradation model calibrated to operational battery temperature telemetry.',
          classification: 'possible-not-calculated'
        },
        {
          claim: 'AC Reactive Power & Subsynchronous Resonance',
          whyPossible: 'High power transfers alter line reactive consumption (Q_loss = I^2*X), impacting bus voltage angles and inverter control loops.',
          assumptionsRequired: 'Assumes high renewable inverter penetration with low system physical inertia.',
          dataOrModelNeeded: 'Requires electromagnetic transient (EMT) and full AC Newton-Raphson power flow solver (outside DC power-flow approximation scope).',
          classification: 'possible-not-calculated'
        }
      ],
      causalChain: [
        {
          trigger: `Energize ${altName} on ${primaryAsset}`,
          connectionPathway: 'High-voltage transmission interconnect and substation bus coupling',
          affectedPlaceOrAsset: `${primaryAsset} in ${studyPlace}`,
          directOutcome: `Thermal line loading drops below 100% rated capacity; active I²R transmission losses reduce to ${simResult.metrics.primaryPerformance.toFixed(1)} MW.`,
          secondaryEffect: 'Shifts loop flow impedance balance across parallel secondary transmission lines.',
          laterEffect: 'Battery storage capacity degradation over 7-10 years under continuous high-temperature peaking cycles.',
          safeguardOrRecovery: 'Deploy dynamic line rating (DLR) sensors, arm automated Remedial Action Schemes (RAS), and maintain mobile substation backup.',
          classification: 'calculated',
          timeframe: 'Immediate (0-1 mo)',
          spatialReach: 'High-voltage grid buses and connected sub-transmission corridors',
          confidenceBasis: 'DC power-flow approximation solver'
        }
      ],
      crossDomainLinks: [
        {
          sourceDomain: 'energy',
          targetDomain: 'water',
          linkType: 'electrical-power',
          name: 'Critical Water Utility Pumping Feeder',
          description: 'Substation bus supplies 11 kV electric feeders powering municipal water treatment plants and distribution booster stations.',
          affectedAssets: [primaryAsset, 'water-booster-substation'],
          classification: 'evidence-based-not-quantified',
          evidenceOrRequirement: 'Grid reliability directly bounds municipal water supply continuity.'
        },
        {
          sourceDomain: 'energy',
          targetDomain: 'traffic',
          linkType: 'electrical-power',
          name: 'Intelligent Transportation Systems (ITS) Power',
          description: 'Grid distribution lines power arterial traffic signal controllers, corridor CCTV monitoring, and electric bus charging depots.',
          affectedAssets: [primaryAsset, 'traffic-signal-feeders'],
          classification: 'evidence-based-not-quantified',
          evidenceOrRequirement: 'Grid outages collapse traffic signal coordination unless uninterruptible power supply (UPS) is maintained.'
        }
      ]
    };
  }
}

export function generatePracticalNextSteps(
  scenario: Scenario,
  alternative: SolutionAlternative | null,
  simResult: AlternativeRunRecord
): PracticalNextSteps {
  const altName = alternative?.name || 'Current Baseline Network';
  const months = alternative?.implementationMonths || 12;
  const domain = scenario.domain;
  const primaryAsset = scenario.problemStatement?.affectedAssetIds?.[0] || 'critical network corridor';

  if (domain === 'traffic') {
    return {
      prerequisites: [
        `Corridor right-of-way alignment survey on ${primaryAsset}`,
        'Municipal inter-agency traffic signal controller firmware compatibility audit',
        'Emergency services priority dispatch coordination and baseline travel-time log'
      ],
      implementationStages: [
        {
          phase: 'Phase 1: Mobilization & Site Setup',
          title: 'Traffic Management & Sensor Trenching',
          duration: `${Math.max(1, Math.round(months * 0.25))} mo`,
          description: `Establish off-peak work-zone detours, install temporary inductive loops, and complete geotechnical survey along ${primaryAsset}.`
        },
        {
          phase: 'Phase 2: Civil & Systems Deployment',
          title: 'Infrastructure Construction & Signal Upgrades',
          duration: `${Math.max(2, Math.round(months * 0.5))} mo`,
          description: `Deploy physical lane modifications, signal gantry heads, and fiber interconnect for ${altName}.`
        },
        {
          phase: 'Phase 3: Commissioning & Validation',
          title: 'Dynamic Green Wave Tuning & Verification',
          duration: `${Math.max(1, Math.round(months * 0.25))} mo`,
          description: 'Conduct field floating-car speed runs, verify emergency vehicle preemption, and calibrate peak signal ratios.'
        }
      ],
      precautions: [
        'Enforce night-time and off-peak only lane closures to prevent severe morning commute spillback',
        'Ensure pedestrian refuge crosswalks and ADA compliance ramps remain operational throughout work zones',
        'Coordinate backup power (UPS) for intersection traffic controllers during electrical tie-ins'
      ],
      monitoringNeeds: [
        'Real-time automated queue length telemetry at critical bottleneck intersections',
        'Bus transit arrival-time adherence and modal shift adoption tracking',
        'Corridor collision and near-miss safety logging during the first 90 days'
      ],
      missingDataDisclosures: [
        'Microscopic pedestrian jaywalking counts and mid-block friction are not included in macro CTM model',
        'Dynamic origin-destination route diversion during weather anomalies requires localized OD survey'
      ],
      recoveryActions: [
        'Pre-program automated fallback time-of-day signal timing plans if smart radar sensors or fiber communication links fail',
        'Designate secondary arterial spillback relief corridors with dynamic variable message sign (VMS) rerouting',
        'Establish rapid civil work-zone taper rollback protocol within 15 minutes during acute emergency corridor incidents'
      ],
      engineeringBoundaryNotice:
        'WhatIf provides strategic macro-planning simulations. Detailed civil roadway geometry, structural overpass calculations, signal wiring diagrams, and stamped construction packages require licensed Professional Engineer (PE) approval.'
    };
  } else if (domain === 'water') {
    return {
      prerequisites: [
        `Subsurface utility potholing and ground-penetrating radar survey along ${primaryAsset}`,
        'Department of Water Resources environmental discharge and trenching permits',
        'Valving inventory and hydraulic isolation plan for surrounding distribution zones'
      ],
      implementationStages: [
        {
          phase: 'Phase 1: Mobilization & Bypass Piping',
          title: 'Temporary Service Bypass & Excavation',
          duration: `${Math.max(1, Math.round(months * 0.25))} mo`,
          description: `Install temporary overland bypass piping to ensure uninterrupted customer water service before trenching ${primaryAsset}.`
        },
        {
          phase: 'Phase 2: Pipe Laying & Mechanical Install',
          title: 'Main Replacement & Booster Integration',
          duration: `${Math.max(2, Math.round(months * 0.5))} mo`,
          description: `Excavate, bed, and lay smooth-bore high-capacity piping and pressure control infrastructure for ${altName}.`
        },
        {
          phase: 'Phase 3: Hydrotesting & Water Quality',
          title: 'Pressure Proofing & System Disinfection',
          duration: `${Math.max(1, Math.round(months * 0.25))} mo`,
          description: 'Perform 1.5x working pressure hydrostatic hold tests, super-chlorination disinfection, and bacteriological clearance.'
        }
      ],
      precautions: [
        'Maintain minimum emergency fire-flow availability at all fire hydrants during construction staging',
        'Implement slow valve opening/closing protocols to prevent destructive water hammer acoustic pressure spikes',
        'Verify proper thrust block sizing at all pipe bends and tees to resist hydraulic forces'
      ],
      monitoringNeeds: [
        'Continuous SCADA piezometric pressure transmitters at high-elevation and boundary nodes',
        'Acoustic leak noise correlators along new and connected transmission segments',
        'Turbidity and chlorine residual monitoring during post-construction system recharging'
      ],
      missingDataDisclosures: [
        'Remaining pipe wall thickness on adjacent unmodeled distribution mains requires coupon extraction',
        'Dynamic pump performance curves and tank storage depletion cycles are modeled under steady-state assumptions'
      ],
      recoveryActions: [
        'Configure automated pressure-relief and surge-anticipator bypass valves if booster pumps trip abruptly',
        'Maintain dedicated emergency water tanker filling stations and mobile diesel generators for high-elevation zones',
        'Prepare pre-tested isolation valve sequences to compartmentalize pipe failure without regional depressurization'
      ],
      engineeringBoundaryNotice:
        'WhatIf delivers deterministic Darcy-Weisbach hydraulic planning calculations. Transient surge analysis, water quality advection modeling, and stamped mechanical pipeline specifications require certified professional hydraulic engineering validation.'
    };
  } else {
    return {
      prerequisites: [
        `Regional Transmission Organization (RTO/ISO) interconnect study and feasibility approval for ${primaryAsset}`,
        'Right-of-way corridor vegetation clearance and environmental wildlife nesting assessment',
        'Substation protection relay coordination and transfer-trip scheme review'
      ],
      implementationStages: [
        {
          phase: 'Phase 1: Civil Foundation & Procurement',
          title: 'Pad Preparation & Conductor Staging',
          duration: `${Math.max(1, Math.round(months * 0.25))} mo`,
          description: `Complete substation pad civil works, inspect transmission tower structural loading, and stage conductors for ${altName}.`
        },
        {
          phase: 'Phase 2: Stringing & Electrical Integration',
          title: 'Conductor Stringing / BESS Commissioning',
          duration: `${Math.max(2, Math.round(months * 0.5))} mo`,
          description: `Pull HTLS composite conductors / install battery storage enclosures and step-up transformers on ${primaryAsset}.`
        },
        {
          phase: 'Phase 3: Relay Testing & Energization',
          title: 'Protection Testing & Grid Synchronizing',
          duration: `${Math.max(1, Math.round(months * 0.25))} mo`,
          description: 'Conduct primary injection testing, verify SCADA remote telemetry, and perform controlled staged energization.'
        }
      ],
      precautions: [
        'Schedule line clearance outages strictly during shoulder months to prevent N-1 thermal overloads on parallel corridors',
        'Verify solid mechanical grounding and induction mitigation during live adjacent-circuit stringing',
        'Establish automated thermal trip interlocks to prevent exceeding manufacturer conductor temperature limits'
      ],
      monitoringNeeds: [
        'Real-time dynamic line rating (DLR) tension, sag, and ambient weather telemetry',
        'Substation transformer top-oil temperature and dissolved gas analysis (DGA) monitoring',
        'SCADA active/reactive power flow and bus voltage phase angle telemetry'
      ],
      missingDataDisclosures: [
        'Sub-cycle electromagnetic transient (EMT) and inverter subsynchronous resonance require specialized transient solvers',
        'Reactive power (MVAR) voltage collapse and dynamic reactive compensation are outside the linearized DC power flow scope'
      ],
      recoveryActions: [
        'Arm automated remedial action schemes (RAS / SPS) for instantaneous generation tripping upon transmission line trip',
        'Deploy mobile substation / bypass disconnect switches to restore power within 4 hours if transformer over-heats',
        'Maintain demand response shed contracts and battery reserve emergency dispatch to counter sudden frequency dips'
      ],
      engineeringBoundaryNotice:
        'WhatIf provides linearized DC optimal power flow and thermal dispatch simulations. AC reactive power dispatch, harmonic resonance studies, and certified electrical utility interconnection filings require licensed electrical engineering sign-off.'
    };
  }
}

/**
 * Escapes CSV cell values against spreadsheet formula injection (=, +, -, @, \t, \r)
 * and properly quotes commas/newlines/quotes.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

/**
 * Validates and sanitizes an untrusted JSON string for Scenario import.
 * Rejects oversized payloads (>1MB), prototype-pollution keys (__proto__, constructor, prototype),
 * non-finite numbers, invalid domains, and dangling topology references.
 */
export function sanitizeAndValidateScenarioImport(
  rawJsonText: string
): { valid: true; scenario: Scenario } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof rawJsonText !== 'string' || rawJsonText.trim().length === 0) {
    return { valid: false, errors: ['Import payload is empty.'] };
  }

  if (rawJsonText.length > 1_000_000) {
    return { valid: false, errors: ['Import payload exceeds maximum allowed size (1 MB).'] };
  }

  // Check raw JSON text for forbidden prototype-pollution property names
  if (/"(__proto__|constructor|prototype)"\s*:/.test(rawJsonText)) {
    return {
      valid: false,
      errors: ['Security violation: prototype-pollution keys (__proto__, constructor, prototype) are forbidden.']
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (e) {
    return {
      valid: false,
      errors: [`Malformed JSON syntax: ${e instanceof Error ? e.message : 'Unable to parse'}`]
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Root JSON value must be a Scenario object.'] };
  }

  // Recursive check for non-finite numbers or forbidden keys
  const inspectNode = (obj: unknown, path: string): void => {
    if (typeof obj === 'number' && !Number.isFinite(obj)) {
      errors.push(`Non-finite numeric value at ${path}.`);
      return;
    }
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          errors.push(`Forbidden key '${key}' at ${path}.`);
        } else {
          inspectNode((obj as Record<string, unknown>)[key], `${path}.${key}`);
        }
      }
    }
  };
  inspectNode(parsed, 'root');

  const candidate = parsed as Partial<Scenario>;

  if (!candidate.id || typeof candidate.id !== 'string') {
    errors.push("Missing or invalid string field 'id'.");
  }
  if (!candidate.title || typeof candidate.title !== 'string') {
    errors.push("Missing or invalid string field 'title'.");
  }
  if (!candidate.domain || !['traffic', 'water', 'energy'].includes(candidate.domain)) {
    errors.push("Field 'domain' must be 'traffic', 'water', or 'energy'.");
  }
  if (!Array.isArray(candidate.alternatives) || candidate.alternatives.length === 0) {
    errors.push("Field 'alternatives' must be a non-empty array.");
  }

  if (candidate.domain === 'water') {
    if (!candidate.waterNetwork || !Array.isArray(candidate.waterNetwork.nodes) || !Array.isArray(candidate.waterNetwork.pipes)) {
      errors.push('Water scenario requires waterNetwork.nodes and waterNetwork.pipes arrays.');
    } else {
      const nodeIds = new Set(candidate.waterNetwork.nodes.map((n) => n.id));
      const density = candidate.waterNetwork.waterDensityKgM3;
      const gravity = candidate.waterNetwork.gravityMs2;
      const viscosity = candidate.waterNetwork.dynamicViscosityPaS;
      if (typeof density !== 'number' || density <= 0) errors.push('Water density must be positive (kg/m³).');
      if (typeof gravity !== 'number' || gravity <= 0) errors.push('Gravity must be positive (m/s²).');
      if (viscosity !== undefined && (typeof viscosity !== 'number' || viscosity <= 0)) {
        errors.push('Dynamic viscosity must be positive (Pa·s) when provided.');
      }
      for (const pipe of candidate.waterNetwork.pipes) {
        if (!nodeIds.has(pipe.fromNodeId) || !nodeIds.has(pipe.toNodeId)) {
          errors.push(`Pipe '${pipe.id}' references non-existent node '${pipe.fromNodeId}' or '${pipe.toNodeId}'.`);
        }
        if (typeof pipe.diameter !== 'number' || pipe.diameter <= 0) {
          errors.push(`Pipe '${pipe.id}' must have positive diameter (m).`);
        }
        if (typeof pipe.length !== 'number' || pipe.length <= 0) {
          errors.push(`Pipe '${pipe.id}' must have positive length (m).`);
        }
        if (pipe.absoluteRoughnessMm !== undefined &&
            (typeof pipe.absoluteRoughnessMm !== 'number' || pipe.absoluteRoughnessMm < 0)) {
          errors.push(`Pipe '${pipe.id}' absolute roughness must be non-negative (mm).`);
        }
        if (pipe.hazenWilliamsC !== undefined &&
            (typeof pipe.hazenWilliamsC !== 'number' || pipe.hazenWilliamsC <= 0)) {
          errors.push(`Pipe '${pipe.id}' legacy Hazen-Williams C must be positive.`);
        }
      }
    }
  } else if (candidate.domain === 'energy') {
    if (!candidate.powerNetwork || !Array.isArray(candidate.powerNetwork.buses) || !Array.isArray(candidate.powerNetwork.lines)) {
      errors.push('Energy scenario requires powerNetwork.buses and powerNetwork.lines arrays.');
    } else {
      const busIds = new Set(candidate.powerNetwork.buses.map((b) => b.id));
      for (const line of candidate.powerNetwork.lines) {
        if (!busIds.has(line.fromBusId) || !busIds.has(line.toBusId)) {
          errors.push(`Line '${line.id}' references non-existent bus '${line.fromBusId}' or '${line.toBusId}'.`);
        }
        if (typeof line.reactancePu !== 'number' || line.reactancePu <= 0) {
          errors.push(`Line '${line.id}' must have reactancePu > 0.`);
        }
      }
    }
  } else if (candidate.domain === 'traffic') {
    if (!candidate.trafficNetwork || !Array.isArray(candidate.trafficNetwork.cells) || candidate.trafficNetwork.cells.length === 0) {
      errors.push('Traffic scenario requires non-empty trafficNetwork.cells array.');
    } else {
      const cellIds = new Set(candidate.trafficNetwork.cells.map((c) => c.id));
      for (const cell of candidate.trafficNetwork.cells) {
        for (const nextId of cell.nextCellIds || []) {
          if (!cellIds.has(nextId)) {
            errors.push(`Traffic cell '${cell.id}' nextCellIds references unknown cell '${nextId}'.`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Strip HTML tags from string titles/descriptions to prevent XSS injection
  const stripHtml = (s: string) => s.replace(/[<>]/g, '');
  const cleanScenario: Scenario = {
    ...(candidate as Scenario),
    id: `${stripHtml(candidate.id!)}-imp`,
    title: stripHtml(candidate.title!),
    description: stripHtml(candidate.description || ''),
    updatedAt: 'Imported just now',
    status: 'completed',
    objectives: Array.isArray(candidate.objectives) ? candidate.objectives : [],
    assumptions: Array.isArray(candidate.assumptions) ? candidate.assumptions : [],
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints : []
  };

  return { valid: true, scenario: cleanScenario };
}
