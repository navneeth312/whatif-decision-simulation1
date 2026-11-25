import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  Layers,
  Eye,
  EyeOff,
  Search,
  Maximize2,
  Minimize2,
  Zap,
  AlertCircle,
  Sliders,
  CheckCircle2,
  Check,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  Droplets,
  Activity,
  GitBranch,
  Building2,
  Trees,
  Monitor,
  Gauge,
  Minus
} from 'lucide-react';
import { DigitalTwinAdapters, ProblemHotspot } from '../models/digitalTwinAdapters';
import {
  pickGeographicFeature,
  PickedGeographicFeature
} from '../models/geographicFeaturePicker';
import {
  Scenario,
  SolutionAlternative,
  AlternativeRunRecord
} from '../types';
import { checkDomainEligibility } from '../models/domainEligibility';
import {
  addOSMTileLayer,
  createOSMArterialRibbonGeometry,
  createOSMRoadNetworkRibbonGeometry,
  createOSMLaneMarkingsGeometry,
  createOSMVegetationInstancedMesh,
  createOSMBuildingGeometry,
  createOSMBuildingOutlineGeometry,
  createOSMLandcoverGeometry,
  createOSMRailwayGeometry,
  createOSMRoadGeometry,
  createOSMUtilityGeometry,
  createOSMUtilityPointGeometry,
  createOSMWaterwayRibbonGeometry,
  declutterMapLabelCandidates,
  discoverRegionalPlacesFromOSM,
  expandMapBounds,
  fitMapBoundsToAspect,
  geographicToWorld,
  getCameraFitDistance,
  getCameraStartDistance,
  getLandmarkFocusDistance,
  getMapBounds,
  getMapLandmarks,
  getWaterwayAndHighwayLabels,
  getMapPlace,
  getMapPlaceWorldPosition,
  getAreaNameOpacity,
  getLandmarkNameOpacity,
  getMapTileZoom,
  getWorldDimensions,
  getFeatureCoordinates,
  isCoordinateWithinBounds,
  loadOSMPlaceData,
  NamedMapLandmark,
  OSM_ATTRIBUTION_URL,
  OSMPlaceData,
  REGIONAL_BOUNDS,
  REGIONAL_MAP_PLACES,
  RegionalMapPlace,
  scenarioPositionToWorld
} from '../models/regionalMap';
import {
  createDaylightBuildingMaterial,
  createHolographicBuildingMaterial,
  createDaylightSkyTexture,
  createHoloSkyTexture,
  createCyberSensorNodesGeometry,
  createSensorBeaconTexture,
  createCyberGroundMaterial,
  createDaylightGroundMaterial
} from '../models/digitalTwinShaders';
import {
  GraphicsCompatibilityModal,
  GraphicsProfile
} from './GraphicsCompatibilityModal';

export const MIN_CAMERA_DISTANCE = 0.35;
export const MAX_CAMERA_DISTANCE = 160;

function findNearestPlaceToFeature(
  geoFeature: PickedGeographicFeature,
  places: RegionalMapPlace[]
): RegionalMapPlace {
  if (!places || places.length === 0) {
    return {
      id: 'nambur',
      label: 'Nambur',
      district: 'Guntur',
      lat: 16.3541,
      lon: 80.5284,
      category: 'town',
      description: 'Primary urban study area'
    };
  }
  let closest = places[0];
  let minDist = Infinity;
  for (const place of places) {
    const d = Math.hypot(geoFeature.lat - place.lat, geoFeature.lon - place.lon);
    if (d < minDist) {
      minDist = d;
      closest = place;
    }
  }
  return closest;
}

interface DigitalTwinViewer3DProps {
  scenario: Scenario;
  selectedAlternative: SolutionAlternative | null;
  simulationResult: AlternativeRunRecord;
  baselineResult?: AlternativeRunRecord;
  timelineProgress: number; // 0 to 100
  isPlaying: boolean;
  playbackSpeed: 1 | 2 | 4;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string | null) => void;
  onSelectMapPlace?: (placeId: string) => void;
  discoveredPlaces?: RegionalMapPlace[];
  onDiscoveredPlaces?: (places: RegionalMapPlace[]) => void;
  onFallbackTo2D?: () => void;
  mapPlaceId: string;
  hologram?: boolean;
  reducedMotion?: boolean;
  externalCameraState?: {
    distance: number;
    azimuth: number;
    elevation: number;
    panX: number;
    panZ: number;
  } | null;
  onCameraChange?: (state: {
    distance: number;
    azimuth: number;
    elevation: number;
    panX: number;
    panZ: number;
  }) => void;
  qualityPreset?: 'performance' | 'balanced' | 'high';
  onQualityPresetChange?: (preset: 'performance' | 'balanced' | 'high') => void;
  highlightProblemHotspot?: boolean;
  differenceMode?: boolean;
  isComparisonView?: boolean;
  comparisonLabel?: string;
  isSecondaryTwin?: boolean;
  mapMode?: 'location-selection' | 'simulation';
  isMapHudVisible?: boolean;
  onToggleMapHud?: (visible: boolean) => void;
  onOpenGraphicsSettings?: () => void;
  onConfirmLocation?: (placeId: string, feature?: PickedGeographicFeature) => void;
  showSimulationCoverage?: boolean;
  onToggleSimulationCoverage?: (show: boolean) => void;
  onInspectFeature?: (feature: PickedGeographicFeature | null) => void;
}

export interface InspectableAssetMeta {
  id: string;
  name: string;
  type: string;
  status: 'nominal' | 'warning' | 'critical' | 'upgraded';
  statusBadgeText: string;
  metrics: { label: string; value: string }[];
}


/**
 * Realistic 3D Steel Lattice Transmission Tower (Double-Circuit Overhead Line)
 * Modeled with 4 tapered lattice legs, cross-braces, double cross-arms, and insulator strings.
 */
function createTransmissionTowerGroup(
  x: number,
  z: number,
  towerHeight = 0.36,
  isHologram = false
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const steelMat = new THREE.MeshStandardMaterial({
    color: isHologram ? 0x0284c7 : 0x94a3b8,
    emissive: isHologram ? 0x00f0ff : 0x1e293b,
    emissiveIntensity: isHologram ? 0.45 : 0.08,
    metalness: 0.85,
    roughness: 0.25
  });

  const baseW = 0.085;
  const waistW = 0.032;
  const waistH = towerHeight * 0.72;

  // 4 corner legs
  const legGeo = new THREE.CylinderGeometry(0.0035, 0.0055, waistH, 6);
  const legPositions: [number, number][] = [
    [-1, -1], [1, -1], [1, 1], [-1, 1]
  ];
  legPositions.forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(
      sx * (baseW + waistW) * 0.25,
      waistH * 0.5,
      sz * (baseW + waistW) * 0.25
    );
    leg.rotation.z = -sx * ((baseW - waistW) / waistH) * 0.5;
    leg.rotation.x = sz * ((baseW - waistW) / waistH) * 0.5;
    group.add(leg);
  });

  // Cross tie horizontal collars
  [0.3, 0.6, 0.9].forEach((ratio) => {
    const ringW = baseW * (1 - ratio) + waistW * ratio;
    const ringBar = new THREE.Mesh(new THREE.BoxGeometry(ringW, 0.004, ringW), steelMat);
    ringBar.position.y = waistH * ratio;
    group.add(ringBar);
  });

  // Cross-arms (horizontal beams for 3-phase conductor cables)
  const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.006, 0.015), steelMat);
  lowerArm.position.y = waistH;
  group.add(lowerArm);

  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.015), steelMat);
  upperArm.position.y = waistH + (towerHeight - waistH) * 0.5;
  group.add(upperArm);

  // Tower apex peak for shield / ground wire
  const peakH = towerHeight - waistH;
  const peak = new THREE.Mesh(
    new THREE.ConeGeometry(waistW * 0.75, peakH, 4),
    steelMat
  );
  peak.position.y = waistH + peakH * 0.5;
  group.add(peak);

  // Insulator strings hanging from cross-arms
  const insMat = new THREE.MeshStandardMaterial({
    color: isHologram ? 0x38bdf8 : 0x64748b,
    emissive: isHologram ? 0x00f0ff : 0x0284c7,
    emissiveIntensity: isHologram ? 0.6 : 0.3
  });
  [-0.09, 0.09].forEach((ox) => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.032, 6), insMat);
    ins.position.set(ox, waistH - 0.016, 0);
    group.add(ins);
  });
  [-0.065, 0.065].forEach((ox) => {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.032, 6), insMat);
    ins.position.set(ox, upperArm.position.y - 0.016, 0);
    group.add(ins);
  });

  return group;
}

/**
 * Realistic Elevated Municipal Water Tower
 * Structural steel lattice legs, central riser, spherical water bowl, and level ring.
 */
function createElevatedWaterTankGroup(
  colorHex: number,
  isHologram = false
): THREE.Group {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: isHologram ? 0x0284c7 : 0x94a3b8,
    metalness: 0.7,
    roughness: 0.35
  });

  // Central riser pipe
  const riser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.020, 0.12, 12),
    steelMat
  );
  riser.position.y = 0.06;
  group.add(riser);

  // 4 lattice support legs
  const legGeo = new THREE.CylinderGeometry(0.0035, 0.0055, 0.12, 6);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(legGeo, steelMat);
    leg.position.set(sx * 0.042, 0.06, sz * 0.042);
    group.add(leg);
  });

  // Elevated storage bowl (spheroid tank)
  const tankMat = new THREE.MeshStandardMaterial({
    color: isHologram ? 0x0284c7 : 0x38bdf8,
    emissive: colorHex,
    emissiveIntensity: isHologram ? 0.7 : 0.45,
    metalness: 0.4,
    roughness: 0.25
  });
  const tank = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 16, 12),
    tankMat
  );
  tank.scale.set(1, 0.75, 1);
  tank.position.y = 0.145;
  group.add(tank);

  // Conical roof cap & vent
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.062, 0.024, 16),
    steelMat
  );
  cap.position.y = 0.182;
  group.add(cap);

  // Water level indicator ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.068, 0.004, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.145;
  group.add(ring);

  return group;
}

/**
 * Realistic Ground Water Storage Reservoir
 * Concrete perimeter basin rim with shimmering hydraulic water surface.
 */
function createReservoirGroup(
  colorHex: number,
  isHologram = false
): THREE.Group {
  const group = new THREE.Group();

  const basinMat = new THREE.MeshStandardMaterial({
    color: isHologram ? 0x034a75 : 0x64748b,
    roughness: 0.7
  });
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.04, 24),
    basinMat
  );
  rim.position.y = 0.02;
  group.add(rim);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: isHologram ? 0x00f0ff : 0x0ea5e9,
    emissiveIntensity: isHologram ? 0.75 : 0.45,
    roughness: 0.1,
    metalness: 0.3
  });
  const waterSurface = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.042, 24),
    waterMat
  );
  waterSurface.position.y = 0.022;
  group.add(waterSurface);

  return group;
}

/**
 * High-Visibility Problem Hotspot Beacon
 * Pulsing rose-red beam for bottlenecks in baseline; transformed emerald beacon when alleviated.
 */
function createProblemHotspotBeacon(
  hotspot: ProblemHotspot,
  isResolved: boolean,
  isHologram: boolean
): THREE.Group {
  const group = new THREE.Group();
  const colorHex = isResolved ? 0x10b981 : (hotspot.severity === 'critical' ? 0xf43f5e : 0xf59e0b);

  // Vertical light column / energy pillar
  const pillarGeo = new THREE.CylinderGeometry(0.022, 0.042, 1.2, 12, 1, true);
  const pillarMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: isHologram ? 0.65 : 0.45,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.y = 0.6;
  group.add(pillar);

  // Concentric ground pulse rings
  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 24),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.02;
  group.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.28, 24),
    new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.02;
  group.add(ring2);

  // Floating apex marker (Octahedron for warning, Sphere for resolved)
  const markerGeo = isResolved
    ? new THREE.SphereGeometry(0.065, 12, 12)
    : new THREE.OctahedronGeometry(0.075, 0);
  const markerMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.9,
    roughness: 0.2
  });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.y = 1.25;
  group.add(marker);

  return group;
}

/**
 * Realistic 3D Traffic Signal Infrastructure Gantry
 * Features vertical galvanized steel mast, cantilever overhead arm, 3-aspect vertical signal head
 * (red, amber, green) with sun hoods/visors, and a white pavement stop-line decal.
 */
function createTrafficSignalGantryGroup(
  isGreen: boolean,
  isModified: boolean,
  isHologram: boolean
): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: isHologram ? 0x1e293b : 0x475569,
    metalness: 0.7,
    roughness: 0.35
  });

  // Vertical support pole (height 0.28 wu)
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.018, 0.28, 8),
    steelMat
  );
  mast.position.set(0.12, 0.14, -0.10);
  group.add(mast);

  // Horizontal cantilever arm extending out over traffic lanes (length 0.18 wu)
  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.010, 0.18, 8),
    steelMat
  );
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.03, 0.26, -0.10);
  group.add(arm);

  // Signal head housing (matte black vertical box)
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8
  });
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.082, 0.024),
    housingMat
  );
  housing.position.set(-0.02, 0.22, -0.10);
  group.add(housing);

  // 3 aspects: Red (top), Amber (mid), Green (bottom)
  const redLensMat = new THREE.MeshStandardMaterial({
    color: !isGreen ? 0xef4444 : 0x581c1c,
    emissive: !isGreen ? 0xef4444 : 0x000000,
    emissiveIntensity: !isGreen ? 2.2 : 0.0,
    roughness: 0.2
  });
  const redLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 8),
    redLensMat
  );
  redLens.position.set(-0.02, 0.245, -0.086);
  group.add(redLens);

  const amberLensMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    roughness: 0.2
  });
  const amberLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 8),
    amberLensMat
  );
  amberLens.position.set(-0.02, 0.22, -0.086);
  group.add(amberLens);

  const greenLensMat = new THREE.MeshStandardMaterial({
    color: isGreen ? 0x10b981 : 0x064e3b,
    emissive: isGreen ? (isModified ? 0x00f0ff : 0x10b981) : 0x000000,
    emissiveIntensity: isGreen ? 2.5 : 0.0,
    roughness: 0.2
  });
  const greenLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 8),
    greenLensMat
  );
  greenLens.position.set(-0.02, 0.195, -0.086);
  group.add(greenLens);

  // Reflective white stop-line pavement decal
  const stopLineMat = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.85
  });
  const stopLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.20, 0.032),
    stopLineMat
  );
  stopLine.rotation.x = -Math.PI / 2;
  stopLine.position.set(0, 0.022, 0.08);
  group.add(stopLine);

  return group;
}

/**
 * High-resolution canvas texture for floating 3D callout billboard badges
 */
function createChangeCalloutTexture(
  badgeText: string,
  subText: string,
  hologram: boolean
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 460;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const primaryColor = hologram ? '#fbbf24' : '#00f0ff';
  const bgColor = hologram ? 'rgba(20, 15, 3, 0.94)' : 'rgba(5, 18, 32, 0.92)';

  // Card body with downward pointer
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  // Main rounded rectangle (x: 4, y: 4, w: 452, h: 74, r: 14)
  ctx.roundRect(4, 4, 452, 74, 14);
  ctx.fill();
  ctx.stroke();

  // Downward pointer arrow at center bottom
  ctx.beginPath();
  ctx.moveTo(215, 78);
  ctx.lineTo(230, 96);
  ctx.lineTo(245, 78);
  ctx.closePath();
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.restore();

  // Badge icon/category title
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = primaryColor;
  ctx.fillText(badgeText, 230, 28, 430);

  // Subtitle / Delta metric
  ctx.font = '600 20px "SF Mono", Consolas, "Liberation Mono", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(subText, 230, 56, 430);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Massive High-Visibility Intervention Beacon
 * 2.5 world unit luminous laser beam, outer glow sleeve, concentric ground pulse rings,
 * floating apex diamond, and 3D billboard callout badge.
 */
function createMassiveChangeBeacon(
  pos: THREE.Vector3,
  badgeText: string,
  subText: string,
  hologram: boolean,
  colorHex?: number,
  index = 0,
  targetId = ''
): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(pos);

  // Color selection: Electric amber/gold in hologram, electric cyan in daylight
  const primaryColor = colorHex ?? (hologram ? 0xfbbf24 : 0x00f0ff);
  const sleeveColor = hologram ? 0xf59e0b : 0x00f0ff;

  // 1. Vertical Luminous Laser Beam (Height 2.45 wu)
  const coreGeo = new THREE.CylinderGeometry(0.016, 0.035, 2.45, 12, 1, true);
  const coreMat = new THREE.MeshBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 1.225;
  group.add(core);

  // 2. Translucent Outer Glow Sleeve
  const sleeveGeo = new THREE.CylinderGeometry(0.08, 0.16, 2.45, 12, 1, true);
  const sleeveMat = new THREE.MeshBasicMaterial({
    color: sleeveColor,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeve.position.y = 1.225;
  group.add(sleeve);

  // 3. Floating Apex Diamond at tip of laser beam
  const apexGeo = new THREE.OctahedronGeometry(0.085, 0);
  const apexMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    emissive: primaryColor,
    emissiveIntensity: 2.5,
    roughness: 0.15
  });
  const apex = new THREE.Mesh(apexGeo, apexMat);
  apex.position.y = 2.45;
  group.add(apex);

  // 4. Triple Concentric Ground Halo Rings
  const ring1 = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.35, 32),
    new THREE.MeshBasicMaterial({
      color: primaryColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    })
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.035;
  group.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.68, 32),
    new THREE.MeshBasicMaterial({
      color: primaryColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    })
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.032;
  group.add(ring2);

  const ring3 = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.02, 6, 48),
    new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.45
    })
  );
  ring3.rotation.x = -Math.PI / 2;
  ring3.position.y = 0.030;
  group.add(ring3);
  group.userData.pulseRing = ring3;

  // 5. Floating 3D Billboard Callout Sprite
  const texture = createChangeCalloutTexture(badgeText, subText, hologram);
  if (texture) {
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.center.set(0.5, 0.0); // bottom center so pointer sits right at apex
    const staggeredY = 2.55 + (index % 3) * 0.42;
    sprite.position.set(0, staggeredY, 0);
    sprite.scale.set(2.4, 0.55, 1.0);
    sprite.userData.isChangeBillboard = true;
    sprite.userData.targetId = targetId;
    sprite.userData.index = index;
    sprite.userData.staggeredY = staggeredY;
    group.add(sprite);
    group.userData.billboardSprite = sprite;
  }

  return group;
}

/**
 * Intervention Highlight Ring for Upgraded / Added Assets
 */
function createInterventionHighlightRing(
  pos: THREE.Vector3,
  radius = 0.26
): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(pos);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.85, radius, 32),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  group.add(ring);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.15, 0.012, 6, 32),
    new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.5
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  group.add(halo);

  return group;
}

function formatLandmarkName(name: string): string {
  const cleaned = name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(vvit|vvitu)$/i.test(cleaned)) return 'VVITU';
  return cleaned === cleaned.toLocaleLowerCase()
    ? cleaned.replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase())
    : cleaned;
}


function createPlaceLabel(label: string, hologram: boolean): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // High-tech translucent dark glass HUD chip (inspired by Dubai Digital Twin command center)
  ctx.fillStyle = hologram ? 'rgba(3, 14, 28, 0.88)' : 'rgba(7, 16, 32, 0.84)';
  ctx.strokeStyle = hologram ? 'rgba(0, 240, 255, 0.85)' : 'rgba(56, 189, 248, 0.70)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(2, 2, 316, 60, 14);
  ctx.fill();
  ctx.stroke();

  // Glowing indicator dot
  ctx.beginPath();
  ctx.arc(22, 32, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = hologram ? '#00f0ff' : '#f59e0b';
  ctx.fill();

  // Label text
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = hologram ? '#e0faff' : '#f8fafc';
  ctx.fillText(label, 36, 33, 270);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWaterwayLabel(label: string, hologram: boolean): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = hologram ? 'rgba(2, 28, 52, 0.92)' : 'rgba(7, 34, 58, 0.90)';
  ctx.strokeStyle = hologram ? 'rgba(56, 189, 248, 0.95)' : 'rgba(2, 132, 199, 0.92)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(2, 2, 336, 60, 14);
  ctx.fill();
  ctx.stroke();

  // Water symbol
  ctx.font = 'bold 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('≈', 22, 32);

  // Label text
  ctx.font = 'italic 600 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(label, 38, 33, 290);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHighwayLabel(label: string, hologram: boolean): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = hologram ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.90)';
  ctx.strokeStyle = hologram ? 'rgba(251, 191, 36, 0.92)' : 'rgba(245, 158, 11, 0.90)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(2, 2, 336, 60, 14);
  ctx.fill();
  ctx.stroke();

  // Highway indicator dot
  ctx.beginPath();
  ctx.arc(22, 32, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  // Label text
  ctx.font = '700 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fef3c7';
  ctx.fillText(label, 36, 33, 290);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeThreeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Points
    ) {
      if (!child.userData.sharedOsmGeometry) child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m instanceof THREE.Material) {
          const texture = (m as THREE.MeshBasicMaterial).map;
          if (texture) texture.dispose();
          m.dispose();
        }
      });
    } else if (child instanceof THREE.Sprite) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
}

