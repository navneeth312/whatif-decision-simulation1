import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  clipLineSegmentToBounds,
  createOSMBuildingGeometry,
  createOSMBuildingOutlineGeometry,
  createOSMLandcoverGeometry,
  createOSMRailwayGeometry,
  createOSMRoadGeometry,
  decodeOSMPlaceBuffer,
  declutterMapLabelCandidates,
  discoverRegionalPlacesFromOSM,
  expandMapBounds,
  fitMapBoundsToAspect,
  getAreaNameOpacity,
  getBuildingHeightInfo,
  getCameraFitDistance,
  getCameraStartDistance,
  getLandmarkFocusDistance,
  getLandmarkNameOpacity,
  getMapLandmarks,
  getMapBounds,
  getMapPlaceWorldPosition,
  OSMMapFeature,
  getMapPlace,
  getMapPlaceDataId,
  getOSMTileDescriptors,
  getWorldDimensions,
  REGIONAL_BOUNDS,
  REGIONAL_MAP_PLACES,
  scenarioPositionToSvg,
  scenarioPositionToWorld,
  summarizeOSMCoverage
} from '../models/regionalMap';

const regionalOSMGzipBuffer = readFileSync('public/maps/region.json.gz');
const regionalOSMData = JSON.parse(gunzipSync(regionalOSMGzipBuffer).toString('utf8')) as {
  featureCount: number;
  counts: Record<string, number>;
  cities: { id: string }[];
  features: { id: string }[];
};

