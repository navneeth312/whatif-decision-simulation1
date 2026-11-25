import { WaterNetwork, WaterSimulationResult, WaterPipe } from '../types';

export const WATER_MODEL_VERSION = 'v2.0.0-SI-DarcyWeisbach-Newton';

/**
 * Solves a steady-state incompressible pressurized water network with Darcy-Weisbach
 * pipe losses and damped Newton iteration on junction continuity. Pump/valve curves,
 * minor losses, tank storage dynamics, water quality, and transients are not modeled.
 */
export function solveWaterNetwork(
  network: WaterNetwork,
  options?: {
    maxIterations?: number;
    tolerance?: number;
    minPressureWarningKPa?: number;
  }
): WaterSimulationResult {
  const maxIterations = options?.maxIterations ?? 60;
  const tolerance = options?.tolerance ?? 1e-4; // m³/s residual threshold
  const minPressureWarningKPa = options?.minPressureWarningKPa ?? 180; // standard municipal 180 kPa

  const rho = Number.isFinite(network.waterDensityKgM3) && (network.waterDensityKgM3 as number) > 0
    ? (network.waterDensityKgM3 as number)
    : 1000;
  const g = Number.isFinite(network.gravityMs2) && (network.gravityMs2 as number) > 0
    ? (network.gravityMs2 as number)
    : 9.81;
  const mu = Number.isFinite(network.dynamicViscosityPaS) && (network.dynamicViscosityPaS as number) > 0
    ? (network.dynamicViscosityPaS as number)
    : 1.002e-3; // water near 20 °C, Pa·s
  const nu = mu / rho; // m²/s

  // Separate fixed-head nodes (reservoirs/tanks with explicit head) and unknown junctions
  const fixedNodes = network.nodes.filter((n) => n.type === 'reservoir' || n.head !== undefined);
  const junctions = network.nodes.filter((n) => n.type !== 'reservoir' && n.head === undefined);

  const warnings: string[] = [];

  if (fixedNodes.length === 0) {
    return {
      converged: false,
      iterations: 0,
      residualNorm: Infinity,
      tolerance,
      nodeResults: {},
      pipeResults: {},
      totalFlowM3s: 0,
      maxHeadLossM: 0,
      minPressureKPa: 0,
      warnings: ['Network has no fixed-head reservoir or reference tank. System is indeterminate.'],
      solverNote: 'Boundary error: at least one fixed-head source node is required.'
    };
  }

  // Map node IDs to indices
  const junctionMap = new Map<string, number>();
  junctions.forEach((j, idx) => junctionMap.set(j.id, idx));

  // Initial head estimate: mean fixed head or reservoir head minus nominal elevation
  const avgFixedHead =
    fixedNodes.reduce((sum, n) => sum + (n.head ?? n.elevation + 30), 0) / fixedNodes.length;

  const H = new Float64Array(junctions.length);
  for (let i = 0; i < junctions.length; i++) {
    // Initial guess slightly above elevation to guarantee positive starting pressure
    H[i] = Math.max(avgFixedHead - 2.0, junctions[i].elevation + 15.0);
  }

  const getNodeHead = (nodeId: string): number => {
    const fixed = fixedNodes.find((n) => n.id === nodeId);
    if (fixed) return fixed.head ?? fixed.elevation + 30;
    const idx = junctionMap.get(nodeId);
    return idx !== undefined ? H[idx] : 0;
  };

  // Resolve pipe geometry and absolute roughness. Imported legacy H-W-only data is
  // converted to an equivalent roughness at a stated 1 m/s reference velocity.
  const pipeParameters = new Map<string, { diameterM: number; lengthM: number; roughnessM: number }>();
  for (const pipe of network.pipes) {
    const D = Math.max(0.01, pipe.diameter);
    const L = Math.max(1, pipe.length);
    const roughnessMm = Number.isFinite(pipe.absoluteRoughnessMm) && pipe.absoluteRoughnessMm! >= 0
      ? pipe.absoluteRoughnessMm!
      : Number.isFinite(pipe.hazenWilliamsC) && pipe.hazenWilliamsC! > 0
        ? legacyHazenWilliamsEquivalentRoughnessMm(pipe.hazenWilliamsC!, D, nu, g)
        : 0.15;
    if (pipe.absoluteRoughnessMm === undefined && pipe.hazenWilliamsC !== undefined) {
      warnings.push(`Pipe '${pipe.id}' uses legacy Hazen-Williams C converted to equivalent Darcy roughness at 1 m/s; provide surveyed absolute roughness for engineering use.`);
    } else if (pipe.absoluteRoughnessMm === undefined) {
      warnings.push(`Pipe '${pipe.id}' has no roughness input; a 0.15 mm illustrative default was used.`);
    }
    pipeParameters.set(pipe.id, { diameterM: D, lengthM: L, roughnessM: Math.max(0, roughnessMm) / 1000 });
  }

  const headLossForFlow = (pipe: WaterPipe, flowM3s: number): number => {
    const params = pipeParameters.get(pipe.id);
    if (!params || Math.abs(flowM3s) < 1e-14) return 0;
    const area = Math.PI * params.diameterM * params.diameterM / 4;
    const velocity = Math.abs(flowM3s) / area;
    const reynolds = velocity * params.diameterM / nu;
    const frictionFactor = darcyWeisbachFrictionFactor(reynolds, params.roughnessM / params.diameterM);
    return frictionFactor * (params.lengthM / params.diameterM) * (velocity * velocity / (2 * g));
  };

  const flowForHeadLoss = (pipe: WaterPipe, headLossM: number): number => {
    if (!(headLossM > 0)) return 0;
    let low = 0;
    let high = 1e-5;
    for (let i = 0; i < 60 && headLossForFlow(pipe, high) < headLossM; i++) high *= 2;
    if (!Number.isFinite(high) || high > 1e4) return high;
    for (let i = 0; i < 52; i++) {
      const mid = (low + high) / 2;
      if (headLossForFlow(pipe, mid) < headLossM) low = mid;
      else high = mid;
    }
    return (low + high) / 2;
  };

  // Compute pipe flow Q_ij from node i to node j
  const computePipeFlowAndDeriv = (
    pipe: WaterPipe,
    hFrom: number,
    hTo: number
  ): { flow: number; dQdHFrom: number } => {
    const dH = hFrom - hTo;
    const absDH = Math.abs(dH);
    const flow = Math.sign(dH) * flowForHeadLoss(pipe, absDH);
    const derivativeStep = Math.max(1e-5, absDH * 1e-4);
    const qPlus = flowForHeadLoss(pipe, absDH + derivativeStep);
    const qMinus = flowForHeadLoss(pipe, Math.max(0, absDH - derivativeStep));
    const dQdHFrom = Math.max(1e-8, Math.min(1e5, (qPlus - qMinus) / (absDH > derivativeStep ? 2 * derivativeStep : derivativeStep)));
    return { flow, dQdHFrom };
  };

  let converged = false;
  let iterations = 0;
  let currentResidualNorm = 0;

  // Damped Newton-Raphson loop
  for (iterations = 1; iterations <= maxIterations; iterations++) {
    const N = junctions.length;
    if (N === 0) {
      converged = true;
      break;
    }

    // Residual vector R: for each junction, R_i = Σ Q_in - Σ Q_out - Demand_i
    const R = new Float64Array(N);
    // Jacobian matrix J (N x N)
    const J: number[][] = Array.from({ length: N }, () => Array(N).fill(0));

    // Fill residuals with negative base demand (positive demand is an outflow)
    for (let i = 0; i < N; i++) {
      R[i] = -junctions[i].baseDemand;
    }

    for (const pipe of network.pipes) {
      const hFrom = getNodeHead(pipe.fromNodeId);
      const hTo = getNodeHead(pipe.toNodeId);
      const { flow, dQdHFrom } = computePipeFlowAndDeriv(pipe, hFrom, hTo);

      const iIdx = junctionMap.get(pipe.fromNodeId);
      const jIdx = junctionMap.get(pipe.toNodeId);

      // Flow leaves fromNode, enters toNode
      if (iIdx !== undefined) {
        R[iIdx] -= flow;
        J[iIdx][iIdx] -= dQdHFrom;
        if (jIdx !== undefined) {
          J[iIdx][jIdx] += dQdHFrom;
        }
      }

      if (jIdx !== undefined) {
        R[jIdx] += flow;
        J[jIdx][jIdx] -= dQdHFrom;
        if (iIdx !== undefined) {
          J[jIdx][iIdx] += dQdHFrom;
        }
      }
    }

    // Compute residual norm
    let norm = 0;
    for (let i = 0; i < N; i++) {
      norm += R[i] * R[i];
    }
    currentResidualNorm = Math.sqrt(norm);

    if (currentResidualNorm < tolerance) {
      converged = true;
      break;
    }

    // Solve J * delta = -R using Gaussian elimination with partial pivoting
    // We solve J * delta = RHS, where RHS = -R
    const RHS = new Float64Array(N);
    for (let i = 0; i < N; i++) RHS[i] = -R[i];

    const delta = solveLinearSystem(J, RHS);
    if (!delta || !delta.every(Number.isFinite)) {
      warnings.push('Jacobian matrix singular or poorly conditioned at iteration ' + iterations);
      break;
    }

    // Damping factor with bounds check to keep pressure reasonable
    let alpha = 1.0;
    for (let i = 0; i < N; i++) {
      // Limit excessive head jumps in a single step
      if (Math.abs(alpha * delta[i]) > 40) {
        alpha = Math.min(alpha, 40 / Math.abs(delta[i]));
      }
    }

    for (let i = 0; i < N; i++) {
      H[i] += alpha * delta[i];
    }
  }

  // Post-process results
  const nodeResults: WaterSimulationResult['nodeResults'] = {};
  let minPressureKPa = Infinity;

  // Process fixed nodes
  for (const fn of fixedNodes) {
    const head = fn.head ?? fn.elevation + 30;
    const pressureKPa = ((head - fn.elevation) * rho * g) / 1000;
    minPressureKPa = Math.min(minPressureKPa, pressureKPa);
    nodeResults[fn.id] = {
      head,
      pressureKPa,
      demandSupplied: fn.baseDemand,
      unmetDemand: false,
      lowPressureWarning: pressureKPa < minPressureWarningKPa,
      negativePressureWarning: pressureKPa < 0
    };
  }

  // Process junctions
  for (let i = 0; i < junctions.length; i++) {
    const j = junctions[i];
    const head = H[i];
    const pressureKPa = ((head - j.elevation) * rho * g) / 1000;
    minPressureKPa = Math.min(minPressureKPa, pressureKPa);

    const negPressure = pressureKPa < 0;
    const lowPressure = pressureKPa < minPressureWarningKPa;

    if (negPressure) {
      warnings.push(`Node '${j.name}' (${j.id}) has negative pressure: ${pressureKPa.toFixed(1)} kPa (elevation ${j.elevation}m).`);
    } else if (lowPressure) {
      warnings.push(`Node '${j.name}' (${j.id}) pressure below service threshold: ${pressureKPa.toFixed(1)} kPa < ${minPressureWarningKPa} kPa.`);
    }

    nodeResults[j.id] = {
      head,
      pressureKPa,
      demandSupplied: j.baseDemand,
      unmetDemand: negPressure,
      lowPressureWarning: lowPressure,
      negativePressureWarning: negPressure
    };
  }

  const pipeResults: WaterSimulationResult['pipeResults'] = {};
  let totalFlowM3s = 0;
  let maxHeadLossM = 0;

  for (const pipe of network.pipes) {
    const hFrom = getNodeHead(pipe.fromNodeId);
    const hTo = getNodeHead(pipe.toNodeId);
    const { flow } = computePipeFlowAndDeriv(pipe, hFrom, hTo);
    const headLoss = Math.abs(hFrom - hTo);
    const area = (Math.PI * Math.pow(Math.max(0.01, pipe.diameter), 2)) / 4;
    const velocity = Math.abs(flow) / (area > 0 ? area : 0.001);
    const headLossPerKm = (headLoss / Math.max(1, pipe.length)) * 1000;

    totalFlowM3s += Math.abs(flow);
    maxHeadLossM = Math.max(maxHeadLossM, headLoss);

    const overloaded = velocity > 3.0; // excessive velocity > 3 m/s
    if (overloaded) {
      warnings.push(`Pipe '${pipe.id}' has excessive fluid velocity: ${velocity.toFixed(2)} m/s > 3.0 m/s.`);
    }

    pipeResults[pipe.id] = {
      flowM3s: flow,
      velocityMs: velocity,
      headLossM: headLoss,
      headLossPerKm,
      overloaded
    };
  }

  return {
    converged,
    iterations,
    residualNorm: currentResidualNorm,
    tolerance,
    nodeResults,
    pipeResults,
    totalFlowM3s: totalFlowM3s / 2, // avoid double-counting undirected flows
    maxHeadLossM,
    minPressureKPa: isFinite(minPressureKPa) ? minPressureKPa : 0,
    warnings,
    solverNote: `Solved with steady-state Darcy-Weisbach head loss and damped Newton continuity (density: ${rho} kg/m³, dynamic viscosity: ${mu} Pa·s, g: ${g} m/s²). Friction uses f=64/Re below Re 2,000, a smooth cubic blend from Re 2,000–4,000, and the Swamee-Jain approximation above Re 4,000. Minor losses, pump head curves, PRV controls, tank storage dynamics, transients, and water quality are not modeled; pump/valve nodes are ordinary demand junctions, and a tank without a specified head is an unknown-head junction.`
  };
}

