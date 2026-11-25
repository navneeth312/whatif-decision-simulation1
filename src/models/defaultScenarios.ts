import {
  Scenario,
  ProblemStatement,
  WaterNetwork,
  PowerGridNetwork,
  TrafficNetwork,
  ParameterModification
} from '../types';

export const BASE_TRAFFIC_NETWORK: TrafficNetwork = {
  timeStepSeconds: 5,
  totalSteps: 28,
  cells: [
    { id: 'cell-nw-in', name: 'North Arterial Inflow', x: 12, y: 14, z: 0, lengthKm: 0.65, lanes: 2, freeFlowSpeedKmh: 56, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 20, initialDensityVehKmPerLane: 78, nextCellIds: ['cell-hub-1'], inflowDemandVehHour: 2450 },
    { id: 'cell-hub-1', name: 'NW Campus Gateway Intersection', x: 24, y: 22, z: 1, lengthKm: 0.30, lanes: 2, freeFlowSpeedKmh: 45, jamDensityVehKmPerLane: 140, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 102, signalGreenRatio: 0.48, nextCellIds: ['cell-campus-main', 'cell-ring-north'] },
    { id: 'cell-campus-main', name: 'VVITU Central Boulevard', x: 38, y: 32, z: 2, lengthKm: 0.50, lanes: 2, freeFlowSpeedKmh: 42, jamDensityVehKmPerLane: 135, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 98, nextCellIds: ['cell-hub-2'] },
    { id: 'cell-hub-2', name: 'University Plaza Main Intersection', x: 50, y: 42, z: 2, lengthKm: 0.32, lanes: 2, freeFlowSpeedKmh: 38, jamDensityVehKmPerLane: 140, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 112, signalGreenRatio: 0.44, nextCellIds: ['cell-ring-south', 'cell-east-corridor', 'cell-transit-spine'] },
    { id: 'cell-ring-north', name: 'North Ring Road Arterial', x: 36, y: 58, z: 3, lengthKm: 0.65, lanes: 2, freeFlowSpeedKmh: 46, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 64, nextCellIds: ['cell-hub-3'] },
    { id: 'cell-hub-3', name: 'North Ring & Hospital Junction', x: 26, y: 74, z: 2, lengthKm: 0.30, lanes: 2, freeFlowSpeedKmh: 40, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 72, signalGreenRatio: 0.52, nextCellIds: ['cell-transit-spine', 'cell-west-conn'] },
    { id: 'cell-ring-south', name: 'South Campus Parkway', x: 64, y: 54, z: 1, lengthKm: 0.70, lanes: 2, freeFlowSpeedKmh: 46, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 58, nextCellIds: ['cell-hub-4'] },
    { id: 'cell-hub-4', name: 'South Tech Park Intersection', x: 76, y: 66, z: 1, lengthKm: 0.30, lanes: 2, freeFlowSpeedKmh: 40, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 62, signalGreenRatio: 0.54, nextCellIds: ['cell-hub-6', 'cell-se-arterial'] },
    { id: 'cell-east-corridor', name: 'East Commercial Expressway', x: 68, y: 28, z: 1, lengthKm: 0.75, lanes: 2, freeFlowSpeedKmh: 50, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 20, initialDensityVehKmPerLane: 54, nextCellIds: ['cell-hub-5'] },
    { id: 'cell-hub-5', name: 'East Gateway Intersection', x: 82, y: 18, z: 0, lengthKm: 0.30, lanes: 2, freeFlowSpeedKmh: 45, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 20, initialDensityVehKmPerLane: 48, signalGreenRatio: 0.58, nextCellIds: ['cell-ne-bypass'] },
    { id: 'cell-transit-spine', name: 'Central Transit Spine', x: 50, y: 64, z: 2, lengthKm: 0.50, lanes: 2, freeFlowSpeedKmh: 38, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 65, nextCellIds: ['cell-hub-6'] },
    { id: 'cell-hub-6', name: 'South Transit Terminal Intersection', x: 52, y: 84, z: 0, lengthKm: 0.35, lanes: 2, freeFlowSpeedKmh: 38, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 52, signalGreenRatio: 0.60, nextCellIds: ['cell-south-exit'] },
    { id: 'cell-west-conn', name: 'West Innovation Connector', x: 14, y: 50, z: 1, lengthKm: 0.60, lanes: 2, freeFlowSpeedKmh: 48, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 50, nextCellIds: ['cell-hub-7'], inflowDemandVehHour: 1100 },
    { id: 'cell-hub-7', name: 'West Science Gate Signal', x: 20, y: 38, z: 1, lengthKm: 0.30, lanes: 2, freeFlowSpeedKmh: 42, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 66, signalGreenRatio: 0.52, nextCellIds: ['cell-campus-main'] },
    { id: 'cell-ne-bypass', name: 'Northeast Freight & Rail Overpass', x: 88, y: 40, z: 1, lengthKm: 0.70, lanes: 2, freeFlowSpeedKmh: 52, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 20, initialDensityVehKmPerLane: 44, nextCellIds: ['cell-hub-8'] },
    { id: 'cell-hub-8', name: 'East Industrial Beltway Signal', x: 86, y: 56, z: 1, lengthKm: 0.32, lanes: 2, freeFlowSpeedKmh: 44, jamDensityVehKmPerLane: 130, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 55, signalGreenRatio: 0.56, nextCellIds: ['cell-se-arterial'] },
    { id: 'cell-se-arterial', name: 'Southeast Riverfront Arterial', x: 82, y: 82, z: 0, lengthKm: 0.65, lanes: 2, freeFlowSpeedKmh: 50, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 18, initialDensityVehKmPerLane: 40, nextCellIds: [] },
    { id: 'cell-south-exit', name: 'South Highway Interchange Ramp', x: 38, y: 90, z: 0, lengthKm: 0.60, lanes: 2, freeFlowSpeedKmh: 55, jamDensityVehKmPerLane: 125, backwardWaveSpeedKmh: 20, initialDensityVehKmPerLane: 38, nextCellIds: [] }
  ]
};

export const BASE_WATER_NETWORK: WaterNetwork = {
  waterDensityKgM3: 1000,
  gravityMs2: 9.81,
  dynamicViscosityPaS: 1.002e-3,
  nodes: [
    { id: 'res-east', name: 'East Mountain Gravity Reservoir', type: 'reservoir', elevation: 180, baseDemand: 0, head: 230, x: 12, y: 18, z: 15 },
    { id: 'tank-high', name: 'North Ridge Elevated Storage Tank', type: 'tank', elevation: 138, baseDemand: 0.006, x: 78, y: 16, z: 14 },
    { id: 'pump-station-1', name: 'Valley Primary Booster Pump', type: 'pump', elevation: 115, baseDemand: 0.01, x: 28, y: 26, z: 6 },
    { id: 'valve-prv-1', name: 'Ridge Pressure Regulating Valve', type: 'valve', elevation: 142, baseDemand: 0.01, x: 56, y: 24, z: 9 },
    { id: 'junc-valley', name: 'Valley Distribution Hub', type: 'junction', elevation: 112, baseDemand: 0.075, x: 42, y: 36, z: 5 },
    { id: 'junc-ridge', name: 'North Ridge Residential Zone', type: 'junction', elevation: 163.7, baseDemand: 0.062, x: 72, y: 32, z: 12 },
    { id: 'junc-south', name: 'South Hillside Colony', type: 'junction', elevation: 156, baseDemand: 0.055, x: 48, y: 74, z: 9 },
    { id: 'junc-west', name: 'West Commercial District', type: 'junction', elevation: 122, baseDemand: 0.065, x: 24, y: 66, z: 6 },
    { id: 'junc-east', name: 'East Industrial Estate', type: 'junction', elevation: 128, baseDemand: 0.06, x: 86, y: 46, z: 7 },
    { id: 'junc-central', name: 'Central Municipal Core', type: 'junction', elevation: 132, baseDemand: 0.055, x: 58, y: 52, z: 8 },
    { id: 'junc-north', name: 'North Foothills Terrace', type: 'junction', elevation: 152, baseDemand: 0.04, x: 42, y: 16, z: 10 },
    { id: 'junc-hospital', name: 'Regional Medical Center Junction', type: 'junction', elevation: 138, baseDemand: 0.045, x: 34, y: 52, z: 7 },
    { id: 'junc-campus', name: 'University Research Park Node', type: 'junction', elevation: 136, baseDemand: 0.04, x: 68, y: 68, z: 7 },
    { id: 'junc-park', name: 'Botanical Greenway Node', type: 'junction', elevation: 124, baseDemand: 0.03, x: 20, y: 44, z: 5 },
    { id: 'junc-tech', name: 'Semiconductor Fab Supply Node', type: 'junction', elevation: 130, baseDemand: 0.05, x: 86, y: 68, z: 6 },
    { id: 'junc-harbor', name: 'Lower Riverfront Terminal', type: 'junction', elevation: 108, baseDemand: 0.04, x: 70, y: 86, z: 4 }
  ],
  pipes: [
    // Absolute roughness values are synthetic calibration values that preserve the
    // earlier illustrative operating point; they are not surveyed material data.
    { id: 'pipe-trunk-1', fromNodeId: 'res-east', toNodeId: 'pump-station-1', length: 950, diameter: 0.48, absoluteRoughnessMm: 0.50271 },
    { id: 'pipe-pump-boost', fromNodeId: 'pump-station-1', toNodeId: 'junc-valley', length: 650, diameter: 0.44, absoluteRoughnessMm: 0.27163 },
    { id: 'pipe-valley-prv', fromNodeId: 'junc-valley', toNodeId: 'valve-prv-1', length: 780, diameter: 0.32, absoluteRoughnessMm: 1.73548 },
    { id: 'pipe-prv-ridge', fromNodeId: 'valve-prv-1', toNodeId: 'junc-ridge', length: 690, diameter: 0.215, absoluteRoughnessMm: 0.99642 },
    { id: 'pipe-ridge-tank', fromNodeId: 'junc-ridge', toNodeId: 'tank-high', length: 520, diameter: 0.24, absoluteRoughnessMm: 1.16689 },
    { id: 'pipe-valley-south', fromNodeId: 'junc-valley', toNodeId: 'junc-south', length: 880, diameter: 0.26, absoluteRoughnessMm: 0.86402 },
    { id: 'pipe-valley-central', fromNodeId: 'junc-valley', toNodeId: 'junc-central', length: 680, diameter: 0.34, absoluteRoughnessMm: 0.32594 },
    { id: 'pipe-central-east', fromNodeId: 'junc-central', toNodeId: 'junc-east', length: 820, diameter: 0.26, absoluteRoughnessMm: 0.73118 },
    { id: 'pipe-south-west', fromNodeId: 'junc-south', toNodeId: 'junc-west', length: 760, diameter: 0.24, absoluteRoughnessMm: 1.14823 },
    { id: 'pipe-west-central', fromNodeId: 'junc-west', toNodeId: 'junc-central', length: 720, diameter: 0.26, absoluteRoughnessMm: 0.81422 },
    { id: 'pipe-pump-north', fromNodeId: 'pump-station-1', toNodeId: 'junc-north', length: 610, diameter: 0.28, absoluteRoughnessMm: 0.42272 },
    { id: 'pipe-north-prv', fromNodeId: 'junc-north', toNodeId: 'valve-prv-1', length: 590, diameter: 0.25, absoluteRoughnessMm: 0.56749 },
    { id: 'pipe-valley-hosp', fromNodeId: 'junc-valley', toNodeId: 'junc-hospital', length: 540, diameter: 0.28, absoluteRoughnessMm: 0.47732 },
    { id: 'pipe-hosp-west', fromNodeId: 'junc-hospital', toNodeId: 'junc-west', length: 580, diameter: 0.25, absoluteRoughnessMm: 0.46531 },
    { id: 'pipe-pump-park', fromNodeId: 'pump-station-1', toNodeId: 'junc-park', length: 620, diameter: 0.26, absoluteRoughnessMm: 0.39810 },
    { id: 'pipe-park-hosp', fromNodeId: 'junc-park', toNodeId: 'junc-hospital', length: 520, diameter: 0.24, absoluteRoughnessMm: 0.52962 },
    { id: 'pipe-central-campus', fromNodeId: 'junc-central', toNodeId: 'junc-campus', length: 640, diameter: 0.28, absoluteRoughnessMm: 0.40244 },
    { id: 'pipe-east-tech', fromNodeId: 'junc-east', toNodeId: 'junc-tech', length: 690, diameter: 0.25, absoluteRoughnessMm: 1.04605 },
    { id: 'pipe-campus-tech', fromNodeId: 'junc-campus', toNodeId: 'junc-tech', length: 560, diameter: 0.24, absoluteRoughnessMm: 0.69684 },
    { id: 'pipe-campus-harbor', fromNodeId: 'junc-campus', toNodeId: 'junc-harbor', length: 630, diameter: 0.24, absoluteRoughnessMm: 0.61966 }
  ]
};