function getAssetPositionInWorld(scenario: Scenario, assetId: string, mapPlaceId: string): THREE.Vector3 | null {
  if (scenario.domain === 'traffic' && scenario.trafficNetwork) {
    const cell = scenario.trafficNetwork.cells.find((c) => c.id === assetId);
    if (cell) return scenarioPositionToWorld(cell.x, cell.y, 0.05, mapPlaceId);
  } else if (scenario.domain === 'water' && scenario.waterNetwork) {
    const node = scenario.waterNetwork.nodes.find((n) => n.id === assetId);
    if (node) return scenarioPositionToWorld(node.x, node.y, 0.05, mapPlaceId);
    const pipe = scenario.waterNetwork.pipes.find((p) => p.id === assetId);
    if (pipe) {
      const n1 = scenario.waterNetwork.nodes.find((n) => n.id === pipe.fromNodeId);
      const n2 = scenario.waterNetwork.nodes.find((n) => n.id === pipe.toNodeId);
      if (n1 && n2) return scenarioPositionToWorld((n1.x + n2.x) / 2, (n1.y + n2.y) / 2, 0.05, mapPlaceId);
    }
  } else if (scenario.domain === 'energy' && scenario.powerNetwork) {
    const bus = scenario.powerNetwork.buses.find((b) => b.id === assetId);
    if (bus) return scenarioPositionToWorld(bus.x, bus.y, 0.05, mapPlaceId);
    const line = scenario.powerNetwork.lines.find((l) => l.id === assetId);
    if (line) {
      const b1 = scenario.powerNetwork.buses.find((b) => b.id === line.fromBusId);
      const b2 = scenario.powerNetwork.buses.find((b) => b.id === line.toBusId);
      if (b1 && b2) return scenarioPositionToWorld((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, 0.05, mapPlaceId);
    }
  }
  return null;
}

export const DigitalTwinViewer3D: React.FC<DigitalTwinViewer3DProps> = ({
  scenario,
  selectedAlternative,
  simulationResult,
  baselineResult,
  timelineProgress,
  isPlaying,
  playbackSpeed,
  selectedAssetId,
  onSelectAsset,
  onSelectMapPlace,
  discoveredPlaces,
  onDiscoveredPlaces,
  onFallbackTo2D,
  mapPlaceId,
  hologram = false,
  reducedMotion = false,
  externalCameraState,
  onCameraChange,
  qualityPreset,
  onQualityPresetChange,
  highlightProblemHotspot,
  differenceMode = false,
  isComparisonView = false,
  comparisonLabel = '',
  isSecondaryTwin = false,
  mapMode = 'simulation',
  isMapHudVisible: externalMapHudVisible,
  onToggleMapHud,
  onOpenGraphicsSettings,
  onConfirmLocation,
  showSimulationCoverage = true,
  onToggleSimulationCoverage,
  onInspectFeature
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reducedDetailMode, setReducedDetailMode] = useState(false);
  const [showPerformanceNotice, setShowPerformanceNotice] = useState(false);
  const [showGraphicsModal, setShowGraphicsModal] = useState(false);
  const [graphicsProfile, setGraphicsProfile] = useState<GraphicsProfile>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('whatif_graphics_preference') as GraphicsProfile | null;
      if (saved && ['recommended', 'high', 'performance', '2d'].includes(saved)) return saved;
    }
    return 'recommended';
  });

  const [cameraAzimuth, setCameraAzimuth] = useState(0.58);
  const [cameraElevation, setCameraElevation] = useState(0.74);
  const [cameraDistance, setCameraDistance] = useState(65);
  const [cameraPanX, setCameraPanX] = useState(0);
  const [cameraPanZ, setCameraPanZ] = useState(0);

  const isExternalCameraUpdateRef = useRef(false);
  const [webglContextLost, setWebglContextLost] = useState(false);

  useEffect(() => {
    if (externalCameraState) {
      isExternalCameraUpdateRef.current = true;
      if (Math.abs(externalCameraState.distance - cameraDistance) > 0.01) {
        setCameraDistance(externalCameraState.distance);
      }
      if (Math.abs(externalCameraState.azimuth - cameraAzimuth) > 0.005) {
        setCameraAzimuth(externalCameraState.azimuth);
      }
      if (Math.abs(externalCameraState.elevation - cameraElevation) > 0.005) {
        setCameraElevation(externalCameraState.elevation);
      }
      if (Math.abs(externalCameraState.panX - cameraPanX) > 0.01) {
        setCameraPanX(externalCameraState.panX);
      }
      if (Math.abs(externalCameraState.panZ - cameraPanZ) > 0.01) {
        setCameraPanZ(externalCameraState.panZ);
      }
    }
  }, [externalCameraState]);

  useEffect(() => {
    if (isExternalCameraUpdateRef.current) {
      isExternalCameraUpdateRef.current = false;
      return;
    }
    onCameraChange?.({
      distance: cameraDistance,
      azimuth: cameraAzimuth,
      elevation: cameraElevation,
      panX: cameraPanX,
      panZ: cameraPanZ
    });
  }, [cameraDistance, cameraAzimuth, cameraElevation, cameraPanX, cameraPanZ, onCameraChange]);

  const [showContextBuildings, setShowContextBuildings] = useState(true);
  const [layers, setLayers] = useState({
    buildings: true,
    roads: true,
    flow: true,
    vegetation: true,
    water: scenario.domain === 'water',
    power: scenario.domain === 'energy',
    hotspots: true,
    interventions: true,
    labels: true
  });
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showLegendPanel, setShowLegendPanel] = useState(false);
  const [isInspectorExpanded, setIsInspectorExpanded] = useState(true);
  const [internalMapHudVisible, setInternalMapHudVisible] = useState(true);
  const isMapHudVisible = externalMapHudVisible !== undefined ? externalMapHudVisible : internalMapHudVisible;

  const toggleMapHud = () => {
    const next = !isMapHudVisible;
    setInternalMapHudVisible(next);
    onToggleMapHud?.(next);
  };
  const componentPositionsRef = useRef<Record<string, THREE.Vector3>>({});

  // Sync default domain layer visibility
  useEffect(() => {
    setLayers((prev) => ({
      ...prev,
      water: scenario.domain === 'water',
      power: scenario.domain === 'energy'
    }));
  }, [scenario.domain]);
  const [showFlowParticles, setShowFlowParticles] = useState(true);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [assetFilterQuery, setAssetFilterQuery] = useState('');
  const [landmarkSearchQuery, setLandmarkSearchQuery] = useState('');
  const [osmMapData, setOsmMapData] = useState<OSMPlaceData | null>(null);
  const [osmMapError, setOsmMapError] = useState(false);
  const [osmRetryNonce, setOsmRetryNonce] = useState(0);
  const [contextRestoreNonce, setContextRestoreNonce] = useState(0);

  const selectedMapLandmarkRef = useRef<NamedMapLandmark | null>(null);
  const pendingLandmarkFlightRef = useRef<NamedMapLandmark | null>(null);
  const previousScenarioContextRef = useRef('');

  const [hoveredAsset, setHoveredAsset] = useState<InspectableAssetMeta | null>(null);
  const [selectedAssetMeta, setSelectedAssetMeta] = useState<InspectableAssetMeta | null>(null);
  const [allAssetsList, setAllAssetsList] = useState<InspectableAssetMeta[]>([]);

  const scenarioGroupRef = useRef<THREE.Group | null>(null);
  const flowGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const baseGroupRef = useRef<THREE.Group | null>(null);
  const contextGroupRef = useRef<THREE.Group | null>(null);
  const lightsRef = useRef<{
    ambientLight: THREE.AmbientLight;
    keySunLight: THREE.DirectionalLight;
    skyFillLight: THREE.DirectionalLight;
    rimLightAmber: THREE.DirectionalLight;
  } | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const selectedLandmarkMarkerRef = useRef<THREE.Group | null>(null);
  const osmTileLayerRef = useRef<{ group: THREE.Group; dispose: () => void } | null>(null);
  const osmRoadOverlayRef = useRef<THREE.LineSegments | null>(null);
  const areaLabelSpritesRef = useRef<THREE.Sprite[]>([]);
  const landmarkLabelSpritesRef = useRef<THREE.Sprite[]>([]);
  const waterwayHighwayLabelSpritesRef = useRef<THREE.Sprite[]>([]);
  const changeBeaconSpritesRef = useRef<THREE.Sprite[]>([]);
  const [isChangeCardMinimized, setIsChangeCardMinimized] = useState<boolean>(false);
  const [isChangesStripExpanded, setIsChangesStripExpanded] = useState<boolean>(true);
  const [selectedGeoFeature, setSelectedGeoFeature] = useState<PickedGeographicFeature | null>(null);
  const geoHighlightGroupRef = useRef<THREE.Group | null>(null);
  const assetHighlightGroupRef = useRef<THREE.Group | null>(null);
  const activeBuildingMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const activeGroundMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const sensorBeaconTextureRef = useRef<THREE.Texture | null>(null);
  const areaMarkerGroupsRef = useRef<THREE.Group[]>([]);
  const landmarkMarkerGroupsRef = useRef<THREE.Group[]>([]);
  const updateSizeRef = useRef<(() => void) | null>(null);
  const isDestroyedRef = useRef(false);
  const isRenderingActiveRef = useRef(true);
  const animatedObjectsRef = useRef<{
    mesh: THREE.Object3D;
    pathStart: THREE.Vector3;
    pathEnd: THREE.Vector3;
    speedFactor: number;
    phase: number;
  }[]>([]);
  const interactableMeshesRef = useRef<THREE.Object3D[]>([]);
  const mapPlaceHitTargetsRef = useRef<THREE.Object3D[]>([]);
  const assetMetaByIdRef = useRef<Map<string, InspectableAssetMeta>>(new Map());

  const onSelectMapPlaceRef = useRef(onSelectMapPlace);
  onSelectMapPlaceRef.current = onSelectMapPlace;
  const onSelectAssetRef = useRef(onSelectAsset);
  onSelectAssetRef.current = onSelectAsset;
  const onDiscoveredPlacesRef = useRef(onDiscoveredPlaces);
  onDiscoveredPlacesRef.current = onDiscoveredPlaces;

  const resolvedPlaces = useMemo(
    () => (discoveredPlaces && discoveredPlaces.length > 0 ? discoveredPlaces : REGIONAL_MAP_PLACES),
    [discoveredPlaces]
  );
  const resolvedPlacesRef = useRef(resolvedPlaces);
  resolvedPlacesRef.current = resolvedPlaces;

  const currentMapPlace = useMemo(
    () => getMapPlace(mapPlaceId, resolvedPlaces),
    [mapPlaceId, resolvedPlaces]
  );
  const isWideAreaView = mapPlaceId === 'region';
  const osmAreaBounds = currentMapPlace.bounds || REGIONAL_BOUNDS;
  // Conservative vertical scale: 1.15x city view preserves true architectural proportions and open streets
  // Proportional vertical scale: 2.8x for regional massing, 2.2x for realistic city buildings
  const mapVerticalExaggeration = mapPlaceId === 'region' ? 2.8 : 2.2;

  const allNamedMapLandmarks = useMemo(
    () => getMapLandmarks(osmMapData?.features || [], REGIONAL_BOUNDS, 180),
    [osmMapData]
  );
  const namedMapLandmarks = useMemo(
    () => getMapLandmarks(osmMapData?.features || [], osmAreaBounds, 32),
    [osmMapData, osmAreaBounds]
  );
  const waterwayAndHighwayLandmarks = useMemo(
    () => getWaterwayAndHighwayLabels(osmMapData?.features || [], osmAreaBounds, 14),
    [osmMapData, osmAreaBounds]
  );
  const landmarkSuggestions = useMemo(() => {
    const query = landmarkSearchQuery.trim().toLocaleLowerCase();
    if (query.length < 2) return [];
    return allNamedMapLandmarks
      .filter((landmark) =>
        landmark.name.toLocaleLowerCase().replace(/[_-]+/g, ' ').includes(query) ||
        landmark.category.toLocaleLowerCase().includes(query)
      )
      .slice(0, 12);
  }, [allNamedMapLandmarks, landmarkSearchQuery]);

  const osmBuildingGeometry = useMemo(
    () => {
      const features = osmMapData?.features || [];
      return createOSMBuildingGeometry(features, osmAreaBounds, mapVerticalExaggeration, isWideAreaView);
    },
    [osmMapData, osmAreaBounds, mapVerticalExaggeration, isWideAreaView]
  );
  const osmBuildingOutlineGeometry = useMemo(
    () => createOSMBuildingOutlineGeometry(
      osmMapData?.features || [],
      osmAreaBounds,
      isWideAreaView,
      mapVerticalExaggeration,
      hologram
    ),
    [osmMapData, osmAreaBounds, isWideAreaView, mapVerticalExaggeration, hologram]
  );
  const osmLandcoverGeometry = useMemo(
    () => createOSMLandcoverGeometry(osmMapData?.features || [], osmAreaBounds, hologram),
    [osmMapData, osmAreaBounds, hologram]
  );
  const osmArterialRibbonGeometry = useMemo(
    () => createOSMArterialRibbonGeometry(osmMapData?.features || [], osmAreaBounds, hologram),
    [osmMapData, osmAreaBounds, hologram]
  );
  const osmRoadNetworkRibbonGeometry = useMemo(
    () =>
      createOSMRoadNetworkRibbonGeometry(
        osmMapData?.features || [],
        osmAreaBounds,
        hologram,
        isWideAreaView
      ),
    [osmMapData, osmAreaBounds, hologram, isWideAreaView]
  );
  const osmLaneMarkingsGeometry = useMemo(
    () =>
      createOSMLaneMarkingsGeometry(
        osmMapData?.features || [],
        osmAreaBounds,
        hologram
      ),
    [osmMapData, osmAreaBounds, hologram]
  );
  const osmVegetationMesh = useMemo(
    () =>
      reducedDetailMode
        ? null
        : createOSMVegetationInstancedMesh(
            osmMapData?.features || [],
            osmAreaBounds,
            hologram,
            1200
          ),
    [osmMapData, osmAreaBounds, hologram, reducedDetailMode]
  );
  const osmWaterwayRibbonGeometry = useMemo(
    () => createOSMWaterwayRibbonGeometry(osmMapData?.features || [], osmAreaBounds),
    [osmMapData, osmAreaBounds]
  );
  const osmMajorRoadGeometry = useMemo(
    () => createOSMRoadGeometry(osmMapData?.features || [], osmAreaBounds, true),
    [osmMapData, osmAreaBounds]
  );
  const osmLocalRoadGeometry = useMemo(
    () =>
      isWideAreaView
        ? null
        : createOSMRoadGeometry(osmMapData?.features || [], osmAreaBounds, false),
    [osmMapData, osmAreaBounds, isWideAreaView]
  );
  const osmRoadGeometry = osmMajorRoadGeometry;
  const osmRailwayGeometry = useMemo(
    () => createOSMRailwayGeometry(osmMapData?.features || [], osmAreaBounds),
    [osmMapData, osmAreaBounds]
  );
  const osmPowerLineGeometry = useMemo(
    () => createOSMUtilityGeometry(osmMapData?.features || [], 'power', osmAreaBounds),
    [osmMapData, osmAreaBounds]
  );
  const osmWaterwayGeometry = useMemo(
    () => createOSMUtilityGeometry(osmMapData?.features || [], 'waterway', osmAreaBounds),
    [osmMapData, osmAreaBounds]
  );
  const osmPowerPointGeometry = useMemo(
    () => createOSMUtilityPointGeometry(osmMapData?.features || [], 'power', osmAreaBounds),
    [osmMapData, osmAreaBounds]
  );
  const osmWaterFacilityGeometry = useMemo(
    () => createOSMUtilityPointGeometry(osmMapData?.features || [], 'water_supply', osmAreaBounds),
    [osmMapData, osmAreaBounds]
  );

  useEffect(() => {
    let active = true;
    setOsmMapError(false);
    loadOSMPlaceData(mapPlaceId)
      .then((data) => {
        if (!active) return;
        setOsmMapData((prev) => (prev === data ? prev : data));
        const places = discoverRegionalPlacesFromOSM(data.features || []);
        onDiscoveredPlacesRef.current?.(places);
      })
      .catch(() => {
        if (active) setOsmMapError(true);
      });
    return () => {
      active = false;
    };
  }, [mapPlaceId, osmRetryNonce]);


  const toggleFullscreen = () => {
    if (!containerWrapperRef.current) return;
    if (!document.fullscreenElement) {
      containerWrapperRef.current.requestFullscreen?.().catch(() => {
        setIsFullscreen((prev) => !prev);
      });
    } else {
      document.exitFullscreen?.().catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => undefined);
        }
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const stateRef = useRef({
    cameraAzimuth,
    cameraElevation,
    cameraDistance,
    cameraPanX,
    cameraPanZ,
    isPlaying,
    playbackSpeed,
    timelineProgress,
    selectedAssetId,
    showContextBuildings,
    showFlowParticles,
    mapPlaceId,
    hologram,
    isWideAreaView,
    reducedDetailMode
  });

  useEffect(() => {
    stateRef.current = {
      cameraAzimuth,
      cameraElevation,
      cameraDistance,
      cameraPanX,
      cameraPanZ,
      isPlaying,
      playbackSpeed,
      timelineProgress,
      selectedAssetId,
      showContextBuildings,
      showFlowParticles,
      mapPlaceId,
      hologram,
      isWideAreaView,
      reducedDetailMode
    };
  }, [
    cameraAzimuth,
    cameraElevation,
    cameraDistance,
    cameraPanX,
    cameraPanZ,
    isPlaying,
    playbackSpeed,
    timelineProgress,
    selectedAssetId,
    showContextBuildings,
    showFlowParticles,
    mapPlaceId,
    hologram,
    isWideAreaView,
    reducedDetailMode
  ]);

  const cameraFlightRef = useRef<{
    fromX: number;
    fromZ: number;
    fromDistance: number;
    fromAzimuth: number;
    fromElevation: number;
    toX: number;
    toZ: number;
    toDistance: number;
    toAzimuth: number;
    toElevation: number;
    startedAt: number;
    durationMs: number;
    onComplete?: () => void;
  } | null>(null);

  const handleFitBounds = (animateTransition = false) => {
    cameraFlightRef.current = null;
    const container = containerRef.current;
    const aspect = container?.clientHeight
      ? container.clientWidth / container.clientHeight
      : 1.5;

    const pendingLandmark = pendingLandmarkFlightRef.current;
    pendingLandmarkFlightRef.current = null;

    const targetAz = mapPlaceId === 'region' ? -0.45 : 0.55;
    const targetEl = mapPlaceId === 'region' ? 0.76 : 0.40;
    const targetPoint = pendingLandmark && !pendingLandmark.placeId
      ? geographicToWorld(pendingLandmark.lon, pendingLandmark.lat, 0)
      : getMapPlaceWorldPosition(mapPlaceId, resolvedPlaces);
    const fitDistance = getCameraStartDistance(mapPlaceId, aspect);
    const targetDistance = pendingLandmark && !pendingLandmark.placeId
      ? getLandmarkFocusDistance(mapPlaceId, aspect)
      : (mapPlaceId === 'region' ? fitDistance : Math.min(fitDistance, 4.8));

    if (pendingLandmark && !pendingLandmark.placeId) {
      selectedMapLandmarkRef.current = pendingLandmark;
    } else {
      selectedMapLandmarkRef.current = null;
      setLandmarkSearchQuery('');
    }

    if (animateTransition && !reducedMotion) {
      const currentCamera = stateRef.current;
      cameraFlightRef.current = {
        fromX: currentCamera.cameraPanX,
        fromZ: currentCamera.cameraPanZ,
        fromDistance: currentCamera.cameraDistance,
        fromAzimuth: currentCamera.cameraAzimuth,
        fromElevation: currentCamera.cameraElevation,
        toX: targetPoint.x,
        toZ: targetPoint.z,
        toDistance: targetDistance,
        toAzimuth: targetAz,
        toElevation: targetEl,
        startedAt: performance.now(),
        durationMs: 880
      };
      return;
    }

    setCameraAzimuth(targetAz);
    setCameraElevation(targetEl);
    setCameraDistance(targetDistance);
    setCameraPanX(targetPoint.x);
    setCameraPanZ(targetPoint.z);
  };

  useEffect(() => {
    const contextKey = `${scenario.id}:${scenario.domain}`;
    const scenarioChanged = previousScenarioContextRef.current !== contextKey;
    previousScenarioContextRef.current = contextKey;
    handleFitBounds(!scenarioChanged);
  }, [scenario.domain, scenario.id, mapPlaceId]);

  // Decoupled Domain Asset Generation
  const updateScenarioAssets = useCallback(() => {
    const scenarioGroup = scenarioGroupRef.current;
    const flowGroup = flowGroupRef.current;
    if (!scenarioGroup || !flowGroup) return;

    while (scenarioGroup.children.length > 0) {
      const child = scenarioGroup.children[0];
      scenarioGroup.remove(child);
      disposeThreeObject(child);
    }

    while (flowGroup.children.length > 0) {
      const child = flowGroup.children[0];
      flowGroup.remove(child);
      disposeThreeObject(child);
    }

    animatedObjectsRef.current = [];
    interactableMeshesRef.current = [];
    assetMetaByIdRef.current = new Map();

    const registerInteractable = (
      obj: THREE.Object3D,
      meta: InspectableAssetMeta
    ) => {
      obj.userData.assetId = meta.id;
      obj.traverse((child) => {
        child.userData.assetId = meta.id;
      });
      interactableMeshesRef.current.push(obj);
      assetMetaByIdRef.current.set(meta.id, meta);
    };

    const componentPositions: Record<string, THREE.Vector3> = {};

    // DOMAIN 1: TRAFFIC DIGITAL TWIN
    if (
      scenario.domain === 'traffic' &&
      scenario.trafficNetwork &&
      simulationResult.rawOutput.domain === 'traffic'
    ) {
      const trafficOut = simulationResult.rawOutput.result;
      const stepIdx = Math.min(
        trafficOut.timeSteps.length - 1,
        Math.max(
          0,
          Math.floor((timelineProgress / 100) * trafficOut.timeSteps.length)
        )
      );
      const stepData =
        trafficOut.timeSteps[stepIdx] ||
        trafficOut.timeSteps[trafficOut.timeSteps.length - 1];

      const cellPositions: Record<string, THREE.Vector3> = {};
      scenario.trafficNetwork.cells.forEach((cell) => {
        const cellWorldPos = scenarioPositionToWorld(cell.x, cell.y, 0.015, mapPlaceId);
        cellPositions[cell.id] = cellWorldPos;
        componentPositions[cell.id] = cellWorldPos;
      });

      const asphaltMat = new THREE.MeshStandardMaterial({
        color: 0x142538,
        roughness: 0.88,
        metalness: 0.08,
        transparent: differenceMode,
        opacity: differenceMode ? 0.35 : 1.0
      });
      const linkVertices: THREE.Vector3[] = [];
      scenario.trafficNetwork.cells.forEach((cell) => {
        const p1 = cellPositions[cell.id];
        cell.nextCellIds.forEach((nextId) => {
          const p2 = cellPositions[nextId];
          if (p1 && p2) {
            linkVertices.push(
              new THREE.Vector3(p1.x, 0.025, p1.z),
              new THREE.Vector3(p2.x, 0.025, p2.z)
            );
          }
        });
      });
      if (linkVertices.length > 0 && mapPlaceId !== 'region') {
        const linkGeometry = new THREE.BufferGeometry().setFromPoints(linkVertices);
        const linkOverlay = new THREE.LineSegments(
          linkGeometry,
          new THREE.LineBasicMaterial({ color: 0x8bb8c8, transparent: true, opacity: 0.24 })
        );
        linkOverlay.renderOrder = 4;
        scenarioGroup.add(linkOverlay);
      }

      const cells = scenario.trafficNetwork.cells;
      cells.forEach((cell, idx) => {
        const pos = cellPositions[cell.id];
        const speedVal =
          stepData?.cellSpeeds[cell.id] ?? trafficOut.averageSpeedKmh;
        const densityVal =
          stepData?.cellDensities[cell.id] ?? cell.initialDensityVehKmPerLane;
        const flowVal = stepData?.cellFlows[cell.id] ?? 1400;
        const densityLimit = 0.7 * cell.jamDensityVehKmPerLane;

        const isModified =
          selectedAlternative?.modifications.some(
            (m) => m.targetId === cell.id
          ) ?? false;

        const status: 'nominal' | 'warning' | 'critical' | 'upgraded' =
          speedVal < 22 || densityVal > 0.8 * cell.jamDensityVehKmPerLane
            ? 'critical'
            : densityVal > densityLimit
              ? 'warning'
              : isModified
                ? 'upgraded'
                : 'nominal';

        const statusHex =
          status === 'critical'
            ? 0xf43f5e
            : status === 'warning'
              ? 0xf59e0b
              : status === 'upgraded'
                ? 0x22d3ee
                : 0x10b981;

        const roadGroup = new THREE.Group();
        roadGroup.position.copy(pos);

        const isSignalized = (cell.signalGreenRatio ?? 1.0) < 1.0;
        const nodeRadius = isSignalized ? 0.25 : 0.2;

        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(nodeRadius, nodeRadius * 1.08, 0.035, 24),
          asphaltMat
        );
        roadGroup.add(pad);

        const isDimmed = differenceMode && !isModified && status === 'nominal';
        const shouldHighlightChange = (differenceMode || isComparisonView || Boolean(selectedAlternative)) && isModified;
        const isLocationSelectionCoverage = mapMode === 'location-selection' && showSimulationCoverage;

        const effectiveColorHex = isLocationSelectionCoverage ? 0x10b981 : (shouldHighlightChange ? 0x00f0ff : statusHex);

        const ringMat = new THREE.MeshStandardMaterial({
          color: effectiveColorHex,
          emissive: effectiveColorHex,
          emissiveIntensity: isDimmed ? 0.08 : (shouldHighlightChange ? 2.8 : isLocationSelectionCoverage ? 2.2 : 0.85),
          roughness: 0.25,
          transparent: isDimmed,
          opacity: isDimmed ? 0.22 : 1.0
        });

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(nodeRadius * (shouldHighlightChange || isLocationSelectionCoverage ? 1.15 : 0.88), 0.025, 8, 24),
          ringMat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.03;
        roadGroup.add(ring);

        if (isLocationSelectionCoverage) {
          const coverageRing = new THREE.Mesh(
            new THREE.RingGeometry(nodeRadius * 1.2, nodeRadius * 1.7, 24),
            new THREE.MeshBasicMaterial({
              color: 0x10b981,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.85
            })
          );
          coverageRing.rotation.x = -Math.PI / 2;
          coverageRing.position.y = 0.045;
          roadGroup.add(coverageRing);
        }

        if (shouldHighlightChange) {
          // Luminous pulsing concentric upgrade aura ring
          const haloRing = new THREE.Mesh(
            new THREE.RingGeometry(nodeRadius * 1.35, nodeRadius * 1.9, 32),
            new THREE.MeshBasicMaterial({
              color: 0x00f0ff,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.95
            })
          );
          haloRing.rotation.x = -Math.PI / 2;
          haloRing.position.y = 0.048;
          roadGroup.add(haloRing);

          // Upward glowing solution beacon pin
          const beaconCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.55, 8),
            new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })
          );
          beaconCylinder.position.set(0, 0.32, 0);
          roadGroup.add(beaconCylinder);

          const beaconDiamond = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.065),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          beaconDiamond.position.set(0, 0.62, 0);
          roadGroup.add(beaconDiamond);
        }

        if (isSignalized) {
          const isGreen = speedVal > 18.0;
          const signalGantry = createTrafficSignalGantryGroup(isGreen, isModified, hologram);
          roadGroup.add(signalGantry);
        } else {
          const beacon = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.07, 0.1),
            ringMat
          );
          beacon.position.set(0, 0.04, 0);
          roadGroup.add(beacon);
        }

        registerInteractable(roadGroup, {
          id: cell.id,
          name: cell.name,
          type: isSignalized
            ? `Signalized Intersection (g=${(cell.signalGreenRatio ?? 1).toFixed(2)})`
            : `CTM Road Segment (${cell.lanes} Lanes)`,
          status,
          statusBadgeText: isModified
            ? 'PROPOSED SIGNAL TIMING'
            : isSignalized
              ? 'CTM SIGNALIZED'
              : status === 'critical'
                ? 'CRITICAL BREACH'
                : status === 'warning'
                  ? 'QUEUE WARNING'
                  : status === 'upgraded'
                    ? 'UPGRADED'
                    : 'NOMINAL',
          metrics: [
            ...(isSignalized
              ? [
                  {
                    label: 'Physical Infrastructure',
                    value: '0 mapped in OSM region.json (Simulated CTM Signal)'
                  },
                  {
                    label: 'Signal Green Ratio (g/C)',
                    value: `${((cell.signalGreenRatio ?? 1) * 100).toFixed(0)}% cycle allocation`
                  }
                ]
              : []),
            { label: 'Cell Speed', value: `${speedVal.toFixed(1)} km/h (Min >= 22.0)` },
            {
              label: 'Queue Density',
              value: `${densityVal.toFixed(1)} / ${densityLimit.toFixed(1)} veh/km/ln`
            },
            { label: 'Discharge Flow', value: `${Math.round(flowVal)} veh/h (${cell.lanes}L)` }
          ]
        });

        scenarioGroup.add(roadGroup);

        const targetNextId = cell.nextCellIds[0];
        const startVec = pos.clone().add(new THREE.Vector3(0, 0.06, 0));
        const endVec = targetNextId && cellPositions[targetNextId]
          ? cellPositions[targetNextId].clone().add(new THREE.Vector3(0, 0.06, 0))
          : pos.clone().add(new THREE.Vector3(0.35, 0.06, (idx % 2 === 0 ? 1 : -1) * 0.28));

        const vehicleCount = reducedDetailMode ? 1 : 2;
        for (let v = 0; v < vehicleCount; v++) {
          const vGroup = new THREE.Group();
          const vColor =
            v === 0 && isModified
              ? 0x22d3ee
              : status === 'critical'
                ? 0xf43f5e
                : (idx + v) % 2 === 0
                  ? 0xfbbf24
                  : 0x10b981;
          const vBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.055, 0.018, 0.032),
            new THREE.MeshStandardMaterial({
              color: vColor,
              emissive: vColor,
              emissiveIntensity: 0.6,
              roughness: 0.3
            })
          );
          const vCabin = new THREE.Mesh(
            new THREE.BoxGeometry(0.031, 0.013, 0.027),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
          );
          vCabin.position.y = 0.011;
          vGroup.add(vBody);
          vGroup.add(vCabin);
          flowGroup.add(vGroup);

          animatedObjectsRef.current.push({
            mesh: vGroup,
            pathStart: startVec,
            pathEnd: endVec,
            speedFactor: Math.max(0.22, speedVal / 45),
            phase: (v * 0.5 + idx * 0.13) % 1
          });
        }
      });

      const selectedIntervention = `${selectedAlternative?.id || ''} ${selectedAlternative?.name || ''}`;
      if (/metro|rapid transit|elevated rail/i.test(selectedIntervention)) {
        const gateway = cellPositions['cell-nw-in'];
        const campusHub = cellPositions['cell-campus-main'];
        if (gateway && campusHub) {
          const routeStart = gateway.clone();
          const routeEnd = campusHub.clone();
          const routeMid = routeStart.clone().lerp(routeEnd, 0.5);
          const offsetX = routeEnd.z - routeStart.z;
          const offsetZ = routeStart.x - routeEnd.x;
          const offsetLength = Math.hypot(offsetX, offsetZ) || 1;
          routeMid.x += (offsetX / offsetLength) * 0.18;
          routeMid.z += (offsetZ / offsetLength) * 0.18;
          const guidewayHeight = 0.16;
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(routeStart.x, guidewayHeight, routeStart.z),
            new THREE.Vector3(routeMid.x, guidewayHeight, routeMid.z),
            new THREE.Vector3(routeEnd.x, guidewayHeight, routeEnd.z)
          ]);
          const guidewayGlow = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 40, 0.09, 8, false),
            new THREE.MeshBasicMaterial({
              color: 0xffb94d,
              transparent: true,
              opacity: 0.2,
              depthTest: false,
              depthWrite: false,
              toneMapped: false
            })
          );
          guidewayGlow.renderOrder = 20;
          scenarioGroup.add(guidewayGlow);

          const guideway = new THREE.Mesh(
            new THREE.TubeGeometry(curve, 40, 0.04, 8, false),
            new THREE.MeshBasicMaterial({
              color: 0xffdf85,
              transparent: true,
              opacity: 0.98,
              depthTest: false,
              depthWrite: false,
              toneMapped: false
            })
          );
          guideway.renderOrder = 21;
          scenarioGroup.add(guideway);

          const stationMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdf85,
            toneMapped: false,
            depthTest: false
          });
          [routeStart, routeEnd].forEach((position) => {
            const station = new THREE.Mesh(
              new THREE.SphereGeometry(0.065, 10, 10),
              stationMaterial
            );
            station.position.set(position.x, guidewayHeight, position.z);
            station.renderOrder = 22;
            scenarioGroup.add(station);
          });
        }
      }
    }

    // DOMAIN 2: WATER DISTRIBUTION DIGITAL TWIN
    else if (
      scenario.domain === 'water' &&
      scenario.waterNetwork &&
      simulationResult.rawOutput.domain === 'water'
    ) {
      const waterOut = simulationResult.rawOutput.result;
      const pressureLimit =
        scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 180.0;

      const nodePositions: Record<string, THREE.Vector3> = {};
      scenario.waterNetwork.nodes.forEach((node) => {
        // Place all nodes at ground level; each node's visual model provides its own vertical height.
        // Elevated types (reservoir, tank, high-elevation junction) sit slightly above ground.
        const baseElevY =
          node.type === 'reservoir'
            ? 0.03
            : node.type === 'tank'
              ? 0.03
              : node.elevation > 150
                ? 0.04
                : 0.03;
        const nodeWorldPos = scenarioPositionToWorld(node.x, node.y, baseElevY, mapPlaceId);
        nodePositions[node.id] = nodeWorldPos;
        componentPositions[node.id] = nodeWorldPos;
      });

      scenario.waterNetwork.nodes.forEach((node) => {
        const pos = nodePositions[node.id];
        const nRes = waterOut.nodeResults[node.id];
        const pressureKpa = nRes?.pressureKPa ?? waterOut.minPressureKPa;
        const headM = nRes?.head ?? node.head ?? node.elevation + 25;

        const status: 'nominal' | 'warning' | 'critical' | 'upgraded' =
          node.type === 'reservoir'
            ? 'upgraded'
            : pressureKpa < pressureLimit
              ? 'critical'
              : pressureKpa < pressureLimit + 25
                ? 'warning'
                : 'nominal';

        const colorHex =
          status === 'critical'
            ? 0xf43f5e
            : status === 'warning'
              ? 0xf59e0b
              : status === 'upgraded'
                ? 0x22d3ee
                : 0x10b981;

        const isModified =
          selectedAlternative?.modifications.some(
            (m) => m.targetId === node.id
          ) ?? false;

        const isDimmed = differenceMode && !isModified && status === 'nominal';

        const nodeGroup = new THREE.Group();
        nodeGroup.position.copy(pos);

        const shouldHighlightNode = (differenceMode || isComparisonView || Boolean(selectedAlternative)) && isModified;

        if (node.type === 'reservoir') {
          const resGroup = createReservoirGroup(colorHex, hologram);
          nodeGroup.add(resGroup);
        } else if (node.type === 'tank') {
          const tankGroup = createElevatedWaterTankGroup(colorHex, hologram);
          nodeGroup.add(tankGroup);
        } else if (node.type === 'pump' || node.type === 'valve') {
          const pumpHousing = new THREE.Mesh(
            new THREE.BoxGeometry(0.065, 0.045, 0.05),
            new THREE.MeshStandardMaterial({
              color: shouldHighlightNode ? 0x00f0ff : (node.type === 'pump' ? 0xf59e0b : 0xa855f7),
              emissive: shouldHighlightNode ? 0x00f0ff : (node.type === 'pump' ? 0xd97706 : 0x7c3aed),
              emissiveIntensity: isDimmed ? 0.08 : (shouldHighlightNode ? 2.6 : 0.5),
              metalness: 0.55,
              roughness: 0.3,
              transparent: isDimmed,
              opacity: isDimmed ? 0.25 : 1.0
            })
          );
          pumpHousing.position.y = 0.025;
          nodeGroup.add(pumpHousing);
        } else {
          const junc = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.022, 10),
            new THREE.MeshStandardMaterial({
              color: shouldHighlightNode ? 0x00f0ff : colorHex,
              emissive: shouldHighlightNode ? 0x00f0ff : colorHex,
              emissiveIntensity: isDimmed ? 0.08 : (shouldHighlightNode ? 2.8 : 0.7),
              roughness: 0.3,
              transparent: isDimmed,
              opacity: isDimmed ? 0.25 : 1.0
            })
          );
          junc.position.y = 0.011;
          nodeGroup.add(junc);
        }

        if (shouldHighlightNode) {
          const haloRing = new THREE.Mesh(
            new THREE.RingGeometry(0.12, 0.20, 24),
            new THREE.MeshBasicMaterial({
              color: 0x00f0ff,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.95
            })
          );
          haloRing.rotation.x = -Math.PI / 2;
          haloRing.position.y = 0.035;
          nodeGroup.add(haloRing);

          // Upward glowing solution upgrade beacon pin
          const beaconCylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(0.010, 0.010, 0.5, 8),
            new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.85 })
          );
          beaconCylinder.position.set(0, 0.28, 0);
          nodeGroup.add(beaconCylinder);

          const beaconDiamond = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.06),
            new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
          );
          beaconDiamond.position.set(0, 0.56, 0);
          nodeGroup.add(beaconDiamond);
        }

        registerInteractable(nodeGroup, {
        id: node.id,
        name: node.name,
        type: `${node.type.toUpperCase()} Node (Elev ${node.elevation} m)`,
        status,
        statusBadgeText:
          status === 'critical'
            ? 'LOW PRESSURE BREACH'
            : status === 'warning'
              ? 'MARGINAL HEAD'
              : status === 'upgraded'
                ? 'SOURCE HEAD'
                : 'PRESSURE OK',
        metrics: [
          { label: 'Hydraulic Pressure', value: `${pressureKpa.toFixed(1)} kPa (Min >= ${pressureLimit.toFixed(0)})` },
          { label: 'Piezometric Head', value: `${headM.toFixed(1)} m` },
          { label: 'Base Outflow Demand', value: `${(node.baseDemand * 1000).toFixed(1)} L/s` }
        ]
      });

      scenarioGroup.add(nodeGroup);
    });

  scenario.waterNetwork.pipes.forEach((pipe) => {
    const start =
      nodePositions[pipe.fromNodeId] || new THREE.Vector3(-10, 0.2, 0);
    const end =
      nodePositions[pipe.toNodeId] || new THREE.Vector3(10, 0.2, 0);

    const pRes = waterOut.pipeResults[pipe.id];
    const flowM3s = pRes?.flowM3s ?? 0.05;
    const velocityMs = pRes?.velocityMs ?? 1.1;
    const headLossPerKm = pRes?.headLossPerKm ?? 3.5;

    const isOverloaded = velocityMs > 2.0 || headLossPerKm > 12.0;
    const isUpgraded =
      selectedAlternative?.modifications.some(
        (m) => m.targetId === pipe.id
      ) ?? false;

    const colorHex = isUpgraded
      ? 0x22d3ee
      : isOverloaded
        ? 0xf43f5e
        : velocityMs > 1.6
          ? 0xf59e0b
          : 0x38bdf8;

    const mid = start
      .clone()
      .add(end)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 0.02, 0));
    componentPositions[pipe.id] = mid;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    // Sleek, proportionate water main radius (0.015–0.032 wu ≈ 3–6m visual scale)
    const radius = Math.min(0.032, Math.max(0.015, pipe.diameter * 0.005 * 4.5));

    const tubeGeo = new THREE.TubeGeometry(curve, 20, radius, 8, false);
    const isDimmed = differenceMode && !isUpgraded && !isOverloaded;
    const shouldHighlightPipe = (differenceMode || isComparisonView || Boolean(selectedAlternative)) && isUpgraded;
    const isLocationSelectionCoverage = mapMode === 'location-selection' && showSimulationCoverage;
    const effectivePipeColorHex = isLocationSelectionCoverage ? 0x10b981 : (shouldHighlightPipe ? 0x00f0ff : colorHex);

    const tubeMat = new THREE.MeshStandardMaterial({
      color: effectivePipeColorHex,
      emissive: effectivePipeColorHex,
      emissiveIntensity: isDimmed ? 0.08 : (shouldHighlightPipe ? 2.6 : isLocationSelectionCoverage ? 2.2 : 0.6),
      roughness: 0.28,
      transparent: isDimmed,
      opacity: isDimmed ? 0.22 : 1.0
    });
    const pipeMesh = new THREE.Mesh(tubeGeo, tubeMat);

    if (shouldHighlightPipe || isLocationSelectionCoverage) {
      const outerGlowGeo = new THREE.TubeGeometry(curve, 20, radius * (isLocationSelectionCoverage ? 1.8 : 1.6), 8, false);
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: isLocationSelectionCoverage ? 0x10b981 : 0x00f0ff,
        transparent: true,
        opacity: isLocationSelectionCoverage ? 0.65 : 0.45,
        wireframe: true
      });
      const outerMesh = new THREE.Mesh(outerGlowGeo, outerGlowMat);
      scenarioGroup.add(outerMesh);
    }

    registerInteractable(pipeMesh, {
      id: pipe.id,
      name: `Water Main (${pipe.id})`,
      type: `Pressurized Main (D=${(pipe.diameter * 1000).toFixed(0)} mm, ε=${(pipe.absoluteRoughnessMm ?? 0.15).toFixed(2)} mm)`,
      status: isUpgraded ? 'upgraded' : isOverloaded ? 'critical' : 'nominal',
      statusBadgeText: isUpgraded
        ? 'UPGRADED MAIN'
        : isOverloaded
          ? 'VELOCITY / HEAD-LOSS ALERT'
          : 'NOMINAL FLOW',
      metrics: [
        { label: 'Flow Velocity', value: `${velocityMs.toFixed(2)} m/s (Limit <= 2.00 m/s)` },
        { label: 'Head-Loss Gradient', value: `${headLossPerKm.toFixed(1)} m/km (Limit <= 12.0 m/km)` },
        { label: 'Volumetric Flow', value: `${Math.abs(flowM3s).toFixed(3)} m³/s` }
      ]
    });

    scenarioGroup.add(pipeMesh);

    const pulseCount = reducedDetailMode ? 1 : 2;
    for (let p = 0; p < pulseCount; p++) {
      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.6, 8, 8),
        new THREE.MeshBasicMaterial({
          color: isOverloaded ? 0xfda4af : 0x67e8f9
        })
      );
      flowGroup.add(pulse);
      animatedObjectsRef.current.push({
        mesh: pulse,
        pathStart: start,
        pathEnd: end,
        speedFactor: Math.max(0.35, velocityMs * 0.45),
        phase: p / pulseCount
      });
    }
  });
}

    // DOMAIN 3: ELECTRICAL POWER GRID DIGITAL TWIN
    else if (
  scenario.domain === 'energy' &&
  scenario.powerNetwork &&
  simulationResult.rawOutput.domain === 'energy'
) {
  const powerOut = simulationResult.rawOutput.result;

  const busPositions: Record<string, THREE.Vector3> = {};
  scenario.powerNetwork.buses.forEach((bus) => {
    const busWorldPos = scenarioPositionToWorld(bus.x, bus.y, 0.02, mapPlaceId);
    busPositions[bus.id] = busWorldPos;
    componentPositions[bus.id] = busWorldPos;
  });

  scenario.powerNetwork.buses.forEach((bus) => {
    const pos = busPositions[bus.id];
    const angleDeg = powerOut.busAnglesDeg[bus.id] ?? 0;
    const netInjMw = powerOut.busNetInjectionsMw[bus.id] ?? 0;
    const genAtBus = scenario.powerNetwork?.generators.find((g) => g.busId === bus.id);
    const loadAtBus = scenario.powerNetwork?.loads.find((l) => l.busId === bus.id);

    const busGroup = new THREE.Group();
    busGroup.position.copy(pos);

    const yardPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.03, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 })
    );
    busGroup.add(yardPad);

    const mainColor = bus.isSlack
      ? 0xf59e0b
      : genAtBus
        ? 0x10b981
        : bus.isSubstation
          ? 0x8b5cf6
          : 0x38bdf8;

    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.09, 0.10),
      new THREE.MeshStandardMaterial({
        color: mainColor,
        emissive: mainColor,
        emissiveIntensity: 0.45,
        metalness: 0.45,
        roughness: 0.3
      })
    );
    hall.position.set(-0.05, 0.06, 0);
    busGroup.add(hall);

    if (bus.hasTransformer || bus.isSubstation) {
      for (let c = -1; c <= 1; c++) {
        const coil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.032, 0.08, 10),
          new THREE.MeshStandardMaterial({
            color: 0xfbbf24,
            emissive: 0xd97706,
            emissiveIntensity: 0.55
          })
        );
        coil.position.set(0.08, 0.05, c * 0.055);
        busGroup.add(coil);
      }
    }

    registerInteractable(busGroup, {
      id: bus.id,
      name: bus.name,
      type: `${bus.baseKv} kV ${bus.isSlack ? 'Slack Generator Bus' : bus.isSubstation ? 'Transformer Substation' : 'Distribution Load Bus'}`,
      status: bus.isSlack ? 'upgraded' : 'nominal',
      statusBadgeText: bus.isSlack
        ? 'SLACK REFERENCE'
        : genAtBus
          ? `GEN (${genAtBus.scheduledMw} MW)`
          : 'SUBSTATION BUS',
      metrics: [
        { label: 'Voltage Phase Angle (θ)', value: `${angleDeg.toFixed(2)}°` },
        { label: 'Net Active Injection', value: `${netInjMw.toFixed(1)} MW` },
        {
          label: 'Connected Gen / Load',
          value: `Gen: ${genAtBus ? genAtBus.scheduledMw : 0} MW • Load: ${loadAtBus ? loadAtBus.mw.toFixed(0) : 0} MW`
        }
      ]
    });

    scenarioGroup.add(busGroup);
  });

  scenario.powerNetwork.lines.forEach((line, idx) => {
    const start =
      busPositions[line.fromBusId] || new THREE.Vector3(-10, 0.12, 0);
    const end =
      busPositions[line.toBusId] || new THREE.Vector3(10, 0.12, 0);

    const lRes = powerOut.lineFlowsMw[line.id];
    const flowMw = lRes?.flowMw ?? 45;
    const loadingPct =
      lRes?.loadingPct ?? (Math.abs(flowMw) / line.thermalRatingMw) * 100;
    const lossMw = lRes?.estimatedLossesMw ?? 1.2;

    const isUpgraded =
      selectedAlternative?.modifications.some(
        (m) => m.targetId === line.id
      ) ?? false;

    const status: 'nominal' | 'warning' | 'critical' | 'upgraded' =
      loadingPct > 100
        ? 'critical'
        : loadingPct > 80
          ? 'warning'
          : isUpgraded
            ? 'upgraded'
            : 'nominal';

    const lineHex =
      status === 'critical'
        ? 0xf43f5e
        : status === 'warning'
          ? 0xf59e0b
          : status === 'upgraded'
            ? 0x22d3ee
            : 0x10b981;

    const mid = start
      .clone()
      .add(end)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 0.22 + (idx % 2) * 0.05, 0));
    componentPositions[line.id] = mid;

    const pylon = createTransmissionTowerGroup(mid.x, mid.z, 0.36, hologram);
    scenarioGroup.add(pylon);

    const curve = new THREE.QuadraticBezierCurve3(
      start.clone().add(new THREE.Vector3(0, 0.14, 0)),
      mid,
      end.clone().add(new THREE.Vector3(0, 0.14, 0))
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.016, 8, false);
    const shouldHighlightLine = (differenceMode || isComparisonView || Boolean(selectedAlternative)) && isUpgraded;
    const isDimmed = differenceMode && !isUpgraded && status === 'nominal';
    const isLocationSelectionCoverage = mapMode === 'location-selection' && showSimulationCoverage;
    const effectiveLineHex = isLocationSelectionCoverage ? 0x10b981 : (shouldHighlightLine ? 0x00f0ff : lineHex);

    const tubeMat = new THREE.MeshStandardMaterial({
      color: effectiveLineHex,
      emissive: effectiveLineHex,
      emissiveIntensity: isDimmed ? 0.08 : (shouldHighlightLine ? 2.8 : isLocationSelectionCoverage ? 2.2 : 0.85),
      roughness: 0.2,
      transparent: isDimmed,
      opacity: isDimmed ? 0.22 : 1.0
    });
    const lineMesh = new THREE.Mesh(tubeGeo, tubeMat);

    if (shouldHighlightLine || isLocationSelectionCoverage) {
      const outerGlowGeo = new THREE.TubeGeometry(curve, 20, 0.038, 8, false);
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: isLocationSelectionCoverage ? 0x10b981 : 0x00f0ff,
        transparent: true,
        opacity: isLocationSelectionCoverage ? 0.65 : 0.40,
        wireframe: true
      });
      const outerMesh = new THREE.Mesh(outerGlowGeo, outerGlowMat);
      scenarioGroup.add(outerMesh);
    }

    registerInteractable(lineMesh, {
      id: line.id,
      name: `Transmission Line (${line.id})`,
      type: `HV Corridor (${line.fromBusId} → ${line.toBusId}, Rating ${line.thermalRatingMw} MW)`,
      status,
      statusBadgeText:
        status === 'critical'
          ? `OVERLOAD (${loadingPct.toFixed(0)}%)`
          : status === 'warning'
            ? 'HIGH LOADING'
            : status === 'upgraded'
              ? 'RE-CONDUCTORED'
              : 'NOMINAL',
      metrics: [
        {
          label: 'Thermal Loading',
          value: `${loadingPct.toFixed(1)}% (Limit <= 100.0% / ${line.thermalRatingMw} MW)`
        },
        { label: 'Active Power Flow', value: `${flowMw.toFixed(1)} MW (x=${line.reactancePu} p.u.)` },
        { label: 'Post-Processed I²R Loss', value: `${lossMw.toFixed(2)} MW` }
      ]
    });

    scenarioGroup.add(lineMesh);

    const packetCount = reducedDetailMode ? 1 : 2;
    for (let p = 0; p < packetCount; p++) {
      const packet = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 8, 8),
        new THREE.MeshBasicMaterial({ color: lineHex })
      );
      flowGroup.add(packet);
      animatedObjectsRef.current.push({
        mesh: packet,
        pathStart: start.clone().add(new THREE.Vector3(0, 0.14, 0)),
        pathEnd: end.clone().add(new THREE.Vector3(0, 0.14, 0)),
        speedFactor: 0.8,
        phase: p / packetCount
      });
    }
  });
}

