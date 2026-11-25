import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Scenario,
  SolutionAlternative,
  AlternativeRunRecord
} from '../types';
import { Activity, Layers, MapPin, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import {
  clipLineSegmentToBounds,
  declutterMapLabelCandidates,
  discoverRegionalPlacesFromOSM,
  fitMapBoundsToAspect,
  geographicToSvg,
  getFeatureCoordinates,
  getMapBounds,
  getMapLandmarks,
  getMapPlace,
  getMapTileZoom,
  getOSMTileDescriptors,
  getOverlayScaleForViewport,
  getPannedZoomBounds,
  getTileSvgRect,
  isCoordinateWithinBounds,
  isMajorRegionalRoad,
  loadOSMPlaceData,
  NamedMapLandmark,
  OSM_ATTRIBUTION_URL,
  OSMMapFeature,
  REGIONAL_BOUNDS,
  RegionalMapPlace,
  scenarioPositionToSvg
} from '../models/regionalMap';

interface DigitalTwinViewer2DProps {
  scenario: Scenario;
  selectedAlternative: SolutionAlternative | null;
  simulationResult: AlternativeRunRecord;
  baselineResult: AlternativeRunRecord;
  timelineProgress: number;
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string | null) => void;
  onSelectMapPlace?: (placeId: string) => void;
  onDiscoveredPlaces?: (places: RegionalMapPlace[], features: OSMMapFeature[]) => void;
  mapPlaceId: string;
  reducedMotion?: boolean;
}

const SVG_WIDTH = 800;
const SVG_HEIGHT = 425;
const SVG_PADDING = 20;
const METERS_PER_LAT = 110574;

function formatPlaceName(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').replace(/[_-]+/g, ' ').trim();
}

