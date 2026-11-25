import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDomainEligibility,
  getDomainCoverageExplanation,
  GeographicFeatureLike
} from '../models/domainEligibility';
import { DEFAULT_SCENARIOS } from '../models/defaultScenarios';

const mockTrafficScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'traffic')!;
const mockWaterScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'water')!;
const mockPowerScenario = DEFAULT_SCENARIOS.find((s) => s.domain === 'energy')!;

test('Domain Eligibility & Coverage Rule Suite', async (t) => {
  await t.test('1. Null feature is gracefully handled as eligible', () => {
    const res = checkDomainEligibility(mockTrafficScenario, null);
    assert.equal(res.isEligible, true);
    assert.equal(res.unsupportedMessage, '');
  });

  await t.test('2. Traffic Domain: road corridors and intersections are eligible', () => {
    const highwayFeature: GeographicFeatureLike = {
      id: 'osm-way-99881',
      category: 'highway',
      title: 'NH16 National Highway Expressway Corridor',
      lat: 16.48,
      lon: 80.69
    };
    const res = checkDomainEligibility(mockTrafficScenario, highwayFeature);
    assert.equal(res.isEligible, true);
    assert.equal(res.coverageDomainLabel, 'Road Traffic Network');
    assert.equal(res.unsupportedMessage, '');
  });

  await t.test('2b. Traffic Domain: modeled traffic cell ID matches eligibility', () => {
    const cellId = mockTrafficScenario.trafficNetwork?.cells[0]?.id || 'cell_1';
    const cellFeature: GeographicFeatureLike = {
      id: cellId,
      category: 'infrastructure',
      title: 'Monitored Traffic Link',
      lat: 16.48,
      lon: 80.69
    };
    const res = checkDomainEligibility(mockTrafficScenario, cellFeature);
    assert.equal(res.isEligible, true);
  });

  await t.test('2c. Traffic Domain: unmapped building returns ineligible with polite banner', () => {
    const buildingFeature: GeographicFeatureLike = {
      id: 'osm-bldg-40291',
      category: 'building',
      title: 'Residential Apartment Complex Block D',
      lat: 16.49,
      lon: 80.70
    };
    const res = checkDomainEligibility(mockTrafficScenario, buildingFeature);
    assert.equal(res.isEligible, false);
    assert.ok(res.unsupportedMessage.includes('Simulation is not available here yet'));
    assert.ok(res.unsupportedMessage.includes('You can still explore this location on the map'));
  });

  await t.test('3. Water Domain: water utility assets (pipes, tanks, reservoirs) are eligible', () => {
    const waterFeature: GeographicFeatureLike = {
      id: 'water-pipe-loop-1',
      category: 'pipe',
      title: 'Municipal Feeder Pipe Branch 4',
      lat: 16.51,
      lon: 80.64
    };
    const res = checkDomainEligibility(mockWaterScenario, waterFeature);
    assert.equal(res.isEligible, true);
    assert.equal(res.coverageDomainLabel, 'Municipal Water Distribution Network');
  });

  await t.test('3b. Water Domain: non-water asset returns ineligible with polite message', () => {
    const parkFeature: GeographicFeatureLike = {
      id: 'osm-park-112',
      category: 'park',
      title: 'City Central Garden',
      lat: 16.51,
      lon: 80.64
    };
    const res = checkDomainEligibility(mockWaterScenario, parkFeature);
    assert.equal(res.isEligible, false);
    assert.ok(res.unsupportedMessage.includes('Simulation is not available here yet'));
  });

  await t.test('4. Energy Domain: electrical substations and transmission lines are eligible', () => {
    const subFeature: GeographicFeatureLike = {
      id: 'substation-north-400kv',
      category: 'substation',
      title: '400kV Regional Grid Substation North',
      lat: 16.53,
      lon: 80.62
    };
    const res = checkDomainEligibility(mockPowerScenario, subFeature);
    assert.equal(res.isEligible, true);
    assert.equal(res.coverageDomainLabel, 'High-Voltage Power Transmission Grid');
  });

  await t.test('4b. Energy Domain: unmodeled road corridor returns ineligible for power simulation', () => {
    const roadFeature: GeographicFeatureLike = {
      id: 'osm-way-99881',
      category: 'highway',
      title: 'Local Service Street',
      lat: 16.53,
      lon: 80.62
    };
    const res = checkDomainEligibility(mockPowerScenario, roadFeature);
    assert.equal(res.isEligible, false);
    assert.ok(res.unsupportedMessage.includes('Simulation is not available here yet'));
  });

  await t.test('5. Domain Coverage Explanations: provides plain-language guidance across all domains', () => {
    const trafficExpl = getDomainCoverageExplanation('traffic');
    assert.ok(trafficExpl.greenExplanation.includes('Green roads show where traffic simulation is available'));
    assert.ok(trafficExpl.greyExplanation.includes('Grey areas can still be explored'));

    const waterExpl = getDomainCoverageExplanation('water');
    assert.ok(waterExpl.greenExplanation.includes('Green areas show where the modeled water network is available'));

    const energyExpl = getDomainCoverageExplanation('energy');
    assert.ok(energyExpl.greenExplanation.includes('Green areas show where the modeled electricity network is available'));
  });
});