export const BASE_POWER_NETWORK: PowerGridNetwork = {
  baseMva: 100,
  nominalPowerFactor: 0.95,
  buses: [
    { id: 'bus-1', name: 'North Thermal Plant (Slack Bus)', baseKv: 230, isSlack: true, hasTransformer: true, x: 14, y: 18, z: 0 },
    { id: 'bus-2', name: 'Central 230kV Switching Substation', baseKv: 230, isSubstation: true, hasTransformer: true, x: 42, y: 32, z: 2 },
    { id: 'bus-3', name: 'East Industrial Step-Down Substation', baseKv: 115, isSubstation: true, hasTransformer: true, x: 76, y: 34, z: 1 },
    { id: 'bus-4', name: 'South Metro Distribution Substation', baseKv: 115, isSubstation: true, hasTransformer: true, x: 48, y: 68, z: 2 },
    { id: 'bus-5', name: 'West Valley Gas Peaker Bus', baseKv: 115, x: 18, y: 62, z: 0 },
    { id: 'bus-6', name: 'High-Tech Fab & Data Center Bus', baseKv: 115, x: 74, y: 64, z: 2 },
    { id: 'bus-7', name: 'North Valley Intertie Substation', baseKv: 230, isSubstation: true, hasTransformer: true, x: 28, y: 14, z: 1 },
    { id: 'bus-8', name: 'Northeast Wind & Solar Collector', baseKv: 115, x: 84, y: 14, z: 0 },
    { id: 'bus-9', name: 'Harbor Desalination & Port Bus', baseKv: 115, x: 86, y: 52, z: 1 },
    { id: 'bus-10', name: 'South Rail Traction Substation', baseKv: 115, isSubstation: true, x: 32, y: 84, z: 1 },
    { id: 'bus-11', name: 'University Microgrid Tie Bus', baseKv: 115, x: 62, y: 84, z: 1 },
    { id: 'bus-12', name: 'West Agritech Pumping Bus', baseKv: 115, x: 14, y: 40, z: 0 }
  ],
  generators: [
    { id: 'gen-slack-1', busId: 'bus-1', minMw: 50, maxMw: 400, scheduledMw: 215, costPerMwh: 44 },
    { id: 'gen-peaker-5', busId: 'bus-5', minMw: 10, maxMw: 140, scheduledMw: 55, costPerMwh: 76 },
    { id: 'gen-wind-8', busId: 'bus-8', minMw: 5, maxMw: 110, scheduledMw: 45, costPerMwh: 20 }
  ],
  loads: [
    { id: 'load-hub-2', busId: 'bus-2', mw: 32 },
    { id: 'load-ind-3', busId: 'bus-3', mw: 108 },
    { id: 'load-metro-4', busId: 'bus-4', mw: 68 },
    { id: 'load-tech-6', busId: 'bus-6', mw: 48 },
    { id: 'load-val-7', busId: 'bus-7', mw: 18 },
    { id: 'load-port-9', busId: 'bus-9', mw: 34 },
    { id: 'load-rail-10', busId: 'bus-10', mw: 26 },
    { id: 'load-univ-11', busId: 'bus-11', mw: 24 },
    { id: 'load-agri-12', busId: 'bus-12', mw: 18 }
  ],
  lines: [
    { id: 'line-1-2', fromBusId: 'bus-1', toBusId: 'bus-2', reactancePu: 0.042, resistancePu: 0.005, thermalRatingMw: 260 },
    { id: 'line-1-7', fromBusId: 'bus-1', toBusId: 'bus-7', reactancePu: 0.036, resistancePu: 0.004, thermalRatingMw: 220 },
    { id: 'line-7-2', fromBusId: 'bus-7', toBusId: 'bus-2', reactancePu: 0.040, resistancePu: 0.005, thermalRatingMw: 200 },
    { id: 'line-2-3', fromBusId: 'bus-2', toBusId: 'bus-3', reactancePu: 0.075, resistancePu: 0.012, thermalRatingMw: 55 },
    { id: 'line-2-4', fromBusId: 'bus-2', toBusId: 'bus-4', reactancePu: 0.058, resistancePu: 0.008, thermalRatingMw: 145 },
    { id: 'line-3-6', fromBusId: 'bus-3', toBusId: 'bus-6', reactancePu: 0.068, resistancePu: 0.010, thermalRatingMw: 95 },
    { id: 'line-6-4', fromBusId: 'bus-6', toBusId: 'bus-4', reactancePu: 0.054, resistancePu: 0.008, thermalRatingMw: 115 },
    { id: 'line-4-5', fromBusId: 'bus-4', toBusId: 'bus-5', reactancePu: 0.050, resistancePu: 0.007, thermalRatingMw: 120 },
    { id: 'line-5-2', fromBusId: 'bus-5', toBusId: 'bus-2', reactancePu: 0.062, resistancePu: 0.009, thermalRatingMw: 110 },
    { id: 'line-8-3', fromBusId: 'bus-8', toBusId: 'bus-3', reactancePu: 0.058, resistancePu: 0.008, thermalRatingMw: 115 },
    { id: 'line-7-8', fromBusId: 'bus-7', toBusId: 'bus-8', reactancePu: 0.072, resistancePu: 0.009, thermalRatingMw: 130 },
    { id: 'line-3-9', fromBusId: 'bus-3', toBusId: 'bus-9', reactancePu: 0.055, resistancePu: 0.007, thermalRatingMw: 90 },
    { id: 'line-9-6', fromBusId: 'bus-9', toBusId: 'bus-6', reactancePu: 0.060, resistancePu: 0.008, thermalRatingMw: 90 },
    { id: 'line-4-10', fromBusId: 'bus-4', toBusId: 'bus-10', reactancePu: 0.052, resistancePu: 0.007, thermalRatingMw: 95 },
    { id: 'line-4-11', fromBusId: 'bus-4', toBusId: 'bus-11', reactancePu: 0.056, resistancePu: 0.007, thermalRatingMw: 95 },
    { id: 'line-6-11', fromBusId: 'bus-6', toBusId: 'bus-11', reactancePu: 0.062, resistancePu: 0.008, thermalRatingMw: 90 },
    { id: 'line-1-12', fromBusId: 'bus-1', toBusId: 'bus-12', reactancePu: 0.048, resistancePu: 0.006, thermalRatingMw: 120 },
    { id: 'line-12-5', fromBusId: 'bus-12', toBusId: 'bus-5', reactancePu: 0.052, resistancePu: 0.007, thermalRatingMw: 110 }
  ]
};