// PROBLEM HOTSPOTS OVERLAY (Bottlenecks, Pressure Deficits, Line Overloads)
if (layers.hotspots) {
  const hotspots = DigitalTwinAdapters.getProblemHotspots(scenario, simulationResult);
  hotspots.forEach((hs) => {
    const hsPos = componentPositions[hs.componentId];
    if (!hsPos) return;

    let isResolved = false;
    if (hs.domain === 'traffic' && simulationResult.rawOutput.domain === 'traffic') {
      const trOut = simulationResult.rawOutput.result;
      const lastStep = trOut.timeSteps[trOut.timeSteps.length - 1];
      const spd = lastStep?.cellSpeeds[hs.componentId] ?? trOut.averageSpeedKmh;
      isResolved = spd >= 22.0 && selectedAlternative !== null;
    } else if (hs.domain === 'water' && simulationResult.rawOutput.domain === 'water') {
      const wOut = simulationResult.rawOutput.result;
      const pKpa = wOut.nodeResults[hs.componentId]?.pressureKPa ?? 0;
      const minLimit = scenario.constraints.find((c) => c.metricKey === 'primaryPerformance')?.threshold || 180.0;
      isResolved = pKpa >= minLimit && pKpa <= 550.0 && selectedAlternative !== null;
    } else if (hs.domain === 'energy' && simulationResult.rawOutput.domain === 'energy') {
      const pOut = simulationResult.rawOutput.result;
      const lineFlows = Object.values(pOut.lineFlowsMw);
      const maxLoad = Math.max(...lineFlows.map((l) => l.loadingPct));
      isResolved = maxLoad <= 100.0 && selectedAlternative !== null;
    }

    const beaconGroup = createProblemHotspotBeacon(hs, isResolved, hologram);
    beaconGroup.position.copy(hsPos);
    registerInteractable(beaconGroup, {
      id: hs.id,
      name: `${isResolved ? '✓ Alleviated: ' : '! Bottleneck: '}${hs.name}`,
      type: `${hs.domain.toUpperCase()} Stress Hotspot`,
      status: isResolved ? 'upgraded' : hs.severity,
      statusBadgeText: isResolved ? 'ALLEVIATED' : hs.severity === 'critical' ? 'CRITICAL BREACH' : 'WARNING',
      metrics: [
        { label: hs.metricLabel, value: hs.metricValue },
        { label: 'Threshold', value: hs.thresholdValue },
        { label: 'Recommended Action', value: hs.recommendedAction }
      ]
    });
    scenarioGroup.add(beaconGroup);
  });
}