describe('Regional OpenStreetMap viewport and scenario alignment', () => {
  it('builds mapped building outlines without roof triangulation', () => {
    const geometry = createOSMBuildingOutlineGeometry([
      {
        id: 'square',
        kind: 'building',
        height: '9',
        coordinates: [
          [80.53, 16.36],
          [80.531, 16.36],
          [80.531, 16.361],
          [80.53, 16.361],
          [80.53, 16.36]
        ]
      }
    ]);
    assert.ok(geometry);
    assert.equal(geometry.getIndex(), null);
    // Four footprint edges, four roof edges, and four vertical corners.
    assert.equal(geometry.getAttribute('position').count, 24);
    const positionValues = Array.from(geometry.getAttribute('position').array);
    assert.ok(positionValues.every(Number.isFinite));
    assert.ok(Math.max(...positionValues.filter((_, index) => index % 3 === 1)) >= 0.194);
    geometry.dispose();

    const footprintGeometry = createOSMBuildingOutlineGeometry([
      {
        id: 'square',
        kind: 'building',
        coordinates: [
          [80.53, 16.36],
          [80.531, 16.36],
          [80.531, 16.361],
          [80.53, 16.361],
          [80.53, 16.36]
        ]
      }
    ], undefined, true);
    assert.ok(footprintGeometry);
    assert.equal(footprintGeometry.getAttribute('position').count, 8);
    footprintGeometry.dispose();
  });

  it('builds solid, colored OSM buildings with taller regional visualization extrusion', () => {
    const geometry = createOSMBuildingGeometry([
      {
        id: 'regional-square',
        kind: 'building',
        height: '9',
        coordinates: [
          [80.53, 16.36],
          [80.531, 16.36],
          [80.531, 16.361],
          [80.53, 16.361],
          [80.53, 16.36]
        ]
      }
    ], undefined, 18);
    assert.ok(geometry);
    assert.ok(geometry.getIndex());
    assert.ok(geometry.getAttribute('color'));
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox);
    assert.ok(geometry.boundingBox.max.y >= 0.824);
    geometry.dispose();
  });

  it('keeps the selected cities inside the regional map extent', () => {
    const cities = REGIONAL_MAP_PLACES.filter((place) => place.id !== 'region');
    assert.equal(cities.length, 4);
    for (const place of cities) {
      assert.ok(place.lon >= REGIONAL_BOUNDS.west && place.lon <= REGIONAL_BOUNDS.east);
      assert.ok(place.lat >= REGIONAL_BOUNDS.south && place.lat <= REGIONAL_BOUNDS.north);
    }
    assert.equal(getMapPlace('vijayawada').district, 'NTR District');
    assert.equal(getMapPlace('tenali').district, 'Guntur District');
  });

  it('loads verified OSM footprints for all four mapped city cores in regional 3D', async () => {
    assert.equal(getMapPlaceDataId('region'), 'region');
    for (const cityId of ['nambur', 'vijayawada', 'tenali', 'guntur']) {
      assert.equal(getMapPlaceDataId(cityId), 'region');
    }
    const decodedFromGzip = await decodeOSMPlaceBuffer(
      regionalOSMGzipBuffer.buffer.slice(
        regionalOSMGzipBuffer.byteOffset,
        regionalOSMGzipBuffer.byteOffset + regionalOSMGzipBuffer.byteLength
      )
    );
    assert.equal(decodedFromGzip.featureCount, regionalOSMData.featureCount);
    assert.equal(decodedFromGzip.features.length, regionalOSMData.features.length);

    const decodedFromPlain = await decodeOSMPlaceBuffer(
      new TextEncoder().encode(JSON.stringify({ source: 'test', license: 'ODbL', retrievedAt: '2026-11-25', featureCount: 0, features: [] })).buffer
    );
    assert.equal(decodedFromPlain.featureCount, 0);

    assert.equal(regionalOSMData.featureCount, regionalOSMData.features.length);
    assert.equal(new Set(regionalOSMData.features.map((feature) => feature.id)).size, regionalOSMData.featureCount);
    assert.equal(regionalOSMData.counts.building, 94515);
    assert.deepEqual(
      regionalOSMData.cities.map((city) => city.id).sort(),
      ['guntur', 'nambur', 'tenali', 'vijayawada']
    );
  });

  it('makes mapped regional buildings and landmarks searchable beyond the visible label limit', () => {
    const features = regionalOSMData.features as unknown as OSMMapFeature[];
    const defaultList = getMapLandmarks(features, REGIONAL_BOUNDS);
    const searchableList = getMapLandmarks(features, REGIONAL_BOUNDS, 3000);
    assert.equal(defaultList.length, 24);
    assert.ok(searchableList.length > defaultList.length);
    assert.ok(searchableList.some((landmark) => /VVIT/i.test(landmark.name)));
    assert.ok(searchableList.some((landmark) => /central[_ ]block/i.test(landmark.name)));
  });

  it('fits city bounds to a landscape canvas without shifting the city center', () => {
    const bounds = getMapBounds('vijayawada');
    const fitted = fitMapBoundsToAspect(bounds, 800, 425);
    const center = getMapPlace('vijayawada');
    assert.ok(Math.abs((fitted.west + fitted.east) / 2 - center.lon) < 1e-10);
    assert.ok(Math.abs((fitted.south + fitted.north) / 2 - center.lat) < 1e-10);
    assert.ok(fitted.east - fitted.west > bounds.east - bounds.west);

    const centerPoint = scenarioPositionToSvg(50, 50, fitted, 800, 425, 20, 'vijayawada');
    assert.ok(Math.abs(centerPoint.x - 400) < 1);
    assert.ok(Math.abs(centerPoint.y - 212.5) < 1);
  });

  it('places scenario assets in the selected city view and around VVITU in regional view', () => {
    const nambur = scenarioPositionToWorld(50, 50, 0, 'nambur');
    const vijayawada = scenarioPositionToWorld(50, 50, 0, 'vijayawada');
    const region = scenarioPositionToWorld(50, 50, 0, 'region');
    assert.ok(nambur.distanceTo(vijayawada) > 50);
    assert.ok(region.distanceTo(nambur) < 1e-6);

    const size = getWorldDimensions(getMapBounds('tenali'));
    assert.ok(size.width > 0 && size.depth > 0);
    const fitDistance = getCameraFitDistance('tenali', 1.7);
    assert.ok(Number.isFinite(fitDistance));
    assert.equal(getCameraStartDistance('tenali', 1.7), fitDistance);
    assert.ok(getLandmarkFocusDistance('tenali', 1.7) < fitDistance);
    assert.equal(getCameraStartDistance('region', 1.7), getCameraFitDistance('region', 1.7));

    // Verify Nambur and every core place camera lookAt aligns with its geometric bounds center.
    const namburCenter = getMapPlaceWorldPosition('nambur');
    const namburBounds = getMapBounds('nambur');
    const mid = scenarioPositionToWorld(50, 50, 0, 'nambur');
    assert.ok(namburCenter.distanceTo(mid) < 1e-6);
    assert.ok(namburBounds.west < 80.527 && namburBounds.east > 80.527);
  });

  it('discovers expanded cities, towns, districts, mandals, highways, rail and height estimates across the study region', () => {
    const features = regionalOSMData.features as unknown as OSMMapFeature[];
    const places = discoverRegionalPlacesFromOSM(features);
    assert.ok(places.length > 50);
    assert.ok(places.some((p) => p.category === 'city' && /amaravati/i.test(p.label)));
    assert.ok(places.some((p) => p.category === 'town' && /vuyyuru|ponnuru|repalle/i.test(p.label)));
    assert.ok(places.some((p) => p.category === 'district' && /guntur|ntr|krishna/i.test(p.label)));
    assert.ok(places.some((p) => p.category === 'mandal'));

    // Non-dedicated discovered towns map safely to region.json without missing file 404s.
    const discoveredTown = places.find((p) => p.category === 'town' && p.id !== 'tenali' && p.id !== 'nambur');
    assert.ok(discoveredTown);
    assert.equal(getMapPlaceDataId(discoveredTown.id), 'region');

    // Verify building height source metadata distinguishes tagged heights from visualization estimates.
    assert.equal(getBuildingHeightInfo({ id: 'h1', kind: 'building', height: '12', coordinates: [] }).source, 'osm-height');
    assert.equal(getBuildingHeightInfo({ id: 'h2', kind: 'building', 'building:levels': '3', coordinates: [] }).source, 'osm-levels');
    assert.equal(getBuildingHeightInfo({ id: 'h3', kind: 'building', coordinates: [] }).source, 'estimated');

    const summary = summarizeOSMCoverage(features, REGIONAL_BOUNDS);
    assert.equal(summary.buildingFootprints, 94515);
    assert.equal(summary.buildingsWithTaggedHeight + summary.buildingsWithEstimatedHeight, summary.buildingFootprints);
    assert.ok(summary.roadWays >= 10494);
    assert.ok(summary.railways > 100);
    assert.ok(summary.waterways > 100);

    const majorRoads = createOSMRoadGeometry(features, REGIONAL_BOUNDS, true);
    assert.ok(majorRoads);
    assert.ok(majorRoads.getAttribute('position').count > 1000);
    majorRoads.dispose();

    const railGeom = createOSMRailwayGeometry(features, REGIONAL_BOUNDS);
    assert.ok(railGeom);
    assert.ok(railGeom.getAttribute('position').count > 200);
    railGeom.dispose();
  });

  it('builds bounded, attributed OSM tile URLs for the regional context', () => {
    const tiles = getOSMTileDescriptors(getMapBounds('region'), 9);
    assert.ok(tiles.length > 0 && tiles.length < 100);
    assert.ok(tiles.every((tile) => tile.url.startsWith('https://tile.openstreetmap.org/')));
    assert.ok(tiles.every((tile) => tile.zoom === 9));
  });

  it('clips mapped utility and road segments at the active viewport boundary', () => {
    const bounds = { west: 0, south: 0, east: 1, north: 1 };
    assert.deepEqual(clipLineSegmentToBounds([-1, 0.5], [2, 0.5], bounds), [[0, 0.5], [1, 0.5]]);
    assert.equal(clipLineSegmentToBounds([-1, -1], [-2, -2], bounds), null);
  });

  it('extends the 3D tile context around the fitted map without shifting its center', () => {
    const bounds = getMapBounds('tenali');
    const expanded = expandMapBounds(bounds, 1.22);
    assert.ok(expanded.east - expanded.west > bounds.east - bounds.west);
    assert.ok(Math.abs((expanded.east + expanded.west) / 2 - (bounds.east + bounds.west) / 2) < 1e-10);
    assert.ok(Math.abs((expanded.north + expanded.south) / 2 - (bounds.north + bounds.south) / 2) < 1e-10);
  });

  it('shows area labels when zoomed out and named OSM places when zoomed in', () => {
    const fitDistance = getCameraFitDistance('nambur', 1.5);
    // Area labels prominent when zoomed out
    assert.ok(getAreaNameOpacity(fitDistance, fitDistance) > 0.99);
    assert.ok(getAreaNameOpacity(fitDistance * 0.95, fitDistance) > 0.85);
    // When zoomed in, area labels don't abruptly drop to zero: they maintain soft background orientation
    assert.ok(getAreaNameOpacity(fitDistance * 0.88, fitDistance) > 0.35);
    assert.ok(getAreaNameOpacity(fitDistance * 0.5, fitDistance) >= 0.40);
    // Selected or hovered place is guaranteed full opacity
    assert.equal(getAreaNameOpacity(fitDistance * 0.5, fitDistance, true), 1.0);

    // Landmarks hidden at distant regional overview to prevent clutter
    assert.equal(getLandmarkNameOpacity(fitDistance, fitDistance), 0);
    assert.equal(getLandmarkNameOpacity(fitDistance * 0.9, fitDistance), 0);
    // Landmarks fade in as user approaches
    assert.ok(getLandmarkNameOpacity(fitDistance * 0.7, fitDistance) > 0);
    // At close and building-level zoom, landmarks remain readable and DO NOT disappear
    assert.ok(getLandmarkNameOpacity(fitDistance * 0.5, fitDistance) >= 0.80);
    assert.ok(getLandmarkNameOpacity(fitDistance * 0.25, fitDistance) >= 0.80);
    // Selected landmark is guaranteed full opacity
    assert.equal(getLandmarkNameOpacity(fitDistance * 0.25, fitDistance, true), 1.0);
  });

  it('keeps overlapping close-up labels clear and prioritizes the mapped campus', () => {
    const visible = declutterMapLabelCandidates([
      { id: 'small-shop', priority: 40, x: 100, y: 100, width: 120, height: 34 },
      { id: 'campus', priority: 100, x: 104, y: 102, width: 180, height: 38 },
      { id: 'distant-school', priority: 72, x: 360, y: 100, width: 130, height: 34 }
    ]);
    assert.deepEqual([...visible].sort(), ['campus', 'distant-school']);
  });

  it('derives labeled 3D places from named OSM features and skips unnamed footprints', () => {
    const features = [
      { id: 'campus', kind: 'amenity', name: 'VVIT (Vasireddy Venkatadri Institute of Technology)', class: 'college', coordinates: [[80.524, 16.344], [80.526, 16.344], [80.526, 16.346], [80.524, 16.344]] },
      { id: 'hall', kind: 'building', name: 'Main Academic Block', class: 'yes', coordinates: [[80.525, 16.344], [80.5252, 16.3442]] },
      { id: 'generic', kind: 'building', name: 'Potential building', class: 'yes', coordinates: [[80.525, 16.344], [80.5252, 16.3442]] }
    ];
    const landmarks = getMapLandmarks(features, getMapBounds('nambur'));
    assert.deepEqual(landmarks.map((landmark) => landmark.name), [
      'VVIT (Vasireddy Venkatadri Institute of Technology)',
      'Main Academic Block'
    ]);
    assert.equal(landmarks[0].category, 'Campus');
  });

  it('triangulates real OSM landcover polygons (parks, plazas, water bodies) into terrain geometry', () => {
    const sampleFeatures = [
      {
        id: 'way/park1',
        kind: 'landcover',
        leisure: 'park',
        coordinates: [
          [80.640, 16.510],
          [80.644, 16.510],
          [80.644, 16.514],
          [80.640, 16.514],
          [80.640, 16.510]
        ]
      },
      {
        id: 'way/lake1',
        kind: 'water',
        natural: 'water',
        coordinates: [
          [80.645, 16.515],
          [80.650, 16.515],
          [80.650, 16.520],
          [80.645, 16.520],
          [80.645, 16.515]
        ]
      },
      {
        id: 'way/plaza1',
        kind: 'landcover',
        landuse: 'commercial',
        coordinates: [
          [80.651, 16.510],
          [80.655, 16.510],
          [80.655, 16.514],
          [80.651, 16.514],
          [80.651, 16.510]
        ]
      }
    ];

    const bounds = REGIONAL_BOUNDS;
    const geo = createOSMLandcoverGeometry(sampleFeatures as unknown as OSMMapFeature[], bounds, false);
    assert.ok(geo, 'Expected non-null landcover BufferGeometry');
    const posAttr = geo.getAttribute('position');
    const colorAttr = geo.getAttribute('color');
    assert.ok(posAttr, 'Expected position attribute');
    assert.ok(colorAttr, 'Expected vertex color attribute');
    assert.ok(posAttr.count >= 6, 'Expected at least 6 polygon boundary vertices');
    assert.ok(geo.getIndex(), 'Expected indexed triangle faces');
    assert.ok(geo.getIndex()!.count >= 6, 'Expected at least 2 indexed triangle faces');
    assert.equal(posAttr.count, colorAttr.count);
  });
});
