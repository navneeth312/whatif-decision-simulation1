/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LandingView } from './components/LandingView';
import { DashboardView } from './components/DashboardView';
import { GeographicMapView } from './components/GeographicMapView';
import { SimulationWorkspace } from './components/SimulationWorkspace';
import { ResultsComparisonView } from './components/ResultsComparisonView';
import { HistoryInsightsView } from './components/HistoryInsightsView';
import { ConnectedDecisionToolsModal } from './components/ConnectedDecisionToolsModal';
import { CreateScenarioModal } from './components/CreateScenarioModal';
import { ReportModal } from './components/ReportModal';
import { ImportExportModal } from './components/ImportExportModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { FirstUseWalkthroughModal } from './components/FirstUseWalkthroughModal';
import { DEFAULT_SCENARIOS, applyProblemTemplateToScenario } from './models/defaultScenarios';
import {
  clearAllLocalStorage,
  DEFAULT_LOCAL_PROFILE,
  DEFAULT_WORKSPACE_PREFERENCES,
  estimateLocalStorageBytes,
  loadLocalProfile,
  loadRunHistory,
  loadScenariosFromStorage,
  loadWorkspacePreferences,
  LocalProfileSettings,
  MapViewMode,
  saveLocalProfile,
  saveRunHistory,
  saveScenariosToStorage,
  saveWorkspacePreferences,
  SimulationRunLogEntry
} from './models/localStorageStore';
import {
  normalizeAndRankAlternatives,
  runAlternativeSimulation,
  runBaselineSimulation
} from './models/decisionEngines';
import { OSMMapFeature, REGIONAL_MAP_PLACES, RegionalMapPlace } from './models/regionalMap';
import { Scenario } from './types';

function computeInitialState() {
  const scenarios = loadScenariosFromStorage();
  const profile = loadLocalProfile();
  const prefs = loadWorkspacePreferences(scenarios);
  const runHistory = loadRunHistory();
  return { scenarios, profile, prefs, runHistory };
}

