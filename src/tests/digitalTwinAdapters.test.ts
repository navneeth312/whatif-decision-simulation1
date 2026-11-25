import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DigitalTwinAdapters } from '../models/digitalTwinAdapters';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';
import { runBaselineSimulation, runAlternativeSimulation } from '../models/decisionEngines';

describe('Digital Twin Adapters & Comparison Suite', () => {
  const trafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
  const waterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
  const energyScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;

  it('1. Traffic Hotspot Identification: detects primary corridor bottlenecks', () => {
    const baseline = runBaselineSimulation(trafficScenario);
    const hotspots = DigitalTwinAdapters.getProblemHotspots(trafficScenario, baseline);

    assert.ok(hotspots.length > 0, 'Expected at least one traffic hotspot');
    const primaryHotspot = hotspots.find((h) => h.domain === 'traffic');
    assert.ok(primaryHotspot, 'Expected primary bottleneck hotspot');
    assert.equal(primaryHotspot.domain, 'traffic');
    assert.equal(primaryHotspot.metricLabel, 'Cell Speed');
  });

  it('2. Water Hotspot Identification: detects low pressure deficit node', () => {
    const baseline = runBaselineSimulation(waterScenario);
    const hotspots = DigitalTwinAdapters.getProblemHotspots(waterScenario, baseline);

    assert.ok(hotspots.length > 0, 'Expected at least one water hotspot');
    const pressureHotspot = hotspots.find((h) => h.componentId === 'junc-ridge' || h.componentId === 'n-north-res');
    assert.ok(pressureHotspot, 'Expected low pressure node to be flagged as hotspot');
    assert.equal(pressureHotspot.domain, 'water');
    assert.equal(pressureHotspot.metricLabel, 'Pressure');
  });

  it('3. Energy Hotspot Identification: detects overloaded transmission corridor', () => {
    const baseline = runBaselineSimulation(energyScenario);
    const hotspots = DigitalTwinAdapters.getProblemHotspots(energyScenario, baseline);

    assert.ok(hotspots.length > 0, 'Expected at least one energy hotspot');
    const lineHotspot = hotspots.find((h) => h.componentId === 'line-2-3' || h.componentId === 'line-4-9');
    assert.ok(lineHotspot, 'Expected line overload hotspot');
    assert.equal(lineHotspot.domain, 'energy');
    assert.equal(lineHotspot.metricLabel, 'Thermal Loading');
  });

  it('4. Topological Asset Connectivity: correctly returns predecessors and successors', () => {
    // Traffic cell connectivity
    const trafficConn = DigitalTwinAdapters.getConnectedAssets(trafficScenario, 'cell-hub-1');
    assert.equal(trafficConn.targetId, 'cell-hub-1');
    assert.ok(trafficConn.connectedIds.length > 0, 'Expected connected cells for cell-hub-1');

    // Water node connectivity
    const waterConn = DigitalTwinAdapters.getConnectedAssets(waterScenario, 'res-east');
    assert.equal(waterConn.targetId, 'res-east');
    assert.ok(waterConn.connectedIds.length > 0, 'Expected connected pipes/nodes for res-east');

    // Energy bus connectivity
    const energyConn = DigitalTwinAdapters.getConnectedAssets(energyScenario, 'bus-2');
    assert.equal(energyConn.targetId, 'bus-2');
    assert.ok(energyConn.connectedIds.length > 0, 'Expected connected corridors for bus-2');
  });

  it('5. Before / After Comparison Highlights: computes deterministic deltas and asset upgrades', () => {
    const baseline = runBaselineSimulation(trafficScenario);
    const altA = trafficScenario.alternatives[0];
    const altResult = runAlternativeSimulation(trafficScenario, altA);

    const highlights = DigitalTwinAdapters.getComparisonHighlights(
      trafficScenario,
      baseline,
      altResult,
      altA
    );

    assert.equal(highlights.baselineName, 'Unmitigated Baseline');
    assert.equal(highlights.alternativeName, altA.name);
    assert.equal(highlights.primaryMetricLabel, 'Corridor Average Speed (All 16 Segments)');
    assert.ok(highlights.baselineValue > 0, 'Baseline speed should be positive');
    assert.ok(highlights.alternativeValue > 0, 'Alternative speed should be positive');
    assert.ok(highlights.addedOrUpgradedAssets.length > 0, 'Expected added/upgraded asset names');
    assert.ok(highlights.alleviatedIssues.length > 0, 'Expected alleviated issues list');
  });
});
