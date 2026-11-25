import { PowerGridNetwork, PowerGridSimulationResult, TransmissionLine } from '../types';

export const POWER_MODEL_VERSION = 'v1.2.0-DC-LoadFlow-BMatrix';

/**
 * Solves balanced steady-state active-power DC load flow.
 * Solves B * θ = P on connected islands, balances active power with explicitly designated
 * slack generator, calculates line flows, thermal loading, and optional post-processed I²R losses.
 */
export function solvePowerGrid(network: PowerGridNetwork): PowerGridSimulationResult {
  const baseMva = network.baseMva > 0 ? network.baseMva : 100.0;
  const violations: string[] = [];

  // Identify buses
  const buses = network.buses;
  const nBuses = buses.length;
  if (nBuses === 0) {
    return {
      converged: false,
      slackBusId: '',
      slackGenerationMw: 0,
      busAnglesDeg: {},
      busNetInjectionsMw: {},
      lineFlowsMw: {},
      totalGenerationMw: 0,
      totalLoadMw: 0,
      totalEstimatedLossesMw: 0,
      violations: ['No buses defined in electrical network.'],
      islandsCount: 0,
      solverNote: 'Empty grid configuration.'
    };
  }

  const busIndexMap = new Map<string, number>();
  buses.forEach((b, idx) => busIndexMap.set(b.id, idx));

  // Determine connected components (islands) using BFS/DFS
  const adj = Array.from({ length: nBuses }, () => [] as number[]);
  for (const line of network.lines) {
    const u = busIndexMap.get(line.fromBusId);
    const v = busIndexMap.get(line.toBusId);
    if (u !== undefined && v !== undefined) {
      adj[u].push(v);
      adj[v].push(u);
    }
  }

  const visited = new Uint8Array(nBuses);
  const islands: number[][] = [];
  for (let i = 0; i < nBuses; i++) {
    if (!visited[i]) {
      const component: number[] = [];
      const queue = [i];
      visited[i] = 1;
      while (queue.length > 0) {
        const curr = queue.shift()!;
        component.push(curr);
        for (const neighbor of adj[curr]) {
          if (!visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
      islands.push(component);
    }
  }

  // Calculate bus loads and scheduled generator outputs
  const busLoadMw = new Float64Array(nBuses);
  for (const load of network.loads) {
    const idx = busIndexMap.get(load.busId);
    if (idx !== undefined) {
      busLoadMw[idx] += Number.isFinite(load.mw) ? load.mw : 0;
    }
  }

  const busGenMw = new Float64Array(nBuses);
  for (const gen of network.generators) {
    const idx = busIndexMap.get(gen.busId);
    if (idx !== undefined) {
      busGenMw[idx] += Number.isFinite(gen.scheduledMw) ? gen.scheduledMw : 0;
    }
  }

  // Find slack generator or nominate primary slack bus
  let slackBusId = buses.find((b) => b.isSlack)?.id;
  let slackGen = network.generators.find((g) => g.busId === slackBusId);
  if (!slackGen) {
    // If not explicitly set, pick generator on island 0 with greatest capacity
    if (network.generators.length > 0) {
      slackGen = [...network.generators].sort((a, b) => b.maxMw - a.maxMw)[0];
      slackBusId = slackGen.busId;
    } else {
      slackBusId = buses[0].id;
    }
  }

  const slackBusIdx = busIndexMap.get(slackBusId!) ?? 0;

  // Total system load
  let totalLoad = 0;
  for (let i = 0; i < nBuses; i++) totalLoad += busLoadMw[i];

  // Total scheduled gen except slack gen
  let otherGenTotal = 0;
  for (const gen of network.generators) {
    if (gen.id !== slackGen?.id) {
      otherGenTotal += gen.scheduledMw;
    }
  }

  // Balance power at slack bus
  const requiredSlackMw = totalLoad - otherGenTotal;
  let slackGenViolation = false;
  if (slackGen) {
    if (requiredSlackMw > slackGen.maxMw) {
      violations.push(
        `Slack generator '${slackGen.id}' dispatched at ${requiredSlackMw.toFixed(1)} MW exceeds maximum rating of ${slackGen.maxMw} MW.`
      );
      slackGenViolation = true;
    } else if (requiredSlackMw < slackGen.minMw) {
      violations.push(
        `Slack generator '${slackGen.id}' dispatched at ${requiredSlackMw.toFixed(1)} MW is below minimum generation limit of ${slackGen.minMw} MW.`
      );
      slackGenViolation = true;
    }
    busGenMw[slackBusIdx] = requiredSlackMw;
  }

  // Build Susceptance Matrix B for each island
  // B_ik = -1 / x_ik for i != k; B_ii = Σ (1 / x_ij)
  const busAnglesRad = new Float64Array(nBuses);
  const busNetInjectionMw = new Float64Array(nBuses);

  let hasIslandError = false;

  for (const island of islands) {
    if (island.length === 1) {
      // Single isolated bus
      const bIdx = island[0];
      busAnglesRad[bIdx] = 0;
      busNetInjectionMw[bIdx] = busGenMw[bIdx] - busLoadMw[bIdx];
      if (Math.abs(busNetInjectionMw[bIdx]) > 1e-3) {
        violations.push(`Isolated island bus '${buses[bIdx].id}' has net unsupplied power of ${busNetInjectionMw[bIdx].toFixed(2)} MW.`);
      }
      continue;
    }

    // Pick reference bus for this island
    let refIdx = island.includes(slackBusIdx) ? slackBusIdx : island[0];

    // Filter lines belonging to this island
    const islandLines = network.lines.filter((l) => {
      const u = busIndexMap.get(l.fromBusId);
      const v = busIndexMap.get(l.toBusId);
      return u !== undefined && v !== undefined && island.includes(u) && island.includes(v);
    });

    const m = island.length;
    // Map island bus index to local [0..m-1]
    const localMap = new Map<number, number>();
    island.forEach((globalIdx, localIdx) => localMap.set(globalIdx, localIdx));

    // Full island B matrix (m x m)
    const B: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
    for (const line of islandLines) {
      const uGlobal = busIndexMap.get(line.fromBusId)!;
      const vGlobal = busIndexMap.get(line.toBusId)!;
      const u = localMap.get(uGlobal)!;
      const v = localMap.get(vGlobal)!;
      const x = Math.max(1e-5, line.reactancePu);
      const b_pu = 1.0 / x;

      B[u][u] += b_pu;
      B[v][v] += b_pu;
      B[u][v] -= b_pu;
      B[v][u] -= b_pu;
    }

    // Submatrix removing reference bus row/column
    const localRef = localMap.get(refIdx)!;
    const reducedIndices: number[] = [];
    for (let k = 0; k < m; k++) {
      if (k !== localRef) reducedIndices.push(k);
    }

    const rSize = reducedIndices.length;
    const B_red: number[][] = Array.from({ length: rSize }, () => Array(rSize).fill(0));
    const P_red = new Float64Array(rSize);

    for (let r = 0; r < rSize; r++) {
      const origR = reducedIndices[r];
      const gIdx = island[origR];
      P_red[r] = (busGenMw[gIdx] - busLoadMw[gIdx]) / baseMva;
      for (let c = 0; c < rSize; c++) {
        const origC = reducedIndices[c];
        B_red[r][c] = B[origR][origC];
      }
    }

    // Solve B_red * theta_red = P_red
    const theta_red = solveReducedSystem(B_red, P_red);
    if (!theta_red || !theta_red.every(Number.isFinite)) {
      violations.push(`Susceptance matrix for island containing bus '${buses[refIdx].id}' is singular.`);
      hasIslandError = true;
      continue;
    }

    busAnglesRad[refIdx] = 0;
    for (let r = 0; r < rSize; r++) {
      const origR = reducedIndices[r];
      const gIdx = island[origR];
      busAnglesRad[gIdx] = theta_red[r];
    }
  }

  // Compute line flows and post-processed I²R losses
  const lineFlowsMw: PowerGridSimulationResult['lineFlowsMw'] = {};
  let totalEstimatedLossesMw = 0;

  for (const line of network.lines) {
    const uIdx = busIndexMap.get(line.fromBusId);
    const vIdx = busIndexMap.get(line.toBusId);
    if (uIdx === undefined || vIdx === undefined) continue;

    const thetaU = busAnglesRad[uIdx];
    const thetaV = busAnglesRad[vIdx];
    const x = Math.max(1e-5, line.reactancePu);

    // Active power flow: P_ij = baseMva * (theta_i - theta_j) / x
    const flowMw = (baseMva * (thetaU - thetaV)) / x;
    const absFlow = Math.abs(flowMw);
    const rating = Math.max(1.0, line.thermalRatingMw);
    const loadingPct = (absFlow / rating) * 100;
    const thermalViolation = absFlow > rating;

    if (thermalViolation) {
      violations.push(
        `Transmission line '${line.id}' (${line.fromBusId} -> ${line.toBusId}) loaded at ${loadingPct.toFixed(1)}% (${absFlow.toFixed(1)} MW > limit ${rating} MW).`
      );
    }

    // Optional post-processed loss estimation: I²R
    // I_pu ≈ |P_pu / (V_nominal * pf)|, Loss_pu = I² * r
    let estimatedLossesMw: number | undefined = undefined;
    if (line.resistancePu !== undefined && line.resistancePu > 0) {
      const pf = network.nominalPowerFactor ?? 0.95;
      const p_pu = absFlow / baseMva;
      const i_pu = p_pu / pf; // assuming ~1.0 pu voltage
      const loss_pu = i_pu * i_pu * line.resistancePu;
      estimatedLossesMw = loss_pu * baseMva;
      totalEstimatedLossesMw += estimatedLossesMw;
    }

    lineFlowsMw[line.id] = {
      flowMw,
      loadingPct,
      thermalViolation,
      estimatedLossesMw
    };
  }

  // Bus results
  const busAnglesDeg: Record<string, number> = {};
  const busNetInjectionsMw: Record<string, number> = {};
  for (let i = 0; i < nBuses; i++) {
    const bId = buses[i].id;
    busAnglesDeg[bId] = (busAnglesRad[i] * 180) / Math.PI;
    busNetInjectionsMw[bId] = busGenMw[i] - busLoadMw[i];
  }

  let totalGeneration = 0;
  for (let i = 0; i < nBuses; i++) totalGeneration += busGenMw[i];

  return {
    converged: !hasIslandError,
    slackBusId: slackBusId ?? '',
    slackGenerationMw: requiredSlackMw,
    busAnglesDeg,
    busNetInjectionsMw,
    lineFlowsMw,
    totalGenerationMw: totalGeneration,
    totalLoadMw: totalLoad,
    totalEstimatedLossesMw,
    violations,
    islandsCount: islands.length,
    solverNote:
      'Balanced steady-state DC load flow formulation (Bθ=P). Assumes nominal 1.0 p.u. voltage, small phase angles (|θ_i - θ_j| << 1 rad), and negligible resistance during angle solve. Omits reactive power (Q), voltage magnitude variations, and transient dynamics. I²R losses are post-processed estimates only.'
  };
}

function solveReducedSystem(A: number[][], b: Float64Array): Float64Array | null {
  const n = b.length;
  if (n === 0) return new Float64Array(0);
  const M = A.map((r) => [...r]);
  const x = new Float64Array(b);

  for (let i = 0; i < n; i++) {
    let maxR = i;
    let maxV = Math.abs(M[i][i]);
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > maxV) {
        maxV = Math.abs(M[r][i]);
        maxR = r;
      }
    }
    if (maxV < 1e-12) return null;

    if (maxR !== i) {
      const tempRow = M[i];
      M[i] = M[maxR];
      M[maxR] = tempRow;
      const tb = x[i];
      x[i] = x[maxR];
      x[maxR] = tb;
    }

    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c < n; c++) M[r][c] -= f * M[i][c];
      x[r] -= f * x[i];
    }
  }

  const sol = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let c = i + 1; c < n; c++) s -= M[i][c] * sol[c];
    sol[i] = s / M[i][i];
  }
  return sol;
}
