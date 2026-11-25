import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickGeographicFeature,
  ensureSpatialIndex
} from '../models/geographicFeaturePicker';
import { OSMMapFeature, geographicToWorld } from '../models/regionalMap';

test('Universal Geographic Feature Picker Suite', async (t) => {
  const sampleBuilding: OSMMapFeature = {
    id: 'way/101',
    kind: 'building',
    building: 'apartments',
    name: 'Lotus Residency',
    'building:levels': 4,
    height: 14,
    coordinates: [
      [80.60, 16.50],
      [80.602, 16.50],
      [80.602, 16.502],
      [80.60, 16.502],
      [80.60, 16.50]
    ]
  };

  const sampleWaterway: OSMMapFeature = {
    id: 'way/202',
    kind: 'waterway',
    waterway: 'canal',
    name: 'Krishna Western Delta Main Canal',
    coordinates: [
      [80.61, 16.51],
      [80.62, 16.515],
      [80.63, 16.52]
    ]
  };

  const sampleRoad: OSMMapFeature = {
    id: 'way/303',
    kind: 'road',
    highway: 'trunk',
    name: 'NH 16 / Chennai-Kolkata Hwy',
    lanes: 6,
    maxspeed: 80,
    coordinates: [
      [80.64, 16.53],
      [80.65, 16.535],
      [80.66, 16.54]
    ]
  };

  const features: OSMMapFeature[] = [sampleBuilding, sampleWaterway, sampleRoad];
  ensureSpatialIndex(features);

  await t.test('1. Building Picking: hits point inside building footprint with honest attribution', () => {
    // Center of building is at lon=80.601, lat=16.501
    const worldPos = geographicToWorld(80.601, 16.501, 0);
    const result = pickGeographicFeature(worldPos, features, 'Vijayawada');

    assert.equal(result.category, 'building');
    assert.equal(result.id, 'way/101');
    assert.equal(result.title, 'Lotus Residency');
    assert.equal(result.provenance, 'osm_source_geometry');
    assert.ok(result.details.some(d => d.label === 'Ground Footprint'));
    assert.ok(result.details.some(d => d.label === 'Levels / Floors' && String(d.value).includes('4')));
    assert.ok(result.details.some(d => d.label === 'Building Height' && String(d.value).includes('14')));
    assert.ok(result.polygonCoordinates && result.polygonCoordinates.length >= 4);
  });

  await t.test('2. Waterway Picking: hits waterway polyline within proximity threshold', () => {
    // Point very close to segment [80.615, 16.5125]
    const worldPos = geographicToWorld(80.61505, 16.51252, 0);
    const result = pickGeographicFeature(worldPos, features, 'Vijayawada');

    assert.equal(result.category, 'waterway');
    assert.equal(result.id, 'way/202');
    assert.equal(result.title, 'Krishna Western Delta Main Canal');
    assert.equal(result.provenance, 'osm_source_geometry');
    assert.ok(result.lineCoordinates && result.lineCoordinates.length >= 2);
  });

  await t.test('3. Highway Picking: hits road centerline with classification, lanes, and speed', () => {
    // Point very close to segment [80.645, 16.5325]
    const worldPos = geographicToWorld(80.64502, 16.53253, 0);
    const result = pickGeographicFeature(worldPos, features, 'Vijayawada');

    assert.equal(result.category, 'road');
    assert.equal(result.id, 'way/303');
    assert.equal(result.title, 'NH 16 / Chennai-Kolkata Hwy');
    assert.ok(result.details.some(d => d.label === 'Corridor Classification' && String(d.value).includes('TRUNK')));
    assert.ok(result.details.some(d => d.label === 'Speed Limit' && String(d.value).includes('80 km/h')));
  });

  await t.test('4. Terrain Coordinate Fallback: returns honest ground coordinate for open terrain', () => {
    // Far away from all sample features
    const worldPos = geographicToWorld(80.75, 16.65, 0);
    const result = pickGeographicFeature(worldPos, features, 'Andhra Pradesh Study Area');

    assert.equal(result.category, 'terrain');
    assert.equal(result.provenance, 'terrain_coordinate');
    assert.ok(result.title.includes('Terrain Coordinate'));
    assert.ok(result.details.some(d => d.label === 'Terrain Elevation' && String(d.value).includes('0.0 m')));
  });

  await t.test('5. Performance & Safety: index handles empty or undefined features gracefully', () => {
    const worldPos = geographicToWorld(80.60, 16.50, 0);
    const result = pickGeographicFeature(worldPos, []);
    assert.equal(result.category, 'terrain');
  });
});
