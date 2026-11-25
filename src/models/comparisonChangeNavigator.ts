import { Scenario, AlternativeRunRecord, SolutionAlternative } from '../types';
import { scenarioPositionToWorld } from './regionalMap';
import { DigitalTwinAdapters } from './digitalTwinAdapters';

export type ChangeCategory = 'directly-modified' | 'improved' | 'degraded' | 'newly-affected';

export interface ChangeExplanation {
  whatChanged: string;
  whereChanged: string;
  situationBefore: string;
  situationAfter: string;
  whyHappened: string;
  directBenefit: string;
  negativeOrSecondaryEffects: string;
  connectedAssetsAffected: string;
  watchOutFor: string;
  practicalTakeaway: string;
  // Rigorous engineering audit separation
  calculatedResults: string[];
  inferredExplanations: string[];
  unmodeledRisks: string[];
  governingEquations: string;
}

export interface AssetComparisonChange {
  id: string;
  assetName: string;
  category: ChangeCategory;
  categoryLabel: string;
  domain: 'traffic' | 'water' | 'energy';
  locationDescription: string;
  worldPosition?: { x: number; z: number };
  metricLabel: string;
  unit: string;
  beforeValue: number;
  afterValue: number;
  delta: number;
  deltaPct: number;
  isDirectModification: boolean;
  interventionLabel?: string;
  connectedAssetIds: string[];
  connectedAssetNames: string[];
  explanation: ChangeExplanation;
}

export interface ComparisonSummaryData {
  totalAssetsEvaluated: number;
  totalModified: number;
  totalImproved: number;
  totalDegraded: number;
  totalNewlyAffected: number;
  totalUnchanged: number;
  remainingViolations: number;
  feasibilityStatus: 'FEASIBLE' | 'VIOLATIONS_REMAIN' | 'INCOMPLETE';
  feasibilityReason: string;
  primaryMetricSummary: {
    label: string;
    before: number;
    after: number;
    unit: string;
    deltaPct: number;
  };
}

/**
 * Derives the 3D camera focus coordinates to frame a specific asset.
 */
export function getAssetCameraFocus(
  scenario: Scenario,
  assetId: string,
  mapPlaceId = 'nambur'
): { x: number; z: number; distance: number } | null {
  let pt: { x: number; y: number } | null = null;

  if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
    const cell = scenario.trafficNetwork.cells.find((c) => c.id === assetId);
    if (cell) pt = { x: cell.x, y: cell.y };
  } else if (scenario.domain === 'water' && scenario.waterNetwork) {
    const node = scenario.waterNetwork.nodes.find((n) => n.id === assetId);
    if (node) {
      pt = { x: node.x, y: node.y };
    } else {
      const pipe = scenario.waterNetwork.pipes.find((p) => p.id === assetId);
      if (pipe) {
        const n1 = scenario.waterNetwork.nodes.find((n) => n.id === pipe.fromNodeId);
        const n2 = scenario.waterNetwork.nodes.find((n) => n.id === pipe.toNodeId);
        if (n1 && n2) pt = { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 };
      }
    }
  } else if (scenario.domain === 'energy' && scenario.powerNetwork) {
    const bus = scenario.powerNetwork.buses.find((b) => b.id === assetId);
    if (bus) {
      pt = { x: bus.x, y: bus.y };
    } else {
      const line = scenario.powerNetwork.lines.find((l) => l.id === assetId);
      if (line) {
        const b1 = scenario.powerNetwork.buses.find((b) => b.id === line.fromBusId);
        const b2 = scenario.powerNetwork.buses.find((b) => b.id === line.toBusId);
        if (b1 && b2) pt = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 };
      }
    }
  }

  if (!pt) return null;
  const world = scenarioPositionToWorld(pt.x, pt.y, 0, mapPlaceId);
  return { x: world.x, z: world.z, distance: 15 };
}

/**
 * Computes all changed assets, difference classifications, summaries,
 * and 10-point plain-language explanations from actual solver results.
 */