// SOLUTION INTERVENTIONS OVERLAY (Upgraded / Modified Infrastructure)
// High-visibility luminous laser columns, outer glow sleeves, concentric pulse rings & 3D billboard callouts
changeBeaconSpritesRef.current = [];
if (layers.interventions && selectedAlternative) {
  selectedAlternative.modifications.forEach((mod, modIdx) => {
    const modPos = componentPositions[mod.targetId];
    if (!modPos) return;

    // Determine category, icon, title, and delta
    let badgeText = '★ ASSET UPGRADED';
    let subText = `${mod.label}: ${mod.originalValue} → ${mod.newValue} ${mod.unit}`;
    const deltaVal = mod.newValue - mod.originalValue;
    const deltaPct = mod.originalValue !== 0 ? Math.round((deltaVal / mod.originalValue) * 100) : 0;
    const sign = deltaVal > 0 ? '+' : '';

    if (mod.property === 'signalGreenRatio' || mod.targetId.includes('signal')) {
      badgeText = '🚦 SIGNAL TIMING MODIFIED';
      subText = `Simulated CTM: ${(mod.originalValue * 100).toFixed(0)}% → ${(mod.newValue * 100).toFixed(0)}% (${sign}${deltaPct}%)`;
    } else if (mod.property === 'lanes' || mod.property === 'capacityVehPerHour') {
      badgeText = '🛣️ ROAD UPGRADED';
      subText = `Lanes: ${mod.originalValue} → ${mod.newValue} (${sign}${deltaPct}%)`;
    } else if (mod.property === 'diameter') {
      badgeText = '💧 PIPE UPGRADED';
      subText = `Diameter: ${(mod.originalValue * 1000).toFixed(0)}mm → ${(mod.newValue * 1000).toFixed(0)}mm (${sign}${deltaPct}%)`;
    } else if (mod.property.includes('pump') || mod.property === 'baseFlowM3s') {
      badgeText = '⚙️ PUMP MODIFIED';
      subText = `Flow: ${mod.originalValue.toFixed(2)} → ${mod.newValue.toFixed(2)} m³/s (${sign}${deltaPct}%)`;
    } else if (mod.targetId.includes('res') || mod.property.includes('elevation')) {
      badgeText = '🌊 RESERVOIR MODIFIED';
      subText = `Head: ${mod.originalValue}m → ${mod.newValue}m`;
    } else if (mod.property === 'thermalRatingMw' || mod.targetId.includes('line')) {
      badgeText = '⚡ POWER LINE UPGRADED';
      subText = `Rating: ${mod.originalValue} → ${mod.newValue} MW (${sign}${deltaPct}%)`;
    } else if (mod.targetId.includes('bus') || mod.targetId.includes('sub')) {
      badgeText = '🏭 SUBSTATION MODIFIED';
      subText = `${mod.label}: ${mod.originalValue} → ${mod.newValue} ${mod.unit}`;
    }

    const beaconGroup = createMassiveChangeBeacon(
      modPos,
      badgeText,
      subText,
      hologram,
      undefined,
      modIdx,
      mod.targetId
    );
    if (beaconGroup.userData.billboardSprite) {
      changeBeaconSpritesRef.current.push(beaconGroup.userData.billboardSprite as THREE.Sprite);
    }

    // Register as interactable so clicking anywhere on the laser beam, halo, or billboard selects the asset
    registerInteractable(beaconGroup, {
      id: mod.targetId,
      name: `Modified Asset: ${mod.label || mod.targetId}`,
      type: `Solution Intervention (${selectedAlternative.name})`,
      status: 'upgraded',
      statusBadgeText: 'UPGRADED ASSET',
      metrics: [
        { label: 'Intervention', value: selectedAlternative.name },
        { label: 'Parameter Modified', value: mod.property },
        { label: 'Baseline Condition (Before)', value: `${mod.originalValue} ${mod.unit}` },
        { label: 'Selected Solution (After)', value: `${mod.newValue} ${mod.unit} (${sign}${deltaPct}%)` },
        { label: 'Physics Model', value: scenario.domain === 'traffic' ? 'Cell Transmission Model (CTM)' : scenario.domain === 'water' ? 'Darcy-Weisbach Pipeline Solver' : 'DC Power Flow Simulator' },
        { label: 'Data Provenance', value: mod.property === 'signalGreenRatio' ? 'Simulated CTM signal timing (0 mapped in OSM region.json)' : 'Calibrated topology & OSM alignment' }
      ]
    });

    scenarioGroup.add(beaconGroup);
  });
}

const assetValues = Array.from(assetMetaByIdRef.current.values());
setAllAssetsList(assetValues);
componentPositionsRef.current = componentPositions;

if (selectedAssetId && assetMetaByIdRef.current.has(selectedAssetId)) {
  setSelectedAssetMeta(assetMetaByIdRef.current.get(selectedAssetId) || null);
} else {
  setSelectedAssetMeta(assetValues[0] || null);
}
  }, [
  scenario,
  selectedAlternative,
  simulationResult,
  mapPlaceId,
  reducedDetailMode,
  differenceMode
]);

useEffect(() => {
  updateScenarioAssets();
}, [updateScenarioAssets]);

// Synchronized 3D Geographic Feature Highlight (Buildings, Roads, Waterways, Terrain)
useEffect(() => {
  const scene = sceneRef.current;
  if (!scene) return;

  if (geoHighlightGroupRef.current) {
    scene.remove(geoHighlightGroupRef.current);
    disposeThreeObject(geoHighlightGroupRef.current);
    geoHighlightGroupRef.current = null;
  }

  if (!selectedGeoFeature) return;

  const group = new THREE.Group();
  const hlColor = hologram ? 0x00f0ff : 0xf59e0b;

  if (selectedGeoFeature.polygonCoordinates && selectedGeoFeature.polygonCoordinates.length >= 3) {
    const worldPts = selectedGeoFeature.polygonCoordinates.map(([lon, lat]) =>
      geographicToWorld(lon, lat, 0.05)
    );
    const explicitH = selectedGeoFeature.details.find((d) => d.label === 'Building Height')?.value;
    const heightWorld = explicitH
      ? Math.min(0.40, Math.max(0.04, Number(String(explicitH).replace(/[^0-9.]/g, '')) * 0.005))
      : 0.08;

    const groundPts = [...worldPts, worldPts[0]];
    const groundGeo = new THREE.BufferGeometry().setFromPoints(groundPts);
    const lineMat = new THREE.LineBasicMaterial({ color: hlColor, linewidth: 2 });
    group.add(new THREE.Line(groundGeo, lineMat));

    const roofPts = worldPts.map((p) => new THREE.Vector3(p.x, heightWorld, p.z));
    const roofPoints = [...roofPts, roofPts[0]];
    const roofGeo = new THREE.BufferGeometry().setFromPoints(roofPoints);
    group.add(new THREE.Line(roofGeo, lineMat));

    for (let i = 0; i < worldPts.length; i++) {
      const colGeo = new THREE.BufferGeometry().setFromPoints([worldPts[i], roofPts[i]]);
      group.add(new THREE.Line(colGeo, lineMat));
    }

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.42, 16),
      new THREE.MeshBasicMaterial({ color: hlColor, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(selectedGeoFeature.worldPos.x, heightWorld + 0.02, selectedGeoFeature.worldPos.z);
    group.add(halo);
  } else if (selectedGeoFeature.lineCoordinates && selectedGeoFeature.lineCoordinates.length >= 2) {
    const worldPts = selectedGeoFeature.lineCoordinates.map(([lon, lat]) =>
      geographicToWorld(lon, lat, 0.12)
    );
    const lineGeo = new THREE.BufferGeometry().setFromPoints(worldPts);
    const lineMat = new THREE.LineBasicMaterial({
      color: selectedGeoFeature.category === 'waterway' ? 0x38bdf8 : 0xfbbf24,
      linewidth: 3
    });
    group.add(new THREE.Line(lineGeo, lineMat));
  } else {
    const pinPos = selectedGeoFeature.worldPos;
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.06, 8, 28),
      new THREE.MeshBasicMaterial({ color: hlColor, transparent: true, opacity: 0.85 })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(pinPos.x, 0.08, pinPos.z);
    group.add(baseRing);

    const laser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8),
      new THREE.MeshBasicMaterial({ color: hlColor, transparent: true, opacity: 0.7 })
    );
    laser.position.set(pinPos.x, 1.68, pinPos.z);
    group.add(laser);

    const beaconHead = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    beaconHead.position.set(pinPos.x, 3.4, pinPos.z);
    group.add(beaconHead);
  }

  scene.add(group);
  geoHighlightGroupRef.current = group;
}, [selectedGeoFeature, hologram]);

// Synchronized 3D Asset Selection Highlight Beacon & Ring
useEffect(() => {
  const scene = sceneRef.current;
  if (!scene) return;

  if (assetHighlightGroupRef.current) {
    scene.remove(assetHighlightGroupRef.current);
    disposeThreeObject(assetHighlightGroupRef.current);
    assetHighlightGroupRef.current = null;
  }

  if (!selectedAssetId) return;

  const pos = getAssetPositionInWorld(scenario, selectedAssetId, mapPlaceId);
  if (!pos) return;

  const isMod = selectedAlternative?.modifications.some((m) => m.targetId === selectedAssetId);
  const hlColor = isMod ? 0x22d3ee : hologram ? 0x00f0ff : 0x06b6d4;

  const group = new THREE.Group();

  // Concentric ground beacon ring
  const groundRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.04, 8, 32),
    new THREE.MeshBasicMaterial({ color: hlColor, transparent: true, opacity: 0.9 })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.set(pos.x, 0.06, pos.z);
  group.add(groundRing);

  // Inner pulsing ring
  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.32, 24),
    new THREE.MeshBasicMaterial({ color: hlColor, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.set(pos.x, 0.065, pos.z);
  group.add(innerRing);

  // Vertical laser light beam
  const laser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8),
    new THREE.MeshBasicMaterial({ color: hlColor, transparent: true, opacity: 0.85 })
  );
  laser.position.set(pos.x, 1.36, pos.z);
  group.add(laser);

  // Beacon diamond pin
  const pin = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  pin.position.set(pos.x, 2.7, pos.z);
  group.add(pin);

  scene.add(group);
  assetHighlightGroupRef.current = group;

  return () => {
    if (assetHighlightGroupRef.current && scene) {
      scene.remove(assetHighlightGroupRef.current);
      disposeThreeObject(assetHighlightGroupRef.current);
      assetHighlightGroupRef.current = null;
    }
  };
}, [selectedAssetId, scenario, mapPlaceId, hologram, selectedAlternative]);

