import {
  OSMMapFeature,
  worldToGeographic,
  geographicToWorld,
  computeFootprintAreaM2,
  getFeatureCoordinates
} from './regionalMap';

export type GeographicFeatureProvenance =
  | 'osm_source_geometry'
  | 'synthetic_solver_topology'
  | 'proposed_intervention'
  | 'terrain_coordinate';

export type GeographicFeatureCategory =
  | 'building'
  | 'road'
  | 'waterway'
  | 'power'
  | 'water_supply'
  | 'poi'
  | 'landmark'
  | 'terrain';

export interface PickedFeatureDetail {
  label: string;
  value: string | number;
  badge?: string;
}

export interface PickedGeographicFeature {
  id: string;
  title: string;
  subtitle: string;
  category: GeographicFeatureCategory;
  provenance: GeographicFeatureProvenance;
  provenanceLabel: string;
  lat: number;
  lon: number;
  worldPos: { x: number; y: number; z: number };
  targetCameraDistance: number;
  details: PickedFeatureDetail[];
  polygonCoordinates?: Array<[number, number]>; // [lon, lat] points
  lineCoordinates?: Array<[number, number]>;    // [lon, lat] points
  osmTags?: Record<string, unknown>;
}

// 2D Point-in-polygon algorithm (Ray casting)
function isPointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance from point (px, py) to line segment (x1, y1)-(x2, y2) in meters
function distanceToSegmentMeters(
  lon: number,
  lat: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const mPerLat = 110540;

  const px = (lon - x1) * mPerLon;
  const py = (lat - y1) * mPerLat;
  const sx = (x2 - x1) * mPerLon;
  const sy = (y2 - y1) * mPerLat;

  const segLenSq = sx * sx + sy * sy;
  if (segLenSq < 1e-6) {
    return Math.hypot(px, py);
  }

  const t = Math.max(0, Math.min(1, (px * sx + py * sy) / segLenSq));
  const projX = t * sx;
  const projY = t * sy;
  return Math.hypot(px - projX, py - projY);
}

// Spatial grid index for sub-millisecond picking across 100k+ features
class SpatialGridIndex {
  private cellSize = 0.015; // ~1.6km per cell
  private grid = new Map<string, OSMMapFeature[]>();

  private getCellKey(lon: number, lat: number): string {
    const gx = Math.floor(lon / this.cellSize);
    const gy = Math.floor(lat / this.cellSize);
    return `${gx}:${gy}`;
  }

  public populate(features: OSMMapFeature[]) {
    this.grid.clear();
    for (const feature of features) {
      const coords = getFeatureCoordinates(feature);
      if (!coords || coords.length === 0) continue;

      const keysSeen = new Set<string>();
      // Sample coords or bound
      const step = Math.max(1, Math.floor(coords.length / 8));
      for (let i = 0; i < coords.length; i += step) {
        const pt = coords[i];
        const key = this.getCellKey(pt[0], pt[1]);
        if (!keysSeen.has(key)) {
          keysSeen.add(key);
          let cell = this.grid.get(key);
          if (!cell) {
            cell = [];
            this.grid.set(key, cell);
          }
          cell.push(feature);
        }
      }
    }
  }