export function computeComparisonChanges(
  scenario: Scenario,
  baseline: AlternativeRunRecord,
  altResult: AlternativeRunRecord,
  alternative: SolutionAlternative | null
): { changes: AssetComparisonChange[]; summary: ComparisonSummaryData } {
  const changes: AssetComparisonChange[] = [];
  const modifiedTargetIds = new Set(alternative?.modifications.map((m) => m.targetId) || []);

  let totalEvaluated = 0;
  let totalUnchanged = 0;
  let remainingViolations = 0;

  // ==========================================
  // DOMAIN 1: ROAD TRAFFIC (CTM Solver)
  // ==========================================
  if (
    scenario.domain === 'traffic' &&
    scenario.trafficNetwork &&
    baseline.rawOutput.domain === 'traffic' &&
    altResult.rawOutput.domain === 'traffic'
  ) {
    const baseOut = baseline.rawOutput.result;
    const altOut = altResult.rawOutput.result;
    const baseLast = baseOut.timeSteps[baseOut.timeSteps.length - 1];
    const altLast = altOut.timeSteps[altOut.timeSteps.length - 1];

    totalEvaluated = scenario.trafficNetwork.cells.length;

    scenario.trafficNetwork.cells.forEach((cell) => {
      const baseSpeed = baseLast?.cellSpeeds[cell.id] ?? baseOut.averageSpeedKmh;
      const altSpeed = altLast?.cellSpeeds[cell.id] ?? altOut.averageSpeedKmh;
      const baseDensity = baseLast?.cellDensities[cell.id] ?? cell.initialDensityVehKmPerLane;
      const altDensity = altLast?.cellDensities[cell.id] ?? cell.initialDensityVehKmPerLane;
      const speedDelta = altSpeed - baseSpeed;
      const speedDeltaPct = Math.round((speedDelta / Math.max(0.1, baseSpeed)) * 100);

      const isDirect = modifiedTargetIds.has(cell.id);
      const mod = alternative?.modifications.find((m) => m.targetId === cell.id);

      // Remaining violation: speed < 22 km/h or density > 0.8 jam density
      if (altSpeed < 22 || altDensity > 0.8 * cell.jamDensityVehKmPerLane) {
        remainingViolations++;
      }

      // Check change significance
      const isSpeedChanged = Math.abs(speedDelta) >= 1.0;
      const isDensityChanged = Math.abs(altDensity - baseDensity) >= 3.0;

      if (!isDirect && !isSpeedChanged && !isDensityChanged) {
        totalUnchanged++;
        return;
      }

      let category: ChangeCategory = 'directly-modified';
      let categoryLabel = 'Directly Modified';

      if (isDirect) {
        category = 'directly-modified';
        categoryLabel = 'Directly Modified by Intervention';
      } else if (speedDelta >= 2.0 || altDensity < baseDensity - 5.0) {
        category = 'improved';
        categoryLabel = 'Improved Flow / Alleviated Bottleneck';
      } else if (speedDelta <= -2.0 || altDensity > baseDensity + 5.0) {
        category = 'degraded';
        categoryLabel = 'Degraded Speed / Increased Queue';
      } else {
        category = 'newly-affected';
        categoryLabel = 'Newly Affected / Flow Redistribution';
      }

      const connected = DigitalTwinAdapters.getConnectedAssets(scenario, cell.id);
      const connectedNames = connected.connectedIds.map((cid) => {
        const found = scenario.trafficNetwork?.cells.find((c) => c.id === cid);
        return found ? found.name : cid;
      });

      // 10-point explanation
      const whatChanged = isDirect
        ? `Asset parameters modified via ${alternative?.name || 'Selected Alternative'}: ${mod?.label || `${mod?.property} adjusted to ${mod?.newValue}`}.`
        : `Traffic flow dynamics shifted downstream/upstream from modified corridor sections.`;

      const whereChanged = `Segment "${cell.name}" (ID: ${cell.id}), length ${cell.lengthKm.toFixed(2)} km with ${cell.lanes} travel lane(s).`;
      const situationBefore = `Pre-intervention baseline speed was ${baseSpeed.toFixed(1)} km/h with a queue density of ${baseDensity.toFixed(1)} veh/km/ln.`;
      const situationAfter = `Post-intervention speed is ${altSpeed.toFixed(1)} km/h with a queue density of ${altDensity.toFixed(1)} veh/km/ln (${speedDeltaPct >= 0 ? `+${speedDeltaPct}%` : `${speedDeltaPct}%`} speed change).`;
      
      const whyHappened = isDirect
        ? `Direct infrastructure adjustment expanded throughput capacity or reduced friction, altering the cell's sending and receiving functions according to the Cell Transmission Model.`
        : speedDelta > 0
          ? `Alleviation of an upstream or downstream bottleneck allowed vehicles to discharge smoothly without forming shockwave spillback into this segment.`
          : `Increased discharge from an upstream corridor upgrade delivered a higher vehicle arrival rate than this segment's downstream receiving capacity could instantly absorb.`;

      const directBenefit = speedDelta > 0
        ? `Segment travel time reduced by ${(Math.abs(speedDelta) / Math.max(1, altSpeed) * 100).toFixed(0)}%, preventing vehicle queues from blocking cross-streets.`
        : `Maintained connectivity across the arterial network.`;

      const negativeOrSecondaryEffects = speedDelta < 0
        ? `Minor localized queue buildup of ${(altDensity - baseDensity).toFixed(1)} veh/km/ln caused by higher incoming flow.`
        : `Faster vehicle arrivals at downstream intersections may require adaptive signal retiming.`;

      const connectedAssetsAffected = connectedNames.length > 0
        ? `Adjacent connected segments: ${connectedNames.join(', ')}.`
        : `Corridor boundary segment with no internal network neighbors.`;

      const watchOutFor = `Monitor downstream intersection green splits to ensure high-speed discharge does not overwhelm subsequent merges.`;
      const practicalTakeaway = speedDelta > 0
        ? `This change successfully alleviates local congestion and contributes to the corridor-wide average speed increase.`
        : `Secondary flow surge requires coordinated traffic signal offsets along the subsequent segments.`;

      changes.push({
        id: cell.id,
        assetName: cell.name,
        category,
        categoryLabel,
        domain: 'traffic',
        locationDescription: `Vijayawada Arterial Network (Cell ${cell.id})`,
        metricLabel: 'Segment Speed',
        unit: 'km/h',
        beforeValue: baseSpeed,
        afterValue: altSpeed,
        delta: speedDelta,
        deltaPct: speedDeltaPct,
        isDirectModification: isDirect,
        interventionLabel: mod?.label,
        connectedAssetIds: connected.connectedIds,
        connectedAssetNames: connectedNames,
        explanation: {
          whatChanged,
          whereChanged,
          situationBefore,
          situationAfter,
          whyHappened,
          directBenefit,
          negativeOrSecondaryEffects,
          connectedAssetsAffected,
          watchOutFor,
          practicalTakeaway,
          calculatedResults: [
            `Baseline speed: ${baseSpeed.toFixed(1)} km/h → Alternative: ${altSpeed.toFixed(1)} km/h (Delta: ${speedDelta >= 0 ? `+${speedDelta.toFixed(1)}` : speedDelta.toFixed(1)} km/h)`,
            `Density: ${baseDensity.toFixed(1)} veh/km/ln → ${altDensity.toFixed(1)} veh/km/ln`,
            `CFL condition satisfied: ${altOut.cflSatisfied ? 'Yes' : 'No'} (CFL ratio: ${altOut.cflRatio.toFixed(3)})`
          ],
          inferredExplanations: [
            `Shockwave propagation calculated via Daganzo Cell Transmission Model conservation equations.`,
            `Discharge rate determined by min(Sending Capacity, Receiving Capacity).`
          ],
          unmodeledRisks: [
            `Driver route diversion to parallel local residential streets is unmodeled.`,
            `Weather, vehicle breakdowns, and pedestrian mid-block crossings are not simulated.`
          ],
          governingEquations: `q_{i}(t) = \\min\\left(v_f \\cdot k_i(t), q_{\\max}, w \\cdot (k_j - k_{i+1}(t))\\right) \\quad \\text{and} \\quad \\frac{\\partial k}{\\partial t} + \\frac{\\partial q}{\\partial x} = 0`
        }
      });
    });
  }

  // ==========================================
  // DOMAIN 2: WATER DISTRIBUTION (Hydraulic Solver)
  // ==========================================
  else if (
    scenario.domain === 'water' &&
    scenario.waterNetwork &&
    baseline.rawOutput.domain === 'water' &&
    altResult.rawOutput.domain === 'water'
  ) {
    const baseOut = baseline.rawOutput.result;
    const altOut = altResult.rawOutput.result;
    const minPressureLimit = scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 180.0;
    const maxPressureLimit = 550.0;

    totalEvaluated = scenario.waterNetwork.nodes.length + scenario.waterNetwork.pipes.length;

    // Check Nodes (Pressure)
    scenario.waterNetwork.nodes.forEach((node) => {
      const baseP = baseOut.nodeResults[node.id]?.pressureKPa ?? 0;
      const altP = altOut.nodeResults[node.id]?.pressureKPa ?? 0;
      const pDelta = altP - baseP;
      const pDeltaPct = Math.round((pDelta / Math.max(1, baseP)) * 100);

      const isDirect = modifiedTargetIds.has(node.id);
      const mod = alternative?.modifications.find((m) => m.targetId === node.id);

      if (altP < minPressureLimit || altP > maxPressureLimit) {
        remainingViolations++;
      }

      const isPressureChanged = Math.abs(pDelta) >= 5.0;
      if (!isDirect && !isPressureChanged) {
        totalUnchanged++;
        return;
      }

      let category: ChangeCategory = 'directly-modified';
      let categoryLabel = 'Directly Modified';

      if (isDirect) {
        category = 'directly-modified';
        categoryLabel = 'Directly Modified Asset';
      } else if (altP >= minPressureLimit && altP <= maxPressureLimit && baseP < minPressureLimit) {
        category = 'improved';
        categoryLabel = 'Deficit Resolved / Minimum Pressure Restored';
      } else if (altP > maxPressureLimit) {
        category = 'degraded';
        categoryLabel = 'High Pressure Breach (>550 kPa)';
      } else if (pDelta > 0) {
        category = 'improved';
        categoryLabel = 'Service Head Increased';
      } else {
        category = 'newly-affected';
        categoryLabel = 'Pressure Redistribution';
      }

      const connected = DigitalTwinAdapters.getConnectedAssets(scenario, node.id);

      changes.push({
        id: node.id,
        assetName: node.name,
        category,
        categoryLabel,
        domain: 'water',
        locationDescription: `Water Distribution Zone (Junction ${node.id})`,
        metricLabel: 'Junction Pressure',
        unit: 'kPa',
        beforeValue: baseP,
        afterValue: altP,
        delta: pDelta,
        deltaPct: pDeltaPct,
        isDirectModification: isDirect,
        interventionLabel: mod?.label,
        connectedAssetIds: connected.connectedIds,
        connectedAssetNames: connected.connectedIds,
        explanation: {
          whatChanged: isDirect
            ? `Pump or junction equipment modified: ${mod?.label || mod?.property}.`
            : `Hydraulic grade line elevated by upstream pumping or network re-routing.`,
          whereChanged: `Junction node "${node.name}" at elevation ${node.elevation?.toFixed(1) || '0.0'} m.`,
          situationBefore: `Baseline pressure was ${baseP.toFixed(1)} kPa (${baseP < minPressureLimit ? 'Deficit below 180 kPa minimum requirement' : 'Within allowable range'}).`,
          situationAfter: `Post-solution pressure is ${altP.toFixed(1)} kPa (${altP > maxPressureLimit ? 'Exceeds 550 kPa upper burst threshold' : altP >= minPressureLimit ? 'Meets service criteria' : 'Remains in deficit'}).`,
          whyHappened: `The non-linear Darcy-Weisbach flow solver adjusted junction heads to balance inflows, outflows, and friction losses across the loop.`,
          directBenefit: altP >= minPressureLimit
            ? `Restores adequate consumer delivery pressure and prevents siphonage backflow.`
            : `Pressure increased by ${pDelta.toFixed(1)} kPa toward target.`,
          negativeOrSecondaryEffects: altP > maxPressureLimit
            ? `Elevated pressure increases burst risk and leakage rates on aged distribution mains.`
            : `None identified within calculated parameters.`,
          connectedAssetsAffected: connected.description,
          watchOutFor: `Ensure pressure reducing valves (PRVs) are deployed if line pressure approaches 500 kPa.`,
          practicalTakeaway: altP >= minPressureLimit && altP <= maxPressureLimit
            ? `Target pressure successfully achieved without over-pressurizing the junction.`
            : `Further pressure regulation or parallel throttling required.`,
          calculatedResults: [
            `Pressure: ${baseP.toFixed(1)} kPa → ${altP.toFixed(1)} kPa (Delta: ${pDelta >= 0 ? `+${pDelta.toFixed(1)}` : pDelta.toFixed(1)} kPa)`,
            `Target Range: [${minPressureLimit} kPa – ${maxPressureLimit} kPa]`,
            `Solver convergence: ${altOut.converged ? 'Converged' : 'Failed'} in ${altOut.iterations} iterations`
          ],
          inferredExplanations: [
            `Head loss along incident pipes computed via Darcy-Weisbach friction regimes.`,
            `Continuity balance: \\sum Q_{\\text{in}} - \\sum Q_{\\text{out}} = Q_{\\text{demand}}`
          ],
          unmodeledRisks: [
            `Transient water hammer from sudden valve closures is unmodeled.`,
            `Underground soil corrosive conditions and pipe wall degradation are not simulated.`
          ],
          governingEquations: `h_f = f \\cdot \\frac{L}{D} \\cdot \\frac{v^2}{2g} \\quad \\text{and} \\quad P = \\rho g (H - z)`
        }
      });
    });

    // Check Pipes (Flow / Velocity / Headloss)
    scenario.waterNetwork.pipes.forEach((pipe) => {
      const basePipe = baseOut.pipeResults[pipe.id];
      const altPipe = altOut.pipeResults[pipe.id];
      if (!basePipe || !altPipe) return;

      const isDirect = modifiedTargetIds.has(pipe.id);
      const mod = alternative?.modifications.find((m) => m.targetId === pipe.id);
      const flowDelta = altPipe.flowM3s - basePipe.flowM3s;

      if (!isDirect && Math.abs(flowDelta) < 0.005) {
        totalUnchanged++;
        return;
      }

      const category: ChangeCategory = isDirect ? 'directly-modified' : flowDelta > 0 ? 'newly-affected' : 'improved';
      const connected = DigitalTwinAdapters.getConnectedAssets(scenario, pipe.id);

      changes.push({
        id: pipe.id,
        assetName: `Pipe ${pipe.id} (${pipe.fromNodeId} → ${pipe.toNodeId})`,
        category,
        categoryLabel: isDirect ? 'Directly Modified Pipe' : 'Flow Re-routed',
        domain: 'water',
        locationDescription: `Pipeline Linking ${pipe.fromNodeId} ↔ ${pipe.toNodeId}`,
        metricLabel: 'Pipe Flow Rate',
        unit: 'm³/s',
        beforeValue: basePipe.flowM3s,
        afterValue: altPipe.flowM3s,
        delta: flowDelta,
        deltaPct: Math.round((flowDelta / Math.max(0.001, Math.abs(basePipe.flowM3s))) * 100),
        isDirectModification: isDirect,
        interventionLabel: mod?.label,
        connectedAssetIds: connected.connectedIds,
        connectedAssetNames: connected.connectedIds,
        explanation: {
          whatChanged: isDirect ? `Pipe diameter or roughness upgraded: ${mod?.label || 'Upgraded geometry'}` : `Flow volume shifted due to network head redistribution.`,
          whereChanged: `Transmission main ${pipe.id} between ${pipe.fromNodeId} and ${pipe.toNodeId}.`,
          situationBefore: `Baseline flow: ${basePipe.flowM3s.toFixed(3)} m³/s with velocity ${basePipe.velocityMs.toFixed(2)} m/s.`,
          situationAfter: `Alternative flow: ${altPipe.flowM3s.toFixed(3)} m³/s with velocity ${altPipe.velocityMs.toFixed(2)} m/s.`,
          whyHappened: `Head differentials across connected junctions dictate flow rate via Darcy-Weisbach law.`,
          directBenefit: `Reduces overall corridor head loss to ${altPipe.headLossM.toFixed(2)} m.`,
          negativeOrSecondaryEffects: altPipe.velocityMs > 2.0 ? `Velocity exceeds 2.0 m/s threshold; check scouring and noise.` : `None.`,
          connectedAssetsAffected: connected.description,
          watchOutFor: `Monitor pipe wall scour if velocities exceed design limits.`,
          practicalTakeaway: `Maintains adequate conveying capacity across the pressure zone.`,
          calculatedResults: [
            `Flow: ${basePipe.flowM3s.toFixed(3)} → ${altPipe.flowM3s.toFixed(3)} m³/s`,
            `Velocity: ${basePipe.velocityMs.toFixed(2)} → ${altPipe.velocityMs.toFixed(2)} m/s`,
            `Head Loss: ${basePipe.headLossM.toFixed(2)} → ${altPipe.headLossM.toFixed(2)} m`
          ],
          inferredExplanations: [`Friction factor derived iteratively via Colebrook-White equation.`],
          unmodeledRisks: [`Biofilm buildup and pipe internal tuberculation are unmodeled.`],
          governingEquations: `Q = A \\cdot v \\quad \\text{and} \\quad \\Delta H = f \\cdot \\frac{L}{D} \\frac{v^2}{2g}`
        }
      });
    });
  }

  // ==========================================
  // DOMAIN 3: ELECTRICAL ENERGY (B-Matrix DC Flow)
  // ==========================================
  else if (
    scenario.domain === 'energy' &&
    scenario.powerNetwork &&
    baseline.rawOutput.domain === 'energy' &&
    altResult.rawOutput.domain === 'energy'
  ) {
    const baseOut = baseline.rawOutput.result;
    const altOut = altResult.rawOutput.result;

    totalEvaluated = scenario.powerNetwork.lines.length;

    scenario.powerNetwork.lines.forEach((line) => {
      const baseFlow = baseOut.lineFlowsMw[line.id];
      const altFlow = altOut.lineFlowsMw[line.id];
      if (!baseFlow || !altFlow) return;

      const baseLoad = baseFlow.loadingPct;
      const altLoad = altFlow.loadingPct;
      const loadDelta = altLoad - baseLoad;
      const isDirect = modifiedTargetIds.has(line.id);
      const mod = alternative?.modifications.find((m) => m.targetId === line.id);

      if (altLoad > 100) {
        remainingViolations++;
      }

      if (!isDirect && Math.abs(loadDelta) < 1.0) {
        totalUnchanged++;
        return;
      }

      let category: ChangeCategory = 'directly-modified';
      let categoryLabel = 'Directly Modified Line';

      if (isDirect) {
        category = 'directly-modified';
        categoryLabel = 'Re-conductored / Added Line';
      } else if (altLoad <= 100 && baseLoad > 100) {
        category = 'improved';
        categoryLabel = 'Thermal Overload Alleviated';
      } else if (loadDelta < -3.0) {
        category = 'improved';
        categoryLabel = 'Reduced Line Loading';
      } else if (altLoad > 100) {
        category = 'degraded';
        categoryLabel = 'Thermal Rating Exceeded (>100%)';
      } else if (loadDelta > 3.0) {
        category = 'newly-affected';
        categoryLabel = 'Loop Flow Redistribution';
      } else {
        category = 'newly-affected';
        categoryLabel = 'Flow Redistribution';
      }

      const connected = DigitalTwinAdapters.getConnectedAssets(scenario, line.id);

      changes.push({
        id: line.id,
        assetName: `Corridor ${line.id} (${line.fromBusId} ↔ ${line.toBusId})`,
        category,
        categoryLabel,
        domain: 'energy',
        locationDescription: `Transmission Path ${line.fromBusId} ↔ ${line.toBusId}`,
        metricLabel: 'Thermal Loading',
        unit: '%',
        beforeValue: baseLoad,
        afterValue: altLoad,
        delta: loadDelta,
        deltaPct: Math.round(loadDelta),
        isDirectModification: isDirect,
        interventionLabel: mod?.label,
        connectedAssetIds: connected.connectedIds,
        connectedAssetNames: connected.connectedIds,
        explanation: {
          whatChanged: isDirect
            ? `Transmission capacity re-rated or reactance reduced: ${mod?.label || 'Upgraded line rating'}.`
            : `Power flow redirected across transmission loops in accordance with Kirchhoff's voltage laws.`,
          whereChanged: `Transmission corridor ${line.id} between bus ${line.fromBusId} and bus ${line.toBusId}. Thermal rating: ${line.thermalRatingMw} MW.`,
          situationBefore: `Baseline loading was ${baseLoad.toFixed(1)}% of thermal rating (${baseFlow.flowMw.toFixed(1)} MW flow).`,
          situationAfter: `Alternative loading is ${altLoad.toFixed(1)}% of thermal rating (${altFlow.flowMw.toFixed(1)} MW flow).`,
          whyHappened: `Linearized DC Power Flow calculates line power purely as P_{ij} = (\\theta_i - \\theta_j) / x_{ij}. Reducing line reactance or adding parallel capacity shifts flow onto lower impedance paths.`,
          directBenefit: altLoad <= 100
            ? `Alleviates thermal overheating and eliminates transmission line trip risk.`
            : `Increases bulk power transfer margin.`,
          negativeOrSecondaryEffects: loadDelta > 0
            ? `Adjacent corridor absorbed an extra ${Math.abs(altFlow.flowMw - baseFlow.flowMw).toFixed(1)} MW of redirected power.`
            : `None.`,
          connectedAssetsAffected: connected.description,
          watchOutFor: `Monitor downstream substation bus angles for high angular separation (potential transient stability issue).`,
          practicalTakeaway: altLoad <= 100
            ? `Thermal bottleneck resolved within allowable MW rating.`
            : `Corridor requires additional conductor capacity or generation re-dispatch.`,
          calculatedResults: [
            `Loading: ${baseLoad.toFixed(1)}% → ${altLoad.toFixed(1)}% (Delta: ${loadDelta >= 0 ? `+${loadDelta.toFixed(1)}%` : `${loadDelta.toFixed(1)}%`})`,
            `Power Flow: ${baseFlow.flowMw.toFixed(1)} MW → ${altFlow.flowMw.toFixed(1)} MW (Rating: ${line.thermalRatingMw} MW)`,
            `Estimated I²R losses: ${altFlow.estimatedLossesMw?.toFixed(2) ?? 'N/A'} MW`
          ],
          inferredExplanations: [
            `B-Matrix nodal admittance: B \\cdot \\theta = P`,
            `Flow follows the path of least electrical reactance.`
          ],
          unmodeledRisks: [
            `Voltage magnitudes |V| and reactive power (MVAR) are unmodeled (requires full AC Newton-Raphson power flow).`,
            `Transient rotor angle stability and protection relay trip timing are not simulated.`
          ],
          governingEquations: `P_{ij} = \\frac{\\theta_i - \\theta_j}{x_{ij}} \\quad \\text{and} \\quad B \\cdot \\theta = P_{\\text{injections}}`
        }
      });
    });
  }

  // Summary counts
  const totalModified = changes.filter((c) => c.category === 'directly-modified').length;
  const totalImproved = changes.filter((c) => c.category === 'improved').length;
  const totalDegraded = changes.filter((c) => c.category === 'degraded').length;
  const totalNewlyAffected = changes.filter((c) => c.category === 'newly-affected').length;

  const isFeasible = remainingViolations === 0 && altResult.feasible;
  const feasibilityStatus: 'FEASIBLE' | 'VIOLATIONS_REMAIN' | 'INCOMPLETE' = isFeasible
    ? 'FEASIBLE'
    : altResult.feasibilityStatus === 'incomplete'
      ? 'INCOMPLETE'
      : 'VIOLATIONS_REMAIN';

  const feasibilityReason = isFeasible
    ? 'All governing engineering constraints and safety limits are satisfied in this alternative.'
    : remainingViolations > 0
      ? `${remainingViolations} active constraint violation(s) remain unmitigated.`
      : 'Incomplete feasibility validation.';

  const primaryMetricSummary = {
    label:
      scenario.domain === 'traffic'
        ? 'Corridor Average Speed (All 16 Segments)'
        : scenario.domain === 'water'
          ? 'System Minimum Pressure (All Junctions)'
          : 'Max Line Thermal Loading (All Corridors)',
    before: baseline.metrics.primaryPerformance,
    after: altResult.metrics.primaryPerformance,
    unit: baseline.metrics.primaryPerformanceUnit,
    deltaPct: Math.round(
      ((altResult.metrics.primaryPerformance - baseline.metrics.primaryPerformance) /
        Math.max(0.001, Math.abs(baseline.metrics.primaryPerformance))) *
        100
    )
  };

  return {
    changes,
    summary: {
      totalAssetsEvaluated: totalEvaluated,
      totalModified,
      totalImproved,
      totalDegraded,
      totalNewlyAffected,
      totalUnchanged,
      remainingViolations,
      feasibilityStatus,
      feasibilityReason,
      primaryMetricSummary
    }
  };
}