// =========================================================================
// EFFECT 1: PERSISTENT CORE THREE.JS SETUP (Mounts ONCE per canvas container)
// Completely eliminates context churn, flickering, and canvas destruction!
// =========================================================================
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 480;

  const scene = new THREE.Scene();
  const initialSky = hologram ? createHoloSkyTexture() : createDaylightSkyTexture();
  scene.background = initialSky;
  scene.fog = new THREE.FogExp2(hologram ? 0x01050e : 0xf1f5f9, hologram ? 0.00028 : 0.00014);
  sceneRef.current = scene;

  // High-precision near/far clipping (0.05 to 650) prevents near-plane cuts while keeping 24-bit depth precision
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 650);
  cameraRef.current = camera;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: false
    });
    rendererRef.current = renderer;
    setWebglUnavailable(false);
  } catch {
    setWebglUnavailable(true);
    return;
  }

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isWideAreaView ? 1.25 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = hologram ? 1.05 : 0.98;

  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererStr = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
    : '';
  const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererStr);

  if (!isSoftwareGl) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } else {
    setReducedDetailMode(true);
    setShowPerformanceNotice(true);
  }

  // Attach to DOM
  container.innerHTML = '';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  // Context loss / restoration listeners
  const domElem = renderer.domElement;
  const handleContextLost = (e: Event) => {
    e.preventDefault();
    console.warn('WebGL context lost. Pausing rendering.');
    isRenderingActiveRef.current = false;
    setWebglUnavailable(true);
  };
  const handleContextRestored = () => {
    console.info('WebGL context restored. Rebuilding scene graph.');
    setWebglUnavailable(false);
    isRenderingActiveRef.current = true;
    setContextRestoreNonce((n) => n + 1);
  };
  domElem.addEventListener('webglcontextlost', handleContextLost, false);
  domElem.addEventListener('webglcontextrestored', handleContextRestored, false);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.03
  ).texture;

  // Natural daylight illumination for Normal 3D, cybernetic cyan/blue for Holographic 3D
  const ambientLight = new THREE.AmbientLight(
    hologram ? 0x38bdf8 : 0xffffff,
    hologram ? 0.70 : 0.85
  );
  scene.add(ambientLight);

  const keySunLight = new THREE.DirectionalLight(
    hologram ? 0x38bdf8 : 0xfffaed,
    hologram ? 1.5 : 1.35
  );
  keySunLight.position.set(110, 135, 80);
  scene.add(keySunLight);

  const skyFillLight = new THREE.DirectionalLight(
    hologram ? 0x0284c7 : 0xdbeafe,
    hologram ? 0.6 : 0.65
  );
  skyFillLight.position.set(-90, 75, -80);
  scene.add(skyFillLight);

  const rimLightAmber = new THREE.DirectionalLight(
    hologram ? 0x0284c7 : 0xf1f5f9,
    hologram ? 0.4 : 0.45
  );
  rimLightAmber.position.set(-60, 50, 120);
  scene.add(rimLightAmber);

  lightsRef.current = { ambientLight, keySunLight, skyFillLight, rimLightAmber };

  const baseGroup = new THREE.Group();
  scene.add(baseGroup);
  baseGroupRef.current = baseGroup;

  const contextGroup = new THREE.Group();
  scene.add(contextGroup);
  contextGroupRef.current = contextGroup;

  const scenarioGroup = new THREE.Group();
  scene.add(scenarioGroup);
  scenarioGroupRef.current = scenarioGroup;

  const flowGroup = new THREE.Group();
  scene.add(flowGroup);
  flowGroupRef.current = flowGroup;

  const selectedLandmarkMarker = new THREE.Group();
  const selectedLandmarkDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
  );
  selectedLandmarkDot.position.y = 0.58;
  const selectedLandmarkHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.05, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
  );
  selectedLandmarkHalo.rotation.x = -Math.PI / 2;
  selectedLandmarkHalo.position.y = 0.2;
  selectedLandmarkMarker.add(selectedLandmarkDot, selectedLandmarkHalo);
  selectedLandmarkMarker.visible = false;
  scene.add(selectedLandmarkMarker);
  selectedLandmarkMarkerRef.current = selectedLandmarkMarker;

  const regionalWorldSize = getWorldDimensions(REGIONAL_BOUNDS);
  const groundSpan = Math.max(2600, regionalWorldSize.width * 6);
  let groundMat: THREE.Material;
  if (hologram) {
    const cyberGround = createCyberGroundMaterial();
    activeGroundMaterialRef.current = cyberGround;
    groundMat = cyberGround;
  } else {
    const daylightGround = createDaylightGroundMaterial();
    activeGroundMaterialRef.current = daylightGround;
    groundMat = daylightGround;
  }
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSpan, groundSpan),
    groundMat
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.01;
  groundMesh.renderOrder = 0;
  baseGroup.add(groundMesh);
  groundMeshRef.current = groundMesh;

  let destroyed = false;
  isDestroyedRef.current = false;

  // Resize Handler
  const updateSize = () => {
    if (destroyed || !containerRef.current || !rendererRef.current || !cameraRef.current) return;
    const c = containerRef.current;
    const w = c.clientWidth || containerWrapperRef.current?.clientWidth || 800;
    const h = c.clientHeight || containerWrapperRef.current?.clientHeight || 480;
    if (w <= 0 || h <= 0) return;
    cameraRef.current.aspect = w / h;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(w, h, false);
    const isWide = stateRef.current.isWideAreaView;
    rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, isWide ? 1.25 : 1.75));
  };
  updateSizeRef.current = updateSize;

  const resizeObserver = new ResizeObserver(() => updateSize());
  resizeObserver.observe(container);

  // Pointer Interaction Handlers
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let isDragging = false;
  let pointerDownPos = { x: 0, y: 0 };
  let lastPos = { x: 0, y: 0 };

  const handlePointerDown = (e: PointerEvent) => {
    isDragging = true;
    cameraFlightRef.current = null;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    lastPos = { x: e.clientX, y: e.clientY };
    try {
      domElem.setPointerCapture(e.pointerId);
    } catch { }
  };

  const handlePointerMove = (e: PointerEvent) => {
    const rect = domElem.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (isDragging) {
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      if (e.shiftKey || e.button === 1 || e.button === 2) {
        const az = stateRef.current.cameraAzimuth;
        const panScale = Math.max(0.006, stateRef.current.cameraDistance * 0.00085);
        const deltaForward = dy * panScale;
        const deltaRight = -dx * panScale;
        const deltaX = deltaRight * Math.cos(az) + deltaForward * Math.sin(az);
        const deltaZ = -deltaRight * Math.sin(az) + deltaForward * Math.cos(az);
        setCameraPanX((p) => p + deltaX);
        setCameraPanZ((p) => p + deltaZ);
      } else {
        setCameraAzimuth((prev) => prev - dx * 0.007);
        setCameraElevation((prev) =>
          Math.max(0.20, Math.min(1.42, prev + dy * 0.006))
        );
      }
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const mapHits = raycaster.intersectObjects(mapPlaceHitTargetsRef.current, true);
    if (mapHits.length > 0) {
      setHoveredAsset(null);
      domElem.style.cursor = 'pointer';
      return;
    }
    const hits = raycaster.intersectObjects(interactableMeshesRef.current, true);
    if (hits.length > 0) {
      const hitId = hits[0].object.userData.assetId;
      const meta = hitId ? assetMetaByIdRef.current.get(hitId) : null;
      setHoveredAsset(meta || null);
      domElem.style.cursor = 'pointer';
    } else {
      setHoveredAsset(null);
      domElem.style.cursor = 'grab';
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    try {
      domElem.releasePointerCapture(e.pointerId);
    } catch { }

    if (!isDragging) return;
    isDragging = false;
    const moveDist = Math.hypot(
      e.clientX - pointerDownPos.x,
      e.clientY - pointerDownPos.y
    );

    if (moveDist < 6) {
      const rect = domElem.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const mapHits = raycaster.intersectObjects(mapPlaceHitTargetsRef.current, true);
      if (mapHits.length > 0) {
        const hitData = mapHits[0].object.userData as {
          mapPlaceId?: string;
          landmark?: NamedMapLandmark;
        };
        const currentCamera = stateRef.current;
        const aspect = camera.aspect || 1.5;
        let targetPoint: THREE.Vector3;
        let targetDistance: number;

        if (hitData.mapPlaceId) {
          const place = getMapPlace(hitData.mapPlaceId, resolvedPlacesRef.current);
          const isDifferentArea = hitData.mapPlaceId !== stateRef.current.mapPlaceId;
          if (isDifferentArea && onSelectMapPlaceRef.current) {
            onSelectMapPlaceRef.current(place.id);
            return;
          }
          const center = getMapPlaceWorldPosition(place.id, resolvedPlacesRef.current);
          targetPoint = new THREE.Vector3(center.x, 0, center.z);
          targetDistance = getLandmarkFocusDistance(stateRef.current.mapPlaceId, aspect);
        } else if (hitData.landmark) {
          const landmark = hitData.landmark;
          targetPoint = geographicToWorld(landmark.lon, landmark.lat, 0);
          targetDistance = getLandmarkFocusDistance(stateRef.current.mapPlaceId, aspect);
          selectedMapLandmarkRef.current = landmark;
        } else {
          targetPoint = new THREE.Vector3(currentCamera.cameraPanX, 0, currentCamera.cameraPanZ);
          targetDistance = currentCamera.cameraDistance;
        }

        cameraFlightRef.current = {
          fromX: currentCamera.cameraPanX,
          fromZ: currentCamera.cameraPanZ,
          fromDistance: currentCamera.cameraDistance,
          fromAzimuth: currentCamera.cameraAzimuth,
          fromElevation: currentCamera.cameraElevation,
          toX: targetPoint.x,
          toZ: targetPoint.z,
          toDistance: targetDistance,
          toAzimuth: currentCamera.cameraAzimuth,
          toElevation: currentCamera.cameraElevation,
          startedAt: performance.now(),
          durationMs: reducedMotion ? 0 : 880
        };
        return;
      }

      const hits = raycaster.intersectObjects(interactableMeshesRef.current, true);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.assetId;
        if (hitId && assetMetaByIdRef.current.has(hitId)) {
          const meta = assetMetaByIdRef.current.get(hitId)!;
          onSelectAssetRef.current(hitId);
          setSelectedAssetMeta(meta);

          if (mapMode === 'location-selection') {
            const hitPos = hits[0].point;
            const currentPlace = resolvedPlacesRef.current.find(
              (p) => p.id === stateRef.current.mapPlaceId
            );
            const pickedModeledAsset: PickedGeographicFeature = {
              id: hitId,
              title: meta.name,
              category: scenario.domain === 'traffic' ? 'road' : scenario.domain === 'water' ? 'water_supply' : 'power',
              subtitle: `Modeled ${scenario.domain === 'traffic' ? 'Traffic Corridor' : scenario.domain === 'water' ? 'Water Asset' : 'Grid Asset'}`,
              provenance: 'synthetic_solver_topology',
              provenanceLabel: 'Modeled Network Topology',
              lat: currentPlace?.lat || 16.48,
              lon: currentPlace?.lon || 80.69,
              worldPos: { x: hitPos.x, y: hitPos.y, z: hitPos.z },
              targetCameraDistance: 24,
              details: [
                { label: 'Network Type', value: meta.type },
                { label: 'Status', value: meta.statusBadgeText },
                { label: 'Simulation Ready', value: 'Yes — Model topology active' }
              ]
            };
            setSelectedGeoFeature(pickedModeledAsset);
            onInspectFeature?.(pickedModeledAsset);
          } else {
            setSelectedGeoFeature(null);
            onInspectFeature?.(null);
          }
        }
      } else {
        // Universal Geographic Feature Explorer: Raycast to ground plane
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const groundHit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, groundHit)) {
          const currentPlace = resolvedPlacesRef.current.find(
            (p) => p.id === stateRef.current.mapPlaceId
          );
          const picked = pickGeographicFeature(
            groundHit,
            osmMapData?.features || [],
            currentPlace?.label || 'Andhra Pradesh Study Region'
          );
          setSelectedGeoFeature(picked);
          setSelectedAssetMeta(null);
          onSelectAssetRef.current(null);
          onInspectFeature?.(picked);

          const currentCamera = stateRef.current;
          cameraFlightRef.current = {
            fromX: currentCamera.cameraPanX,
            fromZ: currentCamera.cameraPanZ,
            fromDistance: currentCamera.cameraDistance,
            fromAzimuth: currentCamera.cameraAzimuth,
            fromElevation: currentCamera.cameraElevation,
            toX: groundHit.x,
            toZ: groundHit.z,
            toDistance: Math.min(currentCamera.cameraDistance, picked.targetCameraDistance || 16),
            toAzimuth: currentCamera.cameraAzimuth,
            toElevation: currentCamera.cameraElevation,
            startedAt: performance.now(),
            durationMs: reducedMotion ? 0 : 720
          };
        }
      }
    }
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = domElem.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundHit = new THREE.Vector3();
    const hasHit = raycaster.ray.intersectPlane(groundPlane, groundHit);

    // Normalize delta across browsers, precision trackpads, and fine-scroll wheels
    const rawDelta = event.deltaY;
    const normalizedDelta =
      event.deltaMode === 1 ? rawDelta * 16 : event.deltaMode === 2 ? rawDelta * 100 : rawDelta;

    // Responsive exponential zoom with smooth damping
    const zoomSensitivity = 0.0018;
    const factor = Math.exp(THREE.MathUtils.clamp(normalizedDelta * zoomSensitivity, -0.35, 0.35));

    const currentDist = stateRef.current.cameraDistance;
    // Both mouse-wheel and toolbar zoom reach the exact same maximum geographic overview (MAX_CAMERA_DISTANCE = 160)
    // and close building inspection distance (MIN_CAMERA_DISTANCE = 0.35)
    const nextDistance = THREE.MathUtils.clamp(currentDist * factor, MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);

    if (hasHit && factor < 1.0 && Number.isFinite(groundHit.x) && Number.isFinite(groundHit.z)) {
      const pull = Math.min(0.40, (1 - factor) * 0.45);
      setCameraPanX((p) => THREE.MathUtils.clamp(p + (groundHit.x - p) * pull, -280, 280));
      setCameraPanZ((p) => THREE.MathUtils.clamp(p + (groundHit.z - p) * pull, -280, 280));
    }
    setCameraDistance(nextDistance);
  };

  const wrapperElem = containerWrapperRef.current;
  domElem.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  domElem.addEventListener('wheel', handleWheel, { passive: false });
  if (wrapperElem) {
    wrapperElem.addEventListener('wheel', handleWheel, { passive: false });
  }

  // Animation Loop
  let animFrameId = 0;
  let softTimerId: ReturnType<typeof setTimeout> | null = null;
  let simClock = 0;
  let lastFrameTime = performance.now();
  const frameTimes: number[] = [];

  const afterDraw = () => {
    if (destroyed) return;
    if (isSoftwareGl) {
      softTimerId = setTimeout(animate, 450);
    } else {
      animFrameId = requestAnimationFrame(animate);
    }
  };

  const animate = () => {
    if (destroyed || !isRenderingActiveRef.current) return;

    const now = performance.now();
    const frameDelta = now - lastFrameTime;
    lastFrameTime = now;

    if (activeBuildingMaterialRef.current?.uniforms?.uTime) {
      activeBuildingMaterialRef.current.uniforms.uTime.value = now * 0.001;
    }

    if (!isSoftwareGl) {
      frameTimes.push(frameDelta);
      if (frameTimes.length > 90) frameTimes.shift();
      if (frameTimes.length >= 60) {
        const slowCount = frameTimes.filter((d) => d > 35).length;
        if (slowCount > 25 && !reducedDetailMode) {
          setReducedDetailMode(true);
          setShowPerformanceNotice(true);
        }
      }
    }

    const {
      cameraAzimuth: az,
      cameraElevation: el,
      cameraDistance: baseDist,
      cameraPanX: panX,
      cameraPanZ: panZ,
      isPlaying: playing,
      playbackSpeed: speed,
      timelineProgress: progress,
      showContextBuildings: showCtx,
      showFlowParticles: showFlows,
      mapPlaceId: currentMapPlaceId,
      hologram: isHolo,
      isWideAreaView: isWide
    } = stateRef.current;

    let framePanX = panX;
    let framePanZ = panZ;
    let frameDistance = baseDist;
    let frameAzimuth = az;
    let frameElevation = el;
    const flight = cameraFlightRef.current;
    if (flight) {
      const progressFlight = flight.durationMs <= 0
        ? 1
        : Math.min(1, (performance.now() - flight.startedAt) / flight.durationMs);
      const eased = 1 - Math.pow(1 - progressFlight, 3);
      framePanX = THREE.MathUtils.lerp(flight.fromX, flight.toX, eased);
      framePanZ = THREE.MathUtils.lerp(flight.fromZ, flight.toZ, eased);
      frameDistance = THREE.MathUtils.lerp(flight.fromDistance, flight.toDistance, eased);
      frameAzimuth = THREE.MathUtils.lerp(flight.fromAzimuth, flight.toAzimuth, eased);
      frameElevation = THREE.MathUtils.lerp(flight.fromElevation, flight.toElevation, eased);
      if (progressFlight >= 1) {
        framePanX = flight.toX;
        framePanZ = flight.toZ;
        frameDistance = flight.toDistance;
        frameAzimuth = flight.toAzimuth;
        frameElevation = flight.toElevation;
        cameraFlightRef.current = null;
        setCameraPanX(flight.toX);
        setCameraPanZ(flight.toZ);
        setCameraDistance(flight.toDistance);
        setCameraAzimuth(flight.toAzimuth);
        setCameraElevation(flight.toElevation);
        flight.onComplete?.();
      }
    }

    contextGroup.visible = showCtx;
    flowGroup.visible = showFlows;

    camera.position.x = framePanX + frameDistance * Math.cos(frameElevation) * Math.sin(frameAzimuth);
    camera.position.y = frameDistance * Math.sin(frameElevation);
    camera.position.z = framePanZ + frameDistance * Math.cos(frameElevation) * Math.cos(frameAzimuth);
    camera.lookAt(framePanX, 0.2, framePanZ);
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);

    const fitDistance = getCameraFitDistance(currentMapPlaceId, camera.aspect || 1.5);
    const focusedLandmark = selectedMapLandmarkRef.current;
    if (selectedLandmarkMarkerRef.current) {
      selectedLandmarkMarkerRef.current.visible = focusedLandmark !== null;
      if (focusedLandmark) {
        selectedLandmarkMarkerRef.current.position.copy(
          geographicToWorld(focusedLandmark.lon, focusedLandmark.lat, 0.2)
        );
      }
    }

    if (osmTileLayerRef.current) osmTileLayerRef.current.group.visible = !isHolo;
    if (osmRoadOverlayRef.current) osmRoadOverlayRef.current.visible = isHolo || isWide;
    const areaOpacity = getAreaNameOpacity(frameDistance, fitDistance);
    const landmarkOpacity = getLandmarkNameOpacity(frameDistance, fitDistance);

    areaMarkerGroupsRef.current.forEach((group) => {
      group.visible = Boolean(layers.labels && areaOpacity > 0.01);
      group.traverse((child) => {
        const materialValue = (child as THREE.Mesh).material;
        const materials: THREE.Material[] = Array.isArray(materialValue)
          ? materialValue
          : [materialValue];
        materials.forEach((material) => {
          if (material instanceof THREE.Material && 'opacity' in material) {
            material.opacity = areaOpacity;
          }
        });
      });
    });

    landmarkMarkerGroupsRef.current.forEach((group) => {
      const landmarkVisibilityDistance = currentMapPlaceId === 'region'
        ? fitDistance * 0.82
        : fitDistance * 1.18;
      group.visible = Boolean(layers.labels && frameDistance <= landmarkVisibilityDistance);
    });

    const viewWidth = domElem.clientWidth || width;
    const viewHeight = domElem.clientHeight || height;
    const projectedLabel = (
      sprite: THREE.Sprite,
      labelId: string,
      priority: number,
      pixelWidth: number,
      pixelHeight: number
    ) => {
      const worldPosition = new THREE.Vector3();
      sprite.getWorldPosition(worldPosition);
      const projected = worldPosition.clone().project(camera);
      const distance = Math.max(1, camera.position.distanceTo(worldPosition));
      const pixelsPerWorldUnit = viewHeight / (
        2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
      );
      sprite.scale.set(pixelWidth / pixelsPerWorldUnit, pixelHeight / pixelsPerWorldUnit, 1);
      const candidate = {
        id: labelId,
        priority,
        x: ((projected.x + 1) / 2) * viewWidth,
        y: ((1 - projected.y) / 2) * viewHeight,
        width: pixelWidth,
        height: pixelHeight
      };
      return projected.z < -1 || projected.z > 1 ||
        candidate.x - candidate.width / 2 < 0 || candidate.x + candidate.width / 2 > viewWidth ||
        candidate.y - candidate.height / 2 < 0 || candidate.y + candidate.height / 2 > viewHeight
        ? null
        : candidate;
    };

    const projectedAreaLabels = areaLabelSpritesRef.current.flatMap((sprite) => {
      const candidate = projectedLabel(
        sprite,
        String(sprite.userData.mapPlaceId || ''),
        Number(sprite.userData.labelPriority) || 0,
        currentMapPlaceId === 'region' ? Number(sprite.userData.labelPixelWidth) || 112 : 148,
        currentMapPlaceId === 'region' ? 26 : 34
      );
      return candidate ? [candidate] : [];
    });
    const visibleAreaLabels = declutterMapLabelCandidates(
      projectedAreaLabels,
      currentMapPlaceId === 'region' ? 24 : 16,
      currentMapPlaceId === 'region' ? 5 : 4
    );
    areaLabelSpritesRef.current.forEach((sprite) => {
      const id = String(sprite.userData.mapPlaceId || '');
      const isSelectedOrHovered = id === currentMapPlaceId;
      const opacity = getAreaNameOpacity(frameDistance, fitDistance, isSelectedOrHovered);
      sprite.material.opacity = opacity;
      sprite.visible = Boolean(layers.labels && opacity > 0.01 && (isSelectedOrHovered || visibleAreaLabels.has(id)));
    });

    const projectedLandmarkLabels = landmarkLabelSpritesRef.current.flatMap((sprite) => {
      const candidate = projectedLabel(
        sprite,
        String(sprite.userData.osmLandmarkId || ''),
        Number(sprite.userData.labelPriority) || 0,
        172,
        40
      );
      return candidate ? [candidate] : [];
    });
    const visibleLandmarkLabels = declutterMapLabelCandidates(projectedLandmarkLabels, 16, 6);
    landmarkLabelSpritesRef.current.forEach((sprite) => {
      const id = String(sprite.userData.osmLandmarkId || '');
      const isSelectedOrHovered = Boolean(focusedLandmark && focusedLandmark.id === id);
      const opacity = getLandmarkNameOpacity(frameDistance, fitDistance, isSelectedOrHovered);
      sprite.material.opacity = opacity;
      sprite.visible = Boolean(layers.labels && opacity > 0.01 && (isSelectedOrHovered || visibleLandmarkLabels.has(id)));
    });

    const projectedWaterwayLabels = waterwayHighwayLabelSpritesRef.current.flatMap((sprite) => {
      const candidate = projectedLabel(
        sprite,
        String(sprite.userData.waterwayHighwayId || ''),
        Number(sprite.userData.labelPriority) || 0,
        155,
        36
      );
      return candidate ? [candidate] : [];
    });
    const visibleWaterwayLabels = declutterMapLabelCandidates(projectedWaterwayLabels, 14, 5);
    waterwayHighwayLabelSpritesRef.current.forEach((sprite) => {
      const id = String(sprite.userData.waterwayHighwayId || '');
      const opacity = frameDistance < fitDistance * 1.3 ? 0.94 : 0.55;
      sprite.material.opacity = opacity;
      sprite.visible = Boolean(layers.labels && opacity > 0.05 && visibleWaterwayLabels.has(id));
    });

    // Declutter Change Billboard Sprites in screen space so 3D badges never overlap or collide
    const projectedBeacons = changeBeaconSpritesRef.current.flatMap((sprite) => {
      const targetId = String(sprite.userData.targetId || '');
      const isSelected = targetId === selectedAssetId;
      const priority = isSelected ? 1000 : 200 - (Number(sprite.userData.index) || 0);
      const candidate = projectedLabel(
        sprite,
        targetId,
        priority,
        frameDistance > 28 ? 165 : 210,
        frameDistance > 28 ? 42 : 52
      );
      return candidate ? [candidate] : [];
    });
    const visibleBeacons = declutterMapLabelCandidates(
      projectedBeacons,
      14,
      frameDistance > 35 ? 3 : 8
    );
    changeBeaconSpritesRef.current.forEach((sprite) => {
      const targetId = String(sprite.userData.targetId || '');
      const isSelected = targetId === selectedAssetId;
      const isVisible = visibleBeacons.has(targetId) || isSelected;
      sprite.visible = Boolean(layers.interventions && isVisible);
    });

    if (!reducedMotion) {
      const step = playing ? 0.012 * speed : 0.003;
      simClock += reducedDetailMode ? step * 0.75 : step;
    }
    const timeOffset = simClock + progress * 0.02;

    animatedObjectsRef.current.forEach((item) => {
      const t = (timeOffset * item.speedFactor + item.phase) % 1;
      item.mesh.position.lerpVectors(item.pathStart, item.pathEnd, t);
    });

    if (activeBuildingMaterialRef.current?.uniforms?.uTime) {
      activeBuildingMaterialRef.current.uniforms.uTime.value = simClock;
    }
    if (activeGroundMaterialRef.current?.uniforms?.uTime) {
      activeGroundMaterialRef.current.uniforms.uTime.value = simClock;
    }

    renderer.render(scene, camera);
    afterDraw();
  };

  animate();

  return () => {
    destroyed = true;
    isDestroyedRef.current = true;
    scenarioGroupRef.current = null;
    flowGroupRef.current = null;
    contextGroupRef.current = null;
    baseGroupRef.current = null;
    lightsRef.current = null;
    groundMeshRef.current = null;
    selectedLandmarkMarkerRef.current = null;
    rendererRef.current = null;
    sceneRef.current = null;
    cameraRef.current = null;

    cancelAnimationFrame(animFrameId);
    if (softTimerId !== null) clearTimeout(softTimerId);
    resizeObserver.disconnect();
    domElem.removeEventListener('webglcontextlost', handleContextLost);
    domElem.removeEventListener('webglcontextrestored', handleContextRestored);
    domElem.removeEventListener('wheel', handleWheel);
    if (wrapperElem) {
      wrapperElem.removeEventListener('wheel', handleWheel);
    }
    domElem.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);

    if (activeGroundMaterialRef.current) {
      activeGroundMaterialRef.current.dispose();
      activeGroundMaterialRef.current = null;
    }

    if (osmTileLayerRef.current) {
      osmTileLayerRef.current.dispose();
      osmTileLayerRef.current = null;
    }

    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.LineSegments ||
        object instanceof THREE.Points
      ) {
        if (!object.userData.sharedOsmGeometry) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material instanceof THREE.Material) {
            const map = (material as THREE.MeshBasicMaterial).map;
            if (map) map.dispose();
            material.dispose();
          }
        });
      } else if (object instanceof THREE.Sprite) {
        const material = object.material;
        if (material.map) material.map.dispose();
        material.dispose();
      }
    });
    pmremGenerator.dispose();
    renderer.dispose();
  };
}, [contextRestoreNonce]);