/** Darcy friction factor: laminar, smooth transition blend, and Swamee-Jain turbulent approximation. */
export function darcyWeisbachFrictionFactor(reynolds: number, relativeRoughness: number): number {
  if (!Number.isFinite(reynolds) || reynolds <= 0) return 0;
  const rr = Math.max(0, relativeRoughness);
  if (reynolds < 2000) return 64 / reynolds;

  const turbulent = (re: number) => {
    const denominator = Math.log10(rr / 3.7 + 5.74 / Math.pow(re, 0.9));
    return 0.25 / (denominator * denominator);
  };
  if (reynolds > 4000) return turbulent(reynolds);

  const t = (reynolds - 2000) / 2000;
  const smoothBlend = t * t * (3 - 2 * t);
  const laminar = 64 / reynolds;
  return laminar * (1 - smoothBlend) + turbulent(reynolds) * smoothBlend;
}

/**
 * Backwards-compatible conversion for H-W-only imports. Matches H-W head gradient
 * to Darcy friction at 1 m/s; this is not a material-specific roughness measurement.
 */
export function legacyHazenWilliamsEquivalentRoughnessMm(
  hazenWilliamsC: number,
  diameterM: number,
  kinematicViscosityM2s: number,
  gravityMs2 = 9.81
): number {
  const d = Math.max(0.01, diameterM);
  const c = Math.max(20, hazenWilliamsC);
  const velocity = 1;
  const flow = velocity * Math.PI * d * d / 4;
  const headGradient = 10.67 * Math.pow(flow, 1.852) / (Math.pow(c, 1.852) * Math.pow(d, 4.871));
  const frictionFactor = headGradient * 2 * gravityMs2 * d / (velocity * velocity);
  const reynolds = velocity * d / Math.max(1e-12, kinematicViscosityM2s);
  const roughnessTerm = Math.pow(10, -0.5 / Math.sqrt(Math.max(1e-8, frictionFactor))) - 5.74 / Math.pow(reynolds, 0.9);
  return Math.max(0.001, 3700 * d * roughnessTerm);
}

/**
 * Standard Gaussian elimination with partial pivoting for small dense N x N systems.
 */
function solveLinearSystem(A: number[][], b: Float64Array): Float64Array | null {
  const n = b.length;
  // Clone matrix
  const M = A.map((row) => [...row]);
  const x = new Float64Array(b);

  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > maxVal) {
        maxVal = Math.abs(M[r][i]);
        maxRow = r;
      }
    }

    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    if (maxRow !== i) {
      const tempRow = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tempRow;
      const tempB = x[i];
      x[i] = x[maxRow];
      x[maxRow] = tempB;
    }

    // Eliminate below
    for (let r = i + 1; r < n; r++) {
      const factor = M[r][i] / M[i][i];
      for (let c = i; c < n; c++) {
        M[r][c] -= factor * M[i][c];
      }
      x[r] -= factor * x[i];
    }
  }

  // Back-substitution
  const sol = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let c = i + 1; c < n; c++) {
      sum -= M[i][c] * sol[c];
    }
    sol[i] = sum / M[i][i];
  }

  return sol;
}
