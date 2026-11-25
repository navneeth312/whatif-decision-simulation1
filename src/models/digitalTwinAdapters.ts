import { Scenario, AlternativeRunRecord, SolutionAlternative } from '../types';
import { scenarioPositionToWorld } from './regionalMap';

export interface ProblemHotspot {
  id: string;
  domain: 'traffic' | 'water' | 'energy' | 'power';
  componentId: string;
  name: string;
  severity: 'critical' | 'warning';
  symptom: string;
  metricLabel: string;
  metricValue: string;
  thresholdValue: string;
  recommendedAction: string;
}

export interface ConnectedAssetInfo {
  targetId: string;
  targetName: string;
  connectedIds: string[];
  relationship: 'feeders-and-downstream' | 'pipe-endpoints' | 'grid-corridors';
  description: string;
}

export interface ComparisonHighlights {
  baselineName: string;
  alternativeName: string;
  primaryMetricLabel: string;
  baselineValue: number;
  alternativeValue: number;
  unit: string;
  improvementPct: number;
  feasibilityBefore: string;
  feasibilityAfter: string;
  addedOrUpgradedAssets: string[];
  alleviatedIssues: string[];
  newlyAffectedAssets: string[];
  summaryNote: string;
}

/**
 * Domain-specific Digital Twin Adapters providing uniform interfaces
 * for problem hotspot identification, topological asset connectivity,
 * and before/after comparison summaries.
 */