// =========================================================================
// EFFECT 2: IN-PLACE THEME SWITCHING (0ms transition, no context recreation!)
// =========================================================================
useEffect(() => {
  const scene = sceneRef.current;
  const renderer = rendererRef.current;
  const lights = lightsRef.current;
  const ground = groundMeshRef.current;
  if (!scene || !renderer || !lights || !ground) return;

  const skyTex = hologram ? createHoloSkyTexture() : createDaylightSkyTexture();
  scene.background = skyTex;
  scene.fog = new THREE.FogExp2(hologram ? 0x01050e : 0xf1f5f9, hologram ? 0.00028 : 0.00014);
  renderer.toneMappingExposure = hologram ? 1.10 : 1.02;

  lights.ambientLight.color.setHex(hologram ? 0x38bdf8 : 0xffffff);
  lights.ambientLight.intensity = hologram ? 0.70 : 0.85;

  lights.keySunLight.color.setHex(hologram ? 0x38bdf8 : 0xfffaed);
  lights.keySunLight.intensity = hologram ? 1.5 : 1.35;

  lights.skyFillLight.color.setHex(hologram ? 0x0284c7 : 0xdbeafe);
  lights.skyFillLight.intensity = hologram ? 0.6 : 0.65;

  lights.rimLightAmber.color.setHex(hologram ? 0x0284c7 : 0xf1f5f9);
  lights.rimLightAmber.intensity = hologram ? 0.4 : 0.45;

  const currentGroundMat = Array.isArray(ground.material) ? ground.material[0] : ground.material;
  if (hologram) {
    currentGroundMat?.dispose();
    const cyberMat = createCyberGroundMaterial();
    ground.material = cyberMat;
    activeGroundMaterialRef.current = cyberMat;
  } else {
    currentGroundMat?.dispose();
    const daylightMat = createDaylightGroundMaterial();
    ground.material = daylightMat;
    activeGroundMaterialRef.current = daylightMat;
  }
}, [hologram]);

// =========================================================================
// EFFECT 3: CONTEXT GROUP POPULATION (OSM Buildings, Roads, Rail, Landmarks)
// Rebuilds only contextGroup meshes without resetting the WebGL context
// =========================================================================
useEffect(() => {
  const contextGroup = contextGroupRef.current;
  if (!contextGroup) return;

  if (osmTileLayerRef.current) {
    osmTileLayerRef.current.dispose();
    osmTileLayerRef.current = null;
  }

  while (contextGroup.children.length > 0) {
    const child = contextGroup.children[0];
    contextGroup.remove(child);
    disposeThreeObject(child);
  }

  areaMarkerGroupsRef.current = [];
  areaLabelSpritesRef.current = [];
  landmarkMarkerGroupsRef.current = [];
  landmarkLabelSpritesRef.current = [];
  const mapPlaceHitTargets: THREE.Object3D[] = [];

  const attachMapHitData = (
    target: THREE.Object3D,
    data: { mapPlaceId?: string; landmark?: NamedMapLandmark }
  ) => {
    target.traverse((child) => Object.assign(child.userData, data));
    mapPlaceHitTargets.push(target);
  };

  const container = containerRef.current;
  const width = container?.clientWidth || 800;
  const height = container?.clientHeight || 480;
  const mapBounds = getMapBounds(mapPlaceId, resolvedPlacesRef.current);
  const fittedMapBounds = fitMapBoundsToAspect(mapBounds, width, height);
  const mapViewportBounds = expandMapBounds(fittedMapBounds, 1.22);

  if (!hologram) {
    const tileLayer = addOSMTileLayer(
      contextGroup,
      mapViewportBounds,
      getMapTileZoom(mapPlaceId)
    );
    osmTileLayerRef.current = tileLayer;
  } else {
    const regionalWorldSize = getWorldDimensions(REGIONAL_BOUNDS);
    const gridSize = Math.max(regionalWorldSize.width, regionalWorldSize.depth);
    const hologramGrid = new THREE.GridHelper(
      gridSize,
      mapPlaceId === 'region' ? 96 : 48,
      0x00f0ff,
      0x034a75
    );
    hologramGrid.position.y = 0.005;
    hologramGrid.renderOrder = 1;
    const gridMaterials = Array.isArray(hologramGrid.material)
      ? hologramGrid.material
      : [hologramGrid.material];
    gridMaterials.forEach((material, index) => {
      material.transparent = true;
      material.opacity = index === 0 ? 0.45 : 0.22;
      material.depthWrite = false;
    });
    contextGroup.add(hologramGrid);
  }

  // Real OSM Landcover Surfaces (parks, gardens, greenery, paved plazas, yards)
  if (osmLandcoverGeometry) {
    const landcoverMesh = new THREE.Mesh(
      osmLandcoverGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    landcoverMesh.renderOrder = 1;
    landcoverMesh.userData.sharedOsmGeometry = true;
    contextGroup.add(landcoverMesh);
  }

  // Extruded OSM Building geometry with realistic procedural shaders
  if (osmBuildingGeometry) {
    if (activeBuildingMaterialRef.current) {
      activeBuildingMaterialRef.current.dispose();
    }
    const bldgMat = hologram
      ? createHolographicBuildingMaterial({ differenceMode })
      : createDaylightBuildingMaterial({ differenceMode });
    activeBuildingMaterialRef.current = bldgMat;

    const buildingMesh = new THREE.Mesh(osmBuildingGeometry, bldgMat);
    buildingMesh.renderOrder = 3;
    buildingMesh.visible = layers.buildings;
    buildingMesh.userData.sharedOsmGeometry = true;
    contextGroup.add(buildingMesh);
  }

  // Building outlines: In Daylight mode, provide subtle architectural edges;
  // In Hologram mode, the GPU shader createHolographicBuildingMaterial renders crisp cyber laser floors,
  // columns, and Fresnel rims with distance-attenuated LOD (avoiding over-saturated raw line clutter).
  if (osmBuildingOutlineGeometry && !hologram && !isWideAreaView) {
    const buildingEdges = new THREE.LineSegments(
      osmBuildingOutlineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x475569,
        transparent: true,
        opacity: 0.15,
        depthWrite: false
      })
    );
    buildingEdges.renderOrder = 3.5;
    buildingEdges.visible = layers.buildings;
    buildingEdges.userData.sharedOsmGeometry = true;
    contextGroup.add(buildingEdges);
  }

  // 1. Physical 3D Road Network Ribbons (Asphalt corridors with physical widths for highways, arterials, secondary connectors, and local streets)
  const roadRibbonGeo = osmRoadNetworkRibbonGeometry || osmArterialRibbonGeometry;
  if (roadRibbonGeo) {
    const roadRibbons = new THREE.Mesh(
      roadRibbonGeo,
      hologram
        ? new THREE.MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          side: THREE.DoubleSide
        })
        : new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide
        })
    );
    roadRibbons.renderOrder = 3.2;
    roadRibbons.visible = layers.roads;
    roadRibbons.userData.sharedOsmGeometry = true;
    contextGroup.add(roadRibbons);
  }

  // 2. Highway & Arterial Center Lane Markings (Crisp off-white / cyan road dividing lines)
  if (osmLaneMarkingsGeometry) {
    const laneMarkings = new THREE.Mesh(
      osmLaneMarkingsGeometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: hologram ? 0.95 : 0.85,
        side: THREE.DoubleSide
      })
    );
    laneMarkings.renderOrder = 3.3;
    laneMarkings.visible = layers.roads;
    laneMarkings.userData.sharedOsmGeometry = true;
    contextGroup.add(laneMarkings);
  }

  // 3. Natural Greenery & Vegetation Canopy Clusters (strictly placed within verified OSM green polygons)
  if (osmVegetationMesh) {
    osmVegetationMesh.renderOrder = 3.4;
    osmVegetationMesh.visible = layers.vegetation;
    osmVegetationMesh.userData.sharedOsmGeometry = true;
    contextGroup.add(osmVegetationMesh);
  }

  if (osmWaterwayRibbonGeometry) {
    const waterways = new THREE.Mesh(
      osmWaterwayRibbonGeometry,
      new THREE.MeshStandardMaterial({
        color: hologram ? 0x011b30 : 0x1e3a5f,
        emissive: hologram ? 0x00334d : 0x000000,
        emissiveIntensity: hologram ? 0.28 : 0.0,
        roughness: 0.15,
        metalness: 0.85,
        transparent: true,
        opacity: hologram ? 0.85 : 0.95,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    waterways.renderOrder = 2.9;
    waterways.userData.sharedOsmGeometry = true;
    contextGroup.add(waterways);
  }

  if (osmMajorRoadGeometry) {
    const majorRoads = new THREE.LineSegments(
      osmMajorRoadGeometry,
      new THREE.LineBasicMaterial({
        color: hologram ? 0x00f0ff : 0x334155,
        transparent: true,
        opacity: hologram ? 0.95 : 0.85
      })
    );
    majorRoads.renderOrder = 2.8;
    majorRoads.visible = layers.roads;
    majorRoads.userData.sharedOsmGeometry = true;
    osmRoadOverlayRef.current = majorRoads;
    contextGroup.add(majorRoads);
  } else {
    osmRoadOverlayRef.current = null;
  }

  // Smart City IoT Sensor Beacons (matching Image 2 glowing amber/yellow nodes)
  if (hologram && osmMapData?.features) {
    const sensorNodesGeo = createCyberSensorNodesGeometry(osmMapData.features, osmAreaBounds);
    if (sensorNodesGeo) {
      if (!sensorBeaconTextureRef.current) {
        sensorBeaconTextureRef.current = createSensorBeaconTexture();
      }
      const sensorPoints = new THREE.Points(
        sensorNodesGeo,
        new THREE.PointsMaterial({
          map: sensorBeaconTextureRef.current,
          color: 0xfbbf24,
          size: 0.32,
          sizeAttenuation: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      sensorPoints.renderOrder = 6;
      contextGroup.add(sensorPoints);
    }
  }

  if (osmLocalRoadGeometry) {
    const localRoads = new THREE.LineSegments(
      osmLocalRoadGeometry,
      new THREE.LineBasicMaterial({
        color: hologram ? 0x0369a1 : 0x64748b,
        transparent: true,
        opacity: hologram ? 0.45 : 0.50
      })
    );
    localRoads.renderOrder = 2.2;
    localRoads.visible = layers.roads;
    localRoads.userData.sharedOsmGeometry = true;
    contextGroup.add(localRoads);
  }

  if (osmRailwayGeometry) {
    const railways = new THREE.LineSegments(
      osmRailwayGeometry,
      new THREE.LineBasicMaterial({
        color: hologram ? 0x67e8f9 : 0xe2e8f0,
        transparent: true,
        opacity: hologram ? 0.55 : 0.52
      })
    );
    railways.renderOrder = 2.5;
    railways.userData.sharedOsmGeometry = true;
    contextGroup.add(railways);
  }

  if (osmPowerLineGeometry) {
    const powerLines = new THREE.LineSegments(
      osmPowerLineGeometry,
      new THREE.LineBasicMaterial({ color: hologram ? 0x6ef4ff : 0xfbbf24, transparent: true, opacity: 0.95 })
    );
    powerLines.renderOrder = 4;
    powerLines.userData.sharedOsmGeometry = true;
    contextGroup.add(powerLines);
  }

  if (osmWaterwayGeometry) {
    const waterways = new THREE.LineSegments(
      osmWaterwayGeometry,
      new THREE.LineBasicMaterial({ color: hologram ? 0x20cfff : 0x38bdf8, transparent: true, opacity: 0.9 })
    );
    waterways.renderOrder = 3;
    waterways.userData.sharedOsmGeometry = true;
    contextGroup.add(waterways);
  }

  if (osmPowerPointGeometry) {
    const powerPoints = new THREE.Points(
      osmPowerPointGeometry,
      new THREE.PointsMaterial({ color: hologram ? 0x6ef4ff : 0xfbbf24, size: 0.12, sizeAttenuation: true })
    );
    powerPoints.userData.sharedOsmGeometry = true;
    powerPoints.renderOrder = 4;
    contextGroup.add(powerPoints);
  }

  if (osmWaterFacilityGeometry) {
    const waterFacilities = new THREE.Points(
      osmWaterFacilityGeometry,
      new THREE.PointsMaterial({ color: hologram ? 0x20cfff : 0x38bdf8, size: 0.26, sizeAttenuation: true })
    );
    waterFacilities.userData.sharedOsmGeometry = true;
    waterFacilities.renderOrder = 5;
    contextGroup.add(waterFacilities);
  }

  // Campus boundary outline
  const campusFeature = osmMapData?.features?.find(
    (f) =>
      f.kind === 'amenity' &&
      f.amenity === 'college' &&
      (f.name?.includes('VVIT') || f.name?.includes('Vasireddy'))
  );
  if (campusFeature) {
    const coordinates = getFeatureCoordinates(campusFeature);
    const points = coordinates.map(([lon, lat]) => geographicToWorld(lon, lat, 0.12));
    const boundaryVertices: THREE.Vector3[] = [];
    for (let index = 0; index < points.length; index += 1) {
      boundaryVertices.push(points[index], points[(index + 1) % points.length]);
    }
    const campusOutline = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(boundaryVertices),
      new THREE.LineBasicMaterial({
        color: hologram ? 0x46f5ff : 0xfbbf24,
        transparent: true,
        opacity: 0.95
      })
    );
    campusOutline.renderOrder = 7;
    contextGroup.add(campusOutline);
  }

  // Area Markers & Labels (Only shown in high-altitude regional view; omitted in city closeups to keep urban canyons clean)
  const corePlaceIds = new Set(['nambur', 'vijayawada', 'tenali', 'guntur', 'amaravati']);
  const visibleAreaPlaces = mapPlaceId === 'region'
    ? resolvedPlacesRef.current
      .filter((entry) => {
        if (entry.id === 'region') return false;
        return (
          corePlaceIds.has(entry.id) ||
          entry.category === 'city' ||
          entry.category === 'town'
        );
      })
      .slice(0, 8)
    : [];

  for (const place of visibleAreaPlaces) {
    const point = geographicToWorld(place.lon, place.lat, 0.22);
    const isCore = corePlaceIds.has(place.id);
    const color = place.id === 'nambur' ? 0xfbbf24 : isCore ? 0x22d3ee : 0x38bdf8;
    const markerGroup = new THREE.Group();
    markerGroup.position.copy(point);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(
        mapPlaceId === 'region' ? (isCore ? 0.45 : 0.32) : 0.28,
        18,
        18
      ),
      new THREE.MeshStandardMaterial({
        color,
        emissive: hologram ? 0x00f0ff : color,
        emissiveIntensity: hologram ? 0.95 : 0.52,
        transparent: true,
        opacity: 0.94
      })
    );
    marker.position.y = 0.32;
    markerGroup.add(marker);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(
        mapPlaceId === 'region' ? (isCore ? 0.85 : 0.55) : 0.48,
        0.045,
        8,
        24
      ),
      new THREE.MeshBasicMaterial({ color: hologram ? 0x00f0ff : 0x67e8f9, transparent: true, opacity: 0.72 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.12;
    markerGroup.add(halo);
    contextGroup.add(markerGroup);
    areaMarkerGroupsRef.current.push(markerGroup);

    const label = place.id === 'nambur' ? 'VVITU · Nambur' : place.label;
    const texture = createPlaceLabel(label, hologram);
    if (texture) {
      const regionalLabelWidth = THREE.MathUtils.clamp(label.length * 0.30 + 1.2, 3.8, 6.4);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
      );
      sprite.position.set(0, mapPlaceId === 'region' ? 1.5 : 1.2, 0);
      sprite.scale.set(
        mapPlaceId === 'region' ? regionalLabelWidth : 6.4,
        mapPlaceId === 'region' ? 1.1 : 1.3,
        1
      );
      sprite.renderOrder = 8;
      sprite.userData.mapPlaceId = place.id;
      sprite.userData.labelPriority =
        place.id === 'nambur'
          ? 100
          : isCore
            ? 90
            : place.category === 'city'
              ? 84
              : place.category === 'town'
                ? 72
                : 54;
      sprite.userData.labelPixelWidth = Math.max(48, Math.min(138, label.length * 5.6 + 8));
      markerGroup.add(sprite);
      areaLabelSpritesRef.current.push(sprite);
    }
    attachMapHitData(markerGroup, { mapPlaceId: place.id });
  }

  // Landmark Markers & Labels (3D pin markers shown only in regional view; clean labels in city views)
  for (const landmark of namedMapLandmarks) {
    const landmarkGroup = new THREE.Group();
    landmarkGroup.position.copy(geographicToWorld(landmark.lon, landmark.lat, 0.2));
    const landmarkColor = landmark.category === 'Campus' ? 0xfbbf24 : 0x22d3ee;
    if (mapPlaceId === 'region') {
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.27, 1),
        new THREE.MeshStandardMaterial({
          color: landmarkColor,
          emissive: hologram ? 0x31dcff : landmarkColor,
          emissiveIntensity: hologram ? 0.42 : 0.48,
          metalness: 0.25,
          roughness: 0.24
        })
      );
      marker.position.y = 0.38;
      landmarkGroup.add(marker);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.026, 8, 20),
        new THREE.MeshBasicMaterial({ color: hologram ? 0x46d8e8 : 0x67e8f9, transparent: true, opacity: hologram ? 0.42 : 0.38 })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.18;
      landmarkGroup.add(halo);
    }
    const compactName = formatLandmarkName(landmark.name)
      .replace(/\bCollege of Engineering\b/gi, 'College of Eng.')
      .trim();
    const labelText = compactName.length > 34
      ? compactName.slice(0, 33).trimEnd() + '…'
      : compactName;
    const labelTexture = createPlaceLabel(labelText, hologram);
    if (labelTexture) {
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false, opacity: 0 })
      );
      label.position.set(0, mapPlaceId === 'region' ? 1.8 : 1.35, 0);
      label.scale.set(mapPlaceId === 'region' ? 7.4 : 6.0, mapPlaceId === 'region' ? 1.7 : 1.5, 1);
      label.renderOrder = 9;
      label.userData.osmLandmarkId = landmark.id;
      label.userData.labelPriority = landmark.priority;
      landmarkGroup.add(label);
      landmarkLabelSpritesRef.current.push(label);
    }
    contextGroup.add(landmarkGroup);
    landmarkMarkerGroupsRef.current.push(landmarkGroup);
    attachMapHitData(landmarkGroup, { landmark });
  }

  // Waterway & Highway Path Labels
  waterwayHighwayLabelSpritesRef.current = [];
  for (const item of waterwayAndHighwayLandmarks) {
    const isWater = item.category === 'Waterway';
    const texture = isWater
      ? createWaterwayLabel(item.name, hologram)
      : createHighwayLabel(item.name, hologram);
    if (texture) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, opacity: 0.9 })
      );
      const wPos = geographicToWorld(item.lon, item.lat, isWater ? 0.38 : 0.55);
      sprite.position.copy(wPos);
      sprite.scale.set(mapPlaceId === 'region' ? 7.6 : 6.2, mapPlaceId === 'region' ? 1.6 : 1.35, 1);
      sprite.renderOrder = 9;
      sprite.userData.waterwayHighwayId = item.id;
      sprite.userData.labelPriority = item.priority;
      sprite.userData.labelPixelWidth = 145;
      contextGroup.add(sprite);
      waterwayHighwayLabelSpritesRef.current.push(sprite);
    }
  }

  mapPlaceHitTargetsRef.current = mapPlaceHitTargets;
}, [
  mapPlaceId,
  hologram,
  waterwayAndHighwayLandmarks,
  osmBuildingGeometry,
  osmBuildingOutlineGeometry,
  osmLandcoverGeometry,
  osmArterialRibbonGeometry,
  osmRoadNetworkRibbonGeometry,
  osmLaneMarkingsGeometry,
  osmVegetationMesh,
  osmWaterwayRibbonGeometry,
  osmMajorRoadGeometry,
  osmLocalRoadGeometry,
  osmRailwayGeometry,
  osmPowerLineGeometry,
  osmWaterwayGeometry,
  osmPowerPointGeometry,
  osmWaterFacilityGeometry,
  namedMapLandmarks,
  isWideAreaView,
  contextRestoreNonce,
  layers.vegetation
]);

