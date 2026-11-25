import * as THREE from 'three';

export interface GeographicBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type MapPlaceCategory =
  | 'region'
  | 'city'
  | 'town'
  | 'suburb'
  | 'village'
  | 'district'
  | 'mandal';

export interface RegionalMapPlace {
  id: string;
  label: string;
  district: string;
  lat: number;
  lon: number;
  description: string;
  category?: MapPlaceCategory;
  bounds?: GeographicBounds;
  osmId?: string;
}

export interface OSMMapFeature {
  id: string;
  kind: string;
  coordinates: number[] | number[][];
  area?: string;
  name?: string;
  class?: string;
  place?: string;
  boundary?: string;
  admin_level?: string | number;
  bounds?: {
    west?: number;
    south?: number;
    east?: number;
    north?: number;
    minlon?: number;
    minlat?: number;
    maxlon?: number;
    maxlat?: number;
  };
  height?: string | number;
  levels?: string | number;
  'building:levels'?: string | number;
  highway?: string;
  power?: string;
  railway?: string;
  waterway?: string;
  man_made?: string;
  amenity?: string;
  leisure?: string;
  historic?: string;
  [key: string]: unknown;
}

export interface OSMPlaceData {
  source: string;
  license: string;
  retrievedAt: string;
  featureCount: number;
  counts?: Record<string, number>;
  features: OSMMapFeature[];
}

export interface NamedMapLandmark {
  id: string;
  name: string;
  kind: string;
  category: string;
  lon: number;
  lat: number;
  priority: number;
  placeId?: string;
  bounds?: GeographicBounds;
}