export const DigitalTwinViewer2D: React.FC<DigitalTwinViewer2DProps> = ({
  scenario,
  selectedAlternative,
  simulationResult,
  timelineProgress,
  selectedAssetId,
  onSelectAsset,
  onSelectMapPlace,
  onDiscoveredPlaces,
  mapPlaceId,
  reducedMotion = false
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [osmFeatures, setOsmFeatures] = useState<OSMMapFeature[]>([]);
  const [osmLoadError, setOsmLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedLandmark, setFocusedLandmark] = useState<NamedMapLandmark | null>(null);
  const dragRef = useRef({ active: false, moved: false, x: 0, y: 0 });
  const flightFrameRef = useRef<number | null>(null);
  const pendingLandmarkRef = useRef<NamedMapLandmark | null>(null);
  const zoomRef = useRef(zoomLevel);
  const panRef = useRef(pan);
  const containerRef = useRef<HTMLDivElement>(null);
  const onDiscoveredPlacesRef = useRef(onDiscoveredPlaces);
  onDiscoveredPlacesRef.current = onDiscoveredPlaces;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      if (flightFrameRef.current !== null) {
        cancelAnimationFrame(flightFrameRef.current);
        flightFrameRef.current = null;
      }
      setZoomLevel((value) => Math.max(0.75, Math.min(32, value * factor)));
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  useEffect(() => {
    zoomRef.current = zoomLevel;
    panRef.current = pan;
  }, [zoomLevel, pan]);

  useEffect(() => {
    let current = true;
    setOsmLoadError(false);
    loadOSMPlaceData(mapPlaceId)
      .then((data) => {
        if (!current) return;
        setOsmFeatures(data.features);
        const places = discoverRegionalPlacesFromOSM(data.features);
        onDiscoveredPlacesRef.current?.(places, data.features);
      })
      .catch(() => {
        if (current) {
          setOsmFeatures([]);
          setOsmLoadError(true);
        }
      });
    return () => {
      current = false;
    };
  }, [mapPlaceId, reloadNonce]);

  useEffect(() => {
    if (flightFrameRef.current !== null) {
      cancelAnimationFrame(flightFrameRef.current);
      flightFrameRef.current = null;
    }
    const pending = pendingLandmarkRef.current;
    pendingLandmarkRef.current = null;
    if (pending && !pending.placeId) {
      setFocusedLandmark(pending);
      flyToGeographicPoint(pending.lon, pending.lat, mapPlaceId === 'region' ? 10 : 4.5);
      return;
    }
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setFocusedLandmark(null);
  }, [mapPlaceId]);

  useEffect(
    () => () => {
      if (flightFrameRef.current !== null) cancelAnimationFrame(flightFrameRef.current);
    },
    []
  );

  const discoveredPlaces = useMemo(
    () => discoverRegionalPlacesFromOSM(osmFeatures),
    [osmFeatures]
  );

  // Compute searchable catalog across ALL loaded regional features regardless of current zoom/city view.
  const searchableLandmarks = useMemo(
    () => getMapLandmarks(osmFeatures, REGIONAL_BOUNDS, 6000),
    [osmFeatures]
  );

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return searchableLandmarks
      .filter(
        (entry) =>
          entry.name.toLowerCase().replace(/[_-]+/g, ' ').includes(q) ||
          entry.category.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [searchableLandmarks, searchQuery]);

  const trafficOut =
    simulationResult.rawOutput.domain === 'traffic'
      ? simulationResult.rawOutput.result
      : null;
  const waterOut =
    simulationResult.rawOutput.domain === 'water'
      ? simulationResult.rawOutput.result
      : null;
  const powerOut =
    simulationResult.rawOutput.domain === 'energy'
      ? simulationResult.rawOutput.result
      : null;

  const stepData =
    trafficOut && trafficOut.timeSteps.length > 0
      ? trafficOut.timeSteps[
          Math.min(
            trafficOut.timeSteps.length - 1,
            Math.max(
              0,
              Math.floor((timelineProgress / 100) * trafficOut.timeSteps.length)
            )
          )
        ]
      : null;

  const areaBounds = getMapBounds(mapPlaceId, discoveredPlaces);
  // Fit both regional AND local views to the canvas aspect so there are never blank margins.
  const mapBaseBounds = fitMapBoundsToAspect(areaBounds, SVG_WIDTH, SVG_HEIGHT);
  const mapBounds = getPannedZoomBounds(
    mapBaseBounds,
    zoomLevel,
    pan,
    { width: SVG_WIDTH, height: SVG_HEIGHT },
    SVG_PADDING
  );
  const viewportLonSpan = mapBounds.east - mapBounds.west;
  const mapTiles = getOSMTileDescriptors(
    mapBounds,
    Math.min(18, getMapTileZoom(mapPlaceId) + Math.floor(Math.log2(Math.max(1, zoomLevel))))
  );
  const overlayScale = Math.max(0.22, getOverlayScaleForViewport(mapBounds));
  const toSvg = (x: number, y: number) =>
    scenarioPositionToSvg(x, y, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING, mapPlaceId);

  const animateCameraTo = (targetZoom: number, targetPan: { x: number; y: number }) => {
    if (flightFrameRef.current !== null) cancelAnimationFrame(flightFrameRef.current);
    if (reducedMotion) {
      setZoomLevel(targetZoom);
      setPan(targetPan);
      return;
    }
    const startZoom = zoomRef.current;
    const startPan = { ...panRef.current };
    const startedAt = performance.now();
    const durationMs = 480;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setZoomLevel(startZoom + (targetZoom - startZoom) * eased);
      setPan({
        x: startPan.x + (targetPan.x - startPan.x) * eased,
        y: startPan.y + (targetPan.y - startPan.y) * eased
      });
      if (t < 1) {
        flightFrameRef.current = requestAnimationFrame(step);
      } else {
        flightFrameRef.current = null;
      }
    };
    flightFrameRef.current = requestAnimationFrame(step);
  };

  const flyToGeographicPoint = (lon: number, lat: number, nextZoom = 5.5) => {
    const centerLat = (mapBaseBounds.north + mapBaseBounds.south) / 2;
    const metersPerLon = METERS_PER_LAT * Math.cos((centerLat * Math.PI) / 180);
    const widthMeters = (mapBaseBounds.east - mapBaseBounds.west) * metersPerLon;
    const heightMeters = (mapBaseBounds.north - mapBaseBounds.south) * METERS_PER_LAT;
    const baseScale = Math.min(
      (SVG_WIDTH - SVG_PADDING * 2) / Math.max(widthMeters, 1),
      (SVG_HEIGHT - SVG_PADDING * 2) / Math.max(heightMeters, 1)
    );
    const scaleAtTarget = nextZoom * baseScale;
    const baseCenterLon = (mapBaseBounds.west + mapBaseBounds.east) / 2;
    const targetPan = {
      x: (baseCenterLon - lon) * metersPerLon * scaleAtTarget,
      y: (lat - centerLat) * METERS_PER_LAT * scaleAtTarget
    };
    animateCameraTo(nextZoom, targetPan);
  };

  const zoomBy = (factor: number) => {
    if (flightFrameRef.current !== null) {
      cancelAnimationFrame(flightFrameRef.current);
      flightFrameRef.current = null;
    }
    setZoomLevel((value) => Math.max(0.75, Math.min(32, value * factor)));
  };

  const focusPlace = (placeId: string) => {
    const target = getMapPlace(placeId, discoveredPlaces);
    setSearchQuery('');
    setFocusedLandmark(null);
    if (placeId !== mapPlaceId && onSelectMapPlace) {
      onSelectMapPlace(placeId);
      return;
    }
    flyToGeographicPoint(target.lon, target.lat, Math.max(2.6, Math.min(12, zoomRef.current * 1.8)));
  };

  const focusLandmark = (landmark: NamedMapLandmark) => {
    setSearchQuery('');
    setFocusedLandmark(landmark);
    if (landmark.placeId && landmark.placeId !== mapPlaceId && onSelectMapPlace) {
      onSelectMapPlace(landmark.placeId);
      return;
    }
    if (!isCoordinateWithinBounds([landmark.lon, landmark.lat], areaBounds) && onSelectMapPlace) {
      const targetPlace =
        discoveredPlaces.find(
          (p) =>
            p.id !== 'region' &&
            p.bounds &&
            isCoordinateWithinBounds([landmark.lon, landmark.lat], p.bounds)
        )?.id || 'region';
      pendingLandmarkRef.current = landmark;
      onSelectMapPlace(targetPlace);
      return;
    }
    const desiredZoom =
      mapPlaceId === 'region'
        ? landmark.category === 'District'
          ? 2.2
          : landmark.category === 'Mandal'
          ? 3.6
          : landmark.category === 'City' || landmark.category === 'Town'
          ? 8
          : 14
        : Math.max(3.6, zoomRef.current * 1.6);
    flyToGeographicPoint(landmark.lon, landmark.lat, Math.min(28, desiredZoom));
  };

  const beginPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (flightFrameRef.current !== null) {
      cancelAnimationFrame(flightFrameRef.current);
      flightFrameRef.current = null;
    }
    dragRef.current = {
      active: true,
      moved: false,
      x: event.clientX,
      y: event.clientY
    };
  };

  const movePan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.x) / Math.max(1, rect.width)) * SVG_WIDTH;
    const dy = ((event.clientY - dragRef.current.y) / Math.max(1, rect.height)) * SVG_HEIGHT;
    dragRef.current.x = event.clientX;
    dragRef.current.y = event.clientY;
    if (Math.hypot(dx, dy) > 1) dragRef.current.moved = true;
    setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
  };

  const endPan = () => {
    dragRef.current.active = false;
  };

  // Clipped OSM vector layers for crisp, offline-resilient alignment between 2D & 3D.
  const clippedRoads = useMemo(() => {
    const majorOnly = viewportLonSpan > 0.14;
    const lines: { id: string; points: string; major: boolean }[] = [];
    for (const feature of osmFeatures) {
      if (feature.kind !== 'road') continue;
      const major = isMajorRegionalRoad(feature);
      if (majorOnly && !major) continue;
      const coords = getFeatureCoordinates(feature);
      if (coords.length < 2) continue;
      for (let i = 0; i < coords.length - 1; i += 1) {
        const segment = clipLineSegmentToBounds(coords[i], coords[i + 1], mapBounds);
        if (!segment) continue;
        const p1 = geographicToSvg(segment[0][0], segment[0][1], mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        const p2 = geographicToSvg(segment[1][0], segment[1][1], mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        lines.push({
          id: `${feature.id}-${i}`,
          points: `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
          major
        });
        if (lines.length >= 2600) return lines;
      }
    }
    return lines;
  }, [osmFeatures, mapBounds, viewportLonSpan]);

  const clippedRailways = useMemo(() => {
    const lines: { id: string; points: string }[] = [];
    for (const feature of osmFeatures) {
      if (feature.kind !== 'railway') continue;
      const coords = getFeatureCoordinates(feature);
      if (coords.length < 2) continue;
      for (let i = 0; i < coords.length - 1; i += 1) {
        const segment = clipLineSegmentToBounds(coords[i], coords[i + 1], mapBounds);
        if (!segment) continue;
        const p1 = geographicToSvg(segment[0][0], segment[0][1], mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        const p2 = geographicToSvg(segment[1][0], segment[1][1], mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        lines.push({
          id: `${feature.id}-${i}`,
          points: `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
        });
        if (lines.length >= 800) return lines;
      }
    }
    return lines;
  }, [osmFeatures, mapBounds]);

  // Show mapped building footprint polygons in 2D when zoomed in to street/city scale so SVG stays 60fps.
  const visibleBuildings2D = useMemo(() => {
    if (viewportLonSpan > 0.055) return [];
    const polygons: { id: string; points: string; named: boolean; label?: string }[] = [];
    for (const feature of osmFeatures) {
      if (feature.kind !== 'building') continue;
      const coords = getFeatureCoordinates(feature);
      if (coords.length < 3) continue;
      const sample = coords[0];
      if (!isCoordinateWithinBounds(sample, mapBounds)) continue;
      const pts = coords.map(([lon, lat]) => {
        const pt = geographicToSvg(lon, lat, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      });
      const rawName = typeof feature.name === 'string' ? feature.name.trim() : '';
      const named = Boolean(rawName && !/^(yes|no|house|building|unnamed)$/i.test(rawName));
      polygons.push({ id: feature.id, points: pts.join(' '), named, label: rawName });
      if (polygons.length >= 2400) break;
    }
    return polygons;
  }, [osmFeatures, mapBounds, viewportLonSpan]);

  // Unified label decluttering across broad area labels and mid-zoom landmarks so
  // settlement tags (e.g., suburbs) never collide with nearby landmark names.
  const { visibleAreaMarkers, visibleLandmarkMarkers } = useMemo(() => {
    const showBroadAreaLabels = viewportLonSpan > 0.04 || zoomLevel <= 1.35;
    const areaCandidates: {
      place: RegionalMapPlace;
      svg: { x: number; y: number };
      priority: number;
      width: number;
      height: number;
    }[] = [];

    if (showBroadAreaLabels) {
      const hasSubLabel = viewportLonSpan > 0.25;
      for (const place of discoveredPlaces) {
        if (place.id === 'region') continue;
        if (place.category === 'village' && viewportLonSpan > 0.28) continue;
        if (place.category === 'district' && viewportLonSpan < 0.35) continue;
        if (!isCoordinateWithinBounds([place.lon, place.lat], mapBounds)) continue;
        const svg = geographicToSvg(place.lon, place.lat, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        const priority =
          place.id === 'nambur'
            ? 110
            : place.category === 'city'
            ? 100
            : place.category === 'town'
            ? 90
            : place.category === 'suburb'
            ? 70
            : place.category === 'mandal'
            ? 56
            : 50;
        const label = place.id === 'nambur' ? 'VVITU · Nambur' : place.label;
        const textWidth = Math.max(58, label.length * 6.8 + (hasSubLabel ? 18 : 10));
        areaCandidates.push({
          place,
          svg,
          priority,
          width: 14 + textWidth,
          height: hasSubLabel ? 28 : 20
        });
      }
    }

    const landmarkCandidates: {
      landmark: NamedMapLandmark;
      svg: { x: number; y: number };
      width: number;
      height: number;
    }[] = [];

    if (viewportLonSpan <= 0.14) {
      for (const lm of searchableLandmarks) {
        if (lm.kind === 'boundary' || ['City', 'Town', 'District', 'Mandal'].includes(lm.category)) {
          continue;
        }
        if (!isCoordinateWithinBounds([lm.lon, lm.lat], mapBounds)) continue;
        const svg = geographicToSvg(lm.lon, lm.lat, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
        const displayName = formatPlaceName(lm.name).slice(0, 26);
        const textWidth = Math.max(64, displayName.length * 6.0 + 10);
        landmarkCandidates.push({
          landmark: lm,
          svg,
          width: 12 + textWidth,
          height: 18
        });
        if (landmarkCandidates.length >= 60) break;
      }
    }

    const combinedCandidates = [
      ...areaCandidates.map((c) => ({
        id: `area:${c.place.id}`,
        priority: c.priority,
        // Text extends rightward from svg.x + 10; center the collision box over dot + label.
        x: c.svg.x + c.width / 2 - 4,
        y: c.svg.y,
        width: c.width,
        height: c.height
      })),
      ...landmarkCandidates.map((c) => ({
        id: `lm:${c.landmark.id}`,
        priority: c.landmark.priority,
        x: c.svg.x + c.width / 2 - 3,
        y: c.svg.y,
        width: c.width,
        height: c.height
      }))
    ];

    const acceptedIds = declutterMapLabelCandidates(
      combinedCandidates,
      viewportLonSpan > 0.14 ? 8 : 14,
      viewportLonSpan > 0.14 ? 14 : 10
    );

    return {
      visibleAreaMarkers: areaCandidates.filter((c) => acceptedIds.has(`area:${c.place.id}`)),
      visibleLandmarkMarkers: landmarkCandidates.filter((c) => acceptedIds.has(`lm:${c.landmark.id}`))
    };
  }, [discoveredPlaces, searchableLandmarks, mapBounds, viewportLonSpan, zoomLevel]);

  const affectedSet = new Set(scenario.problemStatement?.affectedAssetIds || []);

  return (
    <div className="relative w-full h-full min-h-[380px] sm:min-h-[450px] lg:min-h-[500px] rounded-2xl overflow-hidden bg-[#060a17] border border-indigo-500/30 p-3 sm:p-4 flex flex-col justify-between flex-1">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex flex-wrap items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-bold text-white">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>2D OpenStreetMap • {scenario.domain.toUpperCase()}</span>
          <span className="text-[10px] font-mono text-amber-300">Solver overlay is schematic</span>
        </div>

        {/* Place, Landmark & Named Building Search */}
        <div className="relative w-full sm:w-64">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/95 px-2.5 py-1 shadow">
            <MapPin className="w-3.5 h-3.5 text-cyan-300 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchSuggestions[0]) {
                  e.preventDefault();
                  focusLandmark(searchSuggestions[0]);
                } else if (e.key === 'Escape') {
                  setSearchQuery('');
                }
              }}
              aria-label="Search 2D places, landmarks, or buildings"
              aria-expanded={searchQuery.trim().length >= 2}
              aria-controls="map-2d-search-suggestions"
              placeholder="Search place, landmark, building…"
              className="min-w-0 flex-1 bg-transparent text-[11px] text-white placeholder:text-slate-500 focus:outline-none"
            />
            <span className="text-[9px] font-mono text-slate-400 shrink-0">
              {searchableLandmarks.length.toLocaleString()}
            </span>
          </div>
          {searchQuery.trim().length >= 2 && (
            <div
              id="map-2d-search-suggestions"
              role="listbox"
              aria-label="Mapped places matching search"
              className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/98 p-1 shadow-2xl z-30"
            >
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => focusLandmark(entry)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] text-slate-200 hover:bg-cyan-500/15 hover:text-cyan-100 cursor-pointer"
                  >
                    <span className="truncate font-semibold">{formatPlaceName(entry.name)}</span>
                    <span className="shrink-0 text-[9px] text-slate-400">{entry.category}</span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-1.5 text-[10px] text-slate-400">No mapped match found across loaded region.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-[10px] text-slate-300">
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
            [UPG] Modified ({selectedAlternative?.tag || 'Baseline'})
          </span>
        </div>
      </div>

      <div className="absolute top-[60px] right-4 z-10 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/90 p-1 shadow-lg">
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in on 2D map" title="Zoom in" className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
        <span className="min-w-9 text-center text-[10px] font-mono text-cyan-200">{zoomLevel.toFixed(1)}×</span>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out on 2D map" title="Zoom out" className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => { setFocusedLandmark(null); animateCameraTo(1, { x: 0, y: 0 }); }} aria-label="Fit selected area in 2D map" title="Fit selected area" className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-cyan-200 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /></button>
      </div>

      {osmLoadError && (
        <div role="status" className="absolute top-[60px] left-4 z-20 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-950/95 px-3 py-1.5 text-[10px] text-amber-200 shadow-lg">
          <span>Local OSM vector detail failed to load.</span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="rounded border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-bold text-amber-100 hover:bg-amber-500/30 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Responsive SVG Schematic Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center my-1 overflow-hidden">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full min-h-[360px] cursor-grab active:cursor-grabbing"
          role="group"
          aria-label={`2D OpenStreetMap view and WhatIf ${scenario.domain} model for ${scenario.title}`}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onClickCapture={(event) => {
            if (dragRef.current.moved) {
              event.preventDefault();
              event.stopPropagation();
              dragRef.current.moved = false;
            }
          }}
        >
          <defs>
            <clipPath id="regionalMapClip2d">
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} rx="16" />
            </clipPath>
            <pattern
              id="engGrid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(51, 65, 85, 0.28)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect width={SVG_WIDTH} height={SVG_HEIGHT} rx="16" fill="#0b1220" />
          <g clipPath="url(#regionalMapClip2d)">
            {mapTiles.map((tile) => {
              const rect = getTileSvgRect(tile, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
              return (
                <image
                  key={`${tile.zoom}/${tile.x}/${tile.y}`}
                  href={tile.url}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  preserveAspectRatio="none"
                  opacity="0.9"
                />
              );
            })}
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="rgba(3, 8, 22, 0.36)" />

            {/* OSM Vector Waterways, Railways, Roads & Footprints aligned identically to 3D */}
            <g aria-label="Mapped OpenStreetMap roads and railways" pointerEvents="none">
              {clippedRoads.map((seg) => (
                <polyline
                  key={seg.id}
                  points={seg.points}
                  fill="none"
                  stroke={seg.major ? '#38bdf8' : '#64748b'}
                  strokeOpacity={seg.major ? 0.55 : 0.42}
                  strokeWidth={seg.major ? 1.6 : 0.9}
                />
              ))}
              {clippedRailways.map((seg) => (
                <polyline
                  key={seg.id}
                  points={seg.points}
                  fill="none"
                  stroke="#94a3b8"
                  strokeOpacity="0.65"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
              ))}
            </g>

            {visibleBuildings2D.length > 0 && (
              <g aria-label="Mapped OpenStreetMap building footprints" pointerEvents="none">
                {visibleBuildings2D.map((b) => (
                  <polygon
                    key={b.id}
                    points={b.points}
                    fill={b.named ? 'rgba(56, 189, 248, 0.26)' : 'rgba(148, 163, 184, 0.22)'}
                    stroke={b.named ? '#38bdf8' : '#64748b'}
                    strokeWidth={b.named ? 0.85 : 0.5}
                    strokeOpacity="0.8"
                  >
                    {b.label && <title>{b.label}</title>}
                  </polygon>
                ))}
              </g>
            )}
          </g>

          <rect width={SVG_WIDTH} height={SVG_HEIGHT} rx="16" fill="url(#engGrid)" opacity="0.18" pointerEvents="none" />

          {/* Mapped OpenStreetMap Utility Features (not inferred distribution mains) */}
          <g aria-label="Mapped OpenStreetMap utility features" pointerEvents="none">
            {osmFeatures.filter((feature) => feature.kind === 'power' || feature.kind === 'water_supply' || feature.kind === 'waterway').map((feature) => {
              const coords = getFeatureCoordinates(feature);
              if (coords.length === 0) return null;
              if (feature.kind === 'waterway' || (feature.kind === 'power' && coords.length > 1 && ['line', 'minor_line', 'cable', 'minor_cable'].includes(String(feature.power || feature.class || '')))) {
                const isWaterway = feature.kind === 'waterway';
                const segments = coords.slice(0, -1).flatMap((point, index) => {
                  const segment = clipLineSegmentToBounds(point, coords[index + 1], mapBounds);
                  if (!segment) return [];
                  return [segment.map(([lon, lat]) => geographicToSvg(lon, lat, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING))];
                });
                if (segments.length === 0) return null;
                return (
                  <g key={feature.id} fill="none" stroke={isWaterway ? '#38bdf8' : '#fbbf24'} strokeWidth={isWaterway ? 1.8 : 2} strokeDasharray={isWaterway ? '5 4' : undefined} opacity="0.9">
                    {segments.map((segment, index) => <polyline key={`${feature.id}-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(' ')} />)}
                    <title>{isWaterway ? 'Mapped OSM waterway; not a drinking-water main' : `Mapped OSM power line ${feature.voltage ? `(${feature.voltage} V)` : ''}`}</title>
                  </g>
                );
              }
              const featurePoint = coords.length === 1
                ? coords[0]
                : coords.reduce(([lon, lat], point) => [lon + point[0] / coords.length, lat + point[1] / coords.length], [0, 0] as [number, number]);
              if (!isCoordinateWithinBounds(featurePoint, mapBounds)) return null;
              const point = geographicToSvg(featurePoint[0], featurePoint[1], mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
              const isWater = feature.kind === 'water_supply';
              return (
                <g key={feature.id}>
                  <circle cx={point.x} cy={point.y} r={isWater ? 4 : 2.8} fill={isWater ? '#38bdf8' : '#fbbf24'} stroke="#07101d" strokeWidth="1" />
                  <title>{isWater ? `Mapped water facility: ${feature.name || feature.man_made || 'facility'}` : `Mapped power asset: ${feature.power || feature.class || 'asset'}`}</title>
                </g>
              );
            })}
          </g>

          {/* Regional Place Markers (decluttered, fade out on close city zoom) */}
          <g aria-label="OpenStreetMap mapped settlements and places">
            {visibleAreaMarkers.map(({ place, svg }) => {
              const label = place.id === 'nambur' ? 'VVITU · Nambur' : place.label;
              const isCity = place.category === 'city' || place.id === 'nambur';
              return (
                <g
                  key={place.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Focus map on ${label}, ${place.district}`}
                  className="cursor-pointer outline-none"
                  onClick={() => focusPlace(place.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      focusPlace(place.id);
                    }
                  }}
                >
                  <circle cx={svg.x} cy={svg.y} r={isCity ? 5.5 : 4} fill={place.id === 'nambur' ? '#fbbf24' : '#22d3ee'} stroke="#06101f" strokeWidth="1.8" />
                  <circle cx={svg.x} cy={svg.y} r={isCity ? 10.5 : 7.5} fill="none" stroke="#67e8f9" strokeOpacity="0.55" />
                  <text x={svg.x + 10} y={svg.y - 6} fontSize={isCity ? '10.5' : '9'} fontWeight="700" fill="#e2f8ff" stroke="#07101d" strokeWidth="3" paintOrder="stroke">{label}</text>
                  {viewportLonSpan > 0.25 && (
                    <text x={svg.x + 10} y={svg.y + 6} fontSize="7.5" fill="#cbd5e1" stroke="#07101d" strokeWidth="2" paintOrder="stroke">{place.district}</text>
                  )}
                  <title>Click to focus the map on {label}</title>
                </g>
              );
            })}
          </g>

          {/* Mid-zoom Named Landmarks */}
          {visibleLandmarkMarkers.length > 0 && (
            <g aria-label="Mapped OSM landmarks">
              {visibleLandmarkMarkers.map(({ landmark, svg }) => (
                <g
                  key={landmark.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Fly to ${formatPlaceName(landmark.name)} (${landmark.category})`}
                  onClick={() => focusLandmark(landmark)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      focusLandmark(landmark);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <circle cx={svg.x} cy={svg.y} r="3.8" fill={landmark.category === 'Campus' ? '#fbbf24' : '#38bdf8'} stroke="#07101d" strokeWidth="1.2" />
                  <text x={svg.x + 6} y={svg.y + 3} fontSize="8.5" fontWeight="600" fill="#cffafe" stroke="#07101d" strokeWidth="2.5" paintOrder="stroke">
                    {formatPlaceName(landmark.name).slice(0, 26)}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Highlighted Search Target Marker */}
          {focusedLandmark && isCoordinateWithinBounds([focusedLandmark.lon, focusedLandmark.lat], mapBounds) && (() => {
            const p = geographicToSvg(focusedLandmark.lon, focusedLandmark.lat, mapBounds, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING);
            return (
              <g pointerEvents="none">
                <circle cx={p.x} cy={p.y} r="10" fill="none" stroke="#fbbf24" strokeWidth="2" />
                <circle cx={p.x} cy={p.y} r="4.5" fill="#fbbf24" stroke="#06101f" strokeWidth="1.5" />
                <text x={p.x + 12} y={p.y - 6} fontSize="9.5" fontWeight="800" fill="#fef08a" stroke="#07101d" strokeWidth="3" paintOrder="stroke">
                  {formatPlaceName(focusedLandmark.name).slice(0, 32)}
                </text>
              </g>
            );
          })()}

          {/* TRAFFIC 2D TOPOLOGY (16 cells, 8 signals) */}
          {scenario.domain === 'traffic' &&
            scenario.trafficNetwork &&
            trafficOut && (
              <g>
                {scenario.trafficNetwork.cells.map((cell) => {
                  const p1 = toSvg(cell.x, cell.y);
                  return cell.nextCellIds.map((nextId) => {
                    const nextCell = scenario.trafficNetwork!.cells.find((c) => c.id === nextId);
                    if (!nextCell) return null;
                    const p2 = toSvg(nextCell.x, nextCell.y);
                    return (
                      <line
                        key={`${cell.id}->${nextId}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#334155"
                        strokeWidth="2.5"
                        strokeDasharray="5 3"
                      />
                    );
                  });
                })}

                {scenario.trafficNetwork.cells.map((cell, idx) => {
                  const { x, y } = toSvg(cell.x, cell.y);
                  const speed = stepData?.cellSpeeds[cell.id] ?? trafficOut.averageSpeedKmh;
                  const density = stepData?.cellDensities[cell.id] ?? cell.initialDensityVehKmPerLane;
                  const densityRatio = density / cell.jamDensityVehKmPerLane;

                  const isModified =
                    selectedAlternative?.modifications.some((m) => m.targetId === cell.id) ?? false;
                  const isSelected = selectedAssetId === cell.id;
                  const isAffected = affectedSet.has(cell.id);

                  const isBreach = speed < 22 || densityRatio > 0.7;
                  const isWarn = !isBreach && (speed < 30 || densityRatio > 0.55);

                  const strokeColor = isBreach
                    ? '#f43f5e'
                    : isWarn
                    ? '#f59e0b'
                    : isModified
                    ? '#22d3ee'
                    : '#10b981';

                  const statusTag = isBreach
                    ? '[BREACH]'
                    : isWarn
                    ? '[WARN]'
                    : isModified
                    ? '[UPG]'
                    : '[OK]';

                  return (
                    <g
                      key={cell.id}
                      onClick={() => onSelectAsset(cell.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelectAsset(cell.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${cell.name}, ${statusTag}, ${speed.toFixed(1)} kilometers per hour, queue density ${density.toFixed(1)} vehicles per kilometer per lane`}
                      className="cursor-pointer outline-none"
                    >
                      <title>{`${cell.name} · ${statusTag} · ${speed.toFixed(1)} km/h · queue density ${density.toFixed(1)} veh/km/lane · ${cell.lanes} lanes`}</title>
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 8.5 : Math.max(4.5, 7 * overlayScale)}
                        fill={isAffected ? '#0b2231' : '#08111d'}
                        stroke={isSelected ? '#ffffff' : strokeColor}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      <text x={x} y={y + 2.7} textAnchor="middle" fill="#f8fafc" fontSize="7" fontWeight="bold" pointerEvents="none">
                        {String(idx + 1).padStart(2, '0')}
                      </text>
                      {(isSelected || isAffected) && (
                        <circle cx={x} cy={y} r={isSelected ? 13 : 10} fill="none" stroke={strokeColor} strokeOpacity={isSelected ? 0.9 : 0.45} strokeWidth="1.2" pointerEvents="none" />
                      )}
                      {isSelected && (
                        <g pointerEvents="none">
                          <rect x={Math.min(610, Math.max(8, x + 12))} y={Math.min(355, Math.max(54, y - 26))} width="178" height="48" rx="8" fill="#07101d" stroke={strokeColor} strokeWidth="1.4" />
                          <text x={Math.min(622, Math.max(20, x + 24))} y={Math.min(372, Math.max(71, y - 9))} fill="#f8fafc" fontSize="8" fontWeight="700">{cell.name.slice(0, 28)}</text>
                          <text x={Math.min(622, Math.max(20, x + 24))} y={Math.min(388, Math.max(87, y + 7))} fill={strokeColor} fontSize="8" fontFamily="monospace">{statusTag} {speed.toFixed(1)} km/h · {density.toFixed(0)} veh/km/ln</text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}

          {/* WATER 2D TOPOLOGY (16 nodes, 20 pipes) */}
          {scenario.domain === 'water' &&
            scenario.waterNetwork &&
            waterOut && (
              <g>
                {scenario.waterNetwork.pipes.map((pipe) => {
                  const fromNode = scenario.waterNetwork!.nodes.find((n) => n.id === pipe.fromNodeId);
                  const toNode = scenario.waterNetwork!.nodes.find((n) => n.id === pipe.toNodeId);
                  if (!fromNode || !toNode) return null;
                  const p1 = toSvg(fromNode.x, fromNode.y);
                  const p2 = toSvg(toNode.x, toNode.y);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;

                  const pRes = waterOut.pipeResults[pipe.id];
                  const vel = pRes?.velocityMs ?? 0.8;
                  const hLossPerKm = (pRes?.headLossM ?? 2) / Math.max(0.1, pipe.length / 1000);
                  const isModified =
                    selectedAlternative?.modifications.some((m) => m.targetId === pipe.id) ?? false;

                  const pipeColor = isModified
                    ? '#22d3ee'
                    : vel > 2.0 || hLossPerKm > 12.0
                    ? '#f43f5e'
                    : vel > 1.6
                    ? '#f59e0b'
                    : '#38bdf8';

                  return (
                    <g
                      key={pipe.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Water pipe ${pipe.id}, velocity ${vel.toFixed(2)} meters per second, diameter ${Math.round(pipe.diameter * 1000)} millimeters`}
                      onClick={() => onSelectAsset(pipe.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAsset(pipe.id);
                        }
                      }}
                      transform={`translate(${midX} ${midY}) scale(${overlayScale}) translate(${-midX} ${-midY})`}
                      className="cursor-pointer outline-none"
                    >
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={selectedAssetId === pipe.id ? '#ffffff' : pipeColor}
                        strokeWidth={Math.max(2.5, pipe.diameter * 7.5)}
                        strokeOpacity="0.85"
                      />
                      <rect
                        x={midX - 34}
                        y={midY - 9}
                        width="68"
                        height="17"
                        rx="5"
                        fill="#090d1a"
                        stroke={pipeColor}
                        strokeWidth="1"
                      />
                      <text
                        x={midX}
                        y={midY + 3}
                        textAnchor="middle"
                        fill={pipeColor}
                        fontSize="7.5"
                        fontFamily="monospace"
                      >
                        {vel.toFixed(2)}m/s • Ø{Math.round(pipe.diameter * 1000)}
                      </text>
                    </g>
                  );
                })}

                {scenario.waterNetwork.nodes.map((node) => {
                  const { x, y } = toSvg(node.x, node.y);
                  const nRes = waterOut.nodeResults[node.id];
                  const pressure = nRes?.pressureKPa ?? waterOut.minPressureKPa;
                  const isSource = node.type === 'reservoir' || node.type === 'tank';
                  const isControl = node.type === 'pump' || node.type === 'valve';
                  const isModified =
                    selectedAlternative?.modifications.some((m) => m.targetId === node.id) ?? false;

                  const isBreach = !isSource && pressure < 180;
                  const isWarn = !isSource && !isBreach && pressure < 215;

                  const strokeColor = isModified
                    ? '#22d3ee'
                    : isSource
                    ? '#38bdf8'
                    : isControl
                    ? '#a855f7'
                    : isBreach
                    ? '#f43f5e'
                    : isWarn
                    ? '#f59e0b'
                    : '#10b981';

                  const statusTag = isSource
                    ? '[SRC]'
                    : isControl
                    ? `[${node.type.toUpperCase()}]`
                    : isBreach
                    ? '[BREACH]'
                    : isWarn
                    ? '[WARN]'
                    : '[OK]';

                  return (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.name}, ${statusTag}, ${isSource ? `head ${node.head} meters` : `${pressure.toFixed(1)} kilopascals`}`}
                      onClick={() => onSelectAsset(node.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAsset(node.id);
                        }
                      }}
                      transform={`translate(${x} ${y}) scale(${overlayScale}) translate(${-x} ${-y})`}
                      className="cursor-pointer outline-none"
                    >
                      <rect
                        x={x - 68}
                        y={y - 26}
                        width="136"
                        height="52"
                        rx="10"
                        fill="#0b1329"
                        stroke={selectedAssetId === node.id ? '#ffffff' : strokeColor}
                        strokeWidth={selectedAssetId === node.id ? 3 : 2}
                      />
                      <text x={x} y={y - 10} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold">
                        {node.name.slice(0, 19)}
                      </text>
                      <text x={x} y={y + 4} textAnchor="middle" fill={strokeColor} fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                        {statusTag} {isSource ? `H=${node.head}m` : `${pressure.toFixed(1)} kPa`}
                      </text>
                      <text x={x} y={y + 16} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                        z={node.elevation}m • Q={(node.baseDemand * 1000).toFixed(0)}L/s
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

          {/* ENERGY 2D TOPOLOGY (12 buses, 18 lines) */}
          {scenario.domain === 'energy' &&
            scenario.powerNetwork &&
            powerOut && (
              <g>
                {scenario.powerNetwork.lines.map((line) => {
                  const fromBus = scenario.powerNetwork!.buses.find((b) => b.id === line.fromBusId);
                  const toBus = scenario.powerNetwork!.buses.find((b) => b.id === line.toBusId);
                  if (!fromBus || !toBus) return null;
                  const p1 = toSvg(fromBus.x, fromBus.y);
                  const p2 = toSvg(toBus.x, toBus.y);
                  const midX = (p1.x + p2.x) / 2;
                  const midY = (p1.y + p2.y) / 2;

                  const lRes = powerOut.lineFlowsMw[line.id];
                  const flowMw = lRes?.flowMw ?? 85;
                  const loadingPct = lRes?.loadingPct ?? 75;
                  const isModified =
                    selectedAlternative?.modifications.some((m) => m.targetId === line.id) ?? false;

                  const strokeColor = isModified
                    ? '#22d3ee'
                    : loadingPct > 100
                    ? '#f43f5e'
                    : loadingPct > 85
                    ? '#f59e0b'
                    : '#10b981';

                  return (
                    <g
                      key={line.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Transmission line ${line.id}, ${flowMw.toFixed(0)} megawatts, ${loadingPct.toFixed(0)} percent loading`}
                      onClick={() => onSelectAsset(line.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAsset(line.id);
                        }
                      }}
                      transform={`translate(${midX} ${midY}) scale(${overlayScale}) translate(${-midX} ${-midY})`}
                      className="cursor-pointer outline-none"
                    >
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={selectedAssetId === line.id ? '#ffffff' : strokeColor}
                        strokeWidth="3.2"
                      />
                      <rect
                        x={midX - 42}
                        y={midY - 9}
                        width="84"
                        height="18"
                        rx="5"
                        fill="#090d1a"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <text x={midX} y={midY + 3} textAnchor="middle" fill={strokeColor} fontSize="8" fontWeight="bold" fontFamily="monospace">
                        {flowMw.toFixed(0)}MW ({loadingPct.toFixed(0)}%)
                      </text>
                    </g>
                  );
                })}

                {scenario.powerNetwork.buses.map((bus) => {
                  const { x, y } = toSvg(bus.x, bus.y);
                  const angle = powerOut.busAnglesDeg[bus.id] ?? 0;
                  const netInj = powerOut.busNetInjectionsMw[bus.id] ?? 0;
                  const hasGen = scenario.powerNetwork!.generators.some((g) => g.busId === bus.id);

                  const strokeColor = bus.isSlack
                    ? '#10b981'
                    : hasGen
                    ? '#38bdf8'
                    : bus.hasTransformer
                    ? '#a855f7'
                    : '#6366f1';

                  const roleTag = bus.isSlack
                    ? '[SLACK]'
                    : hasGen
                    ? '[GEN]'
                    : bus.hasTransformer
                    ? '[XFMR]'
                    : '[LOAD]';

                  return (
                    <g
                      key={bus.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${bus.name}, ${roleTag}, voltage angle ${angle.toFixed(1)} degrees, net injection ${netInj.toFixed(0)} megawatts`}
                      onClick={() => onSelectAsset(bus.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectAsset(bus.id);
                        }
                      }}
                      transform={`translate(${x} ${y}) scale(${overlayScale}) translate(${-x} ${-y})`}
                      className="cursor-pointer outline-none"
                    >
                      <rect
                        x={x - 72}
                        y={y - 29}
                        width="144"
                        height="58"
                        rx="10"
                        fill="#0b1329"
                        stroke={selectedAssetId === bus.id ? '#ffffff' : strokeColor}
                        strokeWidth={selectedAssetId === bus.id ? 3 : 2}
                      />
                      <text x={x} y={y - 12} textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold">
                        {bus.name.slice(0, 20)}
                      </text>
                      <text x={x} y={y + 3} textAnchor="middle" fill="#22d3ee" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                        {roleTag} θ={angle.toFixed(1)}°
                      </text>
                      <text x={x} y={y + 17} textAnchor="middle" fill="#fbbf24" fontSize="8.5" fontFamily="monospace">
                        Inj: {netInj >= 0 ? `+${netInj.toFixed(0)}` : netInj.toFixed(0)}MW ({bus.baseKv}kV)
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
        </svg>
      </div>

      {/* Bottom Engineering Formula & Solver Convergence Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Solver Status:{' '}
            <strong className="text-emerald-400 font-mono">
              {simulationResult.feasible
                ? 'CONVERGED & FEASIBLE'
                : 'CONSTRAINT BREACH DETECTED'}
            </strong>{' '}
            ({simulationResult.modelVersion})
          </span>
        </div>
        <span className="font-mono text-slate-300">
          Drag to pan · Scroll or +/− to zoom · Click place/asset · Exec: {simulationResult.executionMs} ms
        </span>
        <a href={OSM_ATTRIBUTION_URL} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-300 hover:text-cyan-100 underline underline-offset-2">
          © OpenStreetMap contributors · ODbL
        </a>
      </div>
    </div>
  );
};