// Re-run scenario assets population whenever scenario changes or WebGL restores
useEffect(() => {
  updateScenarioAssets();
}, [updateScenarioAssets, contextRestoreNonce]);

// Synchronize selectedAssetId changes from external dropdown/2D view
useEffect(() => {
  if (!selectedAssetId) return;
  const found = allAssetsList.find((a) => a.id === selectedAssetId);
  if (found) setSelectedAssetMeta(found);
}, [selectedAssetId, allAssetsList]);

const filteredAssets = useMemo(() => {
  if (!assetFilterQuery.trim()) return allAssetsList;
  const q = assetFilterQuery.toLowerCase();
  return allAssetsList.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      a.statusBadgeText.toLowerCase().includes(q)
  );
}, [allAssetsList, assetFilterQuery]);

const focusLandmark = (landmark: NamedMapLandmark) => {
  setLandmarkSearchQuery('');
  const container = containerRef.current;
  const aspect = container?.clientHeight
    ? container.clientWidth / container.clientHeight
    : 1.5;

  if (landmark.placeId && landmark.placeId !== mapPlaceId && onSelectMapPlace) {
    pendingLandmarkFlightRef.current = landmark;
    onSelectMapPlace(landmark.placeId);
    return;
  }

  if (!isCoordinateWithinBounds([landmark.lon, landmark.lat], osmAreaBounds) && onSelectMapPlace) {
    const matchingPlace =
      resolvedPlaces.find(
        (place) =>
          place.id !== 'region' &&
          place.bounds &&
          isCoordinateWithinBounds([landmark.lon, landmark.lat], place.bounds)
      )?.id || 'region';
    pendingLandmarkFlightRef.current = landmark;
    onSelectMapPlace(matchingPlace);
    return;
  }

  const currentCamera = stateRef.current;
  const targetPoint = geographicToWorld(landmark.lon, landmark.lat, 0);
  cameraFlightRef.current = {
    fromX: currentCamera.cameraPanX,
    fromZ: currentCamera.cameraPanZ,
    fromDistance: currentCamera.cameraDistance,
    fromAzimuth: currentCamera.cameraAzimuth,
    fromElevation: currentCamera.cameraElevation,
    toX: targetPoint.x,
    toZ: targetPoint.z,
    toDistance: getLandmarkFocusDistance(mapPlaceId, aspect),
    toAzimuth: currentCamera.cameraAzimuth,
    toElevation: currentCamera.cameraElevation,
    startedAt: performance.now(),
    durationMs: reducedMotion ? 0 : 880
  };
  selectedMapLandmarkRef.current = landmark;
};

const focusAssetById = (assetId: string) => {
  const pos = componentPositionsRef.current[assetId];
  if (!pos) return;
  const currentCamera = stateRef.current;
  cameraFlightRef.current = {
    fromX: currentCamera.cameraPanX,
    fromZ: currentCamera.cameraPanZ,
    fromDistance: currentCamera.cameraDistance,
    fromAzimuth: currentCamera.cameraAzimuth,
    fromElevation: currentCamera.cameraElevation,
    toX: pos.x,
    toZ: pos.z,
    toDistance: Math.min(Math.max(currentCamera.cameraDistance * 0.45, 8.5), 18),
    toAzimuth: currentCamera.cameraAzimuth,
    toElevation: Math.min(currentCamera.cameraElevation, 0.82),
    startedAt: performance.now(),
    durationMs: reducedMotion ? 0 : 880
  };
};

const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
  const panStep = Math.max(0.06, cameraDistance * 0.02);
  const az = cameraAzimuth;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    setCameraPanX((p) => p + panStep * Math.sin(az));
    setCameraPanZ((p) => p + panStep * Math.cos(az));
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    setCameraPanX((p) => p - panStep * Math.sin(az));
    setCameraPanZ((p) => p - panStep * Math.cos(az));
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    setCameraPanX((p) => p - panStep * Math.cos(az));
    setCameraPanZ((p) => p + panStep * Math.sin(az));
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    setCameraPanX((p) => p + panStep * Math.cos(az));
    setCameraPanZ((p) => p - panStep * Math.sin(az));
  } else if (e.key === '+' || e.key === '=' || e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    setCameraDistance((d) => Math.max(MIN_CAMERA_DISTANCE, d / 1.15));
  } else if (e.key === '-' || e.key === '_' || e.key === 'q' || e.key === 'Q') {
    e.preventDefault();
    setCameraDistance((d) => Math.min(MAX_CAMERA_DISTANCE, d * 1.15));
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    handleFitBounds(true);
  }
};

const activeInspectMeta = hoveredAsset || selectedAssetMeta;

if (webglUnavailable) {
  return (
    <div className="w-full h-full min-h-[380px] rounded-2xl bg-slate-950 border border-amber-500/40 p-6 flex flex-col items-center justify-center text-center gap-3">
      <p className="text-sm font-bold text-amber-300">
        3D WebGL Hardware Context Unavailable on This Device
      </p>
      <p className="text-xs text-slate-400 max-w-md">
        All deterministic physics calculations remain active. Switch to the synchronized 2D Engineering Topology view to inspect all network assets.
      </p>
      {onFallbackTo2D && (
        <button
          type="button"
          onClick={onFallbackTo2D}
          className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400 text-xs font-bold text-cyan-300"
        >
          Open 2D Engineering Topology
        </button>
      )}
    </div>
  );
}