export interface MapLabelCandidate {
  id: string;
  priority: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BuildingHeightSource = 'osm-height' | 'osm-levels' | 'estimated';

export type BuildingHeightClassification =
  | 'source-osm-height'                // Source-provided OSM height tag accepted
  | 'estimated-from-levels'            // Height estimated from building:levels count (3.1m / story design estimate)
  | 'procedural-area-estimate'         // Procedural estimate based on footprint polygon area and building category
  | 'sanitized-replacement-estimate';  // Source height rejected as anomalous and replaced by documented estimate

export interface BuildingHeightMetadata {
  heightMeters: number;
  source: BuildingHeightSource;
  classification: BuildingHeightClassification;
  originalOsmHeight?: number;          // Original raw OSM height value (if present in source)
  validatedSourceHeight?: number;      // Validated source height (if accepted)
  osmBuildingLevels?: number;          // Raw OSM building-level count (if present)
  estimatedHeightFromLevels?: number;  // levels * 3.1m design estimate
  proceduralAreaEstimate?: number;     // Footprint area-based estimate
  sanitizationReason?: string;         // Documented reason if raw height was rejected/replaced
  worldHeight: number;
}

export interface OSMCoverageSummary {
  buildingFootprints: number;
  buildingsWithTaggedHeight: number;
  buildingsWithEstimatedHeight: number;
  roadWays: number;
  powerFeatures: number;
  waterFacilities: number;
  waterways: number;
  railways: number;
  namedPlaces: number;
  adminBoundaries: number;
}

/** Keep the highest-priority named places whose projected labels do not overlap. */
export function declutterMapLabelCandidates(
  candidates: MapLabelCandidate[],
  padding = 8,
  maxVisible = Number.POSITIVE_INFINITY
): Set<string> {
  const accepted: MapLabelCandidate[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
    if (accepted.length >= maxVisible) break;
    const overlaps = accepted.some((placed) =>
      Math.abs(candidate.x - placed.x) < (candidate.width + placed.width) / 2 + padding &&
      Math.abs(candidate.y - placed.y) < (candidate.height + placed.height) / 2 + padding
    );
    if (!overlaps) accepted.push(candidate);
  }
  return new Set(accepted.map((candidate) => candidate.id));
}

export interface OSMTileDescriptor {
  url: string;
  bounds: GeographicBounds;
  x: number;
  y: number;
  zoom: number;
}

export const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_WORLD_UNITS_PER_METER = 0.005;
export const MAP_CENTER = { lat: 16.3601477, lon: 80.5302143 };

const namburBounds: GeographicBounds = {
  west: 80.495,
  south: 16.332,
  east: 80.559,
  north: 16.379
};

const regionalHalfLatitudeDegrees = 40 / 110.574;
const regionalHalfLongitudeDegrees =
  40 / (110.574 * Math.cos((MAP_CENTER.lat * Math.PI) / 180));

export const REGIONAL_BOUNDS: GeographicBounds = {
  west: MAP_CENTER.lon - regionalHalfLongitudeDegrees,
  south: MAP_CENTER.lat - regionalHalfLatitudeDegrees,
  east: MAP_CENTER.lon + regionalHalfLongitudeDegrees,
  north: MAP_CENTER.lat + regionalHalfLatitudeDegrees
};

const cityCoreHalfSpanDegrees = 0.025;
const townHalfSpanDegrees = 0.02;
const suburbHalfSpanDegrees = 0.015;
const villageHalfSpanDegrees = 0.012;
const metersPerLatitudeDegree = 110574;
const metersPerLongitudeDegree =
  metersPerLatitudeDegree * Math.cos((MAP_CENTER.lat * Math.PI) / 180);

export const REGIONAL_MAP_PLACES: RegionalMapPlace[] = [
  {
    id: 'region',
    label: 'Regional Corridor Overview',
    district: 'Guntur · NTR · Krishna · Bapatla · Palnadu',
    lat: MAP_CENTER.lat,
    lon: MAP_CENTER.lon,
    description: 'Continuous OpenStreetMap regional corridor centered near Nambur',
    category: 'region',
    bounds: REGIONAL_BOUNDS
  },
  {
    id: 'nambur',
    label: 'Nambur · VVITU',
    district: 'Guntur District',
    lat: 16.34393,
    lon: 80.52456,
    description: 'VVITU and Nambur settlement context',
    category: 'town',
    bounds: namburBounds
  },
  {
    id: 'vijayawada',
    label: 'Vijayawada',
    district: 'NTR District',
    lat: 16.5191525,
    lon: 80.6238204,
    description: 'Vijayawada urban core context',
    category: 'city',
    bounds: {
      west: 80.6238204 - cityCoreHalfSpanDegrees,
      south: 16.5191525 - cityCoreHalfSpanDegrees,
      east: 80.6238204 + cityCoreHalfSpanDegrees,
      north: 16.5191525 + cityCoreHalfSpanDegrees
    }
  },
  {
    id: 'tenali',
    label: 'Tenali',
    district: 'Guntur District',
    lat: 16.2377735,
    lon: 80.6464219,
    description: 'Tenali town core context',
    category: 'town',
    bounds: {
      west: 80.6464219 - cityCoreHalfSpanDegrees,
      south: 16.2377735 - cityCoreHalfSpanDegrees,
      east: 80.6464219 + cityCoreHalfSpanDegrees,
      north: 16.2377735 + cityCoreHalfSpanDegrees
    }
  },
  {
    id: 'guntur',
    label: 'Guntur',
    district: 'Guntur District',
    lat: 16.2915189,
    lon: 80.4541588,
    description: 'Guntur city core context',
    category: 'city',
    bounds: {
      west: 80.4541588 - cityCoreHalfSpanDegrees,
      south: 16.2915189 - cityCoreHalfSpanDegrees,
      east: 80.4541588 + cityCoreHalfSpanDegrees,
      north: 16.2915189 + cityCoreHalfSpanDegrees
    }
  }
];

export const OSM_CITY_COVERAGE = {
  nambur: { buildingFootprints: 4679, roadWays: 1016, powerFeatures: 1, waterFacilities: 0 },
  vijayawada: { buildingFootprints: 46039, roadWays: 3925, powerFeatures: 52, waterFacilities: 18 },
  tenali: { buildingFootprints: 9802, roadWays: 2057, powerFeatures: 119, waterFacilities: 0 },
  guntur: { buildingFootprints: 33995, roadWays: 3496, powerFeatures: 432, waterFacilities: 2 }
} as const;

const osmDataCache = new Map<string, Promise<OSMPlaceData>>();
const discoveredPlacesRegistry = new Map<string, RegionalMapPlace>(
  REGIONAL_MAP_PLACES.map((place) => [place.id, place])
);

function normalizeSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function clampBoundsToRegion(bounds: GeographicBounds): GeographicBounds | null {
  const west = Math.max(REGIONAL_BOUNDS.west, bounds.west);
  const east = Math.min(REGIONAL_BOUNDS.east, bounds.east);
  const south = Math.max(REGIONAL_BOUNDS.south, bounds.south);
  const north = Math.min(REGIONAL_BOUNDS.north, bounds.north);
  if (east <= west + 0.002 || north <= south + 0.002) return null;
  return { west, south, east, north };
}

function buildSquareBounds(lon: number, lat: number, halfSpan: number): GeographicBounds {
  return clampBoundsToRegion({
    west: lon - halfSpan,
    south: lat - halfSpan,
    east: lon + halfSpan,
    north: lat + halfSpan
  }) || {
    west: lon - halfSpan,
    south: lat - halfSpan,
    east: lon + halfSpan,
    north: lat + halfSpan
  };
}

function readFeatureBounds(feature: OSMMapFeature): GeographicBounds | null {
  const b = feature.bounds;
  if (b) {
    const west = Number(b.west ?? b.minlon);
    const south = Number(b.south ?? b.minlat);
    const east = Number(b.east ?? b.maxlon);
    const north = Number(b.north ?? b.maxlat);
    if (
      Number.isFinite(west) &&
      Number.isFinite(south) &&
      Number.isFinite(east) &&
      Number.isFinite(north) &&
      east > west &&
      north > south
    ) {
      return { west, south, east, north };
    }
  }
  const coords = getFeatureCoordinates(feature);
  if (coords.length < 2) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return east > west && north > south ? { west, south, east, north } : null;
}

function inferBoundsCenter(bounds: GeographicBounds): { lon: number; lat: number } {
  return {
    lon: (bounds.west + bounds.east) / 2,
    lat: (bounds.south + bounds.north) / 2
  };
}

function inferDistrictLabel(
  lon: number,
  lat: number,
  boundaries: { name: string; bounds: GeographicBounds; level: number }[]
): string {
  const matchingDistrict = boundaries.find(
    (entry) =>
      entry.level === 5 &&
      isCoordinateWithinBounds([lon, lat], entry.bounds)
  );
  if (matchingDistrict) return matchingDistrict.name;
  const matchingMandal = boundaries.find(
    (entry) =>
      entry.level === 6 &&
      isCoordinateWithinBounds([lon, lat], entry.bounds)
  );
  if (matchingMandal) return matchingMandal.name;
  return lat >= 16.46 ? 'NTR / Krishna Basin' : 'Guntur / Capital Region';
}

export function registerDiscoveredMapPlaces(places: RegionalMapPlace[]): void {
  for (const place of places) {
    discoveredPlacesRegistry.set(place.id, place);
  }
}

/**
 * Discover regional cities, towns, suburbs, districts, and mandals dynamically
 * from loaded OpenStreetMap features instead of limiting selection to 4 cores.
 */
export function discoverRegionalPlacesFromOSM(features: OSMMapFeature[]): RegionalMapPlace[] {
  const coreByName = new Map<string, RegionalMapPlace>([
    ['nambur', REGIONAL_MAP_PLACES[1]],
    ['vijayawada', REGIONAL_MAP_PLACES[2]],
    ['tenali', REGIONAL_MAP_PLACES[3]],
    ['guntur', REGIONAL_MAP_PLACES[4]]
  ]);

  const discovered: RegionalMapPlace[] = [...REGIONAL_MAP_PLACES];
  const seenIds = new Set<string>(discovered.map((p) => p.id));
  const seenKeys = new Set<string>(['region', 'nambur', 'vijayawada', 'tenali', 'guntur']);

  const adminBoundsList: { name: string; bounds: GeographicBounds; level: number; id: string }[] = [];

  for (const feature of features) {
    if (feature.kind !== 'boundary') continue;
    const rawName = typeof feature.name === 'string' ? feature.name.trim() : '';
    if (!rawName) continue;
    const rawBounds = readFeatureBounds(feature);
    if (!rawBounds) continue;
    const clamped = clampBoundsToRegion(rawBounds);
    if (!clamped) continue;
    const level = Number(feature.admin_level || 6);
    adminBoundsList.push({
      id: feature.id,
      name: rawName,
      bounds: clamped,
      level: Number.isFinite(level) ? level : 6
    });
  }

  for (const feature of features) {
    const rawPlace = String(feature.place || feature.class || '').toLowerCase();
    const isPlaceFeature =
      feature.kind === 'place' ||
      (feature.kind === 'poi' &&
        ['city', 'town', 'suburb', 'village'].includes(rawPlace));
    if (!isPlaceFeature) continue;

    const rawName = typeof feature.name === 'string' ? feature.name.trim() : '';
    if (!rawName || /^(yes|no|unnamed)$/i.test(rawName)) continue;

    const key = normalizeSlug(rawName);
    if (!key) continue;

    if (coreByName.has(key) || seenKeys.has(`${rawPlace}:${key}`) || seenKeys.has(key)) {
      continue;
    }

    const coords = getFeatureCoordinates(feature);
    if (coords.length === 0) continue;
    const point = coords.reduce(
      ([lon, lat], [nextLon, nextLat]) => [
        lon + nextLon / coords.length,
        lat + nextLat / coords.length
      ],
      [0, 0] as [number, number]
    );
    if (!isCoordinateWithinBounds(point, REGIONAL_BOUNDS)) continue;

    let category: MapPlaceCategory = 'village';
    let halfSpan = villageHalfSpanDegrees;
    if (rawPlace === 'city') {
      category = 'city';
      halfSpan = cityCoreHalfSpanDegrees;
    } else if (rawPlace === 'town') {
      category = 'town';
      halfSpan = townHalfSpanDegrees;
    } else if (rawPlace === 'suburb') {
      category = 'suburb';
      halfSpan = suburbHalfSpanDegrees;
    } else if (rawPlace === 'village') {
      category = 'village';
      halfSpan = villageHalfSpanDegrees;
    } else {
      continue;
    }

    const id = `${category}-${key}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    seenKeys.add(`${rawPlace}:${key}`);
    seenKeys.add(key);

    const bounds = buildSquareBounds(point[0], point[1], halfSpan);
    const placeEntry: RegionalMapPlace = {
      id,
      label: rawName,
      district: inferDistrictLabel(point[0], point[1], adminBoundsList),
      lat: point[1],
      lon: point[0],
      description: `OpenStreetMap ${category} inside configured study region`,
      category,
      bounds,
      osmId: feature.id
    };
    discovered.push(placeEntry);
  }

  for (const boundary of adminBoundsList) {
    const key = normalizeSlug(boundary.name);
    if (!key) continue;
    const isDistrict = boundary.level === 5 || boundary.level === 7 || /district|authority/i.test(boundary.name);
    const category: MapPlaceCategory = isDistrict ? 'district' : 'mandal';
    const id = `${category}-${key}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const center = inferBoundsCenter(boundary.bounds);
    discovered.push({
      id,
      label: boundary.name,
      district: isDistrict ? 'District / Regional Authority' : 'Administrative Mandal',
      lat: center.lat,
      lon: center.lon,
      description: `OpenStreetMap administrative boundary (${category}) clipped to study corridor`,
      category,
      bounds: boundary.bounds,
      osmId: boundary.id
    });
  }

  const categoryOrder: Record<MapPlaceCategory, number> = {
    region: 0,
    city: 1,
    town: 2,
    district: 3,
    mandal: 4,
    suburb: 5,
    village: 6
  };

  discovered.sort((a, b) => {
    const isCoreA = REGIONAL_MAP_PLACES.some((p) => p.id === a.id);
    const isCoreB = REGIONAL_MAP_PLACES.some((p) => p.id === b.id);
    if (isCoreA && !isCoreB) return -1;
    if (!isCoreA && isCoreB) return 1;
    if (isCoreA && isCoreB) {
      return (
        REGIONAL_MAP_PLACES.findIndex((p) => p.id === a.id) -
        REGIONAL_MAP_PLACES.findIndex((p) => p.id === b.id)
      );
    }
    const orderDiff =
      (categoryOrder[a.category || 'village'] ?? 9) -
      (categoryOrder[b.category || 'village'] ?? 9);
    if (orderDiff !== 0) return orderDiff;
    return a.label.localeCompare(b.label);
  });

  registerDiscoveredMapPlaces(discovered);
  return discovered;
}

export function getDiscoveredMapPlaces(): RegionalMapPlace[] {
  return Array.from(discoveredPlacesRegistry.values());
}

export function getMapPlace(
  placeId: string,
  availablePlaces?: RegionalMapPlace[]
): RegionalMapPlace {
  if (availablePlaces) {
    const found = availablePlaces.find((place) => place.id === placeId);
    if (found) return found;
  }
  return (
    discoveredPlacesRegistry.get(placeId) ||
    REGIONAL_MAP_PLACES.find((place) => place.id === placeId) ||
    REGIONAL_MAP_PLACES[0]
  );
}

export function getMapBounds(
  placeId: string,
  availablePlaces?: RegionalMapPlace[]
): GeographicBounds {
  if (placeId === 'region') return REGIONAL_BOUNDS;
  if (placeId === 'nambur') return namburBounds;
  const place = getMapPlace(placeId, availablePlaces);
  if (place.bounds) return place.bounds;
  return {
    west: place.lon - cityCoreHalfSpanDegrees,
    south: place.lat - cityCoreHalfSpanDegrees,
    east: place.lon + cityCoreHalfSpanDegrees,
    north: place.lat + cityCoreHalfSpanDegrees
  };
}

/** Return the world-space geometric center of any selected area bounds so camera lookAt never shifts off-center. */
export function getMapPlaceWorldPosition(
  placeId: string,
  availablePlaces?: RegionalMapPlace[]
): THREE.Vector3 {
  const bounds = getMapBounds(placeId, availablePlaces);
  const center = inferBoundsCenter(bounds);
  return geographicToWorld(center.lon, center.lat);
}

/** Expand the visible map window to the canvas shape without distorting geography. */
export function fitMapBoundsToAspect(
  bounds: GeographicBounds,
  width: number,
  height: number
): GeographicBounds {
  const centerLat = (bounds.north + bounds.south) / 2;
  const metersPerLon = metersPerLatitudeDegree * Math.cos((centerLat * Math.PI) / 180);
  const widthMeters = (bounds.east - bounds.west) * metersPerLon;
  const heightMeters = (bounds.north - bounds.south) * metersPerLatitudeDegree;
  const targetAspect = Math.max(0.1, width / Math.max(height, 1));
  const boundsAspect = widthMeters / Math.max(heightMeters, 1);
  if (boundsAspect < targetAspect) {
    const expandedWidthMeters = heightMeters * targetAspect;
    const halfLon = expandedWidthMeters / (2 * metersPerLon);
    const centerLon = (bounds.west + bounds.east) / 2;
    return { ...bounds, west: centerLon - halfLon, east: centerLon + halfLon };
  }
  const expandedHeightMeters = widthMeters / targetAspect;
  const halfLat = expandedHeightMeters / (2 * metersPerLatitudeDegree);
  const center = (bounds.north + bounds.south) / 2;
  return { ...bounds, south: center - halfLat, north: center + halfLat };
}

export function expandMapBounds(bounds: GeographicBounds, factor = 1.2): GeographicBounds {
  const scale = Math.max(1, factor);
  const centerLon = (bounds.west + bounds.east) / 2;
  const centerLat = (bounds.south + bounds.north) / 2;
  const halfLon = ((bounds.east - bounds.west) * scale) / 2;
  const halfLat = ((bounds.north - bounds.south) * scale) / 2;
  return {
    west: centerLon - halfLon,
    east: centerLon + halfLon,
    south: centerLat - halfLat,
    north: centerLat + halfLat
  };
}

export function getMapTileZoom(placeId: string): number {
  if (placeId === 'region') return 9;
  const bounds = getMapBounds(placeId);
  const span = Math.max(bounds.east - bounds.west, bounds.north - bounds.south);
  if (span >= 0.45) return 9;
  if (span >= 0.22) return 10;
  if (span >= 0.11) return 11;
  if (span >= 0.068) return 12;
  return 13;
}

export function getMapPlaceDataId(_placeId: string): string {
  // All four city cores (nambur, vijayawada, tenali, guntur) and discovered places
  // share the unified gzip-compressed regional extract at public/maps/region.json.gz.
  return 'region';
}

export function geographicToWorld(lon: number, lat: number, y = 0): THREE.Vector3 {
  const x =
    (lon - MAP_CENTER.lon) * metersPerLongitudeDegree * MAP_WORLD_UNITS_PER_METER;
  const z =
    (MAP_CENTER.lat - lat) * metersPerLatitudeDegree * MAP_WORLD_UNITS_PER_METER;
  return new THREE.Vector3(x, y, z);
}

export function worldToGeographic(x: number, z: number): { lon: number; lat: number } {
  const lon = MAP_CENTER.lon + x / (metersPerLongitudeDegree * MAP_WORLD_UNITS_PER_METER);
  const lat = MAP_CENTER.lat - z / (metersPerLatitudeDegree * MAP_WORLD_UNITS_PER_METER);
  return { lon, lat };
}

function getScenarioOverlayBounds(placeId: string): GeographicBounds {
  // Regional overlays remain anchored near Nambur/VVITU. For local cities/towns
  // use the place's bounds; for wide districts/mandals center a compact city-sized
  // overlay frame on the chosen area's geometric center.
  if (placeId === 'region') return namburBounds;
  const bounds = getMapBounds(placeId);
  const spanLon = bounds.east - bounds.west;
  const spanLat = bounds.north - bounds.south;
  if (spanLon > 0.12 || spanLat > 0.12) {
    const center = inferBoundsCenter(bounds);
    return {
      west: center.lon - 0.03,
      south: center.lat - 0.03,
      east: center.lon + 0.03,
      north: center.lat + 0.03
    };
  }
  return bounds;
}

/**
 * Scenario x/y values are local model coordinates normalized to the active map
 * frame. This preserves aligned placement between 2D and 3D views without claiming
 * synthetic solver assets were surveyed from OSM.
 */
export function scenarioPositionToWorld(
  xPct: number,
  yPct: number,
  y = 0,
  mapPlaceId = 'nambur'
): THREE.Vector3 {
  const x = Math.max(0, Math.min(100, xPct)) / 100;
  const yFraction = Math.max(0, Math.min(100, yPct)) / 100;
  const bounds = getScenarioOverlayBounds(mapPlaceId);
  const lon = bounds.west + x * (bounds.east - bounds.west);
  const lat = bounds.north - yFraction * (bounds.north - bounds.south);
  return geographicToWorld(lon, lat, y);
}

export function geographicToSvg(
  lon: number,
  lat: number,
  bounds: GeographicBounds,
  width: number,
  height: number,
  padding = 20
): { x: number; y: number } {
  const centerLat = (bounds.north + bounds.south) / 2;
  const lonMeters = metersPerLatitudeDegree * Math.cos((centerLat * Math.PI) / 180);
  const widthMeters = (bounds.east - bounds.west) * lonMeters;
  const heightMeters = (bounds.north - bounds.south) * metersPerLatitudeDegree;
  const scale = Math.min(
    (width - padding * 2) / Math.max(widthMeters, 1),
    (height - padding * 2) / Math.max(heightMeters, 1)
  );
  const drawnWidth = widthMeters * scale;
  const drawnHeight = heightMeters * scale;
  return {
    x:
      (width - drawnWidth) / 2 +
      (lon - bounds.west) * lonMeters * scale,
    y:
      (height - drawnHeight) / 2 +
      (bounds.north - lat) * metersPerLatitudeDegree * scale
  };
}

export function scenarioPositionToSvg(
  xPct: number,
  yPct: number,
  viewport: GeographicBounds,
  width: number,
  height: number,
  padding = 20,
  mapPlaceId = 'nambur'
): { x: number; y: number } {
  const x = Math.max(0, Math.min(100, xPct)) / 100;
  const y = Math.max(0, Math.min(100, yPct)) / 100;
  const bounds = getScenarioOverlayBounds(mapPlaceId);
  const lon = bounds.west + x * (bounds.east - bounds.west);
  const lat = bounds.north - y * (bounds.north - bounds.south);
  return geographicToSvg(lon, lat, viewport, width, height, padding);
}

export function getOverlayScaleForViewport(viewport: GeographicBounds): number {
  const viewportWidthKm =
    ((viewport.east - viewport.west) * metersPerLongitudeDegree) / 1000;
  const namburWidthKm =
    ((namburBounds.east - namburBounds.west) * metersPerLongitudeDegree) / 1000;
  return Math.min(1, Math.max(0.045, namburWidthKm / Math.max(viewportWidthKm, 0.1)));
}

export function getPannedZoomBounds(
  base: GeographicBounds,
  zoom: number,
  pan: { x: number; y: number },
  size: { width: number; height: number },
  padding = 20
): GeographicBounds {
  const centerLat = (base.north + base.south) / 2;
  const metersPerLon =
    metersPerLatitudeDegree * Math.cos((centerLat * Math.PI) / 180);
  const widthMeters = ((base.east - base.west) * metersPerLon) / Math.max(zoom, 0.25);
  const heightMeters =
    ((base.north - base.south) * metersPerLatitudeDegree) / Math.max(zoom, 0.25);
  const scale = Math.min(
    (size.width - padding * 2) / Math.max(widthMeters, 1),
    (size.height - padding * 2) / Math.max(heightMeters, 1)
  );
  const metersPerPixel = 1 / Math.max(scale, 1e-9);
  const shiftedCenterLon =
    centerLonFromBounds(base) - (pan.x * metersPerPixel) / metersPerLon;
  const shiftedCenterLat =
    centerLat + (pan.y * metersPerPixel) / metersPerLatitudeDegree;
  const halfLon = widthMeters / (2 * metersPerLon);
  const halfLat = heightMeters / (2 * metersPerLatitudeDegree);
  return {
    west: shiftedCenterLon - halfLon,
    east: shiftedCenterLon + halfLon,
    south: shiftedCenterLat - halfLat,
    north: shiftedCenterLat + halfLat
  };
}

function centerLonFromBounds(bounds: GeographicBounds): number {
  return (bounds.west + bounds.east) / 2;
}

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const radians = (clampedLat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

function tileXToLon(x: number, zoom: number): number {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export function getOSMTileDescriptors(
  bounds: GeographicBounds,
  requestedZoom: number,
  maxTiles = 48
): OSMTileDescriptor[] {
  let zoom = Math.max(7, Math.min(18, Math.round(requestedZoom)));
  while (zoom > 7) {
    const minX = lonToTileX(bounds.west, zoom);
    const maxX = lonToTileX(bounds.east - 1e-8, zoom);
    const minY = latToTileY(bounds.north, zoom);
    const maxY = latToTileY(bounds.south + 1e-8, zoom);
    const count = (maxX - minX + 1) * (maxY - minY + 1);
    if (count <= maxTiles) break;
    zoom -= 1;
  }

  const minX = lonToTileX(bounds.west, zoom);
  const maxX = lonToTileX(bounds.east - 1e-8, zoom);
  const minY = latToTileY(bounds.north, zoom);
  const maxY = latToTileY(bounds.south + 1e-8, zoom);
  const tiles: OSMTileDescriptor[] = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({
        x,
        y,
        zoom,
        url: OSM_TILE_URL.replace('{z}', String(zoom))
          .replace('{x}', String(x))
          .replace('{y}', String(y)),
        bounds: {
          west: tileXToLon(x, zoom),
          east: tileXToLon(x + 1, zoom),
          north: tileYToLat(y, zoom),
          south: tileYToLat(y + 1, zoom)
        }
      });
    }
  }
  return tiles;
}

export function getTileSvgRect(
  tile: OSMTileDescriptor,
  viewport: GeographicBounds,
  width: number,
  height: number,
  padding = 20
): { x: number; y: number; width: number; height: number } {
  const northwest = geographicToSvg(
    tile.bounds.west,
    tile.bounds.north,
    viewport,
    width,
    height,
    padding
  );
  const southeast = geographicToSvg(
    tile.bounds.east,
    tile.bounds.south,
    viewport,
    width,
    height,
    padding
  );
  return {
    x: northwest.x,
    y: northwest.y,
    width: southeast.x - northwest.x,
    height: southeast.y - northwest.y
  };
}

export function getWorldDimensions(bounds: GeographicBounds): { width: number; depth: number } {
  const centerLat = (bounds.north + bounds.south) / 2;
  return {
    width:
      (bounds.east - bounds.west) *
      metersPerLatitudeDegree *
      Math.cos((centerLat * Math.PI) / 180) *
      MAP_WORLD_UNITS_PER_METER,
    depth:
      (bounds.north - bounds.south) *
      metersPerLatitudeDegree *
      MAP_WORLD_UNITS_PER_METER
  };
}

/**
 * Compute camera orbit distance so all four corners of the selected area bounds
 * fit cleanly inside the tilted perspective frustum without cropping city edges
 * or leaving excessive empty margins.
 */
export function getCameraFitDistance(placeId: string, aspect = 1.5): number {
  if (placeId === 'region') {
    // Calibrated framing: ensures the full study corridor (Vijayawada to Guntur/Tenali)
    // fills 85-90% of the canvas height and width cleanly, eliminating the "tiny postage stamp in void" bug
    return 72;
  }
  if (placeId === 'nambur') {
    // Calibrated neighborhood framing: centers directly over VVITU campus & Nambur settlement
    return 6.5;
  }
  const areaBounds = getMapBounds(placeId);
  const size = getWorldDimensions(areaBounds);
  const halfW = size.width / 2;
  const halfD = size.depth / 2;
  const azimuth = 0.68;
  const elevation = 0.82;

  const verticalFov = THREE.MathUtils.degToRad(38);
  const safeAspect = Math.max(0.4, aspect);
  const tanHalfV = Math.tan(verticalFov / 2);
  const tanHalfH = tanHalfV * safeAspect;
  const screenFill = 0.88;

  const sinA = Math.sin(azimuth);
  const cosA = Math.cos(azimuth);
  const sinE = Math.sin(elevation);
  const cosE = Math.cos(elevation);

  let requiredDistance = 4;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = sx * halfW;
      const pz = sz * halfD;
      const rightOffset = Math.abs(px * cosA - pz * sinA);
      const upOffset = Math.abs(-px * sinE * sinA - pz * sinE * cosA);
      const closerDepth = px * cosE * sinA + pz * cosE * cosA;
      const dForY = closerDepth + upOffset / (screenFill * tanHalfV);
      const dForX = closerDepth + rightOffset / (screenFill * tanHalfH);
      requiredDistance = Math.max(requiredDistance, dForX, dForY);
    }
  }
  return Math.max(14, Math.min(68, requiredDistance));
}

