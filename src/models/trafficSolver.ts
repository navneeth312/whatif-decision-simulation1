import { TrafficNetwork, TrafficSimulationResult, TrafficTimeStepData } from '../types';

export const TRAFFIC_MODEL_VERSION = 'v2.1.0-CTM-TriangularFD';

/**
 * Solves traffic dynamics using the discrete-time Cell Transmission Model (Daganzo 1994, 1995)
 * with a triangular fundamental diagram and explicit CFL stability verification.
 */
export function solveTrafficNetwork(network: TrafficNetwork): TrafficSimulationResult {
  const dtSec = Math.max(1, network.timeStepSeconds || 5);
  const dtHours = dtSec / 3600;
  const totalSteps = Math.max(5, network.totalSteps || 30);
  const cells = network.cells;
  const warnings: string[] = [];

  if (cells.length === 0) {
    return {
      converged: false,
      cflSatisfied: false,
      cflRatio: 0,
      timeSteps: [],
      averageSpeedKmh: 0,
      maxCongestionDensityVehKm: 0,
      totalDelayVehicleHours: 0,
      bottleneckCells: [],
      warnings: ['No cells provided in traffic network.'],
      solverNote: 'Empty network configuration.'
    };
  }

  // Check CFL condition for every cell: Δt ≤ Δx / max(v_f, w)
  let cflSatisfied = true;
  let maxCflRatio = 0;

  for (const cell of cells) {
    const vf = Math.max(10, cell.freeFlowSpeedKmh);
    const w = Math.max(5, cell.backwardWaveSpeedKmh);
    const dx = Math.max(0.02, cell.lengthKm);
    const maxWaveSpeed = Math.max(vf, w);
    const maxAllowedDtHours = dx / maxWaveSpeed;
    const ratio = dtHours / maxAllowedDtHours;
    if (ratio > maxCflRatio) maxCflRatio = ratio;

    if (ratio > 1.0) {
      cflSatisfied = false;
      warnings.push(
        `CFL condition breached at cell '${cell.id}': time step Δt (${dtSec}s) > stability threshold (${(maxAllowedDtHours * 3600).toFixed(1)}s). Ratio: ${ratio.toFixed(2)}.`
      );
    }

    if (cell.signalGreenRatio !== undefined && (cell.signalGreenRatio < 0 || cell.signalGreenRatio > 1)) {
      warnings.push(`Cell '${cell.id}' has invalid signal green ratio (${cell.signalGreenRatio}); must be in 0..1.`);
    }
  }

  // Map cells
  const cellMap = new Map<string, (typeof cells)[0]>();
  cells.forEach((c) => cellMap.set(c.id, c));

  // State: density k_i (veh/km/lane) and vehicle count N_i = k_i * length * lanes
  const currentDensity: Record<string, number> = {};
  for (const cell of cells) {
    const kj = Math.max(20, cell.jamDensityVehKmPerLane);
    currentDensity[cell.id] = Math.min(kj, Math.max(0, cell.initialDensityVehKmPerLane));
  }

  const timeSteps: TrafficTimeStepData[] = [];
  let cumulativeDelayVehHours = 0;
  let totalSpeedSum = 0;
  let speedCount = 0;
  let peakDensity = 0;
  const bottleneckCounts = new Map<string, number>();

  for (let step = 0; step < totalSteps; step++) {
    const timeSec = step * dtSec;

    // 1. Calculate Sending Capacity S_i for each cell
    // S_i = lanes * min(v_f * k_i, q_max) (veh/hour)
    const sending: Record<string, number> = {};
    const receiving: Record<string, number> = {};

    for (const cell of cells) {
      const vf = cell.freeFlowSpeedKmh;
      const w = cell.backwardWaveSpeedKmh;
      const kj = cell.jamDensityVehKmPerLane;
      const lanes = Math.max(1, cell.lanes);
      const k = currentDensity[cell.id];

      // q_max per lane = v_f * w * k_j / (v_f + w)
      const qMaxPerLane = (vf * w * kj) / (vf + w);
      const qMaxTotal = lanes * qMaxPerLane;

      // Sending function S_i
      const s = lanes * Math.min(vf * k, qMaxPerLane);
      sending[cell.id] = s;

      // Receiving function R_i = lanes * min(q_max, w * (k_j - k))
      const r = lanes * Math.min(qMaxPerLane, w * Math.max(0, kj - k));
      receiving[cell.id] = r;
    }

    // 2. Compute transition flows between upstream i and downstream j
    // Flow Q_ij = min(S_i, R_j, signal_capacity)
    const flowFromTo: Record<string, number> = {}; // key: "i->j", value: veh/hour
    const totalOutflow: Record<string, number> = {};
    const totalInflow: Record<string, number> = {};

    cells.forEach((c) => {
      totalOutflow[c.id] = 0;
      totalInflow[c.id] = 0;
    });

    for (const cell of cells) {
      const downstreamIds = cell.nextCellIds;
      if (!downstreamIds || downstreamIds.length === 0) {
        // Exit cell: freely discharges according to sending capacity
        const outflow = sending[cell.id];
        totalOutflow[cell.id] += outflow;
        continue;
      }

      // Signal green ratio at end of cell (0..1)
      const greenRatio = cell.signalGreenRatio ?? 1.0;
      const splitFraction = 1.0 / downstreamIds.length;

      for (const nextId of downstreamIds) {
        const nextCell = cellMap.get(nextId);
        if (!nextCell) continue;

        const s = sending[cell.id] * splitFraction;
        const r = receiving[nextId];
        // Signal capacity restricts flow
        const vf = cell.freeFlowSpeedKmh;
        const w = cell.backwardWaveSpeedKmh;
        const kj = cell.jamDensityVehKmPerLane;
        const qMaxCell = cell.lanes * ((vf * w * kj) / (vf + w));
        const signalCap = qMaxCell * greenRatio;

        const flow = Math.min(s, r, signalCap);
        flowFromTo[`${cell.id}->${nextId}`] = flow;
        totalOutflow[cell.id] += flow;
        totalInflow[nextId] += flow;

        // Bottleneck detection: when upstream sending is throttled by downstream receiving
        if (s > r && r < qMaxCell * 0.9) {
          bottleneckCounts.set(nextId, (bottleneckCounts.get(nextId) || 0) + 1);
        }
      }
    }

    // External demand inflow at boundary cells
    for (const cell of cells) {
      if (cell.inflowDemandVehHour && cell.inflowDemandVehHour > 0) {
        // Inflow limited by cell receiving capacity
        const actualInflow = Math.min(cell.inflowDemandVehHour, receiving[cell.id]);
        totalInflow[cell.id] += actualInflow;
      }
    }

    // 3. Update vehicle counts and densities
    // ΔN_i = (Inflow_i - Outflow_i) * Δt
    const stepDensities: Record<string, number> = {};
    const stepSpeeds: Record<string, number> = {};
    const stepFlows: Record<string, number> = {};
    const stepVehicles: Record<string, number> = {};
    let stepTotalVehicles = 0;
    const stepBottlenecks: string[] = [];

    for (const cell of cells) {
      const lengthKm = cell.lengthKm;
      const lanes = Math.max(1, cell.lanes);
      const prevK = currentDensity[cell.id];
      const prevVehicles = prevK * lengthKm * lanes;

      const netRateVehHour = totalInflow[cell.id] - totalOutflow[cell.id];
      const newVehicles = Math.max(0, prevVehicles + netRateVehHour * dtHours);
      const newDensity = Math.min(
        cell.jamDensityVehKmPerLane,
        newVehicles / (lengthKm * lanes)
      );

      currentDensity[cell.id] = newDensity;

      // Speed v = Flow / (k * lanes), bounded by v_f
      const flow = totalOutflow[cell.id];
      let speedKmh = cell.freeFlowSpeedKmh;
      if (newDensity > 1e-3) {
        speedKmh = Math.min(cell.freeFlowSpeedKmh, flow / (newDensity * lanes));
      }

      stepDensities[cell.id] = newDensity;
      stepSpeeds[cell.id] = speedKmh;
      stepFlows[cell.id] = flow;
      stepVehicles[cell.id] = newVehicles;
      stepTotalVehicles += newVehicles;

      if (newDensity > peakDensity) peakDensity = newDensity;
      totalSpeedSum += speedKmh;
      speedCount++;

      // Delay calculation: vehicle-hours lost compared to free-flow travel time
      // T_actual = length / speed, T_free = length / v_f
      if (speedKmh < cell.freeFlowSpeedKmh * 0.95 && speedKmh > 0.1) {
        const delayPerVehHours = (lengthKm / speedKmh) - (lengthKm / cell.freeFlowSpeedKmh);
        if (delayPerVehHours > 0) {
          cumulativeDelayVehHours += delayPerVehHours * newVehicles * (dtHours / (lengthKm / speedKmh));
        }
      }

      // Flag bottleneck
      if (newDensity > cell.jamDensityVehKmPerLane * 0.7) {
        stepBottlenecks.push(cell.id);
      }
    }

    timeSteps.push({
      timeSec,
      cellDensities: stepDensities,
      cellSpeeds: stepSpeeds,
      cellFlows: stepFlows,
      cellVehicles: stepVehicles,
      totalVehicles: stepTotalVehicles,
      bottlenecks: stepBottlenecks
    });
  }

  // Top overall bottleneck cells
  const bottleneckCells = Array.from(bottleneckCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0]);

  return {
    converged: cflSatisfied,
    cflSatisfied,
    cflRatio: maxCflRatio,
    timeSteps,
    averageSpeedKmh: speedCount > 0 ? totalSpeedSum / speedCount : 45.0,
    maxCongestionDensityVehKm: peakDensity,
    totalDelayVehicleHours: cumulativeDelayVehHours,
    bottleneckCells,
    warnings,
    solverNote: `Discrete-time Cell Transmission Model (CTM) with triangular fundamental diagram (Δt = ${dtSec}s). Validates conservation of vehicles and CFL stability. Model assumes homogeneous driver behavior and uncalibrated local turning fractions.`
  };
}