return (
  <div
    ref={containerWrapperRef}
    data-testid="digital-twin-3d"
    data-asset-count={allAssetsList.length}
    className={
      isFullscreen
        ? `fixed inset-0 z-50 w-screen h-screen ${hologram ? 'bg-[#020b18]' : 'bg-[#e2e8f0]'} select-none flex flex-col`
        : `relative w-full h-full min-h-[360px] sm:min-h-[430px] lg:min-h-[490px] rounded-2xl overflow-hidden ${hologram ? 'bg-[#020b18] border border-indigo-500/30' : 'bg-[#e2e8f0] border border-slate-300 shadow-md'
        } select-none flex-1`
    }
  >
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleCanvasKeyDown}
      className={`w-full h-full cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-cyan-500/40 ${hologram ? 'hologram-canvas' : ''}`}
      aria-label={`${hologram ? 'Holographic ' : ''}3D Infrastructure Digital Twin for ${scenario.title}. Use arrow keys or WASD to pan, plus/minus to zoom, R to reset.`}
    />

    {hologram && <div className="hologram-map-overlay" aria-hidden="true" />}

    {/* Dismissible Adaptive Quality Notice Banner */}
    {showPerformanceNotice && reducedDetailMode && (
      <div className="absolute top-16 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 border border-amber-500/40 text-[10px] text-amber-200 shadow-xl max-w-sm">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Reduced 3D quality active for smoother rendering on this device.</span>
        {onFallbackTo2D && (
          <button
            type="button"
            onClick={onFallbackTo2D}
            className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold border border-cyan-500/40 cursor-pointer"
          >
            2D Mode
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowPerformanceNotice(false)}
          className="text-slate-400 hover:text-white text-[10px] px-1 cursor-pointer"
          aria-label="Dismiss notice"
        >
          ✕
        </button>
      </div>
    )}

    {/* Top-Left HUD Stack: Solution / Baseline Status and Implemented Changes Strip */}
    {mapMode !== 'location-selection' && isMapHudVisible && (
      <div className="absolute top-3 left-3 z-20 flex flex-col items-start gap-1.5 max-w-[66%] sm:max-w-[70%] pointer-events-none">
        {/* Prominent Solution / Baseline Status Badge */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {selectedAlternative ? (
            <div className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-950/95 to-slate-950/95 border border-cyan-400/70 text-[11px] font-extrabold text-cyan-200 flex items-center gap-1.5 shadow-lg backdrop-blur-md">
              <span className="text-cyan-400 animate-pulse text-xs">★</span>
              <span>AFTER CHANGE · {selectedAlternative.name}</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-300 text-[9px] font-mono border border-cyan-500/40">
                {selectedAlternative.modifications.length} UPGRADED
              </span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/92 border border-slate-700/80 text-[11px] font-bold text-slate-300 flex items-center gap-1.5 shadow-lg backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>BEFORE CHANGE · Baseline Condition (0 Upgrades)</span>
            </div>
          )}
        </div>

        {/* Quick-Jump Implemented Changes Strip with Collapse Control */}
        {selectedAlternative && layers.interventions && (
          <div className="flex items-center gap-1.5 flex-wrap pointer-events-auto mt-0.5 max-w-full">
            <button
              type="button"
              onClick={() => setIsChangesStripExpanded((v) => !v)}
              className="text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider bg-slate-950/90 px-2 py-0.5 rounded-lg border border-cyan-500/40 hover:bg-slate-900 transition flex items-center gap-1 cursor-pointer shadow-sm"
              title={isChangesStripExpanded ? 'Minimize Changes Strip' : 'Expand Changes Strip'}
              aria-label={isChangesStripExpanded ? 'Minimize Changes Strip' : 'Expand Changes Strip'}
            >
              <span>⚡ Changes ({selectedAlternative.modifications.length})</span>
              {isChangesStripExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {isChangesStripExpanded && selectedAlternative.modifications.map((m) => {
              const isSelected = selectedAssetId === m.targetId;
              const isSig = m.property.includes('signal') || m.targetId.includes('cell-');
              const isPipe = m.targetId.includes('pipe');
              const isNode = m.targetId.includes('node');
              const isLine = m.targetId.includes('line');
              const icon = isSig ? '🚦' : isPipe ? '💧' : isNode ? '⚙️' : isLine ? '⚡' : '🛣️';
              return (
                <button
                  key={m.targetId}
                  type="button"
                  onClick={() => {
                    onSelectAsset(m.targetId);
                    focusAssetById(m.targetId);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border flex items-center gap-1 transition cursor-pointer backdrop-blur-md ${
                    isSelected
                      ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/60 shadow-md'
                      : 'bg-slate-950/80 border-slate-700/70 text-slate-300 hover:border-cyan-500/60 hover:text-white'
                  }`}
                  title={`Click to focus 3D camera on ${m.label}`}
                >
                  <span>{icon}</span>
                  <span className="font-semibold">{m.label.split(' - ')[0] || m.targetId}</span>
                  <span className="text-cyan-400 font-mono text-[9px]">
                    {m.originalValue}→{m.newValue}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {isComparisonView ? (
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/92 border border-slate-700/80 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg backdrop-blur-md">
              <span
                className={`w-2 h-2 rounded-full ${comparisonLabel.includes('BEFORE') ? 'bg-indigo-400' : 'bg-cyan-400'
                  }`}
              />
              <span className="font-mono">{comparisonLabel || `${scenario.domain.toUpperCase()} TWIN`}</span>
            </div>
            {differenceMode && (
              <div className="px-2 py-0.5 rounded-lg bg-indigo-950/90 border border-indigo-500/70 text-[10px] font-mono font-bold text-indigo-200 flex items-center gap-1 shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span>DIFF OVERLAY</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
              <div className="px-2.5 py-1 rounded-xl bg-slate-950/92 border border-slate-800 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg">
                <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{hologram ? 'HOLOGRAM 3D' : '3D Twin'} • {scenario.domain.toUpperCase()}</span>
                <span className="hidden sm:inline text-[10px] font-mono text-amber-300 ml-1">
                  ({allAssetsList.length} interactive assets)
                </span>
              </div>

              {differenceMode && (
                <div className="px-2.5 py-1 rounded-xl bg-purple-950/90 border border-purple-500/70 text-[10px] font-mono font-bold text-purple-200 flex items-center gap-1.5 shadow-lg animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>DIFFERENCE MODE: MODIFIED ASSETS HIGHLIGHTED</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/92 border border-slate-800 text-[11px] text-slate-200 shadow-lg">
                <Search className="w-3 h-3 text-cyan-400 shrink-0" />
                <input
                  type="text"
                  value={assetFilterQuery}
                  onChange={(e) => setAssetFilterQuery(e.target.value)}
                  placeholder="Filter asset..."
                  aria-label="Filter 3D twin components"
                  className="w-20 sm:w-24 bg-transparent text-[11px] text-white placeholder-slate-500 focus:outline-none"
                />
                <select
                  aria-label="Inspect Network Component"
                  value={activeInspectMeta?.id || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) {
                      onSelectAsset(null);
                      setSelectedAssetMeta(null);
                    } else {
                      onSelectAsset(id);
                      const found = allAssetsList.find((a) => a.id === id);
                      if (found) setSelectedAssetMeta(found);
                    }
                  }}
                  className="bg-slate-900 text-[11px] font-mono text-cyan-300 rounded px-1.5 py-0.5 max-w-[140px] sm:max-w-[180px] truncate cursor-pointer focus:outline-none"
                >
                  <option value="" className="bg-slate-950 text-slate-400">
                    All Assets (Overview)
                  </option>
                  {filteredAssets.map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-950 text-white">
                      {a.name} [{a.statusBadgeText}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="hidden xl:flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-slate-950/92 border border-slate-800 text-[10px] text-slate-300 shadow-lg">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  [OK] Nominal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  [WARN] Near Limit
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  [BREACH] Violation
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  [UPG] Upgraded
                </span>
              </div>
            </div>

            <div className="w-[min(19rem,calc(100vw-2.5rem))] pointer-events-auto relative">
              <div className="flex items-center gap-2 rounded-xl border border-slate-700/90 bg-slate-950/95 px-3 py-1.5 shadow-xl">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
                <input
                  type="search"
                  value={landmarkSearchQuery}
                  onChange={(event) => setLandmarkSearchQuery(event.target.value.slice(0, 100))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && landmarkSuggestions[0]) {
                      event.preventDefault();
                      focusLandmark(landmarkSuggestions[0]);
                    }
                    if (event.key === 'Escape') setLandmarkSearchQuery('');
                  }}
                  aria-label="Search mapped places, landmarks, or buildings"
                  aria-expanded={landmarkSearchQuery.trim().length >= 2}
                  aria-controls="map-landmark-suggestions"
                  placeholder="Search mapped places, landmarks, or buildings…"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-white placeholder:text-slate-500 focus:outline-none"
                />
                <span className="shrink-0 text-[9px] text-slate-500">
                  {allNamedMapLandmarks.length.toLocaleString()}
                </span>
              </div>
              {landmarkSearchQuery.trim().length >= 2 && (
                <div
                  id="map-landmark-suggestions"
                  role="listbox"
                  aria-label="Mapped places matching your search"
                  className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/98 p-1 shadow-2xl"
                >
                  {landmarkSuggestions.length > 0 ? landmarkSuggestions.map((landmark) => (
                    <button
                      key={landmark.id}
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => focusLandmark(landmark)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[10px] text-slate-200 transition hover:bg-cyan-500/10 hover:text-cyan-100"
                    >
                      <span className="min-w-0 truncate font-semibold">{formatLandmarkName(landmark.name)}</span>
                      <span className="shrink-0 text-[9px] text-slate-500">{landmark.category}</span>
                    </button>
                  )) : (
                    <p className="px-2.5 py-2 text-[10px] text-slate-400">No mapped place found. Try a shorter name.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )}

    {/* Top-Right Camera Framing, Quality, Fullscreen & Intelligent Layer Toggles */}
    {(!isComparisonView || !isSecondaryTwin) && (
      mapMode === 'location-selection' ? (
        !isMapHudVisible ? (
          <div className="absolute top-3 right-3 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={toggleMapHud}
              className="px-3 py-1.5 rounded-xl bg-slate-950/92 border border-cyan-500/50 text-xs font-semibold text-cyan-300 shadow-2xl backdrop-blur-md hover:bg-slate-900 hover:text-white transition flex items-center gap-2 cursor-pointer"
              title="Restore Map Navigation Controls"
              aria-label="Restore Map HUD"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Show Map HUD</span>
            </button>
          </div>
        ) : (
          <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-slate-950/92 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-2xl">
            <button
              type="button"
              onClick={() => setCameraDistance((distance) => Math.max(MIN_CAMERA_DISTANCE, distance / 1.25))}
              title="Zoom In"
              aria-label="Zoom In 3D Camera"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCameraDistance((distance) => Math.min(MAX_CAMERA_DISTANCE, distance * 1.25))}
              title="Zoom Out"
              aria-label="Zoom Out 3D Camera"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleFitBounds(true)}
              title="Fit Selected Map Area"
              aria-label="Reset 3D Camera View"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen 3D Twin'}
              aria-label="Toggle Fullscreen"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={toggleMapHud}
              title="Hide Navigation Controls"
              aria-label="Toggle Map HUD"
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer border-l border-slate-800 pl-2"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      ) : !isMapHudVisible ? (
        <div className="absolute top-3 right-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={toggleMapHud}
            className="px-3 py-1.5 rounded-xl bg-slate-950/92 border border-cyan-500/50 text-xs font-semibold text-cyan-300 shadow-2xl backdrop-blur-md hover:bg-slate-900 hover:text-white transition flex items-center gap-2 cursor-pointer"
            title="Restore Map HUD overlays and information cards"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Show Map HUD</span>
          </button>
        </div>
      ) : (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-slate-950/92 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-2xl">
          {/* Map HUD ON/OFF Toggle Button */}
          <button
            type="button"
            onClick={toggleMapHud}
            title="Hide Map HUD (Full-bleed 3D Canvas)"
            aria-label="Toggle Map HUD"
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-md shadow-cyan-500/20"
          >
            <EyeOff className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Map HUD</span>
          </button>

        {/* Layer Control Dropdown Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowLayerPanel((prev) => !prev);
              setShowLegendPanel(false);
            }}
            title="Configure Digital Twin Layers"
            aria-label="Digital Twin Layer Settings"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${showLayerPanel
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 hover:bg-slate-800'
              }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Layers</span>
            <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/50 text-[9px] flex items-center justify-center font-mono">
              {Object.values(layers).filter(Boolean).length}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showLayerPanel ? 'rotate-180' : ''}`} />
          </button>

          {/* Layer Settings Popover Panel */}
          {showLayerPanel && (
            <div className="absolute right-0 top-10 mt-1 w-64 p-3 rounded-2xl bg-slate-950/98 backdrop-blur-xl border border-slate-700 shadow-2xl z-50 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Twin Layer Controls
                </span>
                <button
                  type="button"
                  onClick={() => setShowLayerPanel(false)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  aria-label="Close layers"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {[
                  { key: 'buildings', label: '3D Buildings & Roofs', icon: Layers, desc: 'Real architectural footprints & materials' },
                  { key: 'roads', label: 'Roadways & Corridors', icon: Compass, desc: 'Arterials, ribbons & local streets' },
                  { key: 'vegetation', label: 'Parks & Vegetation', icon: Trees, desc: 'OSM parks & natural canopy clusters' },
                  { key: 'flow', label: 'Dynamic Flow Pulses', icon: Activity, desc: 'Vehicles, water flow & power pulses' },
                  { key: 'water', label: 'Water Distribution', icon: Droplets, desc: 'Pipes, tanks, reservoirs & pumps' },
                  { key: 'power', label: 'Electric Power Grid', icon: Zap, desc: 'High-voltage lines, pylons & substations' },
                  { key: 'hotspots', label: 'Problem Hotspots', icon: AlertTriangle, desc: 'Bottleneck & stress beacons' },
                  { key: 'interventions', label: 'Interventions & Upgrades', icon: GitBranch, desc: 'Solution upgrade rings & additions' },
                  { key: 'labels', label: 'Map Labels & Districts', icon: MapPin, desc: 'POIs, landmarks & municipal bounds' }
                ].map((item) => {
                  const Icon = item.icon;
                  const isChecked = layers[item.key as keyof typeof layers];
                  return (
                    <label
                      key={item.key}
                      className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${isChecked ? 'bg-slate-900/90 text-white' : 'text-slate-400 hover:bg-slate-900/40'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${isChecked ? 'text-cyan-400' : 'text-slate-500'}`} />
                        <div>
                          <div className="text-[11px] font-semibold">{item.label}</div>
                          <div className="text-[9px] text-slate-500">{item.desc}</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setLayers((prev) => ({ ...prev, [item.key]: val }));
                          if (item.key === 'buildings') setShowContextBuildings(val);
                          if (item.key === 'flow') setShowFlowParticles(val);
                        }}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setLayers({
                      buildings: true,
                      roads: true,
                      flow: true,
                      vegetation: true,
                      water: scenario.domain === 'water',
                      power: scenario.domain === 'energy',
                      hotspots: true,
                      interventions: true,
                      labels: true
                    });
                    setShowContextBuildings(true);
                    setShowFlowParticles(true);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  Reset Defaults
                </button>
                <span className="text-slate-500 font-mono text-[9px]">{scenario.domain.toUpperCase()} Profile</span>
              </div>
            </div>
          )}
        </div>

        {/* Legend Popover Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowLegendPanel((prev) => !prev);
              setShowLayerPanel(false);
            }}
            title="Inspect Domain Color Legend & Physics Thresholds"
            aria-label="Domain Status Legend"
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${showLegendPanel
              ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-400/50 shadow-md shadow-indigo-500/20'
              : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 hover:bg-slate-800'
              }`}
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Legend</span>
          </button>

          {/* Legend Popover Panel */}
          {showLegendPanel && (
            <div className="absolute right-0 top-10 mt-1 w-72 p-3 rounded-2xl bg-slate-950/98 backdrop-blur-xl border border-slate-700 shadow-2xl z-50 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                <span className="font-bold text-white flex items-center gap-1.5 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  {scenario.domain.toUpperCase()} Telemetry & Status Legend
                </span>
                <button
                  type="button"
                  onClick={() => setShowLegendPanel(false)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  aria-label="Close legend"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 text-[10px]">
                <div className="flex items-start gap-2 p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300">Nominal / Feasible: </span>
                    {scenario.domain === 'traffic'
                      ? 'Speed ≥ 22.0 km/h, density ≤ 70% jam'
                      : scenario.domain === 'water'
                        ? 'Pressure 180–550 kPa, velocity ≤ 2.0 m/s'
                        : 'Line loading ≤ 70%, nominal bus voltage'}
                  </div>
                </div>

                <div className="flex items-start gap-2 p-1.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300">Warning / Near Limit: </span>
                    {scenario.domain === 'traffic'
                      ? 'Queue density 70–80% jam, speed 18–22 km/h'
                      : scenario.domain === 'water'
                        ? 'Pressure 180–205 kPa (marginal head)'
                        : 'Line loading 70–100% of thermal rating'}
                  </div>
                </div>

                <div className="flex items-start gap-2 p-1.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-rose-300">Critical Breach / Hotspot: </span>
                    {scenario.domain === 'traffic'
                      ? 'Speed < 18 km/h or density > 80% jam'
                      : scenario.domain === 'water'
                        ? 'Pressure < 180 kPa (deficit) or > 550 kPa (burst danger)'
                        : 'Line loading > 100% (thermal overload)'}
                  </div>
                </div>

                <div className="flex items-start gap-2 p-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-cyan-300">Upgraded / Intervened: </span>
                    Modified infrastructure asset in active solution alternative
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800 text-[9.5px] text-slate-400">
                Governing Model: <span className="text-cyan-300 font-mono font-semibold">
                  {scenario.domain === 'traffic'
                    ? 'Cell Transmission Model (Daganzo)'
                    : scenario.domain === 'water'
                      ? 'Darcy-Weisbach / EPANET-grade'
                      : 'Linearized DC Power Flow (B-Matrix)'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* GPU & Graphics Quality Configuration Modal Trigger */}
        <button
          type="button"
          onClick={() => setShowGraphicsModal(true)}
          title="Configure GPU & Graphics Quality (High / Recommended / Performance / 2D)"
          aria-label="Graphics Quality Settings"
          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700/80 hover:bg-slate-800"
        >
          <Monitor className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">
            {reducedDetailMode ? 'Performance' : graphicsProfile === 'high' ? 'High Quality' : 'Balanced'}
          </span>
        </button>

        {/* Camera Navigation Controls */}
        <div className="flex items-center gap-1 border-l border-slate-800 pl-1.5">
          <button
            type="button"
            onClick={() => {
              const currentCamera = stateRef.current;
              const targetPoint = getMapPlaceWorldPosition(mapPlaceId, resolvedPlaces);
              const targetDist = mapPlaceId === 'region' ? 36 : 4.2;
              const targetAz = 0.55;
              const targetEl = 0.40;
              cameraFlightRef.current = {
                fromX: currentCamera.cameraPanX,
                fromZ: currentCamera.cameraPanZ,
                fromDistance: currentCamera.cameraDistance,
                fromAzimuth: currentCamera.cameraAzimuth,
                fromElevation: currentCamera.cameraElevation,
                toX: targetPoint.x,
                toZ: targetPoint.z,
                toDistance: targetDist,
                toAzimuth: targetAz,
                toElevation: targetEl,
                startedAt: performance.now(),
                durationMs: reducedMotion ? 0 : 750
              };
            }}
            title="Cinematic Aerial City View (Oblique Canyon Perspective)"
            aria-label="Cinematic Aerial City View"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-cyan-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-[11px] font-medium"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Aerial View</span>
          </button>
          <button
            type="button"
            onClick={() => setCameraDistance((distance) => Math.max(MIN_CAMERA_DISTANCE, distance / 1.25))}
            title="Zoom In"
            aria-label="Zoom In 3D Camera"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCameraDistance((distance) => Math.min(MAX_CAMERA_DISTANCE, distance * 1.25))}
            title="Zoom Out"
            aria-label="Zoom Out 3D Camera"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleFitBounds(true)}
            title="Fit Selected Map Area"
            aria-label="Reset 3D Camera View"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen 3D Twin'}
            aria-label="Toggle Fullscreen"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      )
    )}

    {/* Bottom-Left Selected Asset Telemetry / Compact Change Inspector Card */}
    {isMapHudVisible && mapMode !== 'location-selection' && activeInspectMeta && (() => {
      const activeMod = selectedAlternative?.modifications.find((m) => m.targetId === activeInspectMeta.id);
      if (activeMod && selectedAlternative && isChangeCardMinimized) {
        return (
          <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2 p-2 rounded-xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/50 shadow-xl pointer-events-auto">
            <span className="text-[9px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-lg">
              ★ {selectedAlternative.name}
            </span>
            <span className="text-xs font-bold text-white max-w-[130px] truncate">
              {activeInspectMeta.name}
            </span>
            <button
              type="button"
              onClick={() => setIsChangeCardMinimized(false)}
              title="Expand Change Information"
              aria-label="Expand Change Information"
              className="px-2 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold cursor-pointer transition"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectAsset(null);
                setSelectedAssetMeta(null);
              }}
              title="Dismiss Change Inspector"
              aria-label="Dismiss Change Inspector"
              className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
      return activeMod && selectedAlternative ? (
        <div className="absolute bottom-3 left-3 z-30 w-72 sm:w-80 p-3.5 rounded-2xl bg-slate-950/98 backdrop-blur-xl border border-cyan-500/50 shadow-2xl transition-all space-y-2.5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-300 border border-cyan-400/50 shadow-sm">
                  ★ {selectedAlternative.name}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  IMPLEMENTED CHANGE
                </span>
              </div>
              <h4 className="text-xs font-bold text-white mt-1.5 leading-snug">
                {activeInspectMeta.name}
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">
                {activeInspectMeta.type} • ID: {activeInspectMeta.id}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsChangeCardMinimized(true)}
                title="Minimize Change Information"
                aria-label="Minimize Change Information"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectAsset(null);
                  setSelectedAssetMeta(null);
                }}
                title="Dismiss Change Inspector"
                aria-label="Dismiss Change Inspector"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Parameter Delta Highlight */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2 space-y-1">
            <div className="text-[10px] text-slate-400 font-medium">Intervention Parameter:</div>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">{activeMod.property}:</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-rose-400 line-through text-[11px]">{activeMod.originalValue} {activeMod.unit}</span>
                <span className="text-slate-500">→</span>
                <span className="text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/40 text-[11px]">
                  {activeMod.newValue} {activeMod.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Physics Condition Before vs After */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-2 space-y-1">
              <div className="font-bold text-rose-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                BEFORE (BASELINE)
              </div>
              <div className="text-slate-300 font-mono text-[9px] space-y-0.5">
                <div>Parameter: <span className="font-bold text-rose-200">{activeMod.originalValue} {activeMod.unit}</span></div>
                <div className="text-rose-400/90">Bottleneck / Stress</div>
              </div>
            </div>
            <div className="bg-cyan-950/20 border border-cyan-900/40 rounded-xl p-2 space-y-1">
              <div className="font-bold text-cyan-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                AFTER (UPGRADED)
              </div>
              <div className="text-slate-300 font-mono text-[9px] space-y-0.5">
                <div>Parameter: <span className="font-bold text-cyan-200">{activeMod.newValue} {activeMod.unit}</span></div>
                <div className="text-emerald-400">Flow Alleviated</div>
              </div>
            </div>
          </div>

          {/* Provenance & Focus Action */}
          <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/80">
            <span className="text-[9px] text-slate-400 font-mono truncate" title="Model-derived simulation provenance">
              {scenario.domain === 'traffic'
                ? activeMod.property === 'signalGreenRatio'
                  ? 'CTM Signal Timing · 0 OSM physical signals'
                  : 'CTM Macro Flow Model'
                : scenario.domain === 'water'
                  ? 'Darcy-Weisbach Solver'
                  : 'DC Power Flow'}
            </span>
            <button
              type="button"
              onClick={() => focusAssetById(activeInspectMeta.id)}
              className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <Compass className="w-3 h-3 text-cyan-400" />
              Focus 3D View
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 z-30 w-64 sm:w-72 p-3 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl transition-all">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-white truncate">
              {activeInspectMeta.name}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${activeInspectMeta.status === 'critical'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : activeInspectMeta.status === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : activeInspectMeta.status === 'upgraded'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
              >
                {activeInspectMeta.statusBadgeText}
              </span>
              <button
                type="button"
                onClick={() => setIsInspectorExpanded((v) => !v)}
                title={isInspectorExpanded ? 'Collapse Inspector' : 'Expand Inspector'}
                aria-label={isInspectorExpanded ? 'Collapse Inspector' : 'Expand Inspector'}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 cursor-pointer"
              >
                {isInspectorExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectAsset(null);
                  setSelectedAssetMeta(null);
                }}
                title="Dismiss Inspector"
                aria-label="Dismiss Inspector"
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isInspectorExpanded && (
            <>
              <div className="text-[10px] text-slate-400 mt-1 mb-2 truncate">
                {activeInspectMeta.type} • ID: <span className="font-mono text-slate-300">{activeInspectMeta.id}</span>
              </div>
              <div className="space-y-1.5 border-t border-slate-800 pt-2">
                {activeInspectMeta.metrics.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] gap-2">
                    <span className="text-slate-400 shrink-0">{m.label}:</span>
                    <span className="font-mono font-bold text-cyan-300 truncate">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => focusAssetById(activeInspectMeta.id)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Compass className="w-3 h-3" /> Focus View
                </button>
              </div>
            </>
          )}
        </div>
      );
    })()}

    {/* Bottom-Left Geographic Feature Explorer Card */}
    {isMapHudVisible && mapMode !== 'location-selection' && selectedGeoFeature && !activeInspectMeta && (
      <div className="absolute bottom-3 left-3 z-30 w-72 sm:w-80 p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 shadow-2xl space-y-2">
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {selectedGeoFeature.category.toUpperCase()}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {selectedGeoFeature.provenance === 'osm_source_geometry' ? 'OSM Verified' : 'Terrain Reference'}
              </span>
            </div>
            <h4 className="text-xs font-bold text-white mt-1 leading-snug">
              {selectedGeoFeature.title}
            </h4>
            <p className="text-[10px] text-slate-400">
              {selectedGeoFeature.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedGeoFeature(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close feature inspector"
            aria-label="Close feature inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1 text-[10px]">
          {selectedGeoFeature.details.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-slate-400">
              <span>{d.label}:</span>
              <span className="font-mono font-semibold text-slate-200">{d.value}</span>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <span className="text-[9px] text-slate-500 truncate">
            {selectedGeoFeature.provenanceLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              const currentCamera = stateRef.current;
              cameraFlightRef.current = {
                fromX: currentCamera.cameraPanX,
                fromZ: currentCamera.cameraPanZ,
                fromDistance: currentCamera.cameraDistance,
                fromAzimuth: currentCamera.cameraAzimuth,
                fromElevation: currentCamera.cameraElevation,
                toX: selectedGeoFeature.worldPos.x,
                toZ: selectedGeoFeature.worldPos.z,
                toDistance: selectedGeoFeature.targetCameraDistance,
                toAzimuth: currentCamera.cameraAzimuth,
                toElevation: currentCamera.cameraElevation,
                startedAt: performance.now(),
                durationMs: reducedMotion ? 0 : 650
              };
            }}
            className="px-2 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Compass className="w-3 h-3" />
            Center
          </button>
        </div>
      </div>
    )}

    {/* Step 2 Location Selection Mode: Clean Interactive Map Location Popup */}
    {mapMode === 'location-selection' && selectedGeoFeature && (() => {
      const domainEligibility = checkDomainEligibility(scenario, selectedGeoFeature);

      return (
        <div
          role="dialog"
          aria-label="Location Selection Details"
          className="absolute bottom-4 left-4 z-40 w-80 sm:w-88 p-4 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/50 shadow-[0_12px_40px_rgba(0,0,0,0.85)] space-y-3 animate-fadeIn"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {selectedGeoFeature.category.toUpperCase()}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {selectedGeoFeature.provenance === 'osm_source_geometry' ? 'OSM Surveyed' : 'Terrain Reference'}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white leading-tight">
                {selectedGeoFeature.title}
              </h4>
              <p className="text-[11px] text-slate-400">
                {selectedGeoFeature.subtitle || 'Study Area Candidate'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedGeoFeature(null);
                onInspectFeature?.(null);
              }}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Dismiss location selection"
              aria-label="Close location popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Coordinates and Region Details */}
          <div className="space-y-1.5 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 font-medium">
            <div className="flex items-center justify-between text-slate-400">
              <span>Coordinates:</span>
              <span className="text-cyan-300 font-bold">
                {`${selectedGeoFeature.lat.toFixed(4)}° N, ${selectedGeoFeature.lon.toFixed(4)}° E`}
              </span>
            </div>
            {selectedGeoFeature.details.slice(0, 2).map((d, i) => (
              <div key={i} className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>{d.label}:</span>
                <span className="text-slate-200">{d.value}</span>
              </div>
            ))}
          </div>

          {/* Domain Coverage Awareness & Action Button */}
          {!domainEligibility.isEligible ? (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Simulation Not Available Here Yet</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {domainEligibility.unsupportedMessage}
                </p>
              </div>
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-500 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-700/50"
                title={domainEligibility.unsupportedMessage}
              >
                <MapPin className="w-4 h-4 text-slate-600" />
                <span>Simulation Unavailable Here (Explore Only)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Simulation Available Here</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  This location has active modeled {domainEligibility.coverageDomainLabel} coverage and is ready for simulation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nearestPlace = findNearestPlaceToFeature(selectedGeoFeature, resolvedPlacesRef.current);
                  const targetId = nearestPlace?.id || stateRef.current.mapPlaceId || 'nambur';
                  if (onSelectMapPlaceRef.current) {
                    onSelectMapPlaceRef.current(targetId);
                  }
                  if (onConfirmLocation) {
                    onConfirmLocation(targetId, selectedGeoFeature);
                  }
                  setSelectedGeoFeature(null);
                  onInspectFeature?.(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-500/25"
              >
                <Check className="w-4 h-4 text-slate-950" />
                <span>Confirm This Location</span>
              </button>
            </div>
          )}
        </div>
      );
    })()}

    {osmMapError && (
      <div role="status" className="absolute top-24 left-3 z-20 max-w-xs rounded-xl border border-amber-500/40 bg-slate-950/95 px-3 py-2 text-[10px] text-amber-200 shadow-lg flex items-center justify-between gap-2">
        <span>Local OSM vector detail failed to load. Regional map tiles remain active.</span>
        <button
          type="button"
          onClick={() => setOsmRetryNonce((n) => n + 1)}
          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-[10px] font-bold text-amber-100 shrink-0 cursor-pointer"
        >
          Retry
        </button>
      </div>
    )}

    {/* Bottom-Right Orbit, Solver Provenance & OSM Attribution */}
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 text-[10px] text-slate-400 shadow-xl">
      <Compass className="w-3 h-3 text-cyan-400 shrink-0 hidden lg:inline" />
      <span className="hidden lg:inline text-slate-300 font-medium">
        {scenario.domain === 'traffic'
          ? 'Traffic Network Simulation'
          : scenario.domain === 'water'
            ? 'Water Distribution Simulation'
            : 'Power Transmission Simulation'}
      </span>
      <span className="hidden lg:inline text-slate-600">•</span>
      <span className="hidden xl:inline">Drag orbit • Shift+Drag pan • Scroll zoom •</span>
      <a
        href={OSM_ATTRIBUTION_URL}
        target="_blank"
        rel="noreferrer"
        className="text-cyan-300 hover:text-cyan-100 underline underline-offset-2 shrink-0 font-medium"
      >
        © OpenStreetMap
      </a>
    </div>

    {/* GPU Graphics Compatibility & Quality Configuration Modal */}
    <GraphicsCompatibilityModal
      isOpen={showGraphicsModal}
      onClose={() => setShowGraphicsModal(false)}
      currentProfile={graphicsProfile}
      onApplyProfile={(profile) => {
        setGraphicsProfile(profile);
        if (profile === '2d') {
          onFallbackTo2D?.();
        } else if (profile === 'performance') {
          setReducedDetailMode(true);
        } else {
          setReducedDetailMode(false);
        }
      }}
    />
  </div>
);
};
