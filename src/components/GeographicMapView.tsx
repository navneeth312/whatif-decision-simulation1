import React, { useMemo, useState } from 'react';
import { ArrowLeft, Compass, Play, MapPin, Eye } from 'lucide-react';
import { Scenario } from '../types';
import { RegionalMapPlace } from '../models/regionalMap';
import { runBaselineSimulation } from '../models/decisionEngines';
import { DigitalTwinViewer3D } from './DigitalTwinViewer3D';
import { DigitalTwinViewer2D } from './DigitalTwinViewer2D';
import { MapCompatibilityModal } from './MapCompatibilityModal';

interface GeographicMapViewProps {
  scenario: Scenario;
  allPlaces: RegionalMapPlace[];
  activePlaceId: string;
  onSelectPlace: (placeId: string) => void;
  onBackToDashboard: () => void;
  onStartSimulationAtPlace: (placeId: string) => void;
  reducedMotion: boolean;
  viewMode?: '3d' | 'holo' | '2d';
  onChangeViewMode?: (mode: '3d' | 'holo' | '2d') => void;
}

export const GeographicMapView: React.FC<GeographicMapViewProps> = ({
  scenario,
  allPlaces,
  activePlaceId,
  onSelectPlace,
  onBackToDashboard,
  onStartSimulationAtPlace,
  reducedMotion,
  viewMode = '3d',
  onChangeViewMode
}) => {
  const baselineResult = useMemo(() => runBaselineSimulation(scenario), [scenario]);
  const [showCompatModal, setShowCompatModal] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (localStorage.getItem('whatif_dont_show_3d_compat') === 'true') return false;
      return sessionStorage.getItem('whatif_seen_3d_compat') !== 'true';
    } catch {
      return false;
    }
  });

  const handleProceed3D = () => {
    setShowCompatModal(false);
    try {
      sessionStorage.setItem('whatif_seen_3d_compat', 'true');
    } catch {
      // ignore
    }
  };

  const handleFallback2D = () => {
    setShowCompatModal(false);
    onChangeViewMode?.('2d');
    try {
      sessionStorage.setItem('whatif_seen_3d_compat', 'true');
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header Bar */}
      <header className="p-3 sm:p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Geographic Digital Twin</span>
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Read-Only Exploration
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">
              Survey real OpenStreetMap footprints, corridors, and terrain across Andhra Pradesh study region without simulation overlays.
            </p>
          </div>
        </div>

        {/* Study Area Selector, Mode Switcher & Direct Launch Action */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Map Mode Selector (3D / Holo / 2D) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => onChangeViewMode?.('3d')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === '3d'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Realistic 3D View"
            >
              3D Map
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode?.('holo')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === 'holo'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Holographic Visualization"
            >
              Holo
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode?.('2d')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                viewMode === '2d'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Flat 2D Geographic Map"
            >
              2D Map
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={activePlaceId}
              onChange={(e) => onSelectPlace(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
              aria-label="Select study area"
            >
              {allPlaces.map((pl) => (
                <option key={pl.id} value={pl.id} className="bg-slate-900 text-white">
                  {pl.label} ({pl.district})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => onStartSimulationAtPlace(activePlaceId)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            title="Launch Simulation Workspace for this study location"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Start Simulation Here</span>
          </button>
        </div>
      </header>

      {/* Main Canvas Viewport (2D or 3D) */}
      <div className="flex-1 relative w-full h-full min-h-[460px] overflow-hidden">
        {viewMode !== '2d' ? (
          <DigitalTwinViewer3D
            scenario={scenario}
            mapMode="location-selection"
            mapPlaceId={activePlaceId}
            onSelectMapPlace={onSelectPlace}
            discoveredPlaces={allPlaces}
            reducedMotion={reducedMotion}
            selectedAlternative={null}
            simulationResult={baselineResult}
            baselineResult={baselineResult}
            timelineProgress={50}
            isPlaying={false}
            playbackSpeed={1}
            selectedAssetId={null}
            onSelectAsset={() => {}}
            isComparisonView={false}
            hologram={viewMode === 'holo'}
            onFallbackTo2D={() => onChangeViewMode?.('2d')}
          />
        ) : (
          <DigitalTwinViewer2D
            scenario={scenario}
            selectedAlternative={null}
            simulationResult={baselineResult}
            baselineResult={baselineResult}
            timelineProgress={50}
            selectedAssetId={null}
            onSelectAsset={() => {}}
            mapPlaceId={activePlaceId}
            onSelectMapPlace={onSelectPlace}
            reducedMotion={reducedMotion}
          />
        )}
      </div>

      {/* 3D Map Compatibility Warning Modal */}
      <MapCompatibilityModal
        isOpen={showCompatModal && viewMode !== '2d'}
        onProceed3D={handleProceed3D}
        onFallback2D={handleFallback2D}
      />
    </div>
  );
};