export default function App() {
  const [initialBoot] = useState(computeInitialState);
  const [scenarios, setScenarios] = useState<Scenario[]>(initialBoot.scenarios);
  const [profile, setProfile] = useState<LocalProfileSettings>(initialBoot.profile);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    initialBoot.prefs.activeScenarioId
  );
  const [selectedAltByScenario, setSelectedAltByScenario] = useState<
    Record<string, string | null>
  >(initialBoot.prefs.selectedAltIdByScenario);
  const [mapPlaceByScenario, setMapPlaceByScenario] = useState<
    Record<string, string>
  >(initialBoot.prefs.mapPlaceIdByScenario);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>(
    initialBoot.prefs.mapViewMode || initialBoot.profile.defaultMapView
  );
  const [runHistory, setRunHistory] = useState<SimulationRunLogEntry[]>(
    initialBoot.runHistory
  );
  const [workspaceStage, setWorkspaceStage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('whatif_workspace_stage');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= 1 && parsed <= 8) return parsed;
      }
    } catch {
      // ignore
    }
    return 1;
  });

  const handleWorkspaceStageChange = (stage: number) => {
    setWorkspaceStage(stage);
    try {
      localStorage.setItem('whatif_workspace_stage', String(stage));
    } catch {
      // ignore
    }
  };

  // Discovered regional OSM context shared between 2D, 3D, Workspace, and Scenario Creator
  const [discoveredPlaces, setDiscoveredPlaces] = useState<RegionalMapPlace[]>(
    REGIONAL_MAP_PLACES
  );
  const [osmFeatures, setOsmFeatures] = useState<OSMMapFeature[]>([]);

  // System reduced motion media preference combined with profile setting
  const [systemReducedMotion, setSystemReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const reducedMotion =
    profile.motionPreference === 'reduced' || systemReducedMotion;

  // Check ?autostart=1 or default to dashboard
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      setActiveTab('dashboard');
    }
  }, []);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'catalog' | 'custom' | 'ai'>('catalog');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDecisionToolsOpen, setIsDecisionToolsOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return !localStorage.getItem('whatif_walkthrough_seen');
  });

  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];

  const activeSelectedAltId: string | null =
    selectedAltByScenario[activeScenario.id] !== undefined
      ? selectedAltByScenario[activeScenario.id]
      : activeScenario.alternatives[0]?.id || null;

  const activeMapPlaceId: string =
    mapPlaceByScenario[activeScenario.id] ||
    activeScenario.studyAreaPlaceId ||
    'region';

  // Persist scenarios, workspace prefs, and run history safely to browser localStorage
  useEffect(() => {
    saveScenariosToStorage(scenarios);
  }, [scenarios]);

  useEffect(() => {
    saveWorkspacePreferences({
      activeScenarioId,
      selectedAltIdByScenario: selectedAltByScenario,
      mapPlaceIdByScenario: mapPlaceByScenario,
      mapViewMode
    });
  }, [activeScenarioId, selectedAltByScenario, mapPlaceByScenario, mapViewMode]);

  useEffect(() => {
    saveRunHistory(runHistory);
  }, [runHistory]);

  const recordRunLog = useCallback(
    (scenario: Scenario, altId: string | null, note: string) => {
      if (!profile.persistHistory) return;
      const alt = altId
        ? scenario.alternatives.find((a) => a.id === altId) || null
        : null;
      const rawResults = scenario.alternatives.map((item) =>
        runAlternativeSimulation(scenario, item)
      );
      const ranked = normalizeAndRankAlternatives(scenario, rawResults);
      const record = alt
        ? ranked.find((r) => r.alternativeId === alt.id) ||
          runAlternativeSimulation(scenario, alt)
        : runBaselineSimulation(scenario);

      const entry: SimulationRunLogEntry = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestampIso: new Date().toISOString(),
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        domain: scenario.domain,
        alternativeId: alt?.id || null,
        alternativeName: alt ? `${alt.tag}: ${alt.name}` : 'Baseline (Do Nothing)',
        primaryPerformance: record.metrics.primaryPerformance,
        primaryUnit: record.metrics.primaryPerformanceUnit,
        utilityScore: record.normalizedScores.overallUtility,
        feasible: record.feasible,
        note
      };

      setRunHistory((prev) => {
        const latest = prev[0];
        if (
          latest &&
          latest.scenarioId === entry.scenarioId &&
          latest.alternativeId === entry.alternativeId &&
          latest.note === entry.note &&
          Math.abs(latest.primaryPerformance - entry.primaryPerformance) < 0.05
        ) {
          return prev;
        }
        return [entry, ...prev].slice(0, 40);
      });
    },
    [profile.persistHistory]
  );

  const handleDiscoveredPlaces = useCallback(
    (places: RegionalMapPlace[], features?: OSMMapFeature[]) => {
      if (places.length > 0) {
        setDiscoveredPlaces((prev) =>
          places.length > prev.length ? places : prev
        );
      }
      if (features && features.length > 0) {
        setOsmFeatures((prev) =>
          features.length > prev.length ? features : prev
        );
      }
    },
    []
  );

  const handleSelectScenario = useCallback((id: string) => {
    setActiveScenarioId(id);
  }, []);

  const handleSelectAlternativeForActive = useCallback(
    (altId: string | null) => {
      setSelectedAltByScenario((prev) => ({
        ...prev,
        [activeScenario.id]: altId
      }));
      recordRunLog(activeScenario, altId, 'Alternative selected');
    },
    [activeScenario, recordRunLog]
  );

  const handleSelectMapPlaceForActive = useCallback(
    (placeId: string) => {
      setMapPlaceByScenario((prev) => ({
        ...prev,
        [activeScenario.id]: placeId
      }));
    },
    [activeScenario.id]
  );

  const handleUpdateScenario = (updatedScenario: Scenario) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === updatedScenario.id ? updatedScenario : s))
    );
    const nextAlt =
      selectedAltByScenario[updatedScenario.id] !== undefined
        ? selectedAltByScenario[updatedScenario.id]
        : updatedScenario.alternatives[0]?.id || null;
    recordRunLog(updatedScenario, nextAlt, 'Assumptions or problem updated');
  };

  const handleCreateScenario = (newScenario: Scenario) => {
    setScenarios((prev) => [newScenario, ...prev]);
    setActiveScenarioId(newScenario.id);
    const firstAlt = newScenario.alternatives[0]?.id || null;
    setSelectedAltByScenario((prev) => ({ ...prev, [newScenario.id]: firstAlt }));
    if (newScenario.studyAreaPlaceId) {
      setMapPlaceByScenario((prev) => ({
        ...prev,
        [newScenario.id]: newScenario.studyAreaPlaceId!
      }));
    }
    recordRunLog(newScenario, firstAlt, 'Created scenario');
    setActiveTab('simulation');
  };

  const handleImportScenario = (importedScenario: Scenario) => {
    setScenarios((prev) => [importedScenario, ...prev]);
    setActiveScenarioId(importedScenario.id);
    const firstAlt = importedScenario.alternatives[0]?.id || null;
    setSelectedAltByScenario((prev) => ({ ...prev, [importedScenario.id]: firstAlt }));
    recordRunLog(importedScenario, firstAlt, 'Imported scenario');
    setActiveTab('simulation');
  };

  const handleExploreScenarioDomain = (domain: 'traffic' | 'water' | 'energy') => {
    const target = scenarios.find((s) => s.domain === domain) || scenarios[0];
    setActiveScenarioId(target.id);
    setActiveTab('simulation');
  };

  const handleStartSimulation = (domainOrScenarioId?: string, placeId?: string) => {
    if (domainOrScenarioId) {
      const match =
        scenarios.find((s) => s.id === domainOrScenarioId || s.domain === domainOrScenarioId) ||
        scenarios[0];
      setActiveScenarioId(match.id);
    }
    if (placeId) {
      handleSelectMapPlaceForActive(placeId);
    }
    handleWorkspaceStageChange(1); // Enforce Step 1: Problem or Action entry
    setActiveTab('simulation');
  };

  const handleContinueActiveSimulation = () => {
    setActiveTab('simulation');
  };

  const handleLaunchProblemJourney = (domain: 'traffic' | 'water' | 'energy', problemId?: string) => {
    let target = scenarios.find((s) => s.domain === domain) || scenarios[0];
    if (problemId) {
      const updated = applyProblemTemplateToScenario(target, problemId);
      handleUpdateScenario(updated);
      setActiveScenarioId(updated.id);
      const firstAlt = updated.alternatives[0]?.id || null;
      setSelectedAltByScenario((prev) => ({ ...prev, [updated.id]: firstAlt }));
    } else {
      setActiveScenarioId(target.id);
    }
    handleWorkspaceStageChange(1); // Start from Step 1: Problem or Action
    setActiveTab('simulation');
  };

  const handleSaveProfile = (next: LocalProfileSettings) => {
    setProfile(next);
    saveLocalProfile(next);
    setMapViewMode(next.defaultMapView);
  };

  const handleResetLocalData = () => {
    clearAllLocalStorage();
    setScenarios(DEFAULT_SCENARIOS);
    setProfile(DEFAULT_LOCAL_PROFILE);
    setActiveScenarioId(DEFAULT_WORKSPACE_PREFERENCES.activeScenarioId);
    setSelectedAltByScenario({});
    setMapPlaceByScenario({});
    setMapViewMode(DEFAULT_LOCAL_PROFILE.defaultMapView);
    setRunHistory([]);
  };

  const openCreateWithMode = (mode: 'catalog' | 'custom' | 'ai' = 'catalog') => {
    setCreateModalMode(mode);
    setIsCreateModalOpen(true);
  };

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans antialiased ${reducedMotion ? 'reduced-motion' : ''}`}>
      {/* If Landing view is selected */}
      {activeTab === 'landing' ? (
        <div className="h-full flex flex-col">
          {/* Top minimal landing header */}
          <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex items-center justify-between z-20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-0.5 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-cyan-300">
                  W
                </div>
              </div>
              <span className="text-lg font-black tracking-tight text-white">WhatIf</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="hidden sm:inline-block px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 transition cursor-pointer"
              >
                {profile.displayName} (Local Only)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white transition shadow cursor-pointer"
              >
                Open Workspace →
              </button>
            </div>
          </header>

          <LandingView
            onGetStarted={() => setActiveTab('dashboard')}
            onExploreScenario={handleExploreScenarioDomain}
          />
        </div>
      ) : (
        /* Operational Command Center Layout matching reference */
        <div className="h-full w-full flex overflow-hidden">
          {/* Persistent Left Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => {
              if (tab === 'decision-tools') {
                setIsDecisionToolsOpen(true);
              } else if (tab === 'simulation') {
                handleStartSimulation();
              } else {
                setActiveTab(tab);
              }
            }}
            onOpenCreateModal={() => handleStartSimulation()}
          />

          {/* Right Main Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Navbar */}
            <Navbar
              scenarios={scenarios}
              activeScenarioId={activeScenarioId}
              profileName={profile.displayName}
              profileInitials={profile.initials}
              onSelectScenario={handleSelectScenario}
              onOpenCreateModal={() => handleStartSimulation()}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onOpenDecisionTools={() => setIsDecisionToolsOpen(true)}
              onOpenImportExport={() => setIsImportExportOpen(true)}
              onOpenProfileSettings={() => setIsProfileModalOpen(true)}
              onGoToLanding={() => setActiveTab('landing')}
              onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
            />

            {/* Dynamic View Panel */}
            <main className="flex-1 overflow-hidden flex flex-col pb-14 md:pb-0">
              {activeTab === 'dashboard' && (
                <DashboardView
                  scenarios={scenarios}
                  activeDomain={activeScenario.domain}
                  onSelectScenario={handleSelectScenario}
                  onSelectProblem={handleLaunchProblemJourney}
                  onOpenCreateModal={() => openCreateWithMode('catalog')}
                  onOpenTemplates={() => openCreateWithMode('catalog')}
                  onOpenDecisionTools={() => setIsDecisionToolsOpen(true)}
                  onOpenCompare={() => setActiveTab('compare')}
                  onOpenSimulation={() => handleStartSimulation()}
                  onContinueSimulation={handleContinueActiveSimulation}
                  onOpenMap={(mode) => {
                    if (mode) {
                      setMapViewMode(mode);
                    }
                    setActiveTab('map');
                  }}
                />
              )}

              {activeTab === 'map' && (
                <GeographicMapView
                  scenario={activeScenario}
                  allPlaces={discoveredPlaces}
                  activePlaceId={activeMapPlaceId}
                  onSelectPlace={handleSelectMapPlaceForActive}
                  onBackToDashboard={() => setActiveTab('dashboard')}
                  onStartSimulationAtPlace={(placeId) => handleStartSimulation(undefined, placeId)}
                  reducedMotion={reducedMotion}
                  viewMode={mapViewMode}
                  onChangeViewMode={setMapViewMode}
                />
              )}

              {activeTab === 'simulation' && (
                <SimulationWorkspace
                  scenario={activeScenario}
                  allScenarios={scenarios}
                  onSelectScenario={handleSelectScenario}
                  onUpdateScenario={handleUpdateScenario}
                  selectedAlternativeId={activeSelectedAltId}
                  onSelectAlternative={handleSelectAlternativeForActive}
                  initialStage={workspaceStage}
                  onStageChange={handleWorkspaceStageChange}
                  mapPlaceId={activeMapPlaceId}
                  onSelectMapPlace={handleSelectMapPlaceForActive}
                  viewMode={mapViewMode}
                  onChangeViewMode={setMapViewMode}
                  discoveredPlaces={discoveredPlaces}
                  onDiscoveredPlaces={handleDiscoveredPlaces}
                  osmFeatures={osmFeatures}
                  reducedMotion={reducedMotion}
                  onOpenDecisionTools={() => setIsDecisionToolsOpen(true)}
                  onOpenCompare={() => setActiveTab('compare')}
                  onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
                />
              )}

              {activeTab === 'compare' && (
                <ResultsComparisonView
                  scenario={activeScenario}
                  selectedAlternativeId={activeSelectedAltId}
                  onSelectAlternative={(altId) =>
                    handleSelectAlternativeForActive(altId)
                  }
                  onOpenDecisionTools={() => setIsDecisionToolsOpen(true)}
                  onOpenReportModal={() => setIsReportModalOpen(true)}
                />
              )}

              {activeTab === 'history' && (
                <HistoryInsightsView
                  scenario={activeScenario}
                  runHistory={runHistory}
                  onSelectScenarioAndOpen={(scenarioId, altId) => {
                    if (scenarios.some((s) => s.id === scenarioId)) {
                      setActiveScenarioId(scenarioId);
                      if (altId !== undefined) {
                        setSelectedAltByScenario((prev) => ({
                          ...prev,
                          [scenarioId]: altId
                        }));
                      }
                      setActiveTab('simulation');
                    }
                  }}
                  onOpenReportModal={() => setIsReportModalOpen(true)}
                  onReopenRun={() => setActiveTab('simulation')}
                />
              )}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav
              aria-label="Mobile Navigation"
              className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-slate-950/95 border-t border-slate-800 flex items-center justify-around px-2 z-40 backdrop-blur"
            >
              <button
                type="button"
                onClick={() => setActiveTab('landing')}
                className="flex flex-col items-center justify-center p-1 text-[10px] font-semibold text-slate-400 hover:text-cyan-400 cursor-pointer"
              >
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col items-center justify-center p-1 text-[10px] font-semibold cursor-pointer ${
                  activeTab === 'dashboard' ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => openCreateWithMode('catalog')}
                className="flex flex-col items-center justify-center p-1 text-[10px] font-semibold text-indigo-400 cursor-pointer"
              >
                <span>+ Create</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('simulation')}
                className={`flex flex-col items-center justify-center p-1 text-[10px] font-semibold cursor-pointer ${
                  activeTab === 'simulation' ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                <span>Sims</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`flex flex-col items-center justify-center p-1 text-[10px] font-semibold cursor-pointer ${
                  activeTab === 'map' ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                <span>Map</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('compare')}
                className={`flex flex-col items-center justify-center p-1 text-[10px] font-semibold cursor-pointer ${
                  activeTab === 'compare' ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                <span>Compare</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex flex-col items-center justify-center p-1 text-[10px] font-semibold cursor-pointer ${
                  activeTab === 'history' ? 'text-cyan-400' : 'text-slate-400'
                }`}
              >
                <span>Insights</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Global Modals */}
      {isCreateModalOpen && (
        <CreateScenarioModal
          initialMode={createModalMode}
          discoveredPlaces={discoveredPlaces}
          onClose={() => setIsCreateModalOpen(false)}
          onCreateScenario={handleCreateScenario}
        />
      )}

      {isDecisionToolsOpen && (
        <ConnectedDecisionToolsModal
          scenario={activeScenario}
          selectedAlternativeId={activeSelectedAltId}
          onClose={() => setIsDecisionToolsOpen(false)}
        />
      )}

      {isReportModalOpen && (
        <ReportModal
          scenario={activeScenario}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      {isImportExportOpen && (
        <ImportExportModal
          scenario={activeScenario}
          onImportScenario={handleImportScenario}
          onClose={() => setIsImportExportOpen(false)}
        />
      )}

      {isProfileModalOpen && (
        <ProfileSettingsModal
          profile={profile}
          storageBytes={estimateLocalStorageBytes()}
          scenarioCount={scenarios.length}
          historyCount={runHistory.length}
          onSaveProfile={handleSaveProfile}
          onResetAllData={handleResetLocalData}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {/* First-Use Guided Walkthrough Modal */}
      <FirstUseWalkthroughModal
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