export const PROBLEM_CATALOG: Record<'traffic' | 'water' | 'energy', ProblemStatement[]> = {
  traffic: [
    {
      id: 'prob-traffic-1',
      title: 'Campus Inflow Congestion & Ring Road Spillback',
      description: 'Morning peak commute (8–10 AM) causes bottleneck queuing at NW Campus Gateway and University Plaza intersections, pushing queue density above 70% jam density.',
      domain: 'traffic',
      affectedAssetIds: ['cell-hub-1', 'cell-campus-main', 'cell-hub-2'],
      measurableSymptom: 'Queue density exceeding 70% jam density (91–98 veh/km/lane) and intersection speed dropping below 22 km/h',
      thresholdConstraint: 'Minimum Peak Speed >= 22.0 km/h & Density <= 70% k_j',
      horizon: '5 Years (2026–2031)',
      units: 'km/h, veh/km/lane, veh/h',
      dataSource: 'Synthetic demo data — calibrated Cell Transmission Model v2.4',
      baselineInputsSummary: 'Inflow demand: 2,450 veh/h; Plaza signal green ratio: 0.44; 2 lanes per arterial link',
      available: true
    },
    {
      id: 'prob-traffic-2',
      title: 'East Commercial Corridor Signal Bottleneck',
      description: 'Heavy retail cross-traffic and restrictive signal timing on East Commercial Expressway creates severe upstream queuing into University Plaza.',
      domain: 'traffic',
      affectedAssetIds: ['cell-east-corridor', 'cell-hub-5', 'cell-hub-2'],
      measurableSymptom: 'East Gateway signal queue density exceeds 95 veh/km/lane and speed falls below 20 km/h',
      thresholdConstraint: 'Minimum Peak Speed >= 20.0 km/h',
      horizon: '3 Years (2026–2029)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — macroscopic CTM corridor template',
      baselineInputsSummary: 'Inflow demand: 2,650 veh/h; East Gateway green ratio: 0.36; Initial density: 96 veh/km/ln',
      available: true,
      baselineModifications: [
        { targetId: 'cell-nw-in', property: 'inflowDemandVehHour', label: 'Corridor Peak Inflow', originalValue: 2450, newValue: 2650, unit: 'veh/h' },
        { targetId: 'cell-hub-5', property: 'signalGreenRatio', label: 'East Gateway Signal Green', originalValue: 0.58, newValue: 0.36, unit: 'ratio' },
        { targetId: 'cell-east-corridor', property: 'initialDensityVehKmPerLane', label: 'East Corridor Initial Queue', originalValue: 54, newValue: 98, unit: 'veh/km/ln' }
      ],
      constraintsOverride: [
        { id: 'c_cost', name: 'Budget Cap', metricKey: 'cost', threshold: 18.0, operator: '<=', unit: '$M', severity: 'hard' },
        { id: 'c_speed', name: 'Minimum Corridor Speed', metricKey: 'primaryPerformance', threshold: 20.0, operator: '>=', unit: 'km/h', severity: 'hard' }
      ],
      alternativesOverride: [
        {
          id: 'alt-traf2-brt',
          name: 'East Corridor Dedicated BRT & Adaptive Green Wave',
          tag: 'Solution A',
          description: 'Synchronizes East Gateway and Plaza signals (green ratio 0.74) and shifts 35% of single-occupancy inflow to BRT.',
          color: '#6366f1',
          capexCostMillion: 10.8,
          opexAnnualMillion: 0.42,
          implementationMonths: 14,
          modifications: [
            { targetId: 'cell-nw-in', property: 'inflowDemandVehHour', label: 'Modal Shift Demand', originalValue: 2650, newValue: 1520, unit: 'veh/h' },
            { targetId: 'cell-hub-5', property: 'signalGreenRatio', label: 'East Gateway Green Wave', originalValue: 0.36, newValue: 0.74, unit: 'ratio' },
            { targetId: 'cell-east-corridor', property: 'lanes', label: 'Expressway Dedicated Lane', originalValue: 2, newValue: 3, unit: 'lanes' }
          ]
        },
        {
          id: 'alt-traf2-flyover',
          name: 'East Gateway Grade-Separated Flyover',
          tag: 'Solution B',
          description: 'Constructs 2-lane overpass bypassing East Gateway signal phase and adds third commercial lane.',
          color: '#f59e0b',
          capexCostMillion: 15.6,
          opexAnnualMillion: 0.65,
          implementationMonths: 22,
          modifications: [
            { targetId: 'cell-east-corridor', property: 'lanes', label: 'Expressway Lanes', originalValue: 2, newValue: 3, unit: 'lanes' },
            { targetId: 'cell-hub-5', property: 'signalGreenRatio', label: 'Bypass Effective Green', originalValue: 0.36, newValue: 0.82, unit: 'ratio' }
          ]
        },
        {
          id: 'alt-traf2-tsm',
          name: 'Smart Ramp Metering & Signal Retiming',
          tag: 'Solution C',
          description: 'Low-cost controller retiming at East Gateway and University Plaza without civil widening.',
          color: '#10b981',
          capexCostMillion: 4.2,
          opexAnnualMillion: 0.25,
          implementationMonths: 6,
          modifications: [
            { targetId: 'cell-hub-5', property: 'signalGreenRatio', label: 'Retimed Signal Green', originalValue: 0.36, newValue: 0.64, unit: 'ratio' },
            { targetId: 'cell-hub-2', property: 'signalGreenRatio', label: 'Plaza Coordinated Green', originalValue: 0.44, newValue: 0.62, unit: 'ratio' }
          ]
        }
      ]
    },
    {
      id: 'prob-traffic-3',
      title: 'North Ring Hospital Emergency Access Delay',
      description: 'Ambulance and emergency routing via North Ring & Hospital Junction experiences severe queue spillback during shift handover.',
      domain: 'traffic',
      affectedAssetIds: ['cell-ring-north', 'cell-hub-3', 'cell-transit-spine'],
      measurableSymptom: 'Hospital junction density reaches 108 veh/km/lane and speed drops below 23 km/h',
      thresholdConstraint: 'Minimum Emergency Corridor Speed >= 24.0 km/h',
      horizon: '5 Years (2026–2031)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — hospital access CTM scenario',
      baselineInputsSummary: 'Inflow demand: 2,500 veh/h; Hospital Junction green ratio: 0.35; North Ring density: 104 veh/km/ln',
      available: true,
      baselineModifications: [
        { targetId: 'cell-ring-north', property: 'initialDensityVehKmPerLane', label: 'North Ring Queue', originalValue: 64, newValue: 104, unit: 'veh/km/ln' },
        { targetId: 'cell-hub-3', property: 'signalGreenRatio', label: 'Hospital Signal Green', originalValue: 0.52, newValue: 0.35, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-4',
      title: 'South Tech Park Commuter Surge & Exit Gridlock',
      description: 'Evening tech park exodus overwhelms South Tech Park Intersection and South Transit Terminal, backing queues onto South Campus Parkway.',
      domain: 'traffic',
      affectedAssetIds: ['cell-ring-south', 'cell-hub-4', 'cell-hub-6'],
      measurableSymptom: 'South Tech Park intersection density exceeds 102 veh/km/lane (>70% jam density)',
      thresholdConstraint: 'Minimum Peak Speed >= 23.0 km/h',
      horizon: '4 Years (2026–2030)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — commuter peak CTM model',
      baselineInputsSummary: 'Tech Park green ratio: 0.38; South Parkway initial density: 100 veh/km/ln',
      available: true,
      baselineModifications: [
        { targetId: 'cell-ring-south', property: 'initialDensityVehKmPerLane', label: 'South Parkway Density', originalValue: 58, newValue: 102, unit: 'veh/km/ln' },
        { targetId: 'cell-hub-4', property: 'signalGreenRatio', label: 'Tech Park Signal Green', originalValue: 0.54, newValue: 0.38, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-5',
      title: 'West Innovation Connector Work-Zone Lane Closure',
      description: 'Utility trenching reduces West Innovation Connector from 2 lanes to 1 lane, causing spillback through West Science Gate Signal.',
      domain: 'traffic',
      affectedAssetIds: ['cell-west-conn', 'cell-hub-7', 'cell-campus-main'],
      measurableSymptom: 'Single-lane work zone saturates at 105 veh/km/lane and speed drops below 21 km/h',
      thresholdConstraint: 'Minimum Work-Zone Corridor Speed >= 23.0 km/h',
      horizon: '2 Years (2026–2028)',
      units: 'km/h, lanes',
      dataSource: 'Synthetic demo data — work-zone CTM capacity reduction model',
      baselineInputsSummary: 'West Connector lanes: 1; West Inflow: 1,650 veh/h; Science Gate green: 0.40',
      available: true,
      baselineModifications: [
        { targetId: 'cell-west-conn', property: 'lanes', label: 'Work-Zone Active Lanes', originalValue: 2, newValue: 1, unit: 'lanes' },
        { targetId: 'cell-west-conn', property: 'inflowDemandVehHour', label: 'West Inflow Demand', originalValue: 1100, newValue: 1650, unit: 'veh/h' },
        { targetId: 'cell-hub-7', property: 'signalGreenRatio', label: 'Science Gate Green Ratio', originalValue: 0.52, newValue: 0.40, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-6',
      title: 'Northeast Freight & Rail Overpass Heavy Truck Bottleneck',
      description: 'Port freight convoy arrivals reduce free-flow speed on Northeast Overpass and overload East Industrial Beltway Signal.',
      domain: 'traffic',
      affectedAssetIds: ['cell-ne-bypass', 'cell-hub-8', 'cell-se-arterial'],
      measurableSymptom: 'Freight corridor speed drops to 20.5 km/h with queue density > 96 veh/km/lane',
      thresholdConstraint: 'Minimum Corridor Speed >= 24.0 km/h',
      horizon: '5 Years (2026–2031)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — freight CTM corridor model',
      baselineInputsSummary: 'Overpass free-flow speed: 34 km/h; Beltway signal green: 0.38',
      available: true,
      baselineModifications: [
        { targetId: 'cell-ne-bypass', property: 'freeFlowSpeedKmh', label: 'Freight Grade Free Speed', originalValue: 52, newValue: 34, unit: 'km/h' },
        { targetId: 'cell-hub-8', property: 'signalGreenRatio', label: 'Industrial Beltway Green', originalValue: 0.56, newValue: 0.38, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-7',
      title: 'Central Transit Spine Bus Bunching & Curb Friction',
      description: 'Unprotected curb boarding along Central Transit Spine throttles discharge into South Transit Terminal Intersection.',
      domain: 'traffic',
      affectedAssetIds: ['cell-transit-spine', 'cell-hub-6', 'cell-hub-2'],
      measurableSymptom: 'Transit spine density exceeds 98 veh/km/lane and terminal approach speed drops below 21 km/h',
      thresholdConstraint: 'Minimum Spine Speed >= 23.5 km/h',
      horizon: '3 Years (2026–2029)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — transit spine CTM model',
      baselineInputsSummary: 'Transit Spine free-flow speed: 28 km/h; Terminal green ratio: 0.42',
      available: true,
      baselineModifications: [
        { targetId: 'cell-transit-spine', property: 'freeFlowSpeedKmh', label: 'Curb Friction Speed', originalValue: 38, newValue: 28, unit: 'km/h' },
        { targetId: 'cell-hub-6', property: 'signalGreenRatio', label: 'Terminal Signal Green', originalValue: 0.60, newValue: 0.42, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-8',
      title: 'Stadium Event Surge on Northwest Gateway',
      description: 'University convocation and stadium events spike Northwest Arterial inflow by +35%, saturating Gateway and Central Boulevard.',
      domain: 'traffic',
      affectedAssetIds: ['cell-nw-in', 'cell-hub-1', 'cell-campus-main'],
      measurableSymptom: 'Event inflow 3,100 veh/h drives NW Gateway density above 115 veh/km/lane',
      thresholdConstraint: 'Minimum Event Dispersal Speed >= 22.0 km/h',
      horizon: '1 Year (Event Operations)',
      units: 'km/h, veh/h',
      dataSource: 'Synthetic demo data — event surge CTM model',
      baselineInputsSummary: 'Event Inflow: 3,100 veh/h; NW Gateway green ratio: 0.42',
      available: true,
      baselineModifications: [
        { targetId: 'cell-nw-in', property: 'inflowDemandVehHour', label: 'Event Peak Inflow', originalValue: 2450, newValue: 3100, unit: 'veh/h' },
        { targetId: 'cell-hub-1', property: 'signalGreenRatio', label: 'Gateway Event Green', originalValue: 0.48, newValue: 0.42, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-9',
      title: 'Monsoon Wet-Pavement Speed & Capacity Degradation',
      description: 'Heavy rainfall reduces arterial free-flow speeds by 25% across Central Boulevard and Ring Roads, triggering shockwave queues.',
      domain: 'traffic',
      affectedAssetIds: ['cell-campus-main', 'cell-ring-north', 'cell-ring-south'],
      measurableSymptom: 'Wet-weather arterial speeds fall below 20 km/h with standing waves at intersections',
      thresholdConstraint: 'Wet-Weather Minimum Speed >= 22.0 km/h',
      horizon: '5 Years (Seasonal Resilience)',
      units: 'km/h',
      dataSource: 'Synthetic demo data — weather-degraded CTM parameters',
      baselineInputsSummary: 'Boulevard v_f: 30 km/h; North/South Ring v_f: 32 km/h',
      available: true,
      baselineModifications: [
        { targetId: 'cell-campus-main', property: 'freeFlowSpeedKmh', label: 'Wet Boulevard Free Speed', originalValue: 42, newValue: 30, unit: 'km/h' },
        { targetId: 'cell-ring-north', property: 'freeFlowSpeedKmh', label: 'Wet Ring Free Speed', originalValue: 46, newValue: 32, unit: 'km/h' }
      ]
    },
    {
      id: 'prob-traffic-10',
      title: 'Southeast Riverfront Interchange Merge Bottleneck',
      description: 'Weaving conflicts between South Tech Park traffic and East Industrial Beltway traffic throttle Southeast Riverfront Arterial.',
      domain: 'traffic',
      affectedAssetIds: ['cell-se-arterial', 'cell-hub-4', 'cell-hub-8'],
      measurableSymptom: 'Merge queue backs into Tech Park and Beltway signals (>94 veh/km/lane)',
      thresholdConstraint: 'Minimum Interchange Speed >= 24.0 km/h',
      horizon: '4 Years (2026–2030)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — merge bottleneck CTM model',
      baselineInputsSummary: 'SE Arterial free-flow speed: 32 km/h; Initial density: 96 veh/km/ln',
      available: true,
      baselineModifications: [
        { targetId: 'cell-se-arterial', property: 'freeFlowSpeedKmh', label: 'Weaving Merge Speed', originalValue: 50, newValue: 31, unit: 'km/h' },
        { targetId: 'cell-se-arterial', property: 'initialDensityVehKmPerLane', label: 'Merge Queue Density', originalValue: 40, newValue: 98, unit: 'veh/km/ln' }
      ]
    },
    {
      id: 'prob-traffic-11',
      title: 'South Highway Ramp Spillback onto Transit Terminal',
      description: 'Downstream highway congestion throttles South Highway Interchange Ramp, spilling queues into South Transit Terminal Intersection.',
      domain: 'traffic',
      affectedAssetIds: ['cell-south-exit', 'cell-hub-6', 'cell-transit-spine'],
      measurableSymptom: 'Exit ramp density exceeds 100 veh/km/lane and blocks terminal signal progression',
      thresholdConstraint: 'Minimum Ramp Clearance Speed >= 23.0 km/h',
      horizon: '5 Years (2026–2031)',
      units: 'km/h, veh/km/lane',
      dataSource: 'Synthetic demo data — ramp spillback CTM model',
      baselineInputsSummary: 'South Exit Ramp lanes: 1; Terminal green ratio: 0.40',
      available: true,
      baselineModifications: [
        { targetId: 'cell-south-exit', property: 'lanes', label: 'Ramp Open Lanes', originalValue: 2, newValue: 1, unit: 'lanes' },
        { targetId: 'cell-hub-6', property: 'signalGreenRatio', label: 'Terminal Signal Green', originalValue: 0.60, newValue: 0.40, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-12',
      title: 'Multi-Intersection Signal Desynchronization Crisis',
      description: 'Legacy fixed-time controllers at Gateway, Plaza, and Hospital junctions operate uncoordinated, creating stop-and-go platoons.',
      domain: 'traffic',
      affectedAssetIds: ['cell-hub-1', 'cell-hub-2', 'cell-hub-3', 'cell-hub-4'],
      measurableSymptom: 'Simultaneous red-phase queuing across 4 intersections drops network speed below 20 km/h',
      thresholdConstraint: 'Network Mean Speed >= 23.5 km/h',
      horizon: '3 Years (2026–2029)',
      units: 'km/h, ratio',
      dataSource: 'Synthetic demo data — signal coordination CTM study',
      baselineInputsSummary: 'Gateway green: 0.38; Plaza green: 0.38; Hospital green: 0.40',
      available: true,
      baselineModifications: [
        { targetId: 'cell-hub-1', property: 'signalGreenRatio', label: 'Gateway Uncoordinated Green', originalValue: 0.48, newValue: 0.38, unit: 'ratio' },
        { targetId: 'cell-hub-2', property: 'signalGreenRatio', label: 'Plaza Uncoordinated Green', originalValue: 0.44, newValue: 0.38, unit: 'ratio' },
        { targetId: 'cell-hub-3', property: 'signalGreenRatio', label: 'Hospital Uncoordinated Green', originalValue: 0.52, newValue: 0.40, unit: 'ratio' }
      ]
    },
    {
      id: 'prob-traffic-unavail-1',
      title: 'Microscopic Pedestrian-Vehicle Jaywalking Conflict Kinematics (Unavailable)',
      description: 'Sub-second individual pedestrian trajectory and curb-conflict collision modeling.',
      domain: 'traffic',
      affectedAssetIds: ['cell-hub-2'],
      measurableSymptom: 'Unavailable for this model',
      thresholdConstraint: 'Unavailable — requires microscopic agent-based kinematics',
      horizon: 'N/A',
      units: 'N/A',
      dataSource: 'Model Limitation Disclosure',
      baselineInputsSummary: 'Not applicable — macroscopic Cell Transmission Model solves cell densities and flows, not individual pedestrian trajectories.',
      available: false,
      unavailableReason: 'Unavailable for this model: The implemented traffic solver is a 1D macroscopic Cell Transmission Model (CTM) governed by triangular fundamental diagrams. It does not simulate microscopic vehicle-pedestrian trajectories or sub-second collision kinematics.'
    },
    {
      id: 'prob-traffic-unavail-2',
      title: 'Dynamic Wardrop User-Equilibrium Origin-Destination Matrix Assignment (Unavailable)',
      description: 'Iterative game-theoretic route-choice assignment across competing regional tolled highways.',
      domain: 'traffic',
      affectedAssetIds: ['cell-nw-in'],
      measurableSymptom: 'Unavailable for this model',
      thresholdConstraint: 'Unavailable — requires iterative OD path-assignment solver',
      horizon: 'N/A',
      units: 'N/A',
      dataSource: 'Model Limitation Disclosure',
      baselineInputsSummary: 'Not applicable — CTM uses fixed split ratios at diverges rather than behavioral toll-elasticity equilibrium.',
      available: false,
      unavailableReason: 'Unavailable for this model: The CTM solver propagates cell densities using explicit send/receive capacities and configured diverge splits. Behavioral Wardrop user-equilibrium OD matrix assignment is not modeled.'
    }
  ],
  water: [
    {
      id: 'prob-water-1',
      title: 'Elevated Residential Low Pressure at North Ridge (118 kPa vs 180 kPa Min)',
      description: 'Chronic peak-demand low pressure (~118.0 kPa) at North Ridge Residential Zone and high friction velocity (>2.2 m/s) in main trunk feeder.',
      domain: 'water',
      affectedAssetIds: ['junc-ridge', 'pipe-trunk-1', 'pipe-prv-ridge'],
      measurableSymptom: 'North Ridge nodal pressure drops to 118.0 kPa (breaching >= 180.0 kPa municipal limit) and trunk velocity exceeds 2.0 m/s',
      thresholdConstraint: 'Minimum Node Pressure >= 180.0 kPa & Pipe Velocity <= 2.0 m/s',
      horizon: '5 Years (2026–2031)',
      units: 'kPa, m/s, m/km, m³/s',
      dataSource: 'Synthetic demo data — steady-state Darcy-Weisbach hydraulic solver v2.0',
      baselineInputsSummary: 'Reservoir Head: 230m; Ridge Elevation: 163.7m; Ridge Feed D=215mm; illustrative absolute roughness ε=1.00mm',
      available: true
    },
    {
      id: 'prob-water-2',
      title: 'Valley Primary Trunk Pipe Friction & Velocity Bottleneck',
      description: 'Undersized and tuberculated main supply trunk experiences excessive velocity (>2.4 m/s) and head loss (>16 m/km) during industrial draw.',
      domain: 'water',
      affectedAssetIds: ['pipe-trunk-1', 'pipe-pump-boost', 'junc-valley'],
      measurableSymptom: 'Trunk velocity exceeds 2.4 m/s and friction gradient exceeds 15 m/km, depressing downstream district head',
      thresholdConstraint: 'Minimum Node Pressure >= 180.0 kPa & Pipe Head Loss <= 12.0 m/km',
      horizon: '4 Years (2026–2030)',
      units: 'm/s, m/km, kPa',
      dataSource: 'Synthetic demo data — steady-state Darcy-Weisbach hydraulic model',
      baselineInputsSummary: 'Trunk Diameter: 0.42m; illustrative absolute roughness ε=0.644mm; Valley Hub Demand: 0.095 m³/s',
      available: true,
      baselineModifications: [
        { targetId: 'pipe-trunk-1', property: 'diameter', label: 'Tuberculated Trunk Diameter', originalValue: 0.48, newValue: 0.42, unit: 'm' },
        { targetId: 'pipe-trunk-1', property: 'absoluteRoughnessMm', label: 'Aged Trunk Absolute Roughness', originalValue: 0.5027, newValue: 0.6438, unit: 'mm' },
        { targetId: 'junc-valley', property: 'baseDemand', label: 'Valley Industrial Draw', originalValue: 0.075, newValue: 0.095, unit: 'm³/s' }
      ],
      alternativesOverride: [
        {
          id: 'alt-wat2-twin',
          name: 'Twin 600mm Cement-Mortar Lined Trunk Main',
          tag: 'Solution A',
          description: 'Parallels the synthetic reservoir trunk with a 600mm main using an illustrative 0.333mm roughness input and upgrades booster discharge.',
          color: '#06b6d4',
          capexCostMillion: 6.8,
          opexAnnualMillion: 0.09,
          implementationMonths: 14,
          modifications: [
            { targetId: 'pipe-trunk-1', property: 'diameter', label: 'Twin Trunk Equivalent D', originalValue: 0.42, newValue: 0.62, unit: 'm' },
            { targetId: 'pipe-trunk-1', property: 'absoluteRoughnessMm', label: 'Lined Trunk Absolute Roughness', originalValue: 0.6438, newValue: 0.3326, unit: 'mm' },
            { targetId: 'pipe-prv-ridge', property: 'diameter', label: 'Ridge Feeder Upgrade', originalValue: 0.215, newValue: 0.36, unit: 'm' }
          ]
        },
        {
          id: 'alt-wat2-reline',
          name: 'Structural Epoxy Relining & Booster Head Lift',
          tag: 'Solution B',
          description: 'Cured-in-place pipe relining using an illustrative 0.342mm roughness input plus a +14m source-head increase.',
          color: '#3b82f6',
          capexCostMillion: 4.9,
          opexAnnualMillion: 0.24,
          implementationMonths: 9,
          modifications: [
            { targetId: 'pipe-trunk-1', property: 'absoluteRoughnessMm', label: 'Relined Trunk Absolute Roughness', originalValue: 0.6438, newValue: 0.3415, unit: 'mm' },
            { targetId: 'res-east', property: 'head', label: 'Pump Assisted Source Head', originalValue: 230, newValue: 244, unit: 'm' },
            { targetId: 'pipe-prv-ridge', property: 'diameter', label: 'Ridge Feeder Sizing', originalValue: 0.215, newValue: 0.32, unit: 'm' }
          ]
        },
        {
          id: 'alt-wat2-industrial',
          name: 'Industrial Off-Peak Storage & Demand Throttling',
          tag: 'Solution C',
          description: 'Shifts Valley industrial draw to off-peak hours and upsizes Valley-to-PRV feeder.',
          color: '#8b5cf6',
          capexCostMillion: 2.6,
          opexAnnualMillion: 0.14,
          implementationMonths: 5,
          modifications: [
            { targetId: 'junc-valley', property: 'baseDemand', label: 'Peak-Shaved Valley Demand', originalValue: 0.095, newValue: 0.055, unit: 'm³/s' },
            { targetId: 'pipe-valley-prv', property: 'diameter', label: 'Valley-PRV Pipe D', originalValue: 0.32, newValue: 0.42, unit: 'm' }
          ]
        }
      ]
    },
    {
      id: 'prob-water-3',
      title: 'South Hillside Colony Morning Peak Pressure Deficit',
      description: 'High elevation (156m) and long small-bore feeder cause South Hillside Colony pressure to fall below 180 kPa during morning draw.',
      domain: 'water',
      affectedAssetIds: ['junc-south', 'pipe-valley-south', 'pipe-south-west'],
      measurableSymptom: 'South Hillside pressure drops below 145 kPa under morning peak demand',
      thresholdConstraint: 'Minimum Node Pressure >= 180.0 kPa',
      horizon: '5 Years (2026–2031)',
      units: 'kPa, m³/s',
      dataSource: 'Synthetic demo data — hillside zone hydraulic template',
      baselineInputsSummary: 'South Hillside demand: 0.082 m³/s; Pipe Valley-South D=0.21m',
      available: true,
      baselineModifications: [
        { targetId: 'junc-south', property: 'baseDemand', label: 'South Hillside Peak Draw', originalValue: 0.055, newValue: 0.082, unit: 'm³/s' },
        { targetId: 'pipe-valley-south', property: 'diameter', label: 'South Feeder Diameter', originalValue: 0.26, newValue: 0.21, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-4',
      title: 'Semiconductor Fab High-Flow Industrial Drawdown',
      description: 'New wafer rinsing demand at Semiconductor Fab Supply Node overloads East Industrial and Tech feeders, pulling district pressures down.',
      domain: 'water',
      affectedAssetIds: ['junc-tech', 'junc-east', 'pipe-east-tech', 'pipe-central-east'],
      measurableSymptom: 'Fab node pressure drops below 150 kPa and East feeder velocity exceeds 2.3 m/s',
      thresholdConstraint: 'Minimum Industrial Supply Pressure >= 180.0 kPa',
      horizon: '3 Years (2026–2029)',
      units: 'kPa, m/s',
      dataSource: 'Synthetic demo data — industrial expansion hydraulic model',
      baselineInputsSummary: 'Semiconductor Fab demand: 0.095 m³/s; East-Tech pipe D=0.20m',
      available: true,
      baselineModifications: [
        { targetId: 'junc-tech', property: 'baseDemand', label: 'Fab Ultra-Pure Water Draw', originalValue: 0.05, newValue: 0.095, unit: 'm³/s' },
        { targetId: 'pipe-east-tech', property: 'diameter', label: 'East-Tech Feeder D', originalValue: 0.25, newValue: 0.20, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-5',
      title: 'Regional Medical Center Critical Pressure Redundancy Gap',
      description: 'Encrusted cast-iron mains feeding Regional Medical Center Junction create high head loss and sub-180 kPa pressure during peak hospital draw.',
      domain: 'water',
      affectedAssetIds: ['junc-hospital', 'pipe-valley-hosp', 'pipe-park-hosp'],
      measurableSymptom: 'Hospital junction pressure drops below 165 kPa during peak sterilization and HVAC cooling demand',
      thresholdConstraint: 'Minimum Critical Facility Pressure >= 185.0 kPa',
      horizon: '5 Years (2026–2031)',
      units: 'kPa, m³/s',
      dataSource: 'Synthetic demo data — critical healthcare water template',
      baselineInputsSummary: 'Hospital demand: 0.085 m³/s; Valley-Hospital pipe D=0.20m; illustrative ε=0.736mm',
      available: true,
      baselineModifications: [
        { targetId: 'junc-hospital', property: 'baseDemand', label: 'Hospital Peak Demand', originalValue: 0.045, newValue: 0.085, unit: 'm³/s' },
        { targetId: 'pipe-valley-hosp', property: 'diameter', label: 'Hospital Feeder D', originalValue: 0.28, newValue: 0.20, unit: 'm' },
        { targetId: 'pipe-valley-hosp', property: 'absoluteRoughnessMm', label: 'Hospital Feeder Absolute Roughness', originalValue: 0.4773, newValue: 0.7357, unit: 'mm' }
      ]
    },
    {
      id: 'prob-water-6',
      title: 'Drought Reservoir Drawdown (-12m Source Head Drop)',
      description: 'Prolonged summer drought lowers East Mountain Gravity Reservoir water surface level from 230m to 218m, starving elevated zones.',
      domain: 'water',
      affectedAssetIds: ['res-east', 'junc-ridge', 'tank-high', 'junc-north'],
      measurableSymptom: 'Reservoir head drop to 218m plunges North Ridge pressure below 85 kPa',
      thresholdConstraint: 'Minimum Drought Service Pressure >= 180.0 kPa',
      horizon: '5 Years (Climate Drought Stress)',
      units: 'kPa, m head',
      dataSource: 'Synthetic demo data — drought boundary condition model',
      baselineInputsSummary: 'Reservoir Head: 218.0 m (down from 230.0 m)',
      available: true,
      baselineModifications: [
        { targetId: 'res-east', property: 'head', label: 'Drought Reservoir Head', originalValue: 230, newValue: 218, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-7',
      title: 'North Foothills Terrace Fire-Hydrant Flow Test Deficit',
      description: 'Simultaneous hydrant flushing and residential demand at North Foothills Terrace causes severe pressure sag across the northern loop.',
      domain: 'water',
      affectedAssetIds: ['junc-north', 'pipe-pump-north', 'pipe-north-prv'],
      measurableSymptom: 'Hydrant flow test +0.075 m³/s pulls North Foothills pressure below 130 kPa',
      thresholdConstraint: 'Minimum Fire-Flow Residual Pressure >= 180.0 kPa',
      horizon: '2 Years (Fire Marshal Compliance)',
      units: 'kPa, m³/s',
      dataSource: 'Synthetic demo data — steady-state fire-flow superposition',
      baselineInputsSummary: 'North Foothills demand + hydrant flow: 0.092 m³/s; North feeder D=0.21m',
      available: true,
      baselineModifications: [
        { targetId: 'junc-north', property: 'baseDemand', label: 'Hydrant + Base Demand', originalValue: 0.04, newValue: 0.092, unit: 'm³/s' },
        { targetId: 'pipe-pump-north', property: 'diameter', label: 'North Feeder D', originalValue: 0.28, newValue: 0.21, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-8',
      title: 'Aged Pipe Network Tuberculation (Absolute Roughness Increase)',
      description: 'Scaling increases illustrative absolute roughness across Central and East distribution mains, raising friction loss and reducing downstream service pressure.',
      domain: 'water',
      affectedAssetIds: ['pipe-valley-central', 'pipe-central-east', 'junc-central', 'junc-east'],
      measurableSymptom: 'Pipe head loss exceeds 18 m/km and downstream nodal pressures drop below 160 kPa',
      thresholdConstraint: 'Minimum Node Pressure >= 180.0 kPa & Head Loss <= 12.0 m/km',
      horizon: '5 Years (Asset Rehabilitation)',
      units: 'kPa, m/km, mm',
      dataSource: 'Synthetic demo data — pipe roughness degradation study',
      baselineInputsSummary: 'Illustrative absolute roughness: Valley-Central 0.579mm; Central-East 1.179mm; PRV-Ridge 1.310mm',
      available: true,
      baselineModifications: [
        { targetId: 'pipe-valley-central', property: 'absoluteRoughnessMm', label: 'Valley-Central Absolute Roughness', originalValue: 0.3259, newValue: 0.5789, unit: 'mm' },
        { targetId: 'pipe-central-east', property: 'absoluteRoughnessMm', label: 'Central-East Absolute Roughness', originalValue: 0.7312, newValue: 1.1787, unit: 'mm' },
        { targetId: 'pipe-prv-ridge', property: 'absoluteRoughnessMm', label: 'PRV-Ridge Absolute Roughness', originalValue: 0.9964, newValue: 1.3097, unit: 'mm' }
      ]
    },
    {
      id: 'prob-water-9',
      title: 'University Research Park Laboratory Cooling Surge',
      description: 'Expansion of wet laboratories and chillers at University Research Park Node doubles local water draw.',
      domain: 'water',
      affectedAssetIds: ['junc-campus', 'pipe-central-campus', 'junc-harbor'],
      measurableSymptom: 'Campus node pressure drops below 162 kPa and Central-Campus pipe velocity exceeds 2.1 m/s',
      thresholdConstraint: 'Minimum Campus Pressure >= 180.0 kPa',
      horizon: '4 Years (2026–2030)',
      units: 'kPa, m/s',
      dataSource: 'Synthetic demo data — campus utility expansion model',
      baselineInputsSummary: 'Campus demand: 0.088 m³/s; Central-Campus pipe D=0.22m',
      available: true,
      baselineModifications: [
        { targetId: 'junc-campus', property: 'baseDemand', label: 'Campus Lab Demand', originalValue: 0.04, newValue: 0.088, unit: 'm³/s' },
        { targetId: 'pipe-central-campus', property: 'diameter', label: 'Campus Feeder D', originalValue: 0.28, newValue: 0.22, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-10',
      title: 'West Commercial District High-Rise Pressure Deficit',
      description: 'New mixed-use towers in West Commercial District increase peak demand and overwhelm the South-West and Hospital-West feeders.',
      domain: 'water',
      affectedAssetIds: ['junc-west', 'pipe-south-west', 'pipe-hosp-west'],
      measurableSymptom: 'West Commercial nodal pressure falls below 168 kPa with high feeder friction loss',
      thresholdConstraint: 'Minimum District Pressure >= 180.0 kPa',
      horizon: '5 Years (2026–2031)',
      units: 'kPa, m/km',
      dataSource: 'Synthetic demo data — commercial rezoning hydraulic model',
      baselineInputsSummary: 'West Commercial demand: 0.105 m³/s; Hospital-West D=0.20m',
      available: true,
      baselineModifications: [
        { targetId: 'junc-west', property: 'baseDemand', label: 'West High-Rise Demand', originalValue: 0.065, newValue: 0.105, unit: 'm³/s' },
        { targetId: 'pipe-hosp-west', property: 'diameter', label: 'Hospital-West Pipe D', originalValue: 0.25, newValue: 0.20, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-11',
      title: 'North Ridge Elevated Storage Tank Refill Bottleneck',
      description: 'Peak daytime refill demand at North Ridge Elevated Tank starves adjacent North Ridge Residential Zone.',
      domain: 'water',
      affectedAssetIds: ['tank-high', 'junc-ridge', 'pipe-ridge-tank'],
      measurableSymptom: 'Tank refill draw of 0.045 m³/s pulls North Ridge pressure down to 92 kPa',
      thresholdConstraint: 'Minimum Zone Pressure >= 180.0 kPa during tank refill',
      horizon: '3 Years (2026–2029)',
      units: 'kPa, m³/s',
      dataSource: 'Synthetic demo data — tank refill hydraulic snapshot',
      baselineInputsSummary: 'Tank Refill Draw: 0.045 m³/s; Ridge-Tank pipe D=0.20m',
      available: true,
      baselineModifications: [
        { targetId: 'tank-high', property: 'baseDemand', label: 'Tank Refill Outflow', originalValue: 0.015, newValue: 0.045, unit: 'm³/s' },
        { targetId: 'pipe-ridge-tank', property: 'diameter', label: 'Tank Riser Pipe D', originalValue: 0.24, newValue: 0.20, unit: 'm' }
      ]
    },
    {
      id: 'prob-water-12',
      title: 'Lower Riverfront Port & Botanical Greenway Irrigation Spike',
      description: 'Summer park irrigation and port ship-watering surge increase demand across the western and southern extremities.',
      domain: 'water',
      affectedAssetIds: ['junc-park', 'junc-harbor', 'pipe-pump-park', 'pipe-campus-harbor'],
      measurableSymptom: 'Combined extremity draw increases trunk velocity to 2.35 m/s and drops Ridge pressure below 110 kPa',
      thresholdConstraint: 'Minimum System Pressure >= 180.0 kPa & Velocity <= 2.0 m/s',
      horizon: '5 Years (Summer Peak Operations)',
      units: 'kPa, m/s',
      dataSource: 'Synthetic demo data — summer irrigation hydraulic study',
      baselineInputsSummary: 'Greenway demand: 0.065 m³/s; Harbor demand: 0.075 m³/s',
      available: true,
      baselineModifications: [
        { targetId: 'junc-park', property: 'baseDemand', label: 'Greenway Irrigation Draw', originalValue: 0.03, newValue: 0.065, unit: 'm³/s' },
        { targetId: 'junc-harbor', property: 'baseDemand', label: 'Port Ship Supply Draw', originalValue: 0.04, newValue: 0.075, unit: 'm³/s' }
      ]
    },
    {
      id: 'prob-water-unavail-1',
      title: 'Chlorine Residual Decay & Microbial Contamination Transport (Unavailable)',
      description: 'Multi-species advection-dispersion reaction kinetics and biofilm pathogen intrusion modeling.',
      domain: 'water',
      affectedAssetIds: ['junc-ridge'],
      measurableSymptom: 'Unavailable for this model',
      thresholdConstraint: 'Unavailable — requires water quality advection-reaction solver',
      horizon: 'N/A',
      units: 'N/A',
      dataSource: 'Model Limitation Disclosure',
      baselineInputsSummary: 'Not applicable — steady-state Darcy-Weisbach solver computes nodal heads, pressures, pipe flows, and friction losses only.',
      available: false,
      unavailableReason: 'Unavailable for this model: The implemented water solver uses steady-state incompressible Darcy-Weisbach hydraulics. Chemical decay kinetics, age-of-water tracking, and pathogen contamination transport are not modeled.'
    },
    {
      id: 'prob-water-unavail-2',
      title: 'Acoustic Water Hammer & Pump Trip Surge Transients (Unavailable)',
      description: 'Method-of-characteristics elastic pressure wave propagation following sudden valve closure or pump power loss.',
      domain: 'water',
      affectedAssetIds: ['pipe-trunk-1'],
      measurableSymptom: 'Unavailable for this model',
      thresholdConstraint: 'Unavailable — requires compressible transient MOC solver',
      horizon: 'N/A',
      units: 'N/A',
      dataSource: 'Model Limitation Disclosure',
      baselineInputsSummary: 'Not applicable — steady-state hydraulic equilibrium omits fluid compressibility and pipe wall elasticity.',
      available: false,
      unavailableReason: 'Unavailable for this model: The steady-state Darcy-Weisbach Newton solver does not model compressible acoustic wave speed, pipe wall elasticity, or sub-second water hammer surge transients.'
    }
  ],
  energy: [
    {
      id: 'prob-energy-1',
      title: 'Substation 2–3 Corridor Summer Thermal Overload',
      description: 'Summer heatwave air-conditioning and industrial surge drives Line 2-3 active power flow above its 55 MW continuous thermal rating.',
      domain: 'energy',
      affectedAssetIds: ['line-2-3', 'bus-2', 'bus-3'],
      measurableSymptom: 'Active power flow on Line 2-3 exceeds 100% of its 55.0 MW thermal limit',
      thresholdConstraint: 'Maximum Line Loading <= 100.0% (55.0 MW) & Losses <= 12.0 MW',
      horizon: '5 Years (2026–2031)',
      units: 'MW, % loading, deg',
      dataSource: 'Synthetic demo data — DC Load Flow network analysis v2.4',
      baselineInputsSummary: 'Base MVA: 100; Bus 3 Industrial Load: 108 MW; Line 2-3 Rating: 55 MW',
      available: true
    },
    {
      id: 'prob-energy-2',
      title: 'Substation N-1 Contingency Overload on Line 2–4 Corridor',
      description: 'High impedance on Line 2-4 or de-rated thermal capacity causes parallel path overload between Central Hub and South Metro Substation.',
      domain: 'energy',
      affectedAssetIds: ['line-2-4', 'line-6-4', 'bus-4'],
      measurableSymptom: 'Line 2-4 loading exceeds 105% of degraded 75 MW emergency thermal rating',
      thresholdConstraint: 'Maximum Line Loading <= 100.0%',
      horizon: '3 Years (2026–2029)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — N-1 contingency screening model',
      baselineInputsSummary: 'Line 2-4 Emergency Rating: 75 MW; South Metro Load: 68 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-2-4', property: 'thermalRatingMw', label: 'Line 2-4 De-rated Limit', originalValue: 145, newValue: 75, unit: 'MW' },
        { targetId: 'line-2-4', property: 'reactancePu', label: 'Line 2-4 High Impedance', originalValue: 0.058, newValue: 0.088, unit: 'p.u.' }
      ],
      alternativesOverride: [
        {
          id: 'alt-eng2-double',
          name: 'Double-Circuit 230kV Line 2–4 Upgrade',
          tag: 'Solution A',
          description: 'Upgrades Line 2-4 thermal rating to 190 MW and halves reactance to 0.032 p.u.',
          color: '#38bdf8',
          capexCostMillion: 15.2,
          opexAnnualMillion: 0.22,
          implementationMonths: 15,
          modifications: [
            { targetId: 'line-2-4', property: 'thermalRatingMw', label: 'Line 2-4 Rating', originalValue: 75, newValue: 190, unit: 'MW' },
            { targetId: 'line-2-4', property: 'reactancePu', label: 'Line 2-4 Reactance', originalValue: 0.088, newValue: 0.032, unit: 'p.u.' },
            { targetId: 'line-2-3', property: 'thermalRatingMw', label: 'Line 2-3 Rating', originalValue: 55, newValue: 140, unit: 'MW' }
          ]
        },
        {
          id: 'alt-eng2-peaker',
          name: 'West Valley Peaker Dispatch & Line 6–4 Reinforcement',
          tag: 'Solution B',
          description: 'Increases Bus 5 peaker output to 110 MW to feed South Metro locally and uprates Line 2-4.',
          color: '#10b981',
          capexCostMillion: 18.8,
          opexAnnualMillion: 0.55,
          implementationMonths: 11,
          modifications: [
            { targetId: 'gen-peaker-5', property: 'scheduledMw', label: 'Bus 5 Peaker Dispatch', originalValue: 55, newValue: 110, unit: 'MW' },
            { targetId: 'line-2-4', property: 'thermalRatingMw', label: 'Line 2-4 Thermal Uprate', originalValue: 75, newValue: 150, unit: 'MW' },
            { targetId: 'line-2-3', property: 'thermalRatingMw', label: 'Line 2-3 Thermal Uprate', originalValue: 55, newValue: 120, unit: 'MW' }
          ]
        },
        {
          id: 'alt-eng2-dlr',
          name: 'Dynamic Line Rating (DLR) Sensors & Phase-Shifting Tap',
          tag: 'Solution C',
          description: 'Real-time weather-based dynamic thermal rating and impedance balancing across parallel corridors.',
          color: '#ec4899',
          capexCostMillion: 7.4,
          opexAnnualMillion: 0.18,
          implementationMonths: 6,
          modifications: [
            { targetId: 'line-2-4', property: 'thermalRatingMw', label: 'DLR Verified Rating', originalValue: 75, newValue: 135, unit: 'MW' },
            { targetId: 'line-2-3', property: 'thermalRatingMw', label: 'DLR Line 2-3 Rating', originalValue: 55, newValue: 115, unit: 'MW' }
          ]
        }
      ]
    },
    {
      id: 'prob-energy-3',
      title: 'High-Tech Data Center & Fab Feeder Overload (Line 3–6)',
      description: 'AI cluster and semiconductor fab load growth at Bus 6 pushes Line 3-6 beyond its thermal limit.',
      domain: 'energy',
      affectedAssetIds: ['line-3-6', 'bus-6', 'bus-3'],
      measurableSymptom: 'Line 3-6 active power flow exceeds de-rated 32 MW feeder limit',
      thresholdConstraint: 'Maximum Line Loading <= 100.0%',
      horizon: '4 Years (2026–2030)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — data center grid interconnection study',
      baselineInputsSummary: 'Line 3-6 Rating: 32 MW; Bus 6 Data Center Load: 48 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-3-6', property: 'thermalRatingMw', label: 'Feeder 3-6 Thermal Limit', originalValue: 95, newValue: 32, unit: 'MW' },
        { targetId: 'line-3-6', property: 'reactancePu', label: 'Feeder 3-6 Reactance', originalValue: 0.045, newValue: 0.028, unit: 'p.u.' }
      ]
    },
    {
      id: 'prob-energy-4',
      title: 'North Thermal Slack Corridor Export Bottleneck (Line 1–2)',
      description: 'Low wind output at Bus 8 forces North Thermal Plant (Bus 1) to pick up system slack, overloading primary export Line 1-2.',
      domain: 'energy',
      affectedAssetIds: ['line-1-2', 'bus-1', 'gen-wind-8'],
      measurableSymptom: 'Slack bus export pushes Line 1-2 past 120 MW seasonal conductor rating',
      thresholdConstraint: 'Maximum Export Corridor Loading <= 100.0%',
      horizon: '5 Years (2026–2031)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — renewable dunkelflaute dispatch study',
      baselineInputsSummary: 'Wind output: 10 MW; Line 1-2 Seasonal Rating: 115 MW',
      available: true,
      baselineModifications: [
        { targetId: 'gen-wind-8', property: 'scheduledMw', label: 'Low-Wind Generation', originalValue: 45, newValue: 10, unit: 'MW' },
        { targetId: 'line-1-2', property: 'thermalRatingMw', label: 'Line 1-2 Seasonal Limit', originalValue: 260, newValue: 115, unit: 'MW' }
      ]
    },
    {
      id: 'prob-energy-5',
      title: 'Northeast Wind Farm Curtailment & Collector Overload (Line 8–3)',
      description: 'High wind generation surge at Bus 8 (105 MW) overwhelms collector Line 8-3 into East Industrial Substation.',
      domain: 'energy',
      affectedAssetIds: ['line-8-3', 'bus-8', 'gen-wind-8'],
      measurableSymptom: 'Collector Line 8-3 loading exceeds 60 MW export rating during peak wind harvest',
      thresholdConstraint: 'Maximum Collector Loading <= 100.0%',
      horizon: '3 Years (2026–2029)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — renewable export congestion study',
      baselineInputsSummary: 'Wind Generation: 105 MW; Line 8-3 Rating: 55 MW',
      available: true,
      baselineModifications: [
        { targetId: 'gen-wind-8', property: 'scheduledMw', label: 'Peak Wind Output', originalValue: 45, newValue: 105, unit: 'MW' },
        { targetId: 'line-8-3', property: 'thermalRatingMw', label: 'Collector 8-3 Rating', originalValue: 115, newValue: 55, unit: 'MW' }
      ]
    },
    {
      id: 'prob-energy-6',
      title: 'Harbor Desalination & Electrified Crane Feeder Congestion (Line 3–9)',
      description: 'Cold-ironing shore power and desalination pumps at Bus 9 overload coastal feeder Line 3-9.',
      domain: 'energy',
      affectedAssetIds: ['line-3-9', 'bus-9', 'line-9-6'],
      measurableSymptom: 'Coastal feeder Line 3-9 loading exceeds 22 MW limit',
      thresholdConstraint: 'Maximum Coastal Feeder Loading <= 100.0%',
      horizon: '4 Years (Port Electrification)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — port electrification DC load flow',
      baselineInputsSummary: 'Line 3-9 Thermal Rating: 18 MW; Port Load: 34 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-3-9', property: 'thermalRatingMw', label: 'Harbor Feeder Rating', originalValue: 90, newValue: 18, unit: 'MW' },
        { targetId: 'line-3-9', property: 'reactancePu', label: 'Harbor Feeder Reactance', originalValue: 0.052, newValue: 0.032, unit: 'p.u.' }
      ]
    },
    {
      id: 'prob-energy-7',
      title: 'South Rail Traction Substation Peak Commute Overload (Line 4–10)',
      description: 'Simultaneous electric locomotive acceleration on South Rail Traction Substation overloads radial feeder Line 4-10.',
      domain: 'energy',
      affectedAssetIds: ['line-4-10', 'bus-10', 'bus-4'],
      measurableSymptom: 'Traction feeder Line 4-10 exceeds 22 MW continuous thermal limit',
      thresholdConstraint: 'Maximum Traction Feeder Loading <= 100.0%',
      horizon: '5 Years (Rail Electrification)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — traction power flow template',
      baselineInputsSummary: 'Line 4-10 Thermal Rating: 20 MW; Traction Load: 26 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-4-10', property: 'thermalRatingMw', label: 'Traction Feeder Limit', originalValue: 95, newValue: 20, unit: 'MW' },
        { targetId: 'line-4-10', property: 'reactancePu', label: 'Traction Feeder Reactance', originalValue: 0.048, newValue: 0.029, unit: 'p.u.' }
      ]
    },
    {
      id: 'prob-energy-8',
      title: 'West Valley Gas Peaker Forced Derating & Import Stress',
      description: 'Cooling water restrictions derate West Valley Gas Peaker (Bus 5) to 15 MW, forcing heavy power imports across Line 4-5 and Line 5-2.',
      domain: 'energy',
      affectedAssetIds: ['gen-peaker-5', 'line-5-2', 'line-4-5', 'bus-5'],
      measurableSymptom: 'Slack generation and Line 1-2 / Line 2-3 imports surge above thermal ratings',
      thresholdConstraint: 'Maximum Corridor Loading <= 100.0%',
      horizon: '2 Years (Summer Peaker Reliability)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — generator forced derating study',
      baselineInputsSummary: 'Bus 5 Peaker output: 15 MW (down from 55 MW)',
      available: true,
      baselineModifications: [
        { targetId: 'gen-peaker-5', property: 'scheduledMw', label: 'Derated Peaker Output', originalValue: 55, newValue: 15, unit: 'MW' }
      ]
    },
    {
      id: 'prob-energy-9',
      title: 'North Valley Intertie Corridor Loop Flow Overload (Line 1–7 & 7–2)',
      description: 'Impedance mismatch between direct Line 1-2 and parallel intertie path 1-7-2 concentrates loop flow on North Valley Intertie.',
      domain: 'energy',
      affectedAssetIds: ['line-1-7', 'line-7-2', 'bus-7'],
      measurableSymptom: 'Intertie Line 1-7 exceeds de-rated 85 MW stability limit',
      thresholdConstraint: 'Maximum Intertie Loading <= 100.0%',
      horizon: '5 Years (2026–2031)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — loop flow impedance study',
      baselineInputsSummary: 'Line 1-7 Reactance: 0.022 p.u.; Line 1-7 Rating: 85 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-1-7', property: 'reactancePu', label: 'Intertie Reactance', originalValue: 0.036, newValue: 0.022, unit: 'p.u.' },
        { targetId: 'line-1-7', property: 'thermalRatingMw', label: 'Intertie Thermal Limit', originalValue: 220, newValue: 85, unit: 'MW' }
      ]
    },
    {
      id: 'prob-energy-10',
      title: 'University Microgrid Tie Feeder Overload (Line 4–11 & 6–11)',
      description: 'Campus district heating electrification increases Bus 11 load while tie feeder Line 4-11 is thermally constrained.',
      domain: 'energy',
      affectedAssetIds: ['line-4-11', 'line-6-11', 'bus-11'],
      measurableSymptom: 'Campus tie Line 4-11 loading exceeds 14 MW rating',
      thresholdConstraint: 'Maximum Tie Line Loading <= 100.0%',
      horizon: '4 Years (Campus Decarbonization)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — microgrid tie study',
      baselineInputsSummary: 'Line 4-11 Thermal Rating: 12 MW; Bus 11 Load: 24 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-4-11', property: 'thermalRatingMw', label: 'Campus Tie Thermal Limit', originalValue: 95, newValue: 12, unit: 'MW' },
        { targetId: 'line-4-11', property: 'reactancePu', label: 'Campus Tie Reactance', originalValue: 0.044, newValue: 0.026, unit: 'p.u.' }
      ]
    },
    {
      id: 'prob-energy-11',
      title: 'West Agritech Irrigation Pumping Peak Feeder Stress (Line 1–12)',
      description: 'Simultaneous groundwater pumping in West Agritech zone overloads rural sub-transmission feeder Line 1-12.',
      domain: 'energy',
      affectedAssetIds: ['line-1-12', 'line-12-5', 'bus-12'],
      measurableSymptom: 'Feeder Line 1-12 loading exceeds 25 MW rural conductor rating',
      thresholdConstraint: 'Maximum Rural Feeder Loading <= 100.0%',
      horizon: '3 Years (Agricultural Peak)',
      units: 'MW, % loading',
      dataSource: 'Synthetic demo data — rural sub-transmission template',
      baselineInputsSummary: 'Line 1-12 Thermal Rating: 22 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-1-12', property: 'thermalRatingMw', label: 'Rural Feeder 1-12 Limit', originalValue: 120, newValue: 22, unit: 'MW' },
        { targetId: 'line-1-12', property: 'reactancePu', label: 'Rural Feeder 1-12 Reactance', originalValue: 0.062, newValue: 0.038, unit: 'p.u.' }
      ]
    },
    {
      id: 'prob-energy-12',
      title: 'High System I²R Transmission Loss & Corridor Impedance Imbalance',
      description: 'Aged high-resistance conductors on primary corridors drive total post-processed I²R transmission losses above budget threshold.',
      domain: 'energy',
      affectedAssetIds: ['line-2-3', 'line-2-4', 'line-1-2'],
      measurableSymptom: 'System-wide I²R losses and corridor loading breach strict 4.5 MW loss cap',
      thresholdConstraint: 'Maximum Total Line Losses <= 4.5 MW',
      horizon: '5 Years (Grid Efficiency Mandate)',
      units: 'MW losses, % loading',
      dataSource: 'Synthetic demo data — transmission loss minimization study',
      baselineInputsSummary: 'Loss Constraint Threshold: <= 4.5 MW; Line 2-3 Rating: 55 MW',
      available: true,
      baselineModifications: [
        { targetId: 'line-2-3', property: 'reactancePu', label: 'Aged Line 2-3 Reactance', originalValue: 0.075, newValue: 0.095, unit: 'p.u.' }
      ],
      constraintsOverride: [
        { id: 'c_loss', name: 'Strict Line Loss Cap', metricKey: 'primaryPerformance', threshold: 4.5, operator: '<=', unit: 'MW', severity: 'hard' },
        { id: 'c_cost', name: 'Expansion Budget', metricKey: 'cost', threshold: 25.0, operator: '<=', unit: '$M', severity: 'hard' }
      ]
    },
    {
      id: 'prob-energy-unavail-1',
      title: 'AC Reactive Power (MVAR) Voltage Collapse & Saddle-Node Bifurcation (Unavailable)',
      description: 'Nonlinear AC Newton-Raphson Q-V reactive power exhaustion and voltage magnitude collapse analysis.',
      domain: 'energy',
      affectedAssetIds: ['bus-3'],
      measurableSymptom: 'Unavailable for this model',
      thresholdConstraint: 'Unavailable — requires full nonlinear AC power flow solver',
      horizon: 'N/A',
      units: 'N/A',
      dataSource: 'Model Limitation Disclosure',
      baselineInputsSummary: 'Not applicable — DC load flow assumes flat voltage magnitudes (|V| = 1.0 p.u.) and small phase angles.',
      available: false,
      unavailableReason: 'Unavailable for this model: The implemented electrical solver is a linear DC Power Flow engine (P = Bθ) with post-processed I²R loss estimation. It assumes flat 1.0 p.u. bus voltages and does not solve reactive power (MVAR) or AC voltage collapse.'
    },
    {
      id: 'prob-energy-unavail-2',
      title: 'Sub-Cycle Electromagnetic Transient (EMT) & Inverter Subsynchronous Resonance (Unavailable)',
      description: 'Microsecond-resolution differential equation simulation of switching surges and inverter-based resource (IBR) control loops.',
      domain: 'energy',
      affectedAssetIds: ['bus-8'],
      measurableSymptom: 'Unavailable for this model',
      thresholdConstraint: 'Unavailable — requires time-domain EMT differential solver',
      horizon: 'N/A',
      units: 'N/A',
      dataSource: 'Model Limitation Disclosure',
      baselineInputsSummary: 'Not applicable — steady-state algebraic nodal admittance formulation omits inductance/capacitance differential transients.',
      available: false,
      unavailableReason: 'Unavailable for this model: The steady-state DC load flow solver computes algebraic phase angles and active power flows; sub-cycle electromagnetic transients (EMT) and harmonic resonance are not modeled.'
    }
  ]
};

export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: 'scen-traffic-campus',
    title: 'Campus Traffic Optimization',
    description: 'How can we reduce peak-hour traffic congestion and vehicle queue spillback around VVITU campus during 8–10 AM commute?',
    category: 'Urban Planning',
    domain: 'traffic',
    updatedAt: '2 hours ago',
    status: 'completed',
    problemStatement: PROBLEM_CATALOG.traffic[0],
    futureScenarios: [
      {
        id: 'fut-traf-5yr',
        name: '5-Year Enrollment Growth (+20% Demand)',
        horizonYears: 5,
        parameterShift: 'Inflow demand increases by +20% across arterial gateways',
        multiplier: 1.20,
        description: 'Simulates university enrollment expansion and new hospital wing commuter traffic.'
      },
      {
        id: 'fut-traf-incident',
        name: 'North Arterial Lane Closure Contingency',
        horizonYears: 1,
        parameterShift: 'North Arterial Inflow reduced by 1 lane (Construction/Incident)',
        multiplier: 1.05,
        contingencyAssetId: 'cell-nw-in',
        description: 'Evaluates corridor resilience when primary inflow arterial loses a lane during utility excavation.'
      },
      {
        id: 'fut-traf-10yr-surge',
        name: '10-Year Regional Employment & Stadium Event Surge (+35% Demand)',
        horizonYears: 10,
        parameterShift: 'Corridor inflow demand increases by +35% during regional peak',
        multiplier: 1.35,
        description: 'Tests long-horizon capacity exhaustion under combined commuter and event inflow.'
      }
    ],
    objectives: [
      { id: 'perf', name: 'Corridor Average Speed', unit: 'km/h', direction: 'maximize', weight: 0.35, description: 'Maintain rapid flow above 30 km/h' },
      { id: 'cost', name: 'Total 5-Yr Cost (Synthetic demo data)', unit: '$M', direction: 'minimize', weight: 0.25, description: 'Budget ceiling $18M' },
      { id: 'env', name: 'Emissions & Delay Relief', unit: 'Score', direction: 'maximize', weight: 0.20, description: 'Minimize vehicle queue delay' },
      { id: 'benefit', name: 'User Benefit & Mode Shift', unit: 'Score', direction: 'maximize', weight: 0.20, description: 'Commuter travel reliability' }
    ],
    assumptions: [
      { id: 'asm_demand', name: 'Peak Inflow Demand', category: 'demand', value: 2450, unit: 'veh/h', rangeMin: 1800, rangeMax: 3200, description: 'Morning peak vehicle inflow from North-West arterial' },
      { id: 'asm_jam_density', name: 'Jam Density', category: 'physics', value: 130, unit: 'veh/km/lane', rangeMin: 100, rangeMax: 160, description: 'Bumper-to-bumper standstill density' },
      { id: 'asm_free_speed', name: 'Arterial Free Flow Speed', category: 'physics', value: 55, unit: 'km/h', rangeMin: 40, rangeMax: 65, description: 'Uncongested corridor speed limit' },
      { id: 'asm_growth', name: 'Annual Traffic Growth Rate', category: 'demand', value: 3.5, unit: '%/yr', rangeMin: 1.0, rangeMax: 6.0, description: 'Anticipated campus enrollment expansion' }
    ],
    constraints: [
      { id: 'c_cost', name: 'Budget Cap', metricKey: 'cost', threshold: 18.0, operator: '<=', unit: '$M', severity: 'hard' },
      { id: 'c_speed', name: 'Minimum Peak Speed', metricKey: 'primaryPerformance', threshold: 22.0, operator: '>=', unit: 'km/h', severity: 'hard' }
    ],
    trafficNetwork: BASE_TRAFFIC_NETWORK,
    alternatives: [
      {
        id: 'alt-metro',
        name: 'Metro Stop (Elevated Rapid Transit)',
        tag: 'Solution A',
        description: 'Direct elevated rapid transit link into VVITU central hub. Absorbs 45% of single-occupancy inflow and coordinates gateway green phases.',
        color: '#6366f1',
        capexCostMillion: 12.5,
        opexAnnualMillion: 0.35,
        implementationMonths: 18,
        modifications: [
          { targetId: 'cell-nw-in', property: 'inflowDemandVehHour', label: 'Inflow Demand Shift', originalValue: 2450, newValue: 1320, unit: 'veh/h' },
          { targetId: 'cell-hub-1', property: 'signalGreenRatio', label: 'Gateway Signal Green', originalValue: 0.48, newValue: 0.76, unit: 'ratio' },
          { targetId: 'cell-hub-2', property: 'signalGreenRatio', label: 'Plaza Signal Priority', originalValue: 0.44, newValue: 0.74, unit: 'ratio' },
          { targetId: 'cell-campus-main', property: 'initialDensityVehKmPerLane', label: 'Boulevard Queue Relief', originalValue: 98, newValue: 42, unit: 'veh/km/ln' },
          { targetId: 'cell-hub-1', property: 'initialDensityVehKmPerLane', label: 'Gateway Queue Relief', originalValue: 102, newValue: 45, unit: 'veh/km/ln' },
          { targetId: 'cell-hub-2', property: 'initialDensityVehKmPerLane', label: 'Plaza Queue Relief', originalValue: 112, newValue: 48, unit: 'veh/km/ln' }
        ]
      },
      {
        id: 'alt-widen',
        name: 'Widen Roads & Grade Separation',
        tag: 'Solution B',
        description: 'Add a 3rd vehicular lane on North Arterial, Gateway, and Central Boulevard with grade-separated plaza flow.',
        color: '#f59e0b',
        capexCostMillion: 15.8,
        opexAnnualMillion: 0.40,
        implementationMonths: 24,
        modifications: [
          { targetId: 'cell-nw-in', property: 'lanes', label: 'North Arterial Lanes', originalValue: 2, newValue: 3, unit: 'lanes' },
          { targetId: 'cell-hub-1', property: 'lanes', label: 'Gateway Approach Lanes', originalValue: 2, newValue: 3, unit: 'lanes' },
          { targetId: 'cell-campus-main', property: 'lanes', label: 'Boulevard Lanes', originalValue: 2, newValue: 3, unit: 'lanes' },
          { targetId: 'cell-hub-2', property: 'lanes', label: 'Plaza Underpass Lanes', originalValue: 2, newValue: 3, unit: 'lanes' },
          { targetId: 'cell-hub-2', property: 'signalGreenRatio', label: 'Grade-Sep Effective Green', originalValue: 0.44, newValue: 0.70, unit: 'ratio' },
          { targetId: 'cell-campus-main', property: 'initialDensityVehKmPerLane', label: 'Widened Lane Density', originalValue: 98, newValue: 58, unit: 'veh/km/ln' },
          { targetId: 'cell-hub-1', property: 'initialDensityVehKmPerLane', label: 'Gateway Lane Density', originalValue: 102, newValue: 62, unit: 'veh/km/ln' },
          { targetId: 'cell-hub-2', property: 'initialDensityVehKmPerLane', label: 'Plaza Underpass Density', originalValue: 112, newValue: 64, unit: 'veh/km/ln' }
        ]
      },
      {
        id: 'alt-bus',
        name: 'Add Bus Rapid Transit & TSP',
        tag: 'Solution C',
        description: 'High-frequency electric shuttle feeders with Transit Signal Priority (TSP) and dedicated curb boarding lanes.',
        color: '#10b981',
        capexCostMillion: 6.8,
        opexAnnualMillion: 0.75,
        implementationMonths: 9,
        modifications: [
          { targetId: 'cell-nw-in', property: 'inflowDemandVehHour', label: 'Bus Modal Shift', originalValue: 2450, newValue: 1680, unit: 'veh/h' },
          { targetId: 'cell-hub-1', property: 'signalGreenRatio', label: 'Gateway TSP Green', originalValue: 0.48, newValue: 0.70, unit: 'ratio' },
          { targetId: 'cell-hub-2', property: 'signalGreenRatio', label: 'Plaza TSP Green', originalValue: 0.44, newValue: 0.68, unit: 'ratio' },
          { targetId: 'cell-hub-3', property: 'signalGreenRatio', label: 'Hospital TSP Green', originalValue: 0.52, newValue: 0.70, unit: 'ratio' },
          { targetId: 'cell-campus-main', property: 'initialDensityVehKmPerLane', label: 'TSP Queue Relief', originalValue: 98, newValue: 54, unit: 'veh/km/ln' },
          { targetId: 'cell-hub-1', property: 'initialDensityVehKmPerLane', label: 'Gateway TSP Relief', originalValue: 102, newValue: 56, unit: 'veh/km/ln' },
          { targetId: 'cell-hub-2', property: 'initialDensityVehKmPerLane', label: 'Plaza TSP Relief', originalValue: 112, newValue: 60, unit: 'veh/km/ln' }
        ]
      }
    ]
  },
  {
    id: 'scen-water-district',
    title: 'Hillside Municipal Water District',
    description: 'Resolve chronic low water pressure (118.0 kPa vs 180.0 kPa minimum) at North Ridge Residential Zone and reduce main trunk velocity/head-loss.',
    category: 'Water Utility',
    domain: 'water',
    updatedAt: '1 day ago',
    status: 'completed',
    problemStatement: PROBLEM_CATALOG.water[0],
    futureScenarios: [
      {
        id: 'fut-water-5yr',
        name: '5-Year Urban Expansion (+25% Water Demand)',
        horizonYears: 5,
        parameterShift: 'Municipal junction base demands increase by +25%',
        multiplier: 1.25,
        description: 'Simulates new residential subdivisions connecting to the hillside hydraulic grid.'
      },
      {
        id: 'fut-water-trunk-break',
        name: 'Primary Trunk Line Maintenance Throttling',
        horizonYears: 1,
        parameterShift: 'Pipe Trunk-1 diameter throttled by 35% for scheduled valve/lining work',
        multiplier: 1.0,
        contingencyAssetId: 'pipe-trunk-1',
        description: 'Tests network hydraulic head resilience when main supply trunk is partially isolated.'
      },
      {
        id: 'fut-water-drought-surge',
        name: '10-Year Summer Heatwave & Peak Irrigation Draw (+40% Demand)',
        horizonYears: 10,
        parameterShift: 'All district junction draws increase by +40% during extreme summer peak',
        multiplier: 1.40,
        description: 'Evaluates hillside pressure margin under compounded population growth and summer peak draw.'
      }
    ],
    objectives: [
      { id: 'perf', name: 'Minimum Node Pressure', unit: 'kPa', direction: 'maximize', weight: 0.40, description: 'Maintain minimum 180 kPa across all hillside junctions' },
      { id: 'cost', name: 'Total 5-Yr Cost (Synthetic demo data)', unit: '$M', direction: 'minimize', weight: 0.30, description: 'Budget cap $12M' },
      { id: 'benefit', name: 'Hydraulic Head Margin & Reliability', unit: 'Score', direction: 'maximize', weight: 0.30, description: 'Eliminate low-pressure service violations' }
    ],
    assumptions: [
      { id: 'asm_density', name: 'Water Density (ρ)', category: 'physics', value: 1000, unit: 'kg/m³', rangeMin: 995, rangeMax: 1005, description: 'Assumed water density at 20°C' },
      { id: 'asm_peak_factor', name: 'Peak Hour Demand Multiplier', category: 'demand', value: 1.65, unit: 'multiplier', rangeMin: 1.2, rangeMax: 2.2, description: 'Morning diurnal peak draw factor' },
      { id: 'asm_roughness', name: 'Pipe smoothness adjustment index', category: 'physics', value: 110, unit: 'relative index', rangeMin: 90, rangeMax: 135, description: 'Scales the synthetic absolute roughness inputs; a higher index represents smoother pipe walls. Replace with surveyed roughness data for site studies.' }
    ],
    constraints: [
      { id: 'c_pres', name: 'Minimum Pressure Threshold', metricKey: 'primaryPerformance', threshold: 180.0, operator: '>=', unit: 'kPa', severity: 'hard' },
      { id: 'c_max_pres', name: 'Maximum Safe Pressure Ceiling', metricKey: 'maxPressure', threshold: 550.0, operator: '<=', unit: 'kPa', severity: 'hard' },
      { id: 'c_cost', name: 'Capital Budget Limit', metricKey: 'cost', threshold: 12.0, operator: '<=', unit: '$M', severity: 'hard' }
    ],
    waterNetwork: BASE_WATER_NETWORK,
    alternatives: [
      {
        id: 'alt-loop',
        name: 'Parallel High-Pressure Ductile Loop',
        tag: 'Solution A',
        description: 'Upsize the synthetic main trunk and booster main, enlarge the North Ridge feed, and apply an illustrative 0.554mm absolute roughness input.',
        color: '#06b6d4',
        capexCostMillion: 5.4,
        opexAnnualMillion: 0.08,
        implementationMonths: 12,
        modifications: [
          { targetId: 'pipe-trunk-1', property: 'diameter', label: 'Main Trunk Sizing', originalValue: 0.48, newValue: 0.62, unit: 'm' },
          { targetId: 'pipe-pump-boost', property: 'diameter', label: 'Booster Main Sizing', originalValue: 0.44, newValue: 0.56, unit: 'm' },
          { targetId: 'pipe-valley-prv', property: 'diameter', label: 'Valley-PRV Feeder', originalValue: 0.32, newValue: 0.44, unit: 'm' },
          { targetId: 'pipe-prv-ridge', property: 'diameter', label: 'North Ridge Diameter', originalValue: 0.215, newValue: 0.38, unit: 'm' },
          { targetId: 'pipe-prv-ridge', property: 'absoluteRoughnessMm', label: 'PRV-Ridge Absolute Roughness', originalValue: 0.9964, newValue: 0.5543, unit: 'mm' },
          { targetId: 'pipe-ridge-tank', property: 'diameter', label: 'Tank Riser Diameter', originalValue: 0.24, newValue: 0.36, unit: 'm' }
        ]
      },
      {
        id: 'alt-booster',
        name: 'Elevated Booster Tank & Variable Pump',
        tag: 'Solution B',
        description: 'Boost source pumping head to 245m and upgrade Ridge and South Hillside feeders.',
        color: '#3b82f6',
        capexCostMillion: 7.8,
        opexAnnualMillion: 0.28,
        implementationMonths: 16,
        modifications: [
          { targetId: 'res-east', property: 'head', label: 'Pumped Source Head', originalValue: 230, newValue: 245, unit: 'm' },
          { targetId: 'pipe-trunk-1', property: 'diameter', label: 'Trunk Pipe Sizing', originalValue: 0.48, newValue: 0.58, unit: 'm' },
          { targetId: 'pipe-prv-ridge', property: 'diameter', label: 'Ridge Supply Pipe', originalValue: 0.215, newValue: 0.34, unit: 'm' },
          { targetId: 'pipe-valley-south', property: 'diameter', label: 'South Feed Diameter', originalValue: 0.26, newValue: 0.36, unit: 'm' }
        ]
      },
      {
        id: 'alt-valves',
        name: 'Smart Pressure Regulating Valves & Relining',
        tag: 'Solution C',
        description: 'Epoxy-reline Ridge and Trunk mains using illustrative absolute roughness inputs, then increase PRV-Ridge bore to 320mm.',
        color: '#8b5cf6',
        capexCostMillion: 3.2,
        opexAnnualMillion: 0.14,
        implementationMonths: 6,
        modifications: [
          { targetId: 'pipe-trunk-1', property: 'diameter', label: 'Trunk Bottleneck Relief', originalValue: 0.48, newValue: 0.56, unit: 'm' },
          { targetId: 'pipe-prv-ridge', property: 'diameter', label: 'PRV-Ridge Bore', originalValue: 0.215, newValue: 0.32, unit: 'm' },
          { targetId: 'pipe-prv-ridge', property: 'absoluteRoughnessMm', label: 'Relined Pipe Absolute Roughness', originalValue: 0.9964, newValue: 0.5693, unit: 'mm' }
        ]
      }
    ]
  },
  {
    id: 'scen-power-grid',
    title: 'Regional Substation Grid Expansion',
    description: 'Alleviate transmission line thermal overload on Bus 2–Bus 3 corridor during summer heatwave peak loading.',
    category: 'Energy',
    domain: 'energy',
    updatedAt: '3 days ago',
    status: 'completed',
    problemStatement: PROBLEM_CATALOG.energy[0],
    futureScenarios: [
      {
        id: 'fut-energy-5yr',
        name: '5-Year Regional Industrial Electrification (+30% Load)',
        horizonYears: 5,
        parameterShift: 'Industrial, Port, and Data Center loads increase by +30%',
        multiplier: 1.30,
        description: 'Models semiconductor fab expansion and port crane electrification.'
      },
      {
        id: 'fut-energy-n1',
        name: 'N-1 Transmission Line Trip (Line 2-4 Outage)',
        horizonYears: 1,
        parameterShift: 'Line 2-4 disconnected (x=99.0 p.u.) during peak load',
        multiplier: 1.0,
        contingencyAssetId: 'line-2-4',
        description: 'Mandatory N-1 reliability screening when parallel South Metro corridor trips.'
      },
      {
        id: 'fut-energy-ev-heatwave',
        name: '10-Year EV Fast-Charging & Extreme Heatwave Surge (+45% Load)',
        horizonYears: 10,
        parameterShift: 'System-wide substation active power demand increases by +45%',
        multiplier: 1.45,
        description: 'Evaluates transmission thermal limits and I²R losses under heavy EV fleet charging.'
      }
    ],
    objectives: [
      { id: 'perf', name: 'Total Line I²R Losses', unit: 'MW', direction: 'minimize', weight: 0.35, description: 'Minimize transmission thermal waste' },
      { id: 'cost', name: 'Capital & Operating Cost (Synthetic demo data)', unit: '$M', direction: 'minimize', weight: 0.30, description: 'Capital budget ceiling $25M' },
      { id: 'benefit', name: 'Grid Capacity & Thermal Margin', unit: 'Score', direction: 'maximize', weight: 0.35, description: 'Eliminate conductor thermal violations' }
    ],
    assumptions: [
      { id: 'asm_base_mva', name: 'System Base MVA', category: 'physics', value: 100, unit: 'MVA', rangeMin: 100, rangeMax: 100, description: 'System per-unit reference base' },
      { id: 'asm_pf', name: 'Nominal Load Power Factor', category: 'physics', value: 0.95, unit: 'lagging', rangeMin: 0.88, rangeMax: 0.98, description: 'Used for post-processed I²R loss estimation' },
      { id: 'asm_summer_peak', name: 'Summer Peak Load Multiplier', category: 'demand', value: 1.25, unit: 'x', rangeMin: 1.0, rangeMax: 1.45, description: 'Air conditioning surge factor' }
    ],
    constraints: [
      { id: 'c_loss', name: 'Maximum Line Losses', metricKey: 'primaryPerformance', threshold: 12.0, operator: '<=', unit: 'MW', severity: 'hard' },
      { id: 'c_cost', name: 'Expansion Budget', metricKey: 'cost', threshold: 25.0, operator: '<=', unit: '$M', severity: 'hard' }
    ],
    powerNetwork: BASE_POWER_NETWORK,
    alternatives: [
      {
        id: 'alt-line-upgrade',
        name: 'High-Capacity Line 2–3 Re-conductoring',
        tag: 'Solution A',
        description: 'Replace Line 2-3 with HTLS composite-core conductor, lowering reactance to 0.036 p.u. and raising thermal rating to 180 MW.',
        color: '#38bdf8',
        capexCostMillion: 14.2,
        opexAnnualMillion: 0.20,
        implementationMonths: 14,
        modifications: [
          { targetId: 'line-2-3', property: 'reactancePu', label: 'Reactance x (p.u.)', originalValue: 0.075, newValue: 0.036, unit: 'p.u.' },
          { targetId: 'line-2-3', property: 'thermalRatingMw', label: 'Thermal Rating', originalValue: 55, newValue: 180, unit: 'MW' }
        ]
      },
      {
        id: 'alt-bess',
        name: 'Distributed BESS & Peaker Dispatch',
        tag: 'Solution B',
        description: 'Dispatch local generation at Bus 5 and Bus 8 and upgrade Line 2-3 thermal rating to 130 MW.',
        color: '#10b981',
        capexCostMillion: 21.0,
        opexAnnualMillion: 0.50,
        implementationMonths: 10,
        modifications: [
          { targetId: 'gen-peaker-5', property: 'scheduledMw', label: 'Peaker Dispatch', originalValue: 55, newValue: 85, unit: 'MW' },
          { targetId: 'gen-wind-8', property: 'scheduledMw', label: 'Wind/BESS Dispatch', originalValue: 45, newValue: 75, unit: 'MW' },
          { targetId: 'line-2-3', property: 'thermalRatingMw', label: 'Line 2-3 Rating', originalValue: 55, newValue: 130, unit: 'MW' }
        ]
      },
      {
        id: 'alt-shunt',
        name: 'Series Capacitors & Dynamic Line Rating',
        tag: 'Solution C',
        description: 'Install series compensation on Line 2-4 and dynamic thermal rating on Line 2-3 (uprated to 110 MW).',
        color: '#ec4899',
        capexCostMillion: 8.5,
        opexAnnualMillion: 0.15,
        implementationMonths: 6,
        modifications: [
          { targetId: 'line-2-4', property: 'reactancePu', label: 'Line 2-4 Series Reactance', originalValue: 0.058, newValue: 0.034, unit: 'p.u.' },
          { targetId: 'line-2-3', property: 'thermalRatingMw', label: 'DLR Thermal Rating', originalValue: 55, newValue: 110, unit: 'MW' }
        ]
      }
    ]
  }
];

/**
 * Applies a selected ProblemStatement template from PROBLEM_CATALOG to a scenario,
 * mutating the baseline network parameters, affected assets, constraints, assumptions,
 * candidate solutions (>=3), and future scenarios so selecting a different problem
 * genuinely changes all downstream calculations, diagnostics, and 2D/3D visualizations.
 */
export function applyProblemTemplateToScenario(
  scenario: Scenario,
  problemId: string
): Scenario {
  const domainCatalog = PROBLEM_CATALOG[scenario.domain] || [];
  const template = domainCatalog.find((p) => p.id === problemId);
  if (!template) return scenario;

  // Start from clean canonical domain network so previous template overrides never leak
  const baseTraffic: TrafficNetwork = {
    ...BASE_TRAFFIC_NETWORK,
    cells: BASE_TRAFFIC_NETWORK.cells.map((c) => ({ ...c, nextCellIds: [...c.nextCellIds] }))
  };
  const baseWater: WaterNetwork = {
    ...BASE_WATER_NETWORK,
    nodes: BASE_WATER_NETWORK.nodes.map((n) => ({ ...n })),
    pipes: BASE_WATER_NETWORK.pipes.map((p) => ({ ...p }))
  };
  const basePower: PowerGridNetwork = {
    ...BASE_POWER_NETWORK,
    buses: BASE_POWER_NETWORK.buses.map((b) => ({ ...b })),
    generators: BASE_POWER_NETWORK.generators.map((g) => ({ ...g })),
    loads: BASE_POWER_NETWORK.loads.map((l) => ({ ...l })),
    lines: BASE_POWER_NETWORK.lines.map((ln) => ({ ...ln }))
  };

  // Apply template baselineModifications to the clean canonical network
  const mods: ParameterModification[] = template.baselineModifications || [];
  if (scenario.domain === 'traffic') {
    for (const m of mods) {
      const cell = baseTraffic.cells.find((c) => c.id === m.targetId);
      if (cell) {
        if (m.property === 'lanes') cell.lanes = Math.max(1, Math.round(m.newValue));
        if (m.property === 'freeFlowSpeedKmh') cell.freeFlowSpeedKmh = m.newValue;
        if (m.property === 'signalGreenRatio') cell.signalGreenRatio = m.newValue;
        if (m.property === 'inflowDemandVehHour') cell.inflowDemandVehHour = m.newValue;
        if (m.property === 'initialDensityVehKmPerLane') cell.initialDensityVehKmPerLane = m.newValue;
      }
    }
  } else if (scenario.domain === 'water') {
    for (const m of mods) {
      const pipe = baseWater.pipes.find((p) => p.id === m.targetId);
      if (pipe) {
        if (m.property === 'diameter') pipe.diameter = m.newValue;
        if (m.property === 'absoluteRoughnessMm') pipe.absoluteRoughnessMm = m.newValue;
        if (m.property === 'hazenWilliamsC') {
          const oldC = Math.max(20, m.originalValue || pipe.hazenWilliamsC || 110);
          pipe.absoluteRoughnessMm = Math.max(0.001, (pipe.absoluteRoughnessMm ?? 0.15) * Math.pow(oldC / Math.max(20, m.newValue), 1.852));
          pipe.hazenWilliamsC = m.newValue;
        }
      }
      const node = baseWater.nodes.find((n) => n.id === m.targetId);
      if (node) {
        if (m.property === 'baseDemand') node.baseDemand = m.newValue;
        if (m.property === 'head') node.head = m.newValue;
      }
    }
  } else if (scenario.domain === 'energy') {
    for (const m of mods) {
      const line = basePower.lines.find((l) => l.id === m.targetId);
      if (line) {
        if (m.property === 'reactancePu') line.reactancePu = m.newValue;
        if (m.property === 'thermalRatingMw') line.thermalRatingMw = m.newValue;
      }
      const gen = basePower.generators.find((g) => g.id === m.targetId);
      if (gen) {
        if (m.property === 'scheduledMw') gen.scheduledMw = m.newValue;
      }
    }
  }

  // Build tailored alternatives if not explicitly overridden
  const defaultCanonicalScenario =
    DEFAULT_SCENARIOS.find((s) => s.domain === scenario.domain) || scenario;

  let tailoredAlternatives = template.alternativesOverride || defaultCanonicalScenario.alternatives;
  if (!template.alternativesOverride && mods.length > 0) {
    const primaryAssetId = template.affectedAssetIds?.[0] || mods[0]?.targetId || 'corridor';
    const primaryAssetName = primaryAssetId.replace(/^(cell|pipe|junc|line|bus)-/, '').replace(/[-_]/g, ' ');

    tailoredAlternatives = defaultCanonicalScenario.alternatives.map((baseAlt, idx) => {
      const extraMods: ParameterModification[] = mods.map((bm) => {
        let improvedVal = bm.originalValue;
        if (bm.property === 'lanes') improvedVal = Math.max(bm.originalValue, bm.newValue + (idx === 0 ? 2 : 1));
        else if (bm.property === 'signalGreenRatio') improvedVal = Math.min(0.82, bm.originalValue + (idx === 0 ? 0.22 : 0.14));
        else if (bm.property === 'inflowDemandVehHour') improvedVal = Math.round(bm.newValue * (idx === 0 ? 0.58 : idx === 1 ? 0.78 : 0.68));
        else if (bm.property === 'freeFlowSpeedKmh') improvedVal = bm.originalValue + (idx === 0 ? 6 : 2);
        else if (bm.property === 'initialDensityVehKmPerLane') improvedVal = Math.max(35, bm.originalValue - (idx === 0 ? 25 : 10));
        else if (bm.property === 'diameter') improvedVal = Number((bm.originalValue * (idx === 0 ? 1.35 : idx === 1 ? 1.25 : 1.18)).toFixed(2));
        else if (bm.property === 'hazenWilliamsC') improvedVal = idx === 0 ? 140 : idx === 1 ? 135 : 128;
        else if (bm.property === 'absoluteRoughnessMm') improvedVal = Math.max(0.001, bm.newValue * (idx === 0 ? 0.35 : idx === 1 ? 0.6 : 0.8));
        else if (bm.property === 'head') improvedVal = bm.originalValue + (idx === 0 ? 12 : 6);
        else if (bm.property === 'baseDemand') improvedVal = Number((bm.originalValue * (idx === 2 ? 0.85 : 1.0)).toFixed(3));
        else if (bm.property === 'thermalRatingMw') improvedVal = Math.round(bm.originalValue * (idx === 0 ? 1.4 : idx === 1 ? 1.2 : 1.1));
        else if (bm.property === 'reactancePu') improvedVal = Number((bm.originalValue * (idx === 0 ? 0.55 : 0.75)).toFixed(3));
        else if (bm.property === 'scheduledMw') improvedVal = Math.round(bm.originalValue * (idx === 1 ? 1.35 : 1.15));

        return {
          targetId: bm.targetId,
          property: bm.property,
          label: `${bm.label} Mitigation`,
          originalValue: bm.newValue,
          newValue: improvedVal,
          unit: bm.unit
        };
      });

      // Domain-specific tailored plain-language naming
      let tailoredName = baseAlt.name;
      let tailoredDesc = baseAlt.description;
      let capex = baseAlt.capexCostMillion;
      let opex = baseAlt.opexAnnualMillion;
      let months = baseAlt.implementationMonths;

      if (scenario.domain === 'traffic') {
        if (idx === 0) {
          tailoredName = `Dedicated Corridor Expansion & Transit Priority (${primaryAssetName})`;
          tailoredDesc = `Adds travel/transit capacity and increases signal green time ratio on ${primaryAssetName} to clear peak queue spillback.`;
          capex = 10.8;
          opex = 0.42;
          months = 14;
        } else if (idx === 1) {
          tailoredName = `Grade-Separated Flyover & Geometry Redesign (${primaryAssetName})`;
          tailoredDesc = `Constructs grade-separated bypass flyover and commercial lane widening to permanently eliminate junction friction on ${primaryAssetName}.`;
          capex = 15.6;
          opex = 0.65;
          months = 22;
        } else {
          tailoredName = `Smart Traffic Management & Signal Optimization (${primaryAssetName})`;
          tailoredDesc = `Deploys coordinated green wave timing, dynamic ramp metering, and queue detector feedback on ${primaryAssetName}.`;
          capex = 4.2;
          opex = 0.25;
          months = 6;
        }
      } else if (scenario.domain === 'water') {
        if (idx === 0) {
          tailoredName = `Parallel High-Capacity Main Replacement (${primaryAssetName})`;
          tailoredDesc = `Replaces aged/constricted main with smooth-bore high-diameter piping to eliminate friction head loss along ${primaryAssetName}.`;
          capex = 9.6;
          opex = 0.30;
          months = 12;
        } else if (idx === 1) {
          tailoredName = `Dedicated Pressure Booster & Surge Tank (${primaryAssetName})`;
          tailoredDesc = `Installs an automated inline booster pumping station and elevated surge balancing tank near ${primaryAssetName}.`;
          capex = 14.8;
          opex = 0.55;
          months = 18;
        } else {
          tailoredName = `Smart Pressure Regulating Valve & District Metering (${primaryAssetName})`;
          tailoredDesc = `Retunes PRV pilot controls and installs automated district metered area leak/pressure sensors on ${primaryAssetName}.`;
          capex = 3.6;
          opex = 0.20;
          months = 5;
        }
      } else {
        if (idx === 0) {
          tailoredName = `High-Capacity Line Re-conductoring (${primaryAssetName})`;
          tailoredDesc = `Re-conductors corridor line with high-temperature low-sag (HTLS) composite conductors, raising thermal capacity on ${primaryAssetName}.`;
          capex = 10.2;
          opex = 0.35;
          months = 12;
        } else if (idx === 1) {
          tailoredName = `Substation Battery Energy Storage (BESS) (${primaryAssetName})`;
          tailoredDesc = `Deploys utility-scale 4-hour battery energy storage at connected substation to shave peak corridor flows on ${primaryAssetName}.`;
          capex = 15.4;
          opex = 0.58;
          months = 16;
        } else {
          tailoredName = `Dynamic Line Rating (DLR) & Series Compensation (${primaryAssetName})`;
          tailoredDesc = `Installs weather-responsive dynamic line rating tension sensors and series capacitors on ${primaryAssetName}.`;
          capex = 4.6;
          opex = 0.24;
          months = 6;
        }
      }

      return {
        ...baseAlt,
        id: `${baseAlt.id}-${template.id}`,
        name: tailoredName,
        description: tailoredDesc,
        capexCostMillion: capex,
        opexAnnualMillion: opex,
        implementationMonths: months,
        modifications: [
          ...extraMods,
          ...baseAlt.modifications.filter(
            (m) => !extraMods.some((em) => em.targetId === m.targetId && em.property === m.property)
          )
        ]
      };
    });
  }

  return {
    ...scenario,
    title: template.title,
    description: template.description,
    problemStatement: template,
    constraints: template.constraintsOverride || defaultCanonicalScenario.constraints,
    assumptions: template.assumptionsOverride || defaultCanonicalScenario.assumptions,
    alternatives: tailoredAlternatives,
    futureScenarios:
      template.futureScenariosOverride ||
      defaultCanonicalScenario.futureScenarios?.map((fs, i) => ({
        ...fs,
        contingencyAssetId: i === 1 ? template.affectedAssetIds[0] || fs.contingencyAssetId : fs.contingencyAssetId
      })),
    trafficNetwork: scenario.domain === 'traffic' ? baseTraffic : undefined,
    waterNetwork: scenario.domain === 'water' ? baseWater : undefined,
    powerNetwork: scenario.domain === 'energy' ? basePower : undefined
  };
}