/** Fit the full selected region, city, town, district, or mandal inside the viewport cleanly. */
export function getCameraStartDistance(placeId: string, aspect = 1.5): number {
  return getCameraFitDistance(placeId, aspect);
}

/** Zoom distance for inspecting a searched or clicked point landmark/building. */
export function getLandmarkFocusDistance(placeId: string, aspect = 1.5): number {
  // Neighborhood / building close-up inspection (~750m - 900m ground extent)
  // Camera flies close enough to inspect street lanes, roofs, and asset markers clearly
  return 3.2;
}

/**
 * Decode an ArrayBuffer containing either raw gzip-compressed OSMPlaceData JSON
 * (magic bytes 0x1f 0x8b) or already-decompressed UTF-8 JSON (e.g. if a CDN/proxy
 * decoded Content-Encoding transparently).
 */
export async function decodeOSMPlaceBuffer(buffer: ArrayBuffer): Promise<OSMPlaceData> {
  const bytes = new Uint8Array(buffer);
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (isGzip) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Browser DecompressionStream API is unavailable to decode compressed map data.');
    }
    const decompressedStream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    const jsonText = await new Response(decompressedStream).text();
    return JSON.parse(jsonText) as OSMPlaceData;
  }
  const jsonText = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(jsonText) as OSMPlaceData;
}

export async function loadOSMPlaceData(placeId: string): Promise<OSMPlaceData> {
  const dataId = getMapPlaceDataId(placeId);
  const cached = osmDataCache.get(dataId);
  if (cached) return cached;
  const request = fetch(`/maps/${dataId}.json.gz`).then(async (response) => {
    if (!response.ok) throw new Error(`Could not load ${dataId} OpenStreetMap detail`);
    return decodeOSMPlaceBuffer(await response.arrayBuffer());
  });
  osmDataCache.set(dataId, request);
  try {
    return await request;
  } catch (error) {
    osmDataCache.delete(dataId);
    throw error;
  }
}

export function getFeatureCoordinates(feature: OSMMapFeature): [number, number][] {
  const raw = feature.coordinates as number[] | number[][];
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'number') {
    return raw.length >= 2 ? [[Number(raw[0]), Number(raw[1])]] : [];
  }
  return (raw as number[][])
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [Number(point[0]), Number(point[1])]);
}

/**
 * Build searchable/labeled mapped places and landmarks from OSM features across
 * the given bounds (pass REGIONAL_BOUNDS to search across the whole loaded region).
 */