  public query(lon: number, lat: number, searchRadiusDeg = 0.008): OSMMapFeature[] {
    const minGx = Math.floor((lon - searchRadiusDeg) / this.cellSize);
    const maxGx = Math.floor((lon + searchRadiusDeg) / this.cellSize);
    const minGy = Math.floor((lat - searchRadiusDeg) / this.cellSize);
    const maxGy = Math.floor((lat + searchRadiusDeg) / this.cellSize);

    const result: OSMMapFeature[] = [];
    const seen = new Set<string>();

    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gy = minGy; gy <= maxGy; gy++) {
        const key = `${gx}:${gy}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const feat of cell) {
            if (!seen.has(feat.id)) {
              seen.add(feat.id);
              result.push(feat);
            }
          }
        }
      }
    }
    return result;
  }
}

// Global singleton index for instant lookups
const globalSpatialIndex = new SpatialGridIndex();
let lastIndexedCount = 0;

export function ensureSpatialIndex(features: OSMMapFeature[]) {
  if (features.length !== lastIndexedCount) {
    globalSpatialIndex.populate(features);
    lastIndexedCount = features.length;
  }
}

/**
 * Universal geographic feature picker.
 * Converts world (x, z) coordinates into geographic coordinates and
 * inspects the OpenStreetMap feature layers and ground terrain.
 */
export function pickGeographicFeature(
  worldPos: { x: number; y: number; z: number },
  features: OSMMapFeature[] = [],
  currentPlaceLabel = 'Andhra Pradesh Study Region'
): PickedGeographicFeature {
  const { lon, lat } = worldToGeographic(worldPos.x, worldPos.z);
  ensureSpatialIndex(features);

  const candidates = globalSpatialIndex.query(lon, lat, 0.006);

  // 1. Check Buildings: Point-in-polygon test
  for (const feature of candidates) {
    if (feature.kind !== 'building') continue;
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 3) continue;

    if (isPointInPolygon([lon, lat], coords)) {
      const areaM2 = Math.round(computeFootprintAreaM2(coords));
      const explicitLevels = feature['building:levels'] || feature.levels;
      const explicitHeight = feature.height;
      const rawBuilding = String(feature.building || feature.class || 'yes').toLowerCase();
      const rawName = feature.name ? String(feature.name).trim() : '';

      let buildingType = 'Building';
      if (rawBuilding === 'apartments' || rawBuilding === 'residential') buildingType = 'Residential Apartments';
      else if (rawBuilding === 'commercial') buildingType = 'Commercial Office';
      else if (rawBuilding === 'retail' || rawBuilding === 'shop') buildingType = 'Retail Complex';
      else if (rawBuilding === 'house' || rawBuilding === 'detached') buildingType = 'Residential Dwelling';
      else if (rawBuilding === 'school' || rawBuilding === 'university') buildingType = 'Educational Campus';
      else if (rawBuilding === 'hospital') buildingType = 'Healthcare Facility';
      else if (rawBuilding === 'civic' || rawBuilding === 'public') buildingType = 'Civic Infrastructure';
      else if (areaM2 > 400) buildingType = 'Multi-Story Commercial Structure';
      else if (areaM2 > 160) buildingType = 'Multi-Family Residential Structure';
      else buildingType = 'Urban Building Structure';

      const estimatedFloors = explicitLevels
        ? Number(explicitLevels)
        : areaM2 > 500 ? 5 : areaM2 > 250 ? 4 : areaM2 > 120 ? 3 : 2;

      const estimatedHeightM = explicitHeight
        ? Number(explicitHeight)
        : Math.round(estimatedFloors * 3.2);

      const title = rawName || `${buildingType} (#${feature.id.replace(/^way\//, '')})`;

      const details: PickedFeatureDetail[] = [
        { label: 'Category', value: 'Urban Building Footprint', badge: 'OSM Verified' },
        { label: 'Ground Footprint', value: `${areaM2.toLocaleString()} m²` },
        {
          label: 'Levels / Floors',
          value: explicitLevels ? `${explicitLevels} (Tagged in OSM)` : `~${estimatedFloors} (Procedural estimate)`
        },
        {
          label: 'Building Height',
          value: explicitHeight ? `${explicitHeight} m (Tagged)` : `~${estimatedHeightM} m (Procedural estimate)`
        },
        { label: 'Coordinates', value: `${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E` },
        { label: 'OSM Feature ID', value: feature.id }
      ];

      return {
        id: feature.id,
        title,
        subtitle: `${buildingType} · ${feature.area ? feature.area.toUpperCase() : currentPlaceLabel}`,
        category: 'building',
        provenance: 'osm_source_geometry',
        provenanceLabel: 'OpenStreetMap (ODbL) Source Geometry',
        lat,
        lon,
        worldPos,
        targetCameraDistance: Math.max(6, Math.min(18, Math.sqrt(areaM2) * 0.4)),
        details,
        polygonCoordinates: coords,
        osmTags: feature as Record<string, unknown>
      };
    }
  }

  // 2. Check Waterways and Roads Proximity:
  // If not inside a building footprint, evaluate proximity to both waterways and roads.
  // Whichever linear corridor is closest to the click point is selected.
  let bestWaterway: { feature: OSMMapFeature; dist: number } | null = null;
  let bestRoad: { feature: OSMMapFeature; dist: number } | null = null;