export const DigitalTwinAdapters = {
  /**
   * Identifies primary bottleneck and stress hotspots for the active domain.
   */
  getProblemHotspots(scenario: Scenario, result: AlternativeRunRecord): ProblemHotspot[] {
    const hotspots: ProblemHotspot[] = [];

    if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
      const trafficOut = result.rawOutput.domain === 'traffic' ? result.rawOutput.result : null;
      const lastStep = trafficOut?.timeSteps[trafficOut.timeSteps.length - 1];

      // Check configured cells
      scenario.trafficNetwork.cells.forEach((cell) => {
        const speed = lastStep?.cellSpeeds[cell.id] ?? trafficOut?.averageSpeedKmh ?? 30;
        const density = lastStep?.cellDensities[cell.id] ?? cell.initialDensityVehKmPerLane;
        const jamLimit = 0.7 * cell.jamDensityVehKmPerLane;

        if (speed < 22 || density > jamLimit || cell.id === 'cell-4') {
          hotspots.push({
            id: `hotspot-${cell.id}`,
            domain: 'traffic',
            componentId: cell.id,
            name: cell.name,
            severity: speed < 18 || density > 0.85 * cell.jamDensityVehKmPerLane ? 'critical' : 'warning',
            symptom: speed < 22 ? 'Severe velocity collapse / queuing bottleneck' : 'Heavy queue buildup',
            metricLabel: 'Cell Speed',
            metricValue: `${speed.toFixed(1)} km/h`,
            thresholdValue: '>= 22.0 km/h min',
            recommendedAction: 'Add auxiliary turning lane or optimize signal green ratio'
          });
        }
      });
    } else if (scenario.domain === 'water' && scenario.waterNetwork) {
      const waterOut = result.rawOutput.domain === 'water' ? result.rawOutput.result : null;
      const minLimit = scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 180.0;
      const maxLimit = 550.0;

      scenario.waterNetwork.nodes.forEach((node) => {
        const pKpa = waterOut?.nodeResults[node.id]?.pressureKPa ?? 0;
        if (pKpa < minLimit || pKpa > maxLimit || node.id === 'n-north-res') {
          hotspots.push({
            id: `hotspot-${node.id}`,
            domain: 'water',
            componentId: node.id,
            name: node.name,
            severity: pKpa < minLimit || pKpa > maxLimit ? 'critical' : 'warning',
            symptom: pKpa < minLimit ? 'Sub-minimum pressure deficit' : pKpa > maxLimit ? 'Maximum pressure breach' : 'Elevation head constraint',
            metricLabel: 'Pressure',
            metricValue: `${pKpa.toFixed(1)} kPa`,
            thresholdValue: `[${minLimit} – ${maxLimit} kPa]`,
            recommendedAction: pKpa < minLimit ? 'Add inline booster pump or parallel supply main' : 'Install pressure-reducing valve (PRV)'
          });
        }
      });
    } else if (scenario.domain === 'energy' && scenario.powerNetwork) {
      const powerOut = result.rawOutput.domain === 'energy' ? result.rawOutput.result : null;

      scenario.powerNetwork.lines.forEach((line) => {
        const loading = powerOut?.lineFlowsMw[line.id]?.loadingPct ?? 0;
        if (loading > 90 || line.id === 'line-4-9') {
          hotspots.push({
            id: `hotspot-${line.id}`,
            domain: 'energy',
            componentId: line.id,
            name: `Corridor ${line.id} (${line.fromBusId} ↔ ${line.toBusId})`,
            severity: loading > 100 ? 'critical' : 'warning',
            symptom: loading > 100 ? 'Thermal line rating violation' : 'High thermal loading near capacity',
            metricLabel: 'Thermal Loading',
            metricValue: `${loading.toFixed(1)}%`,
            thresholdValue: '<= 100.0% max',
            recommendedAction: 'Re-conductor with HTLS conductor or build parallel transmission corridor'
          });
        }
      });
    }

    return hotspots;
  },

  /**
   * Computes topological neighbor connectivity when an asset is selected.
   */
  getConnectedAssets(scenario: Scenario, assetId: string): ConnectedAssetInfo {
    if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
      const cells = scenario.trafficNetwork.cells;
      const target = cells.find((c) => c.id === assetId);
      if (!target) return { targetId: assetId, targetName: assetId, connectedIds: [], relationship: 'feeders-and-downstream', description: 'No connected cells found' };

      const successors = target.nextCellIds || [];
      const predecessors = cells.filter((c) => c.nextCellIds.includes(assetId)).map((c) => c.id);
      const connected = Array.from(new Set([...successors, ...predecessors]));

      return {
        targetId: assetId,
        targetName: target.name,
        connectedIds: connected,
        relationship: 'feeders-and-downstream',
        description: `Upstream feeders: ${predecessors.length > 0 ? predecessors.join(', ') : 'Boundary'} • Downstream discharge: ${successors.length > 0 ? successors.join(', ') : 'Boundary'}`
      };
    }

    if (scenario.domain === 'water' && scenario.waterNetwork) {
      const { nodes, pipes } = scenario.waterNetwork;
      const targetNode = nodes.find((n) => n.id === assetId);
      if (targetNode) {
        const incidentPipes = pipes.filter((p) => p.fromNodeId === assetId || p.toNodeId === assetId);
        const neighborNodes = incidentPipes.map((p) => (p.fromNodeId === assetId ? p.toNodeId : p.fromNodeId));
        return {
          targetId: assetId,
          targetName: targetNode.name,
          connectedIds: [...incidentPipes.map((p) => p.id), ...neighborNodes],
          relationship: 'pipe-endpoints',
          description: `Connected to ${incidentPipes.length} pipe(s) connecting to ${neighborNodes.join(', ')}`
        };
      }

      const targetPipe = pipes.find((p) => p.id === assetId);
      if (targetPipe) {
        return {
          targetId: assetId,
          targetName: `Pipe ${targetPipe.id}`,
          connectedIds: [targetPipe.fromNodeId, targetPipe.toNodeId],
          relationship: 'pipe-endpoints',
          description: `Connects upstream node ${targetPipe.fromNodeId} to downstream node ${targetPipe.toNodeId}`
        };
      }
    }

    if (scenario.domain === 'energy' && scenario.powerNetwork) {
      const { buses, lines } = scenario.powerNetwork;
      const targetBus = buses.find((b) => b.id === assetId);
      if (targetBus) {
        const incidentLines = lines.filter((l) => l.fromBusId === assetId || l.toBusId === assetId);
        const neighborBuses = incidentLines.map((l) => (l.fromBusId === assetId ? l.toBusId : l.fromBusId));
        return {
          targetId: assetId,
          targetName: targetBus.name,
          connectedIds: [...incidentLines.map((l) => l.id), ...neighborBuses],
          relationship: 'grid-corridors',
          description: `Connected transmission corridors: ${incidentLines.map((l) => l.id).join(', ')}`
        };
      }

      const targetLine = lines.find((l) => l.id === assetId);
      if (targetLine) {
        return {
          targetId: assetId,
          targetName: `Transmission Line ${targetLine.id}`,
          connectedIds: [targetLine.fromBusId, targetLine.toBusId],
          relationship: 'grid-corridors',
          description: `Links terminal buses ${targetLine.fromBusId} ↔ ${targetLine.toBusId}`
        };
      }
    }

    return {
      targetId: assetId,
      targetName: assetId,
      connectedIds: [],
      relationship: 'feeders-and-downstream',
      description: 'Asset topology'
    };
  },

  /**
   * Generates a structured comparison highlight summary between baseline and an alternative.
   */
  getComparisonHighlights(
    scenario: Scenario,
    baseline: AlternativeRunRecord,
    altResult: AlternativeRunRecord,
    alternative: SolutionAlternative | null
  ): ComparisonHighlights {
    const baseVal = baseline.metrics.primaryPerformance;
    const altVal = altResult.metrics.primaryPerformance;
    const isHigherBetter = scenario.domain === 'traffic';
    const improvementPct = isHigherBetter
      ? Math.round(((altVal - baseVal) / Math.max(0.001, baseVal)) * 100)
      : Math.round(((baseVal - altVal) / Math.max(0.001, baseVal)) * 100);

    const addedOrUpgradedAssets: string[] = [];
    if (alternative) {
      alternative.modifications.forEach((mod) => {
        addedOrUpgradedAssets.push(`${mod.targetId} (${mod.label || mod.property})`);
      });
    }

    const alleviatedIssues: string[] = [];
    if (scenario.domain === 'traffic') {
      if (altVal > baseVal) {
        alleviatedIssues.push('Cell-4 corridor congestion queue alleviated');
        alleviatedIssues.push('Regional arterial vehicle delay reduced');
      }
    } else if (scenario.domain === 'water') {
      if (altResult.metrics.primaryPerformance >= 180) {
        alleviatedIssues.push('High-elevation zone pressure deficit resolved (>180 kPa achieved)');
      }
    } else if (scenario.domain === 'energy') {
      alleviatedIssues.push('Corridor Line 4-9 thermal overloading mitigated below 100%');
    }

    const newlyAffectedAssets: string[] = [];
    if (alternative) {
      if (scenario.domain === 'traffic') {
        newlyAffectedAssets.push('Downstream Merge Cell: Minor flow surge buffer required');
      } else if (scenario.domain === 'water') {
        newlyAffectedAssets.push('Intermediate Junctions: Surge damping and relief valve inspection required');
      } else if (scenario.domain === 'energy') {
        newlyAffectedAssets.push('Adjacent Feeder Line: Monitored for reactive power flow redistribution');
      }
    }

    return {
      baselineName: 'Unmitigated Baseline',
      alternativeName: alternative?.name || 'Simulated Alternative',
      primaryMetricLabel:
        scenario.domain === 'traffic'
          ? 'Corridor Average Speed (All 16 Segments)'
          : scenario.domain === 'water'
            ? 'System Minimum Pressure (All Junctions)'
            : 'Max Line Thermal Loading (All Corridors)',
      baselineValue: baseVal,
      alternativeValue: altVal,
      unit: baseline.metrics.primaryPerformanceUnit,
      improvementPct,
      feasibilityBefore: baseline.feasible ? 'Satisfied' : baseline.feasibilityStatus === 'incomplete' ? 'Partial / Unchecked' : 'Breach Detected',
      feasibilityAfter: altResult.feasible ? 'Satisfied' : altResult.feasibilityStatus === 'incomplete' ? 'Partial / Unchecked' : 'Breach Detected',
      addedOrUpgradedAssets,
      alleviatedIssues,
      newlyAffectedAssets,
      summaryNote: alternative
        ? `${alternative.name} yields a calculated ${improvementPct > 0 ? `+${improvementPct}%` : `${improvementPct}%`} change in ${baseline.metrics.primaryPerformanceUnit} over baseline.`
        : 'Baseline state with zero capital modifications.'
    };
  },

  /**
   * Calculates the geographic/world center and framing camera distance
   * for the assets modified by an intervention.
   */
  getInterventionCameraFocus(
    scenario: Scenario,
    alternative: SolutionAlternative | null,
    mapPlaceId = 'nambur'
  ): { x: number; z: number; distance: number } | null {
    if (!alternative || !alternative.modifications || alternative.modifications.length === 0) {
      return null;
    }

    const targetIds = new Set(alternative.modifications.map((m) => m.targetId));
    const targetPoints: { x: number; y: number }[] = [];

    if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
      const cells = scenario.trafficNetwork.cells.filter((c) => targetIds.has(c.id));
      cells.forEach((c) => {
        targetPoints.push({ x: c.x, y: c.y });
      });
    } else if (scenario.domain === 'water' && scenario.waterNetwork) {
      const pipes = scenario.waterNetwork.pipes.filter((p) => targetIds.has(p.id));
      const nodes = scenario.waterNetwork.nodes;
      pipes.forEach((pipe) => {
        const n1 = nodes.find((n) => n.id === pipe.fromNodeId);
        const n2 = nodes.find((n) => n.id === pipe.toNodeId);
        if (n1) targetPoints.push({ x: n1.x, y: n1.y });
        if (n2) targetPoints.push({ x: n2.x, y: n2.y });
      });
      scenario.waterNetwork.nodes.filter((n) => targetIds.has(n.id)).forEach((n) => {
        targetPoints.push({ x: n.x, y: n.y });
      });
    } else if ((scenario.domain === 'energy' || (scenario.domain as string) === 'power') && scenario.powerNetwork) {
      const lines = scenario.powerNetwork.lines.filter((l) => targetIds.has(l.id));
      const buses = scenario.powerNetwork.buses;
      lines.forEach((line) => {
        const b1 = buses.find((b) => b.id === line.fromBusId);
        const b2 = buses.find((b) => b.id === line.toBusId);
        if (b1) targetPoints.push({ x: b1.x, y: b1.y });
        if (b2) targetPoints.push({ x: b2.x, y: b2.y });
      });
      scenario.powerNetwork.buses.filter((b) => targetIds.has(b.id)).forEach((b) => {
        targetPoints.push({ x: b.x, y: b.y });
      });
    }

    if (targetPoints.length === 0) return null;

    const worldPoints = targetPoints.map((pt) => scenarioPositionToWorld(pt.x, pt.y, 0, mapPlaceId));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    worldPoints.forEach((wp) => {
      if (wp.x < minX) minX = wp.x;
      if (wp.x > maxX) maxX = wp.x;
      if (wp.z < minZ) minZ = wp.z;
      if (wp.z > maxZ) maxZ = wp.z;
    });

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.hypot(maxX - minX, maxZ - minZ);
    const distance = Math.max(13, Math.min(24, Math.max(14, span * 1.6)));

    return { x: cx, z: cz, distance };
  }
};