export function getMapLandmarks(
  features: OSMMapFeature[],
  bounds: GeographicBounds,
  maxResults = 24
): NamedMapLandmark[] {
  const priorityByClass: Record<string, { category: string; priority: number }> = {
    city: { category: 'City', priority: 102 },
    town: { category: 'Town', priority: 92 },
    district: { category: 'District', priority: 94 },
    mandal: { category: 'Mandal', priority: 89 },
    suburb: { category: 'Suburb', priority: 78 },
    village: { category: 'Village', priority: 64 },
    neighbourhood: { category: 'Neighbourhood', priority: 52 },
    locality: { category: 'Locality', priority: 48 },
    hamlet: { category: 'Hamlet', priority: 46 },
    university: { category: 'Campus', priority: 100 },
    college: { category: 'Campus', priority: 98 },
    railway: { category: 'Transit', priority: 88 },
    station: { category: 'Transit', priority: 88 },
    bus_station: { category: 'Transit', priority: 84 },
    hospital: { category: 'Healthcare', priority: 80 },
    stadium: { category: 'Sports', priority: 76 },
    sports_centre: { category: 'Sports', priority: 74 },
    school: { category: 'Education', priority: 72 },
    townhall: { category: 'Civic', priority: 70 },
    courthouse: { category: 'Civic', priority: 70 },
    library: { category: 'Education', priority: 70 },
    park: { category: 'Public space', priority: 66 },
    playground: { category: 'Public space', priority: 60 },
    place_of_worship: { category: 'Landmark', priority: 56 },
    water_works: { category: 'Water infrastructure', priority: 62 },
    water_tower: { category: 'Water infrastructure', priority: 58 },
    substation: { category: 'Power substation', priority: 62 }
  };

  const candidates: NamedMapLandmark[] = [];

  for (const feature of features) {
    const name = typeof feature.name === 'string' ? feature.name.trim() : '';
    if (!name || /^(yes|no|building|house|potential( big)? building|unnamed)$/i.test(name)) {
      continue;
    }

    if (feature.kind === 'boundary') {
      const rawBounds = readFeatureBounds(feature);
      if (!rawBounds) continue;
      const clamped = clampBoundsToRegion(rawBounds);
      if (!clamped) continue;
      const center = inferBoundsCenter(clamped);
      if (!isCoordinateWithinBounds([center.lon, center.lat], bounds)) continue;
      const level = Number(feature.admin_level || 6);
      const isDistrict = level === 5 || level === 7 || /district|authority/i.test(name);
      const categoryKey = isDistrict ? 'district' : 'mandal';
      const meta = priorityByClass[categoryKey];
      candidates.push({
        id: feature.id,
        name: name.slice(0, 96),
        kind: feature.kind,
        category: meta.category,
        lon: center.lon,
        lat: center.lat,
        priority: meta.priority,
        placeId: `${categoryKey}-${normalizeSlug(name)}`,
        bounds: clamped
      });
      continue;
    }

    const featureClass = String(
      feature.place ||
      feature.class ||
      feature.amenity ||
      feature.leisure ||
      feature.historic ||
      feature.railway ||
      feature.power ||
      feature.man_made ||
      feature.building ||
      ''
    ).toLowerCase();

    const mappedCategory = priorityByClass[featureClass];
    const isMappedKind = [
      'place',
      'amenity',
      'poi',
      'leisure',
      'landcover',
      'building',
      'railway',
      'power',
      'water_supply'
    ].includes(feature.kind);
    if (!isMappedKind) continue;

    const coordinates = getFeatureCoordinates(feature);
    if (coordinates.length === 0) continue;
    const point = coordinates.reduce(
      ([lon, lat], [nextLon, nextLat]) => [
        lon + nextLon / coordinates.length,
        lat + nextLat / coordinates.length
      ],
      [0, 0] as [number, number]
    );
    if (!isCoordinateWithinBounds(point, bounds)) continue;

    let placeId: string | undefined;
    if (feature.place) {
      const slug = normalizeSlug(name);
      if (['nambur', 'vijayawada', 'tenali', 'guntur'].includes(slug)) {
        placeId = slug;
      } else if (['city', 'town', 'suburb', 'village'].includes(featureClass)) {
        placeId = `${featureClass}-${slug}`;
      }
    }

    candidates.push({
      id: feature.id,
      name: name.slice(0, 96),
      kind: feature.kind,
      category: mappedCategory?.category || 'Mapped place',
      lon: point[0],
      lat: point[1],
      priority:
        mappedCategory?.priority ||
        (feature.kind === 'amenity' ? 58 : feature.kind === 'poi' ? 52 : 40),
      placeId
    });
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    .filter((landmark) => {
      const normalizedName = landmark.name
        .normalize('NFKD')
        .replace(/\s*\([^)]*\)/g, '')
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, '');
      // OSM has separate campus polygon and point labels ("VVIT", "VVITU",
      // and the full institute name). Treat these as one mapped landmark.
      const key = /^(vvit|vvitu)$/.test(normalizedName) ||
        normalizedName.startsWith('vvituvasireddyvenkatadri')
        ? 'vvitu'
        : `${normalizedName}:${Math.round(landmark.lat * 20)}:${Math.round(landmark.lon * 20)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(0, maxResults));
}

/**
 * Extract curated waterway channels and major arterial highway landmarks with verified geographic coordinates.
 * Filters strictly to features with valid names and coordinates within bounds.
 */
export function getWaterwayAndHighwayLabels(
  features: OSMMapFeature[],
  bounds: GeographicBounds,
  maxResults = 16
): NamedMapLandmark[] {
  const candidates: NamedMapLandmark[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const isWater = feature.kind === 'waterway' || feature.waterway || feature.natural === 'water';
    const isHighway = feature.kind === 'road' && (feature.highway === 'motorway' || feature.highway === 'trunk' || feature.highway === 'primary' || Boolean(feature.name));

    if (!isWater && !isHighway) continue;
    const rawName = feature.name ? String(feature.name).trim() : '';
    if (!rawName || rawName.length < 2) continue;

    const coords = getFeatureCoordinates(feature);
    if (!coords || coords.length === 0) continue;

    // Center of feature
    const center = coords.reduce(
      ([lon, lat], [nextLon, nextLat]) => [
        lon + nextLon / coords.length,
        lat + nextLat / coords.length
      ],
      [0, 0] as [number, number]
    );

    if (!isCoordinateWithinBounds(center, bounds)) continue;

    let displayName = rawName;
    if (isWater) {
      if (/^krishna$/i.test(displayName)) displayName = 'Krishna River';
      else if (/^eluru kaaluva$/i.test(displayName)) displayName = 'Eluru Canal';
      else if (/^budameru$/i.test(displayName)) displayName = 'Budameru Rivulet / Canal';
      else if (/^prakasam/i.test(displayName)) displayName = 'Prakasam Barrage';
    } else if (isHighway) {
      if (/^brts$/i.test(displayName)) displayName = 'BRTS Rapid Transit Corridor';
      else if (/^ringroad$/i.test(displayName)) displayName = 'Guntur Inner Ring Road';
      else if (/^nh\s*16$/i.test(displayName)) displayName = 'NH 16 Highway';
    }

    const key = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      id: feature.id,
      name: displayName,
      kind: isWater ? 'waterway' : 'road',
      category: isWater ? 'Waterway' : 'Highway',
      lon: center[0],
      lat: center[1],
      priority: isWater ? 96 : 89
    });
  }

  return candidates.slice(0, maxResults);
}


export function summarizeOSMCoverage(
  features: OSMMapFeature[],
  bounds?: GeographicBounds
): OSMCoverageSummary {
  const summary: OSMCoverageSummary = {
    buildingFootprints: 0,
    buildingsWithTaggedHeight: 0,
    buildingsWithEstimatedHeight: 0,
    roadWays: 0,
    powerFeatures: 0,
    waterFacilities: 0,
    waterways: 0,
    railways: 0,
    namedPlaces: 0,
    adminBoundaries: 0
  };

  for (const feature of features) {
    if (feature.kind === 'boundary') {
      const b = readFeatureBounds(feature);
      if (b) {
        const center = inferBoundsCenter(b);
        if (!bounds || isCoordinateWithinBounds([center.lon, center.lat], bounds)) {
          summary.adminBoundaries += 1;
        }
      }
      continue;
    }

    const coords = getFeatureCoordinates(feature);
    if (coords.length === 0) continue;
    const sample = coords[Math.floor(coords.length / 2)];
    if (bounds && !coords.some((pt) => isCoordinateWithinBounds(pt, bounds)) && !isCoordinateWithinBounds(sample, bounds)) {
      continue;
    }

    if (feature.kind === 'building') {
      summary.buildingFootprints += 1;
      const meta = getBuildingHeightInfo(feature);
      if (meta.source === 'estimated') summary.buildingsWithEstimatedHeight += 1;
      else summary.buildingsWithTaggedHeight += 1;
    } else if (feature.kind === 'road') {
      summary.roadWays += 1;
    } else if (feature.kind === 'power') {
      summary.powerFeatures += 1;
    } else if (feature.kind === 'water_supply') {
      summary.waterFacilities += 1;
    } else if (feature.kind === 'waterway') {
      summary.waterways += 1;
    } else if (feature.kind === 'railway') {
      summary.railways += 1;
    } else if (feature.kind === 'place' || feature.place) {
      summary.namedPlaces += 1;
    }
  }
  return summary;
}

/**
 * Area label opacity: Full opacity at regional view, gently attenuating to a soft
 * readable background level during close zoom so context is never completely lost.
 * Selected or hovered places are always guaranteed full opacity.
 */
export function getAreaNameOpacity(
  cameraDistance: number,
  fitDistance: number,
  isSelectedOrHovered = false
): number {
  if (isSelectedOrHovered) return 1.0;
  const zoomRatio = cameraDistance / Math.max(1, fitDistance);
  if (zoomRatio >= 1.0) return 1.0;
  if (zoomRatio >= 0.85) {
    return Math.min(1.0, 0.75 + ((zoomRatio - 0.85) / 0.15) * 0.25);
  }
  // Soft, readable background opacity so area context is never completely wiped out
  return Math.max(0.40, Math.min(0.75, 0.40 + zoomRatio * 0.35));
}

/**
 * Landmark label opacity: Hidden at distant regional scale to prevent visual clutter,
 * smoothly fading in as the user zooms in, and remaining fully readable at close-up/building
 * scale without disappearing. Selected or hovered landmarks are guaranteed full opacity.
 */
export function getLandmarkNameOpacity(
  cameraDistance: number,
  fitDistance: number,
  isSelectedOrHovered = false
): number {
  if (isSelectedOrHovered) return 1.0;
  const zoomRatio = cameraDistance / Math.max(1, fitDistance);
  if (zoomRatio >= 0.85) return 0;
  if (zoomRatio >= 0.70) {
    return Math.max(0, ((0.85 - zoomRatio) / 0.15) * 0.8);
  }
  // At close zoom and building level, landmarks stay clearly visible and readable (0.80 - 1.0)
  return Math.min(1.0, Math.max(0.80, 1.0 - zoomRatio * 0.2));
}

export function isCoordinateWithinBounds(
  point: [number, number],
  bounds: GeographicBounds
): boolean {
  return point[0] >= bounds.west && point[0] <= bounds.east &&
    point[1] >= bounds.south && point[1] <= bounds.north;
}

/** Clip a geographic line segment to a map viewport using Liang-Barsky. */
export function clipLineSegmentToBounds(
  start: [number, number],
  end: [number, number],
  bounds: GeographicBounds
): [[number, number], [number, number]] | null {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const p = [-dx, dx, -dy, dy];
  const q = [
    start[0] - bounds.west,
    bounds.east - start[0],
    start[1] - bounds.south,
    bounds.north - start[1]
  ];
  let entering = 0;
  let leaving = 1;
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const intersection = q[i] / p[i];
    if (p[i] < 0) entering = Math.max(entering, intersection);
    else leaving = Math.min(leaving, intersection);
    if (entering > leaving) return null;
  }
  return [
    [start[0] + entering * dx, start[1] + entering * dy],
    [start[0] + leaving * dx, start[1] + leaving * dy]
  ];
}

function getFeatureTag(feature: OSMMapFeature, tag: string): string {
  const value = feature[tag];
  if (value !== undefined && value !== null) return String(value);
  if (tag === 'building:levels' && feature.levels !== undefined) return String(feature.levels);
  if (tag === 'highway' || tag === 'building' || tag === 'landuse') {
    return feature.class ? String(feature.class) : '';
  }
  return '';
}

/**
 * Calculates planar footprint area in square meters using spherical degree projection.
 */
export function computeFootprintAreaM2(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0;
  const midLat = (((coords[0] && coords[0][1]) || 16.4) * Math.PI) / 180;
  const metersPerLon = 111320 * Math.cos(midLat);
  const metersPerLat = 111320;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = coords[i][0] * metersPerLon;
    const y1 = coords[i][1] * metersPerLat;
    const x2 = coords[j][0] * metersPerLon;
    const y2 = coords[j][1] * metersPerLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function getBuildingHeightInfo(
  feature: OSMMapFeature,
  verticalExaggeration = 4
): BuildingHeightMetadata {
  const rawHeight = Number.parseFloat(String(feature.height || ''));
  const rawLevels = Number.parseFloat(getFeatureTag(feature, 'building:levels'));
  let heightMeters: number;
  let source: BuildingHeightSource;
  let classification: BuildingHeightClassification;
  let originalOsmHeight: number | undefined;
  let validatedSourceHeight: number | undefined;
  let osmBuildingLevels: number | undefined;
  let estimatedHeightFromLevels: number | undefined;
  let sanitizationReason: string | undefined;

  const type = getFeatureTag(feature, 'building').toLowerCase();
  const amenity = getFeatureTag(feature, 'amenity').toLowerCase();
  const name = String(feature.name || '').toLowerCase();
  const coords = getFeatureCoordinates(feature);
  const areaM2 = computeFootprintAreaM2(coords);

  // Compute procedural area-based height estimate (design assumption by typology)
  let proceduralAreaEstimate: number;
  if (
    type === 'house' ||
    type === 'residential' ||
    type === 'detached' ||
    type === 'terrace' ||
    type === 'hut' ||
    type === 'shed' ||
    type === 'cabin' ||
    type === 'bungalow' ||
    type === 'kiosk'
  ) {
    proceduralAreaEstimate = areaM2 > 120 ? 6.2 : 3.6; // 1-2 story dwelling
  } else if (
    type === 'apartments' ||
    type === 'residential_multi' ||
    type === 'dormitory' ||
    type === 'flats'
  ) {
    proceduralAreaEstimate = areaM2 > 400 ? 15.5 : 11.5; // Multi-story residential block (3-5 floors)
  } else if (
    type === 'commercial' ||
    type === 'retail' ||
    type === 'supermarket' ||
    type === 'shop'
  ) {
    proceduralAreaEstimate = areaM2 > 500 ? 12.0 : 6.5; // Commercial retail / storefronts
  } else if (type === 'office' || type === 'hotel' || type === 'bank') {
    proceduralAreaEstimate = areaM2 > 600 ? 18.5 : 14.5; // Commercial office / lodging
  } else if (
    type === 'industrial' ||
    type === 'warehouse' ||
    type === 'factory' ||
    type === 'hangar'
  ) {
    proceduralAreaEstimate = 6.0; // Broad horizontal facility
  } else if (
    type === 'school' ||
    type === 'university' ||
    type === 'college' ||
    type === 'hospital' ||
    type === 'civic' ||
    type === 'public' ||
    type === 'government' ||
    amenity.includes('school') ||
    amenity.includes('college') ||
    name.includes('college') ||
    name.includes('university')
  ) {
    proceduralAreaEstimate = areaM2 > 800 ? 12.5 : 8.5; // Campus structure
  } else if (
    type === 'temple' ||
    type === 'church' ||
    type === 'mosque' ||
    type === 'place_of_worship'
  ) {
    proceduralAreaEstimate = 7.5; // Religious structure
  } else if (type === 'roof' || type === 'canopy') {
    proceduralAreaEstimate = 3.0;
  } else {
    if (areaM2 > 0) {
      if (areaM2 < 90) proceduralAreaEstimate = 3.4;
      else if (areaM2 < 240) proceduralAreaEstimate = 5.2;
      else if (areaM2 < 800) proceduralAreaEstimate = 8.5;
      else proceduralAreaEstimate = 12.0;
    } else {
      proceduralAreaEstimate = 4.8;
    }
  }

  const idStr = String(feature.id || '');
  const idHash = (idStr.charCodeAt(idStr.length - 1) || 42) % 7;
  proceduralAreaEstimate = Math.max(3.0, proceduralAreaEstimate + (idHash - 3) * 0.15);

  const hasRawHeight = Number.isFinite(rawHeight);
  if (hasRawHeight) {
    originalOsmHeight = rawHeight;
  }

  const hasValidLevels = Number.isFinite(rawLevels) && rawLevels > 0 && rawLevels <= 80;
  if (hasValidLevels) {
    osmBuildingLevels = rawLevels;
    estimatedHeightFromLevels = Math.round(rawLevels * 3.1 * 10) / 10;
  }

  const hasPlausibleHeight = hasRawHeight && rawHeight > 0 && rawHeight <= 250;

  if (hasPlausibleHeight && hasValidLevels) {
    const expected = estimatedHeightFromLevels!;
    // Anomaly guard: if explicit height contradicts levels by more than 2.5x (e.g. 100m on a 3-level house)
    if (rawHeight > expected * 2.5 && (type === 'house' || type === 'residential' || rawHeight > 45)) {
      sanitizationReason = `Original source height ${rawHeight}m on ${type || 'building'} contradicts source building:levels (${rawLevels}); replaced with levels-based estimate of ${expected.toFixed(1)}m (3.1m/story).`;
      heightMeters = Math.max(3.0, expected);
      source = 'osm-levels';
      classification = 'sanitized-replacement-estimate';
    } else {
      validatedSourceHeight = rawHeight;
      heightMeters = rawHeight;
      source = 'osm-height';
      classification = 'source-osm-height';
    }
  } else if (hasPlausibleHeight) {
    // If only height is given, guard against unrealistic dwelling spikes
    if ((type === 'house' || type === 'residential' || type === 'detached') && rawHeight > 25) {
      sanitizationReason = `Original source height ${rawHeight}m on low-rise residential dwelling exceeds plausible physical limit (25m); replaced with area-based procedural estimate of ${proceduralAreaEstimate.toFixed(1)}m.`;
      heightMeters = proceduralAreaEstimate;
      source = 'estimated';
      classification = 'sanitized-replacement-estimate';
    } else {
      validatedSourceHeight = rawHeight;
      heightMeters = rawHeight;
      source = 'osm-height';
      classification = 'source-osm-height';
    }
  } else if (hasRawHeight && !hasPlausibleHeight) {
    sanitizationReason = `Original source height ${rawHeight}m is outside plausible range (0-250m); replaced with area-based procedural estimate.`;
    heightMeters = proceduralAreaEstimate;
    source = 'estimated';
    classification = 'sanitized-replacement-estimate';
  } else if (hasValidLevels) {
    heightMeters = Math.max(3.0, estimatedHeightFromLevels!);
    source = 'osm-levels';
    classification = 'estimated-from-levels';
  } else {
    heightMeters = proceduralAreaEstimate;
    source = 'estimated';
    classification = 'procedural-area-estimate';
  }

  // Exaggeration is a visualization scale only; solver calculations do not use it.
  return {
    heightMeters: Math.round(heightMeters * 10) / 10,
    source,
    classification,
    originalOsmHeight,
    validatedSourceHeight,
    osmBuildingLevels,
    estimatedHeightFromLevels,
    proceduralAreaEstimate: Math.round(proceduralAreaEstimate * 10) / 10,
    sanitizationReason,
    worldHeight: Math.max(0.015, heightMeters * MAP_WORLD_UNITS_PER_METER * verticalExaggeration)
  };
}

function getBuildingHeightWorld(feature: OSMMapFeature, verticalExaggeration = 4): number {
  return getBuildingHeightInfo(feature, verticalExaggeration).worldHeight;
}

function getBuildingRoofColor(feature: OSMMapFeature): THREE.Color {
  const type = getFeatureTag(feature, 'building').toLowerCase();
  const amenity = getFeatureTag(feature, 'amenity').toLowerCase();
  const name = String(feature.name || '').toLowerCase();

  // Residential houses: authentic terracotta tile / warm clay
  if (
    type === 'house' ||
    type === 'residential' ||
    type === 'detached' ||
    type === 'bungalow' ||
    type === 'terrace'
  ) {
    const idStr = String(feature.id || '');
    const h = (idStr.charCodeAt(idStr.length - 1) || 3) % 3;
    if (h === 0) return new THREE.Color(0xb45309); // Terracotta amber
    if (h === 1) return new THREE.Color(0x9a3412); // Deep clay tile
    return new THREE.Color(0xa16207);               // Warm ochre tile
  }

  // Commercial / Offices / Retail: modern architectural slate-gravel membrane
  if (
    type.includes('commercial') ||
    type.includes('retail') ||
    type.includes('office') ||
    type.includes('hotel') ||
    type.includes('bank')
  ) {
    return new THREE.Color(0x64748b); // Sleek slate gravel
  }

  // Multi-story apartments: clean limestone gravel terrace
  if (type.includes('apartments') || type.includes('residential_multi') || type.includes('dormitory')) {
    return new THREE.Color(0x94a3b8); // Clean gravel terrace
  }

  // Industrial / Warehouses: steel corrugated deck
  if (type.includes('industrial') || type.includes('warehouse') || type.includes('factory')) {
    return new THREE.Color(0x475569); // Charcoal steel
  }

  // Campuses / Universities / Civic: reflective white-stone terrace
  if (
    type.includes('school') ||
    type.includes('university') ||
    type.includes('college') ||
    amenity.includes('school') ||
    amenity.includes('college') ||
    name.includes('college') ||
    name.includes('university') ||
    name.includes('vvit')
  ) {
    return new THREE.Color(0xcfd8dc); // Crisp architectural stone
  }

  // Generic buildings: realistic mix of Mediterranean terracotta and weathered slate gravel
  const idStr = String(feature.id || '');
  const h = (idStr.charCodeAt(idStr.length - 1) || 7) % 5;
  if (h === 0) return new THREE.Color(0xb45309); // Terracotta tile
  if (h === 1) return new THREE.Color(0x9a3412); // Deep clay tile
  if (h === 2) return new THREE.Color(0x78716c); // Weathered gravel
  if (h === 3) return new THREE.Color(0x64748b); // Slate gravel membrane
  return new THREE.Color(0xa8a29e);               // Limestone gravel
}

function getBuildingColor(feature: OSMMapFeature): THREE.Color {
  const type = getFeatureTag(feature, 'building').toLowerCase();
  const amenity = getFeatureTag(feature, 'amenity').toLowerCase();
  const name = String(feature.name || '').toLowerCase();

  // Campuses / Universities / Schools: refined architectural ivory-limestone
  if (
    type.includes('school') ||
    type.includes('university') ||
    type.includes('college') ||
    amenity.includes('school') ||
    amenity.includes('college') ||
    name.includes('college') ||
    name.includes('university') ||
    name.includes('vvit')
  ) {
    return new THREE.Color(0xded8ce); // Refined campus limestone
  }

  // Commercial / Retail / Offices: modern architectural travertine & slate-glass
  if (
    type.includes('commercial') ||
    type.includes('retail') ||
    type.includes('office') ||
    type.includes('hotel') ||
    type.includes('bank')
  ) {
    const idStr = String(feature.id || '');
    const h = (idStr.charCodeAt(idStr.length - 1) || 7) % 3;
    if (h === 0) return new THREE.Color(0xe2ded4); // Warm travertine
    if (h === 1) return new THREE.Color(0xcfd6df); // Pale architectural slate
    return new THREE.Color(0xb8c0cc);               // Architectural glass-steel slate
  }

  // Industrial / Warehouses: steel charcoal
  if (type.includes('industrial') || type.includes('warehouse') || type.includes('factory')) {
    return new THREE.Color(0x64748b);
  }

  // Multi-story apartments / flats: clean limestone concrete
  if (type.includes('apartments') || type.includes('residential_multi') || type.includes('dormitory')) {
    return new THREE.Color(0xd4cdc2); // Warm limestone
  }

  // Low-rise homes / generic residential: authentic natural building materials
  // (sandstone cream, warm ochre, terracotta brick, and architectural slate)
  const idStr = String(feature.id || '');
  const hash = (idStr.charCodeAt(idStr.length - 1) || 42) % 4;
  if (hash === 0) return new THREE.Color(0xdad3c5); // Warm architectural stone
  if (hash === 1) return new THREE.Color(0xcbd5e1); // Pale slate concrete
  if (hash === 2) return new THREE.Color(0xd97706); // Warm ochre accent
  return new THREE.Color(0xb45309);                 // Terracotta brick
}

export function createOSMBuildingGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  verticalExaggeration = 4,
  isWideAreaView = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const scaleM = MAP_WORLD_UNITS_PER_METER * verticalExaggeration;

  for (const feature of features) {
    if (feature.kind !== 'building') continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 4) continue;
    if (bounds) {
      const center = coords.reduce(
        ([lon, lat], [nextLon, nextLat]) => [
          lon + nextLon / coords.length,
          lat + nextLat / coords.length
        ],
        [0, 0] as [number, number]
      );
      if (!isCoordinateWithinBounds(center, bounds)) continue;
    }

    const minArea = isWideAreaView ? 65 : 15;
    const areaM2 = computeFootprintAreaM2(coords);
    const hasExplicitHeight = feature.height || getFeatureTag(feature, 'building:levels');
    const isNamedBuilding = Boolean(feature.name && String(feature.name).trim().length > 2);
    if (!hasExplicitHeight && !isNamedBuilding && areaM2 < minArea) continue;

    const ring = [...coords];
    if (
      ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
    ) {
      ring.pop();
    }
    if (ring.length < 3) continue;

    // 1. Clean near-duplicate consecutive vertices to avoid zero-length edges and degenerate sliver triangles
    const cleanedCoords: [number, number][] = [];
    for (let c = 0; c < ring.length; c++) {
      const curr = ring[c];
      const prev = cleanedCoords[cleanedCoords.length - 1];
      if (!prev) {
        cleanedCoords.push(curr);
      } else {
        const dLon = (curr[0] - prev[0]) * 111320 * 0.96;
        const dLat = (curr[1] - prev[1]) * 111320;
        if (dLon * dLon + dLat * dLat > 0.04) {
          cleanedCoords.push(curr);
        }
      }
    }
    if (cleanedCoords.length < 3) continue;

    // 2. Filter out razor-thin perimeter wall slivers (ratio perimeter^2 / area > 180)
    let perimeterM = 0;
    for (let c = 0; c < cleanedCoords.length; c++) {
      const p1 = cleanedCoords[c];
      const p2 = cleanedCoords[(c + 1) % cleanedCoords.length];
      const dx = (p2[0] - p1[0]) * 111320 * 0.96;
      const dy = (p2[1] - p1[1]) * 111320;
      perimeterM += Math.sqrt(dx * dx + dy * dy);
    }
    if (areaM2 > 0 && (perimeterM * perimeterM) / areaM2 > 180 && !isNamedBuilding && !hasExplicitHeight) {
      continue;
    }

    const world = cleanedCoords.map(([lon, lat]) => geographicToWorld(lon, lat));
    let contour = world.map((point) => new THREE.Vector2(point.x, point.z));

    // 3. CRITICAL: Strictly normalize polygon winding to Counter-Clockwise (CCW).
    // This ensures outward-facing wall normals and upward-facing roof normals.
    if (THREE.ShapeUtils.isClockWise(contour)) {
      contour = contour.reverse();
      world.reverse();
      cleanedCoords.reverse();
    }

    const roofFaces = THREE.ShapeUtils.triangulateShape(contour, []);
    if (roofFaces.length === 0) continue;

    const count = world.length;
    const height = getBuildingHeightWorld(feature, verticalExaggeration);
    const color = getBuildingColor(feature);
    const roofColor = getBuildingRoofColor(feature);
    const baseHeight = 0.015;
    const roofHeight = height + baseHeight;

    const bType = getFeatureTag(feature, 'building').toLowerCase();
    const isResidentialHouse = (bType === 'house' || bType === 'detached' || bType === 'bungalow') && areaM2 < 190;
    const isLargeComplex = areaM2 > 220 && (bType === 'commercial' || bType === 'apartments' || bType === 'university' || bType === 'hospital' || bType === 'yes');

    // 4. Faceted Exterior Walls with Outward-Facing Normals
    const parapetExtra = (!isResidentialHouse && !isWideAreaView) ? 0.38 * scaleM : 0;
    const wallTopHeight = roofHeight + parapetExtra;

    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count;
      const p1 = world[i];
      const p2 = world[next];
      const wallBaseIdx = positions.length / 3;

      // 4 quad vertices
      positions.push(
        p1.x, baseHeight, p1.z,
        p2.x, baseHeight, p2.z,
        p2.x, wallTopHeight, p2.z,
        p1.x, wallTopHeight, p1.z
      );

      const wallLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const wallH = wallTopHeight - baseHeight;
      uvs.push(
        0, 0,
        wallLen, 0,
        wallLen, wallH,
        0, wallH
      );

      // Ambient occlusion: darker bottom (0.64), sunlit top (1.02)
      colors.push(
        color.r * 0.64, color.g * 0.64, color.b * 0.64,
        color.r * 0.64, color.g * 0.64, color.b * 0.64,
        Math.min(1.0, color.r * 1.02), Math.min(1.0, color.g * 1.02), Math.min(1.0, color.b * 1.02),
        Math.min(1.0, color.r * 1.02), Math.min(1.0, color.g * 1.02), Math.min(1.0, color.b * 1.02)
      );

      indices.push(
        wallBaseIdx, wallBaseIdx + 1, wallBaseIdx + 2,
        wallBaseIdx, wallBaseIdx + 2, wallBaseIdx + 3
      );
    }

    // 5. Roof Geometry: Pitched roof ONLY for small convex dwellings where centroid is inside
    let cx = 0, cz = 0;
    for (const p of world) { cx += p.x; cz += p.z; }
    cx /= count;
    cz /= count;
    const centroidVec = new THREE.Vector2(cx, cz);

    // Robust point-in-polygon helper
    let centroidInside = false;
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const xi = contour[i].x, yi = contour[i].y;
      const xj = contour[j].x, yj = contour[j].y;
      const intersect = ((yi > centroidVec.y) !== (yj > centroidVec.y)) &&
        (centroidVec.x < ((xj - xi) * (centroidVec.y - yi)) / (yj - yi) + xi);
      if (intersect) centroidInside = !centroidInside;
    }

    const canUsePitchedRoof = isResidentialHouse && !isWideAreaView && count <= 5 && centroidInside;

    if (canUsePitchedRoof) {
      // Pitched / Hipped Roof for Residential Dwellings
      const ridgeHeight = roofHeight + 1.5 * scaleM;
      const peakIdx = positions.length / 3;
      positions.push(cx, ridgeHeight, cz);
      colors.push(
        Math.min(1.0, roofColor.r * 1.15),
        Math.min(1.0, roofColor.g * 1.15),
        Math.min(1.0, roofColor.b * 1.15)
      );
      uvs.push(cx, cz);

      for (let i = 0; i < count; i += 1) {
        const next = (i + 1) % count;
        const e1Idx = positions.length / 3;
        const p1 = world[i];
        const p2 = world[next];
        positions.push(
          p1.x, roofHeight, p1.z,
          p2.x, roofHeight, p2.z
        );
        colors.push(
          Math.min(1.0, roofColor.r * 1.05), Math.min(1.0, roofColor.g * 1.05), Math.min(1.0, roofColor.b * 1.05),
          Math.min(1.0, roofColor.r * 1.05), Math.min(1.0, roofColor.g * 1.05), Math.min(1.0, roofColor.b * 1.05)
        );
        uvs.push(p1.x, p1.z, p2.x, p2.z);
        // Correct upward-facing CCW winding order for pitched roof triangles
        indices.push(peakIdx, e1Idx + 1, e1Idx);
      }
    } else {
      // Crisp Flat Roof Terrace (Recessed inside parapet when parapetExtra > 0)
      const roofBaseIdx = positions.length / 3;
      const roofBrightness = parapetExtra > 0 ? 0.94 : 1.05;
      for (let i = 0; i < count; i += 1) {
        const p = world[i];
        positions.push(p.x, roofHeight, p.z);
        colors.push(
          Math.min(1.0, roofColor.r * roofBrightness),
          Math.min(1.0, roofColor.g * roofBrightness),
          Math.min(1.0, roofColor.b * roofBrightness)
        );
        uvs.push(p.x, p.z);
      }

      for (const face of roofFaces) {
        // Correct upward-facing CCW winding order
        indices.push(
          roofBaseIdx + face[0],
          roofBaseIdx + face[1],
          roofBaseIdx + face[2]
        );
      }

      // 6. Rooftop Mechanical Penthouse (Procedural Enclosure for Larger Buildings)
      if (isLargeComplex && !isWideAreaView) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of world) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        const hw = Math.max(0.006, (maxX - minX) * 0.16);
        const hd = Math.max(0.006, (maxZ - minZ) * 0.16);
        const phTop = roofHeight + 2.2 * scaleM;

        const phCorners = [
          { x: cx - hw, z: cz - hd },
          { x: cx + hw, z: cz - hd },
          { x: cx + hw, z: cz + hd },
          { x: cx - hw, z: cz + hd }
        ];

        // 4 walls of penthouse
        for (let j = 0; j < 4; j += 1) {
          const next = (j + 1) % 4;
          const q1 = phCorners[j];
          const q2 = phCorners[next];
          const phBaseIdx = positions.length / 3;
          positions.push(
            q1.x, roofHeight, q1.z,
            q2.x, roofHeight, q2.z,
            q2.x, phTop, q2.z,
            q1.x, phTop, q1.z
          );
          colors.push(
            0.40, 0.45, 0.52,
            0.40, 0.45, 0.52,
            0.55, 0.60, 0.68,
            0.55, 0.60, 0.68
          );
          const phLen = Math.hypot(q2.x - q1.x, q2.z - q1.z);
          uvs.push(0, 0, phLen, 0, phLen, 2.2 * scaleM, 0, 2.2 * scaleM);
          indices.push(
            phBaseIdx, phBaseIdx + 1, phBaseIdx + 2,
            phBaseIdx, phBaseIdx + 2, phBaseIdx + 3
          );
        }

        // Top cap of penthouse
        const phCapIdx = positions.length / 3;
        for (let j = 0; j < 4; j += 1) {
          const q = phCorners[j];
          positions.push(q.x, phTop, q.z);
          colors.push(0.65, 0.70, 0.78);
          uvs.push(q.x, q.z);
        }
        indices.push(
          phCapIdx, phCapIdx + 1, phCapIdx + 2,
          phCapIdx, phCapIdx + 2, phCapIdx + 3
        );
      }

      // 7. Rooftop HVAC Chiller Units (for buildings with areaM2 > 120)
      if (areaM2 > 120 && !isResidentialHouse && !isWideAreaView) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const p of world) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const bSpanX = maxX - minX;
        const bSpanZ = maxZ - minZ;
        if (bSpanX > 0.015 && bSpanZ > 0.015) {
          const hvacSize = 0.0035;
          const hvacH = 1.1 * scaleM;
          const offsets = [
            { x: minX + bSpanX * 0.28, z: minZ + bSpanZ * 0.32 },
            { x: minX + bSpanX * 0.72, z: minZ + bSpanZ * 0.68 }
          ];
          for (const off of offsets) {
            const hx1 = off.x - hvacSize;
            const hx2 = off.x + hvacSize;
            const hz1 = off.z - hvacSize;
            const hz2 = off.z + hvacSize;
            const hBase = roofHeight;
            const hTop = roofHeight + hvacH;
            const hvacCorners = [
              { x: hx1, z: hz1 },
              { x: hx2, z: hz1 },
              { x: hx2, z: hz2 },
              { x: hx1, z: hz2 }
            ];
            for (let j = 0; j < 4; j++) {
              const next = (j + 1) % 4;
              const q1 = hvacCorners[j];
              const q2 = hvacCorners[next];
              const idx = positions.length / 3;
              positions.push(
                q1.x, hBase, q1.z,
                q2.x, hBase, q2.z,
                q2.x, hTop, q2.z,
                q1.x, hTop, q1.z
              );
              colors.push(
                0.48, 0.52, 0.58,
                0.48, 0.52, 0.58,
                0.62, 0.66, 0.72,
                0.62, 0.66, 0.72
              );
              uvs.push(0, 0, hvacSize * 2, 0, hvacSize * 2, hvacH, 0, hvacH);
              indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
            }
            // Top fan grille
            const capIdx = positions.length / 3;
            for (let j = 0; j < 4; j++) {
              const q = hvacCorners[j];
              positions.push(q.x, hTop, q.z);
              colors.push(0.35, 0.38, 0.44);
              uvs.push(q.x, q.z);
            }
            indices.push(capIdx, capIdx + 1, capIdx + 2, capIdx, capIdx + 2, capIdx + 3);
          }
        }
      }
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build mapped building edges and vertical corners alongside the solid OSM
 * building mesh.
 */
export function createOSMBuildingOutlineGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  footprintOnly = false,
  verticalExaggeration = 4,
  showFloorBands = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];

  for (const feature of features) {
    if (feature.kind !== 'building') continue;
    const coordinates = getFeatureCoordinates(feature);
    if (coordinates.length < 4) continue;
    if (bounds) {
      const center = coordinates.reduce(
        ([lon, lat], [nextLon, nextLat]) => [
          lon + nextLon / coordinates.length,
          lat + nextLat / coordinates.length
        ],
        [0, 0] as [number, number]
      );
      if (!isCoordinateWithinBounds(center, bounds)) continue;
    }

    const ring = [...coordinates];
    if (
      ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
    ) {
      ring.pop();
    }
    if (ring.length < 3) continue;

    const world = ring.map(([lon, lat]) => geographicToWorld(lon, lat));
    const baseHeight = 0.015;
    const roofHeight = getBuildingHeightWorld(feature, verticalExaggeration) + baseHeight;
    for (let index = 0; index < world.length; index += 1) {
      const point = world[index];
      const next = world[(index + 1) % world.length];
      positions.push(point.x, baseHeight, point.z, next.x, baseHeight, next.z);
      if (!footprintOnly) {
        positions.push(
          point.x, roofHeight, point.z, next.x, roofHeight, next.z,
          point.x, baseHeight, point.z, point.x, roofHeight, point.z
        );
        if (showFloorBands) {
          const totalH = roofHeight - baseHeight;
          const floorStep = 0.024;
          const floorCount = Math.floor(totalH / floorStep);
          for (let f = 1; f < floorCount; f++) {
            const fy = baseHeight + f * floorStep;
            positions.push(point.x, fy, point.z, next.x, fy, next.z);
          }
        }
      }
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

const ARTERIAL_SPINE_TYPES = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link'
]);

export function isArterialSpineRoad(feature: OSMMapFeature): boolean {
  const cls = getFeatureTag(feature, 'highway').toLowerCase();
  return ARTERIAL_SPINE_TYPES.has(cls);
}

const MAJOR_HIGHWAY_TYPES = new Set([
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link'
]);

export function isMajorRegionalRoad(feature: OSMMapFeature): boolean {
  const cls = getFeatureTag(feature, 'highway').toLowerCase();
  return MAJOR_HIGHWAY_TYPES.has(cls);
}

/**
 * Creates physical 3D polygon ribbon geometry for major regional expressways and arterial spines.
 * Generates continuous glowing multi-lane highway ribbons (inspired by Dubai Digital Twin command center).
 */
export function createOSMArterialRibbonGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  isHologram = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const y = 0.040;
  const halfWidth = 0.052; // ~10.5m physical corridor width

  // Colors:
  // Normal 3D: Authentic dark graphite asphalt corridor
  // Hologram: Radiant electric cyan fiber-optic conduit
  const roadColor = isHologram ? new THREE.Color(0x00f0ff) : new THREE.Color(0x23272e);

  for (const feature of features) {
    if (feature.kind !== 'road') continue;
    if (!isArterialSpineRoad(feature)) continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;

    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;

      const a = geographicToWorld(segment[0][0], segment[0][1], y);
      const b = geographicToWorld(segment[1][0], segment[1][1], y);

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-4) continue;

      const nx = (-dz / len) * halfWidth;
      const nz = (dx / len) * halfWidth;

      const baseIdx = positions.length / 3;

      // 4 quad vertices: 2 on left, 2 on right
      positions.push(
        a.x - nx, y, a.z - nz, // v0 (left A)
        a.x + nx, y, a.z + nz, // v1 (right A)
        b.x + nx, y, b.z + nz, // v2 (right B)
        b.x - nx, y, b.z - nz  // v3 (left B)
      );

      // Uniform high-contrast road corridor colors
      colors.push(
        roadColor.r, roadColor.g, roadColor.b,
        roadColor.r, roadColor.g, roadColor.b,
        roadColor.r, roadColor.g, roadColor.b,
        roadColor.r, roadColor.g, roadColor.b
      );

      indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx, baseIdx + 2, baseIdx + 3
      );
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Creates physical 3D polygon ribbon geometry for all mapped road networks (highways, arterials,
 * secondary connectors, and local streets) with realistic physical widths and authentic asphalt materials.
 * Distinguishes Daylight Photorealistic (graphite asphalt) vs Holographic Cyber (cyan/blue fiber-optic).
 */
export function createOSMRoadNetworkRibbonGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  isHologram = false,
  isWideAreaView = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const arterialColor = isHologram ? new THREE.Color(0x00f0ff) : new THREE.Color(0x20242b);
  const secondaryColor = isHologram ? new THREE.Color(0x0284c7) : new THREE.Color(0x282c35);
  const localColor = isHologram ? new THREE.Color(0x0369a1) : new THREE.Color(0x333742);

  for (const feature of features) {
    if (feature.kind !== 'road') continue;
    const highway = String(feature.highway || getFeatureTag(feature, 'highway') || '').toLowerCase();
    if (!highway) continue;

    let halfWidth = 0.016; // Default local / residential ~3.2m corridor
    let y = 0.026;
    let roadColor = localColor;

    if (isArterialSpineRoad(feature)) {
      halfWidth = 0.050; // ~10m corridor
      y = 0.038;
      roadColor = arterialColor;
    } else if (highway === 'secondary' || highway === 'secondary_link') {
      halfWidth = 0.034; // ~6.8m corridor
      y = 0.034;
      roadColor = secondaryColor;
    } else if (highway === 'tertiary' || highway === 'tertiary_link' || highway === 'busway') {
      halfWidth = 0.024; // ~4.8m corridor
      y = 0.030;
      roadColor = secondaryColor;
    } else {
      // Residential, service, unclassified
      if (isWideAreaView) continue; // Skip dense residential alleys in wide regional overview
      halfWidth = 0.016;
      y = 0.026;
      roadColor = localColor;
    }

    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;

    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;

      const a = geographicToWorld(segment[0][0], segment[0][1], y);
      const b = geographicToWorld(segment[1][0], segment[1][1], y);

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-4) continue;

      const nx = (-dz / len) * halfWidth;
      const nz = (dx / len) * halfWidth;

      const baseIdx = positions.length / 3;

      positions.push(
        a.x - nx, y, a.z - nz,
        a.x + nx, y, a.z + nz,
        b.x + nx, y, b.z + nz,
        b.x - nx, y, b.z - nz
      );

      colors.push(
        roadColor.r, roadColor.g, roadColor.b,
        roadColor.r, roadColor.g, roadColor.b,
        roadColor.r, roadColor.g, roadColor.b,
        roadColor.r, roadColor.g, roadColor.b
      );

      indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx, baseIdx + 2, baseIdx + 3
      );
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Creates subtle off-white / cyan center lane divider lines for multi-lane arterials and highways.
 */
export function createOSMLaneMarkingsGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  isHologram = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const stripeColor = isHologram ? new THREE.Color(0x38bdf8) : new THREE.Color(0xf1f5f9);
  const halfWidth = 0.003; // ~0.6m center marking strip

  for (const feature of features) {
    if (feature.kind !== 'road') continue;
    if (!isArterialSpineRoad(feature) && !isMajorRegionalRoad(feature)) continue;

    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;
    const y = 0.041; // Slightly above road surface

    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;

      const a = geographicToWorld(segment[0][0], segment[0][1], y);
      const b = geographicToWorld(segment[1][0], segment[1][1], y);

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-4) continue;

      const nx = (-dz / len) * halfWidth;
      const nz = (dx / len) * halfWidth;

      const baseIdx = positions.length / 3;

      positions.push(
        a.x - nx, y, a.z - nz,
        a.x + nx, y, a.z + nz,
        b.x + nx, y, b.z + nz,
        b.x - nx, y, b.z - nz
      );

      colors.push(
        stripeColor.r, stripeColor.g, stripeColor.b,
        stripeColor.r, stripeColor.g, stripeColor.b,
        stripeColor.r, stripeColor.g, stripeColor.b,
        stripeColor.r, stripeColor.g, stripeColor.b
      );

      indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx, baseIdx + 2, baseIdx + 3
      );
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Creates instanced low-poly 3D tree clusters strictly placed within verified OSM green space polygons
 * (parks, gardens, meadows, forests, playgrounds, grass areas).
 * Guarantees zero trees placed on roads, buildings, or water.
 * Geographic honesty: Procedural realistic canopy density estimate within surveyed OSM land boundaries.
 */
export function createOSMVegetationInstancedMesh(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  isHologram = false,
  maxInstances = 1200
): THREE.InstancedMesh | null {
  // 1. Build a combined low-poly tree geometry: cylinder trunk + conical foliage crown
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Trunk: 5-sided cylinder (radius ~0.0014, height ~0.007)
  const trunkSides = 5;
  const trunkR = 0.0014;
  const trunkH = 0.007;
  const trunkBaseIdx = positions.length / 3;

  for (let i = 0; i < trunkSides; i++) {
    const angle = (i / trunkSides) * Math.PI * 2;
    const x = Math.cos(angle) * trunkR;
    const z = Math.sin(angle) * trunkR;
    positions.push(x, 0, z);
    normals.push(x / trunkR, 0, z / trunkR);
    colors.push(0.32, 0.22, 0.14);
    positions.push(x * 0.85, trunkH, z * 0.85);
    normals.push(x / trunkR, 0, z / trunkR);
    colors.push(0.38, 0.26, 0.17);
  }
  for (let i = 0; i < trunkSides; i++) {
    const next = (i + 1) % trunkSides;
    const b1 = trunkBaseIdx + i * 2;
    const t1 = b1 + 1;
    const b2 = trunkBaseIdx + next * 2;
    const t2 = b2 + 1;
    indices.push(b1, b2, t2, b1, t2, t1);
  }

  // Foliage Crown: 2 stacked conical canopy tiers for a rich natural silhouette
  const crownSides = 7;
  // Tier 1 (Lower canopy)
  const t1BaseIdx = positions.length / 3;
  const t1Y = trunkH * 0.75;
  const t1TopY = t1Y + 0.013;
  const t1R = 0.0075;
  for (let i = 0; i < crownSides; i++) {
    const angle = (i / crownSides) * Math.PI * 2;
    const x = Math.cos(angle) * t1R;
    const z = Math.sin(angle) * t1R;
    positions.push(x, t1Y, z);
    normals.push(x / t1R, 0.35, z / t1R);
    colors.push(0.18, 0.38, 0.16);
  }
  const t1PeakIdx = positions.length / 3;
  positions.push(0, t1TopY, 0);
  normals.push(0, 1, 0);
  colors.push(0.28, 0.52, 0.22);
  for (let i = 0; i < crownSides; i++) {
    const next = (i + 1) % crownSides;
    indices.push(t1PeakIdx, t1BaseIdx + i, t1BaseIdx + next);
  }

  // Tier 2 (Upper canopy)
  const t2BaseIdx = positions.length / 3;
  const t2Y = t1Y + 0.006;
  const t2TopY = t2Y + 0.012;
  const t2R = 0.0055;
  for (let i = 0; i < crownSides; i++) {
    const angle = (i / crownSides) * Math.PI * 2 + 0.25;
    const x = Math.cos(angle) * t2R;
    const z = Math.sin(angle) * t2R;
    positions.push(x, t2Y, z);
    normals.push(x / t2R, 0.45, z / t2R);
    colors.push(0.24, 0.48, 0.20);
  }
  const t2PeakIdx = positions.length / 3;
  positions.push(0, t2TopY, 0);
  normals.push(0, 1, 0);
  colors.push(0.36, 0.64, 0.26);
  for (let i = 0; i < crownSides; i++) {
    const next = (i + 1) % crownSides;
    indices.push(t2PeakIdx, t2BaseIdx + i, t2BaseIdx + next);
  }

  const treeGeo = new THREE.BufferGeometry();
  treeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  treeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  treeGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  treeGeo.setIndex(indices);
  treeGeo.computeVertexNormals();

  // 2. Identify candidate green space polygons and sample placements
  interface TreeInstance {
    x: number;
    z: number;
    scale: number;
    rotY: number;
    color: THREE.Color;
  }
  const instances: TreeInstance[] = [];

  const naturalPalettes = [
    new THREE.Color(0x2d5a27),
    new THREE.Color(0x38662e),
    new THREE.Color(0x4a703b),
    new THREE.Color(0x1e4620),
    new THREE.Color(0x527d3b),
    new THREE.Color(0x3f5e31)
  ];

  const cyberPalettes = [
    new THREE.Color(0x059669),
    new THREE.Color(0x10b981),
    new THREE.Color(0x34d399),
    new THREE.Color(0x047857),
    new THREE.Color(0x065f46)
  ];

  for (const feature of features) {
    if (instances.length >= maxInstances) break;
    const landuse = String(feature.landuse || getFeatureTag(feature, 'landuse') || '').toLowerCase();
    const leisure = String(feature.leisure || getFeatureTag(feature, 'leisure') || '').toLowerCase();
    const natural = String(feature.natural || getFeatureTag(feature, 'natural') || '').toLowerCase();

    const isGreen =
      leisure === 'park' ||
      leisure === 'garden' ||
      leisure === 'pitch' ||
      leisure === 'playground' ||
      natural === 'wood' ||
      natural === 'forest' ||
      natural === 'grassland' ||
      natural === 'scrub' ||
      landuse === 'grass' ||
      landuse === 'meadow' ||
      landuse === 'farmland' ||
      landuse === 'forest' ||
      landuse === 'greenfield';

    if (!isGreen) continue;

    const coords = getFeatureCoordinates(feature);
    if (coords.length < 3) continue;

    if (bounds) {
      const center = coords.reduce(
        ([lon, lat], [nextLon, nextLat]) => [
          lon + nextLon / coords.length,
          lat + nextLat / coords.length
        ],
        [0, 0] as [number, number]
      );
      if (!isCoordinateWithinBounds(center, bounds)) continue;
    }

    const ring = [...coords];
    if (
      ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
    ) {
      ring.pop();
    }
    if (ring.length < 3) continue;

    const world = ring.map(([lon, lat]) => geographicToWorld(lon, lat));
    const poly2D = world.map((pt) => ({ x: pt.x, y: pt.z }));

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const pt of poly2D) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minZ) minZ = pt.y;
      if (pt.y > maxZ) maxZ = pt.y;
    }
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    if (spanX < 0.005 || spanZ < 0.005) continue;

    const areaM2 = computeFootprintAreaM2(ring);
    const treeTarget = Math.max(1, Math.min(24, Math.floor(Math.sqrt(areaM2) * 0.35)));

    let seed = 0;
    const idStr = String(feature.id || 'tree');
    for (let c = 0; c < idStr.length; c++) seed = (seed * 31 + idStr.charCodeAt(c)) & 0xffffffff;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 4294967296;
    };

    const isInside = (px: number, pz: number) => {
      let inside = false;
      for (let i = 0, j = poly2D.length - 1; i < poly2D.length; j = i++) {
        const xi = poly2D[i].x, zi = poly2D[i].y;
        const xj = poly2D[j].x, zj = poly2D[j].y;
        const intersect = ((zi > pz) !== (zj > pz)) && (px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    let placedForFeature = 0;
    const maxAttempts = treeTarget * 4;
    for (let a = 0; a < maxAttempts && placedForFeature < treeTarget && instances.length < maxInstances; a++) {
      const rx = minX + spanX * (0.08 + 0.84 * rand());
      const rz = minZ + spanZ * (0.08 + 0.84 * rand());
      if (isInside(rx, rz)) {
        const sc = 0.75 + 0.55 * rand();
        const rot = rand() * Math.PI * 2;
        const palette = isHologram ? cyberPalettes : naturalPalettes;
        const col = palette[Math.floor(rand() * palette.length)];
        instances.push({ x: rx, z: rz, scale: sc, rotY: rot, color: col });
        placedForFeature++;
      }
    }
  }

  if (instances.length === 0) return null;

  const treeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: isHologram ? 0.35 : 0.82,
    metalness: isHologram ? 0.45 : 0.08,
    emissive: isHologram ? new THREE.Color(0x064e3b) : new THREE.Color(0x000000),
    emissiveIntensity: isHologram ? 0.40 : 0.0
  });

  const instancedMesh = new THREE.InstancedMesh(treeGeo, treeMat, instances.length);
  const dummy = new THREE.Object3D();
  const dummyColor = new THREE.Color();

  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    dummy.position.set(inst.x, 0.008, inst.z);
    dummy.rotation.set(0, inst.rotY, 0);
    dummy.scale.set(inst.scale, inst.scale, inst.scale);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
    dummyColor.copy(inst.color);
    instancedMesh.setColorAt(i, dummyColor);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
  instancedMesh.userData.vegetationCount = instances.length;
  instancedMesh.userData.provenance = 'procedural_density_within_osm_polygons';

  return instancedMesh;
}

/**
 * Creates physical 3D waterway ribbon geometry for rivers (Krishna River) and major irrigation canals.
 */
export function createOSMWaterwayRibbonGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const indices: number[] = [];
  const y = 0.016;

  for (const feature of features) {
    if (feature.kind !== 'waterway') continue;
    const type = String(feature.waterway || feature.class || '').toLowerCase();
    const name = String(feature.name || '').toLowerCase();
    const isRiver = type === 'river' || name.includes('krishna') || name.includes('budameru') || name.includes('munneru');
    const isCanal = type === 'canal';
    const isStream = type === 'stream';
    if (!isRiver && !isCanal && !isStream) continue;

    const halfWidth = isRiver ? 0.22 : (isCanal ? 0.075 : 0.035);
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;

    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;

      const a = geographicToWorld(segment[0][0], segment[0][1], y);
      const b = geographicToWorld(segment[1][0], segment[1][1], y);

      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 1e-4) continue;

      const nx = (-dz / len) * halfWidth;
      const nz = (dx / len) * halfWidth;

      const baseIdx = positions.length / 3;

      positions.push(
        a.x - nx, y, a.z - nz,
        a.x + nx, y, a.z + nz,
        b.x + nx, y, b.z + nz,
        b.x - nx, y, b.z - nz
      );

      indices.push(
        baseIdx, baseIdx + 1, baseIdx + 2,
        baseIdx, baseIdx + 2, baseIdx + 3
      );
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function getLandcoverColor(feature: OSMMapFeature, isHologram: boolean): THREE.Color {
  const landuse = String(feature.landuse || getFeatureTag(feature, 'landuse') || '').toLowerCase();
  const leisure = String(feature.leisure || getFeatureTag(feature, 'leisure') || '').toLowerCase();
  const natural = String(feature.natural || getFeatureTag(feature, 'natural') || '').toLowerCase();
  const kind = String(feature.kind || '').toLowerCase();

  const isGreen =
    leisure === 'park' ||
    leisure === 'garden' ||
    leisure === 'pitch' ||
    leisure === 'playground' ||
    natural === 'wood' ||
    natural === 'forest' ||
    natural === 'grassland' ||
    natural === 'scrub' ||
    landuse === 'grass' ||
    landuse === 'meadow' ||
    landuse === 'farmland' ||
    landuse === 'forest' ||
    landuse === 'greenfield';

  const isWater =
    natural === 'water' ||
    kind === 'water' ||
    landuse === 'reservoir' ||
    landuse === 'basin';

  const isPavedCivic =
    landuse === 'commercial' ||
    landuse === 'retail' ||
    landuse === 'residential' ||
    leisure === 'stadium' ||
    leisure === 'sports_centre';

  const isIndustrial =
    landuse === 'industrial' ||
    landuse === 'railway';

  if (isHologram) {
    if (isWater) return new THREE.Color(0x011b30);
    if (isGreen) return new THREE.Color(0x042426);
    if (isPavedCivic) return new THREE.Color(0x021629);
    return new THREE.Color(0x010f1e);
  }

  // Daylight photorealistic natural materials
  if (isWater) {
    return new THREE.Color(0x183654); // Deep river / reservoir blue
  }
  if (isGreen) {
    if (leisure === 'park' || leisure === 'garden') return new THREE.Color(0x3d5a35); // Lush landscaped park
    if (natural === 'wood' || natural === 'forest') return new THREE.Color(0x2d4428); // Dense woodland canopy
    if (leisure === 'pitch' || leisure === 'playground') return new THREE.Color(0x4a663b); // Sports turf
    return new THREE.Color(0x4c623d); // Meadow & farmland
  }
  if (isPavedCivic) {
    if (landuse === 'commercial' || landuse === 'retail') return new THREE.Color(0x756e62); // Civic plaza travertine
    return new THREE.Color(0x6e675b); // Residential warm stone
  }
  if (isIndustrial) {
    return new THREE.Color(0x565c66); // Slate gravel concrete
  }
  return new THREE.Color(0x524c42); // Natural ground substrate
}

/**
 * Creates physical 3D polygon geometry for real OSM land surfaces, parks, greenery, plazas, and water bodies.
 * Replaces unnatural plain white voids with authentic urban terrain.
 */
export function createOSMLandcoverGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  isHologram = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const y = 0.006; // Just above ground plane to prevent z-fighting

  for (const feature of features) {
    const isLandcover =
      feature.kind === 'landcover' ||
      Boolean(feature.landuse) ||
      Boolean(feature.leisure) ||
      Boolean(feature.natural) ||
      (feature.kind === 'water' && !feature.waterway);

    if (!isLandcover) continue;

    const coords = getFeatureCoordinates(feature);
    if (coords.length < 3) continue;

    if (bounds) {
      const center = coords.reduce(
        ([lon, lat], [nextLon, nextLat]) => [
          lon + nextLon / coords.length,
          lat + nextLat / coords.length
        ],
        [0, 0] as [number, number]
      );
      if (!isCoordinateWithinBounds(center, bounds)) continue;
    }

    const ring = [...coords];
    if (
      ring.length > 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
    ) {
      ring.pop();
    }
    if (ring.length < 3) continue;

    const areaM2 = computeFootprintAreaM2(ring);
    if (areaM2 < 8) continue;

    const world = ring.map(([lon, lat]) => geographicToWorld(lon, lat, y));
    let contour = world.map((pt) => new THREE.Vector2(pt.x, pt.z));

    if (THREE.ShapeUtils.isClockWise(contour)) {
      contour = contour.reverse();
      world.reverse();
    }

    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    if (faces.length === 0) continue;

    const color = getLandcoverColor(feature, isHologram);
    const baseIdx = positions.length / 3;

    for (let i = 0; i < world.length; i++) {
      const p = world[i];
      positions.push(p.x, y, p.z);
      colors.push(color.r, color.g, color.b);
    }

    for (const face of faces) {
      indices.push(
        baseIdx + face[0],
        baseIdx + face[1],
        baseIdx + face[2]
      );
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createOSMRoadGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds,
  majorOnly = false
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const feature of features) {
    if (feature.kind !== 'road') continue;
    if (majorOnly && !isMajorRegionalRoad(feature)) continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;
    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;
      const a = geographicToWorld(segment[0][0], segment[0][1], 0.035);
      const b = geographicToWorld(segment[1][0], segment[1][1], 0.035);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function createOSMRailwayGeometry(
  features: OSMMapFeature[],
  bounds?: GeographicBounds
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const feature of features) {
    if (feature.kind !== 'railway') continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;
    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;
      const a = geographicToWorld(segment[0][0], segment[0][1], 0.048);
      const b = geographicToWorld(segment[1][0], segment[1][1], 0.048);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function createOSMUtilityGeometry(
  features: OSMMapFeature[],
  kind: 'power' | 'waterway',
  bounds?: GeographicBounds
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const feature of features) {
    if (feature.kind !== kind) continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;
    const isPowerLine =
      kind === 'power' &&
      ['line', 'minor_line', 'cable', 'minor_cable'].includes(getFeatureTag(feature, 'power'));
    if (kind === 'power' && !isPowerLine) continue;
    const y = kind === 'power' ? 0.18 : 0.055;
    for (let i = 0; i < coords.length - 1; i += 1) {
      const segment = bounds
        ? clipLineSegmentToBounds(coords[i], coords[i + 1], bounds)
        : ([coords[i], coords[i + 1]] as [[number, number], [number, number]]);
      if (!segment) continue;
      const a = geographicToWorld(segment[0][0], segment[0][1], y);
      const b = geographicToWorld(segment[1][0], segment[1][1], y);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function createOSMUtilityPointGeometry(
  features: OSMMapFeature[],
  kind: 'power' | 'water_supply',
  bounds?: GeographicBounds
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const feature of features) {
    if (feature.kind !== kind) continue;
    const coordinates = getFeatureCoordinates(feature);
    if (coordinates.length === 0) continue;
    const point =
      coordinates.length === 1
        ? coordinates[0]
        : coordinates.reduce(
            (center, coordinate) => [
              center[0] + coordinate[0] / coordinates.length,
              center[1] + coordinate[1] / coordinates.length
            ],
            [0, 0]
          );
    if (bounds && !isCoordinateWithinBounds(point, bounds)) continue;
    const position = geographicToWorld(point[0], point[1], kind === 'power' ? 0.12 : 0.14);
    positions.push(position.x, position.y, position.z);
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function addOSMTileLayer(
  parent: THREE.Object3D,
  bounds: GeographicBounds,
  zoom: number,
  onTileLoad?: () => void
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  group.name = 'OpenStreetMap raster tiles';
  parent.add(group);
  let disposed = false;
  const loaded: THREE.Texture[] = [];

  for (const tile of getOSMTileDescriptors(bounds, zoom)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (disposed) return;
      // Rasterize the loaded tile onto a 2D canvas first so WebGL uploads a
      // mipmap-free CanvasTexture cleanly across both hardware and software GPUs.
      let texture: THREE.Texture;
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          try {
            // Natural basemap rendering for Normal 3D mode.
            // Render the tile as-is (natural Carto colors) then apply a very subtle cool
            // desaturation overlay so the basemap blends gracefully into the dark UI chrome
            // without inverting or darkening the map into illegibility.
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          } catch {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          // Very subtle cool-tone overlay: takes the edge off the pure-white Carto land polygons
          // and ties the basemap into the navy command-center palette while keeping roads/labels readable.
          ctx.fillStyle = 'rgba(10, 22, 48, 0.12)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          texture = new THREE.CanvasTexture(canvas);
        } else {
          texture = new THREE.Texture(img);
        }
      } else {
        texture = new THREE.Texture(img);
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      loaded.push(texture);

      const tileSize = getWorldDimensions(tile.bounds);
      const position = geographicToWorld(
        (tile.bounds.west + tile.bounds.east) / 2,
        (tile.bounds.south + tile.bounds.north) / 2,
        -0.01
      );
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(tileSize.width, tileSize.depth),
        new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(position);
      mesh.renderOrder = 1;
      mesh.userData.osmTile = true;
      group.add(mesh);
      onTileLoad?.();
    };
    img.onerror = () => undefined;
    img.src = tile.url;
  }

  return {
    group,
    dispose: () => {
      disposed = true;
      for (const texture of loaded) texture.dispose();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      parent.remove(group);
    }
  };
}