  for (const feature of candidates) {
    const coords = getFeatureCoordinates(feature);
    if (coords.length < 2) continue;

    const isWater = feature.kind === 'waterway' || feature.waterway || feature.natural === 'water';
    const isRoad = feature.kind === 'road' || Boolean(feature.highway);

    if (isWater) {
      for (let i = 0; i < coords.length - 1; i++) {
        const d = distanceToSegmentMeters(lon, lat, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
        if (d <= 35 && (!bestWaterway || d < bestWaterway.dist)) {
          bestWaterway = { feature, dist: d };
        }
      }
    } else if (isRoad) {
      for (let i = 0; i < coords.length - 1; i++) {
        const d = distanceToSegmentMeters(lon, lat, coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
        if (d <= 25 && (!bestRoad || d < bestRoad.dist)) {
          bestRoad = { feature, dist: d };
        }
      }
    }
  }

  // If both a road and a waterway are nearby, choose whichever is closer to the cursor
  const pickWaterwayFirst = bestWaterway && (!bestRoad || bestWaterway.dist < bestRoad.dist);
  const pickRoadFirst = bestRoad && (!bestWaterway || bestRoad.dist <= bestWaterway.dist);

  if (pickWaterwayFirst && bestWaterway) {
    const feat = bestWaterway.feature;
    const wName = feat.name ? String(feat.name).trim() : 'Regional Canal / Hydrographic Channel';
    const wClass = String(feat.waterway || feat.water || feat.natural || 'canal');
    const coords = getFeatureCoordinates(feat);

    return {
      id: feat.id,
      title: wName,
      subtitle: `Hydrographic Asset · ${wClass.toUpperCase()}`,
      category: 'waterway',
      provenance: 'osm_source_geometry',
      provenanceLabel: 'OpenStreetMap (ODbL) Hydrographic Network',
      lat,
      lon,
      worldPos,
      targetCameraDistance: 22,
      details: [
        { label: 'Channel Type', value: wClass.toUpperCase(), badge: 'Hydrographic' },
        { label: 'Channel Name', value: wName },
        { label: 'Distance from Click', value: `${Math.round(bestWaterway.dist)} meters` },
        { label: 'Coordinates', value: `${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E` },
        { label: 'OSM Feature ID', value: feat.id }
      ],
      lineCoordinates: coords,
      osmTags: feat as Record<string, unknown>
    };
  }

  if (pickRoadFirst && bestRoad) {
    const feat = bestRoad.feature;
    const rName = feat.name ? String(feat.name).trim() : 'Mapped Urban Road Corridor';
    const hType = String(feat.highway || 'road');
    const lanes = feat.lanes ? String(feat.lanes) : hType === 'motorway' || hType === 'trunk' ? '4–6 Lanes' : '2 Lanes';
    const speedLimit = feat.maxspeed ? `${feat.maxspeed} km/h` : hType === 'trunk' ? '80 km/h' : '40 km/h';
    const coords = getFeatureCoordinates(feat);

    return {
      id: feat.id,
      title: rName,
      subtitle: `Transportation Corridor · ${hType.replace(/_/g, ' ').toUpperCase()}`,
      category: 'road',
      provenance: 'osm_source_geometry',
      provenanceLabel: 'OpenStreetMap (ODbL) Road Centerline',
      lat,
      lon,
      worldPos,
      targetCameraDistance: 24,
      details: [
        { label: 'Corridor Classification', value: hType.toUpperCase(), badge: 'Transportation' },
        { label: 'Lanes (Estimated/Tagged)', value: lanes },
        { label: 'Speed Limit', value: speedLimit },
        { label: 'Distance from Click', value: `${Math.round(bestRoad.dist)} meters` },
        { label: 'Coordinates', value: `${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E` },
        { label: 'OSM Feature ID', value: feat.id }
      ],
      lineCoordinates: coords,
      osmTags: feat as Record<string, unknown>
    };
  }

  // 4. Check Power / Water utilities or POIs
  for (const feat of candidates) {
    if (feat.kind === 'power' || feat.kind === 'water_supply' || feat.kind === 'poi') {
      const coords = getFeatureCoordinates(feat);
      if (coords.length > 0) {
        const pt = coords[0];
        const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
        const mPerLat = 110540;
        const d = Math.hypot((lon - pt[0]) * mPerLon, (lat - pt[1]) * mPerLat);
        if (d <= 35) {
          const kindTitle = feat.kind === 'power'
            ? 'Electrical Infrastructure Asset'
            : feat.kind === 'water_supply'
              ? 'Water Supply Asset'
              : 'Point of Interest (POI)';

          const name = feat.name ? String(feat.name).trim() : `${kindTitle} (${feat.id})`;
          return {
            id: feat.id,
            title: name,
            subtitle: `${kindTitle} · ${feat.area ? feat.area.toUpperCase() : currentPlaceLabel}`,
            category: feat.kind === 'power' ? 'power' : feat.kind === 'water_supply' ? 'water_supply' : 'poi',
            provenance: 'osm_source_geometry',
            provenanceLabel: 'OpenStreetMap (ODbL) Utility Network',
            lat: pt[1],
            lon: pt[0],
            worldPos,
            targetCameraDistance: 16,
            details: [
              { label: 'Asset Type', value: String(feat.power || feat.man_made || feat.amenity || feat.kind) },
              { label: 'Coordinates', value: `${pt[1].toFixed(5)}° N, ${pt[0].toFixed(5)}° E` },
              { label: 'OSM Feature ID', value: feat.id }
            ],
            osmTags: feat as Record<string, unknown>
          };
        }
      }
    }
  }

  // 5. Fallback: Terrain Ground Coordinate
  return {
    id: `terrain_${lat.toFixed(5)}_${lon.toFixed(5)}`,
    title: `Terrain Coordinate (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`,
    subtitle: `Ground Datum · ${currentPlaceLabel}`,
    category: 'terrain',
    provenance: 'terrain_coordinate',
    provenanceLabel: 'Regional Digital Elevation Surface (Datum 0m)',
    lat,
    lon,
    worldPos,
    targetCameraDistance: 25,
    details: [
      { label: 'Geographic Latitude', value: `${lat.toFixed(6)}° N` },
      { label: 'Geographic Longitude', value: `${lon.toFixed(6)}° E` },
      { label: 'Terrain Elevation', value: '0.0 m (WGS84 Reference Ground Plane)' },
      { label: 'Active Region Extent', value: currentPlaceLabel },
      { label: 'Intervention Feasibility', value: 'Available for new infrastructure intervention' }
    ]
  };
}
