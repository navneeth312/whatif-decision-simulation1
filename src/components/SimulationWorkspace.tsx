import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Check,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Clock,
  GitCompare,
  Sliders,
  Cpu,
  Search,
  Ban,
  MapPin,
  MessageCircle,
  Car,
  Droplets,
  Zap,
  ArrowRight,
  ArrowLeft,
  FileText,
  ChevronDown,
  ChevronUp,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Send,
  Settings2,
  Info,
  Network,
  X
} from 'lucide-react';
import {
  Scenario,
  SolutionAlternative,
  ProblemStatement,
  ParameterModification,
  AlternativeRunRecord
} from '../types';
import {
  runBaselineSimulation,
  runAlternativeSimulation,
  normalizeAndRankAlternatives,
  runBaselineDiagnosis,
  runFutureIssuesUnderScenario,
  calculateAlternativeDeltas,
  composeAlternativeSequence,
  generatePracticalNextSteps,
  getAlternativeTradeOffs
} from '../models/decisionEngines';
import {
  PROBLEM_CATALOG,
  applyProblemTemplateToScenario
} from '../models/defaultScenarios';
import { DigitalTwinAdapters } from '../models/digitalTwinAdapters';
import {
  computeComparisonChanges,
  getAssetCameraFocus,
  AssetComparisonChange
} from '../models/comparisonChangeNavigator';
import {
  checkDomainEligibility,
  getDomainCoverageExplanation
} from '../models/domainEligibility';
import { assessWaterPressureSummary } from '../utils/waterPressureSummary';
import { PickedGeographicFeature } from '../models/geographicFeaturePicker';
import { ChangeNavigatorBar } from './ChangeNavigatorBar';
import { ComparisonSummaryBar } from './ComparisonSummaryBar';
import { ExplainChangeModal } from './ExplainChangeModal';
import { DigitalTwinViewer3D } from './DigitalTwinViewer3D';
import { DigitalTwinViewer2D } from './DigitalTwinViewer2D';
import {
  discoverRegionalPlacesFromOSM,
  getMapBounds,
  getMapPlace,
  loadOSMPlaceData,
  OSM_ATTRIBUTION_URL,
  OSM_CITY_COVERAGE,
  OSMMapFeature,
  REGIONAL_MAP_PLACES,
  RegionalMapPlace,
  summarizeOSMCoverage
} from '../models/regionalMap';
import { OfflineProblemAssistant } from './OfflineProblemAssistant';
import {
  parseAndValidateActionProposal,
  sanitizeActionText,
  ActionValidationStatus,
  ParsedActionProposal,
  ClarificationOption,
  DOMAIN_EXAMPLE_PROMPTS
} from '../models/actionParser';
import {
  formatCostEstimate,
  formatINR,
  convertUsdMillionToINR
} from '../utils/currencyFormatter';
import { MapCompatibilityModal } from './MapCompatibilityModal';

interface SimulationWorkspaceProps {
  scenario: Scenario;
  allScenarios?: Scenario[];
  onSelectScenario?: (id: string) => void;
  onUpdateScenario?: (updated: Scenario) => void;
  selectedAlternativeId?: string | null;
  onSelectAlternative?: (altId: string | null) => void;
  mapPlaceId?: string;
  onSelectMapPlace?: (placeId: string) => void;
  viewMode?: '3d' | 'holo' | '2d';
  onChangeViewMode?: (mode: '3d' | 'holo' | '2d') => void;
  discoveredPlaces?: RegionalMapPlace[];
  onDiscoveredPlaces?: (places: RegionalMapPlace[], features?: OSMMapFeature[]) => void;
  osmFeatures?: OSMMapFeature[];
  reducedMotion?: boolean;
  onOpenDecisionTools?: () => void;
  onOpenCompare: () => void;
  onOpenReportModal?: () => void;
  onOpenWalkthrough?: () => void;
  initialStage?: number;
  onStageChange?: (stage: number) => void;
}

const STAGES = [
  { id: 1, label: '1. Problem', title: 'Choose a Problem or Describe an Action' },
  { id: 2, label: '2. Place', title: 'Select a Place' },
  { id: 3, label: '3. Situation', title: 'Understand the Situation' },
  { id: 4, label: '4. Solutions', title: 'Compare Possible Solutions' },
  { id: 5, label: '5. Findings', title: 'Findings and Recommended Next Steps' },
  { id: 6, label: '6. Map', title: 'Map and Before/After Comparison' },
  { id: 7, label: '7. Final', title: 'Estimation Complete' }
] as const;

export const SimulationWorkspace: React.FC<SimulationWorkspaceProps> = ({
  scenario,
  allScenarios,
  onSelectScenario,
  onUpdateScenario,
  selectedAlternativeId,
  onSelectAlternative,
  mapPlaceId: controlledMapPlaceId,
  onSelectMapPlace,
  viewMode: controlledViewMode,
  onChangeViewMode,
  discoveredPlaces,
  onDiscoveredPlaces,
  osmFeatures,
  reducedMotion = false,
  onOpenDecisionTools,
  onOpenCompare,
  onOpenReportModal,
  onOpenWalkthrough,
  initialStage,
  onStageChange
}) => {
  // Navigation & Mode State
  const [activeStage, setActiveStage] = useState<number>(initialStage || 1);

  // View Mode State (3d, holo, 2d)
  const [internalViewMode, setInternalViewMode] = useState<'3d' | 'holo' | '2d'>('3d');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = useCallback(
    (mode: '3d' | 'holo' | '2d') => {
      setInternalViewMode(mode);
      onChangeViewMode?.(mode);
    },
    [onChangeViewMode]
  );

  // 3D Map Compatibility Warning Modal State
  const [show3DCompatModal, setShow3DCompatModal] = useState<boolean>(false);
  const [hasSeen3DCompat, setHasSeen3DCompat] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      if (localStorage.getItem('whatif_dont_show_3d_compat') === 'true') return true;
      return sessionStorage.getItem('whatif_seen_3d_compat') === 'true';
    } catch {
      return false;
    }
  });

  // Sync activeStage when initialStage changes externally (e.g. from Dashboard problem selection)
  useEffect(() => {
    if (initialStage && initialStage !== activeStage) {
      setActiveStage(initialStage);
    }
  }, [initialStage]);

  // Show 3D Compatibility Warning when entering 3D map views
  useEffect(() => {
    if ((activeStage === 2 || activeStage === 6) && viewMode === '3d' && !hasSeen3DCompat) {
      setShow3DCompatModal(true);
    }
  }, [activeStage, viewMode, hasSeen3DCompat]);

  const handleProceed3D = () => {
    setShow3DCompatModal(false);
    setHasSeen3DCompat(true);
    try {
      sessionStorage.setItem('whatif_seen_3d_compat', 'true');
    } catch {
      // ignore
    }
  };

  const handleFallback2D = () => {
    setViewMode('2d');
    setShow3DCompatModal(false);
    setHasSeen3DCompat(true);
    try {
      sessionStorage.setItem('whatif_seen_3d_compat', 'true');
    } catch {
      // ignore
    }
  };

  const updateStage = useCallback(
    (newStage: number) => {
      setActiveStage(newStage);
      onStageChange?.(newStage);
    },
    [onStageChange]
  );
  const [workspaceMode, setWorkspaceMode] = useState<'guided' | 'command'>('guided');
  const [journeyNavMode, setJourneyNavMode] = useState<'simple' | 'detailed'>('simple');
  const [advancedExpanded, setAdvancedExpanded] = useState<boolean>(false);
  const [placeConfirmedFeedback, setPlaceConfirmedFeedback] = useState<boolean>(false);
  const [isPlaceConfirmed, setIsPlaceConfirmed] = useState<boolean>(() => {
    return Boolean(scenario.studyAreaPlaceId || localStorage.getItem('whatif_place_confirmed') === 'true');
  });
  const [isTelemetryDismissed, setIsTelemetryDismissed] = useState<boolean>(false);

  // Simulation Coverage Overlay Toggle State (ON by default)
  const [showSimulationCoverage, setShowSimulationCoverage] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('whatif_show_simulation_coverage') !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleSimulationCoverage = (show: boolean) => {
    setShowSimulationCoverage(show);
    try {
      localStorage.setItem('whatif_show_simulation_coverage', show ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  // Step 2 Friendly First-time Location Selection Guide
  const [showLocationGuide, setShowLocationGuide] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('whatif_dont_show_location_guide') !== 'true';
    } catch {
      return true;
    }
  });

  // Inspected Feature & Confirmed Target Synchronization
  const [inspectedFeature, setInspectedFeature] = useState<PickedGeographicFeature | null>(null);
  const [confirmedSimulationTarget, setConfirmedSimulationTarget] = useState<{
    placeId: string;
    placeLabel: string;
    assetId?: string;
    assetTitle?: string;
    domain: string;
  } | null>(() => {
    return {
      placeId: scenario.studyAreaPlaceId || 'nambur',
      placeLabel: scenario.studyAreaLabel || 'Nambur Hub',
      domain: scenario.domain
    };
  });

  // Alternative Selection State
  const [internalAltId, setInternalAltId] = useState<string | null>(
    scenario.alternatives[0]?.id || null
  );
  const selectedAltId =
    selectedAlternativeId !== undefined ? selectedAlternativeId : internalAltId;

  // Simulation Controls & Telemetry
  const [isPlaying, setIsPlaying] = useState<boolean>(() => !reducedMotion);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [timelineProgress, setTimelineProgress] = useState<number>(45);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showCommandCenterHUD, setShowCommandCenterHUD] = useState<boolean>(true);
  const [showLocationHud, setShowLocationHud] = useState<boolean>(true);
  const [isCopilotDismissed, setIsCopilotDismissed] = useState<boolean>(false);
  const lastSelectedAltIdRef = useRef<string | null>(scenario.alternatives[0]?.id || null);

  // Synchronized Digital Twin Before / After Comparison Mode
  const [splitCompareMode, setSplitCompareMode] = useState<boolean>(false);
  const [comparisonSubMode, setComparisonSubMode] = useState<'side-by-side' | 'toggle' | 'difference'>('side-by-side');
  const [toggleCompareTab, setToggleCompareTab] = useState<'before' | 'after'>('after');
  const [sharedCameraState, setSharedCameraState] = useState<{
    azimuth: number;
    elevation: number;
    distance: number;
    panX: number;
    panZ: number;
  } | null>(null);
  const [mobileSplitTab, setMobileSplitTab] = useState<'before' | 'after'>('after');
  const [selectedChangeIndex, setSelectedChangeIndex] = useState<number>(0);
  const [showExplainModal, setShowExplainModal] = useState<boolean>(false);

  // Map & Place State
  const [internalMapPlaceId, setInternalMapPlaceId] = useState<string>(
    scenario.studyAreaPlaceId || 'region'
  );
  const mapPlaceId = controlledMapPlaceId ?? internalMapPlaceId;
  const setMapPlaceId = useCallback(
    (placeId: string) => {
      setInternalMapPlaceId(placeId);
      onSelectMapPlace?.(placeId);
    },
    [onSelectMapPlace]
  );

  const handleDiscoveredPlacesCallback = useCallback(
    (places: RegionalMapPlace[], features?: OSMMapFeature[]) => {
      onDiscoveredPlaces?.(places, features);
    },
    [onDiscoveredPlaces]
  );

  const handleFallbackTo2D = useCallback(() => {
    setViewMode('2d');
  }, [setViewMode]);

  const [localOsmFeatures, setLocalOsmFeatures] = useState<OSMMapFeature[]>([]);
  const [problemSearch, setProblemSearch] = useState<string>('');
  const [offlineAssistantOpen, setOfflineAssistantOpen] = useState(false);
  const [sequenceFollowUpId, setSequenceFollowUpId] = useState<string | null>(
    scenario.alternatives[1]?.id || null
  );

  useEffect(() => {
    let active = true;
    loadOSMPlaceData('region')
      .then((data) => {
        if (!active) return;
        const features = data.features || [];
        setLocalOsmFeatures(features);
        const places = discoverRegionalPlacesFromOSM(features);
        onDiscoveredPlaces?.(places, features);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [onDiscoveredPlaces]);

  const effectiveOsmFeatures = useMemo(
    () => (osmFeatures && osmFeatures.length > 0 ? osmFeatures : localOsmFeatures),
    [osmFeatures, localOsmFeatures]
  );

  const effectivePlaces = useMemo(
    () =>
      discoveredPlaces && discoveredPlaces.length > 0
        ? discoveredPlaces
        : effectiveOsmFeatures.length > 0
          ? discoverRegionalPlacesFromOSM(effectiveOsmFeatures)
          : REGIONAL_MAP_PLACES,
    [discoveredPlaces, effectiveOsmFeatures]
  );

  const groupedPlaceOptions = useMemo(() => {
    const coreIds = new Set(['region', 'nambur', 'vijayawada', 'tenali', 'guntur']);
    const overview = effectivePlaces.filter((p) => p.id === 'region');
    const cities = effectivePlaces.filter(
      (p) => p.id !== 'region' && (coreIds.has(p.id) || p.category === 'city')
    );
    const towns = effectivePlaces.filter(
      (p) => !coreIds.has(p.id) && p.category === 'town'
    );
    const districts = effectivePlaces.filter((p) => p.category === 'district');
    const mandals = effectivePlaces.filter((p) => p.category === 'mandal');
    const suburbs = effectivePlaces.filter((p) => p.category === 'suburb');
    const activePlace = getMapPlace(mapPlaceId, effectivePlaces);
    const activeIsVillage =
      activePlace &&
      activePlace.category === 'village' &&
      !coreIds.has(activePlace.id);
    return {
      overview,
      cities,
      towns,
      districts,
      mandals,
      suburbs,
      activeVillage: activeIsVillage ? activePlace : null
    };
  }, [effectivePlaces, mapPlaceId]);

  const activeMapPlace = useMemo(
    () => getMapPlace(mapPlaceId, effectivePlaces),
    [mapPlaceId, effectivePlaces]
  );

  const domainProblems: ProblemStatement[] = useMemo(() => {
    const catalog = PROBLEM_CATALOG[scenario.domain] || [];
    if (
      scenario.problemStatement &&
      !catalog.some((p) => p.id === scenario.problemStatement?.id)
    ) {
      return [scenario.problemStatement, ...catalog];
    }
    return catalog;
  }, [scenario]);

  const [selectedProblemId, setSelectedProblemId] = useState<string>(
    scenario.problemStatement?.id || domainProblems[0]?.id || ''
  );

  useEffect(() => {
    const catalog = PROBLEM_CATALOG[scenario.domain] || [];
    const nextProbId =
      scenario.problemStatement?.id || catalog[0]?.id || '';
    setSelectedProblemId(nextProbId);
    const nextAlt =
      selectedAltId && scenario.alternatives.some((a) => a.id === selectedAltId)
        ? selectedAltId
        : scenario.alternatives[0]?.id || null;
    setInternalAltId(nextAlt);
  }, [scenario.id, scenario.domain, scenario.problemStatement?.id, scenario.alternatives]);

  useEffect(() => {
    if (scenario.studyAreaPlaceId && !controlledMapPlaceId) {
      setInternalMapPlaceId(scenario.studyAreaPlaceId);
    }
  }, [scenario.id, scenario.studyAreaPlaceId, controlledMapPlaceId]);

  const activeProblem: ProblemStatement | undefined = useMemo(() => {
    return (
      domainProblems.find((p) => p.id === selectedProblemId) ||
      scenario.problemStatement ||
      domainProblems[0]
    );
  }, [domainProblems, selectedProblemId, scenario.problemStatement]);

  const filteredDomainProblems = useMemo(() => {
    if (!problemSearch.trim()) return domainProblems;
    const q = problemSearch.toLowerCase();
    return domainProblems.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.measurableSymptom.toLowerCase().includes(q) ||
        p.thresholdConstraint.toLowerCase().includes(q)
    );
  }, [domainProblems, problemSearch]);

  const handleSelectProblemTemplate = (newProblemId: string) => {
    setSelectedProblemId(newProblemId);
    const chosen = domainProblems.find((p) => p.id === newProblemId);
    if (!chosen) return;

    if (chosen.available === false) {
      if (onUpdateScenario) {
        onUpdateScenario({
          ...scenario,
          problemStatement: chosen
        });
      }
      return;
    }

    const updatedScenario = applyProblemTemplateToScenario(
      scenario,
      newProblemId
    );
    const firstAlt = updatedScenario.alternatives[0]?.id || null;
    setInternalAltId(firstAlt);
    onSelectAlternative?.(firstAlt);
    setSelectedAssetId(chosen.affectedAssetIds[0] || null);
    if (onUpdateScenario) {
      onUpdateScenario(updatedScenario);
    }
  };

  // Stage 1: Dual Workflow (Problem-First vs Action-First)
  const [stage1WorkflowMode, setStage1WorkflowMode] = useState<'problem-first' | 'action-first'>('problem-first');
  const [problemEntryMode, setProblemEntryMode] = useState<'catalog' | 'custom'>('catalog');

  // Custom problem form (both beginner-friendly and technical fields)
  const [customProblemWhat, setCustomProblemWhat] = useState('');
  const [customProblemWhere, setCustomProblemWhere] = useState('');
  const [customProblemNotes, setCustomProblemNotes] = useState('');
  const [customProblemUnknownMeasurements, setCustomProblemUnknownMeasurements] = useState(true);
  const [showCustomTechInputs, setShowCustomTechInputs] = useState(false);
  const [customTechSymptom, setCustomTechSymptom] = useState('');
  const [customTechLimit, setCustomTechLimit] = useState('');

  const [customProblemTitle, setCustomProblemTitle] = useState('');
  const [customProblemDesc, setCustomProblemDesc] = useState('');
  const [customProblemSymptom, setCustomProblemSymptom] = useState('');
  const [customProblemLimit, setCustomProblemLimit] = useState('');

  // Action-First form & Safety Validation
  const [actionVerb, setActionVerb] = useState<'build' | 'change' | 'upgrade' | 'restrict'>('upgrade');
  const [actionDescription, setActionDescription] = useState('');
  const [actionScale, setActionScale] = useState(2);
  const [actionMonths, setActionMonths] = useState(12);
  const [actionCapex, setActionCapex] = useState(8.5);
  const [actionConfirmed, setActionConfirmed] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Live Structured Action-First Validation & Semantic Parser
  const parsedActionProposal: ParsedActionProposal = useMemo(() => {
    return parseAndValidateActionProposal({
      rawText: actionDescription,
      domain: scenario.domain,
      verb: actionVerb,
      scale: actionScale,
      timingMonths: actionMonths,
      capexMillion: actionCapex,
      scenario
    });
  }, [actionDescription, scenario.domain, actionVerb, actionScale, actionMonths, actionCapex, scenario]);

  // Cleanly invalidate stale simulations & feedback whenever inputs change
  const handleActionDescriptionChange = (text: string) => {
    setActionDescription(text);
    setActionConfirmed(false);
    setActionFeedback(null);
  };

  const handleActionVerbChange = (v: typeof actionVerb) => {
    setActionVerb(v);
    setActionConfirmed(false);
    setActionFeedback(null);
  };

  const handleActionScaleChange = (scale: number) => {
    setActionScale(scale);
    setActionConfirmed(false);
    setActionFeedback(null);
  };

  const handleActionMonthsChange = (months: number) => {
    setActionMonths(months);
    setActionConfirmed(false);
    setActionFeedback(null);
  };

  const handleActionCapexChange = (capex: number) => {
    setActionCapex(capex);
    setActionConfirmed(false);
    setActionFeedback(null);
  };

  const handleApplyCustomProblem = () => {
    const whatText = customProblemWhat.trim() || customProblemTitle.trim();
    if (!whatText) return;
    const customId = `custom-prob-${Date.now()}`;
    const affected = scenario.domain === 'traffic'
      ? scenario.trafficNetwork?.cells.slice(0, 3).map((c) => c.id) || ['cell-nw-in']
      : scenario.domain === 'water'
        ? scenario.waterNetwork?.nodes.slice(0, 3).map((n) => n.id) || ['node-j1']
        : scenario.powerNetwork?.lines.slice(0, 3).map((l) => l.id) || ['line-1-2'];

    const whereText = customProblemWhere.trim();
    const notesText = customProblemNotes.trim();
    const fullDesc = [
      whatText,
      whereText ? `Observed area: ${whereText}.` : '',
      notesText ? `Details noted: ${notesText}.` : ''
    ].filter(Boolean).join(' ');

    const symptomText = customProblemUnknownMeasurements || !customTechSymptom.trim()
      ? `Observed condition: ${whatText}${whereText ? ` near ${whereText}` : ''} (Measurements not specified; standard model assumptions applied)`
      : (customTechSymptom.trim() || customProblemSymptom.trim());

    const limitText = customProblemUnknownMeasurements || !customTechLimit.trim()
      ? 'Configured design standard for normal service conditions (Clearly disclosed model baseline).'
      : (customTechLimit.trim() || customProblemLimit.trim());

    const customTemplate: ProblemStatement = {
      id: customId,
      title: whatText.length > 50 ? whatText.slice(0, 47) + '...' : whatText,
      description: fullDesc || 'User-described problem in ordinary language.',
      measurableSymptom: symptomText,
      thresholdConstraint: limitText,
      domain: scenario.domain,
      affectedAssetIds: affected,
      horizon: 'Current Peak Hour',
      units: scenario.domain === 'traffic' ? 'km/h' : scenario.domain === 'water' ? 'kPa' : 'MW',
      dataSource: 'User Normal-Language Observation with Standard Planning Assumptions',
      baselineInputsSummary: 'Configured from user description and regional baseline model topology',
      available: true
    };

    const updatedScenario: Scenario = {
      ...scenario,
      problemStatement: customTemplate
    };

    setSelectedProblemId(customId);
    if (onUpdateScenario) {
      onUpdateScenario(updatedScenario);
    }
    setActiveStage(2);
  };

  const handleStartNewAssessment = () => {
    setActiveStage(1);
    setProblemEntryMode('catalog');
    setCustomProblemWhat('');
    setCustomProblemTitle('');
    setCustomProblemWhere('');
    setCustomProblemNotes('');
    setCustomTechSymptom('');
    setCustomTechLimit('');
    setCustomProblemDesc('');
    setCustomProblemSymptom('');
    setCustomProblemLimit('');
    setActionDescription('');
  };

  const handleSimulateProposedAction = () => {
    if (parsedActionProposal.status !== 'supported-complete' || !parsedActionProposal.synthesizedAlternative) {
      return;
    }

    const proposedAlt = parsedActionProposal.synthesizedAlternative;
    const existingIndex = scenario.alternatives.findIndex((a) => a.id.startsWith('alt-action-'));
    let updatedAlternatives: SolutionAlternative[];
    if (existingIndex >= 0) {
      updatedAlternatives = [...scenario.alternatives];
      updatedAlternatives[existingIndex] = proposedAlt;
    } else {
      updatedAlternatives = [...scenario.alternatives, proposedAlt];
    }

    const updatedScenario: Scenario = {
      ...scenario,
      alternatives: updatedAlternatives
    };

    setInternalAltId(proposedAlt.id);
    onSelectAlternative?.(proposedAlt.id);
    if (onUpdateScenario) {
      onUpdateScenario(updatedScenario);
    }
    setActionFeedback(`Simulated "${proposedAlt.name}" via deterministic ${scenario.domain} solver!`);
    setActiveStage(5);
  };

  const handleSwitchDomain = (domain: 'traffic' | 'water' | 'energy') => {
    if (domain === scenario.domain) return;
    if (allScenarios && onSelectScenario) {
      const match = allScenarios.find((s) => s.domain === domain);
      if (match) {
        onSelectScenario(match.id);
        return;
      }
    }
    // Fallback: switch problem template from catalog
    const catalog = PROBLEM_CATALOG[domain] || [];
    if (catalog.length > 0) {
      const targetProb = catalog[0];
      const updated = applyProblemTemplateToScenario(
        { ...scenario, domain },
        targetProb.id
      );
      if (onUpdateScenario) {
        onUpdateScenario(updated);
      }
    }
  };

  const handleConfirmSimulationTarget = (placeId: string, feature?: PickedGeographicFeature | null) => {
    const targetPlace = effectivePlaces.find((p) => p.id === placeId) || activeMapPlace;
    const targetAssetTitle =
      feature?.title ||
      `${scenario.domain === 'traffic' ? 'Corridor' : scenario.domain === 'water' ? 'Pipeline' : 'Substation'} at ${targetPlace.label}`;
    setConfirmedSimulationTarget({
      placeId: targetPlace.id,
      placeLabel: targetPlace.label,
      assetId: feature?.id,
      assetTitle: targetAssetTitle,
      domain: scenario.domain
    });
    setMapPlaceId(targetPlace.id);
    setIsPlaceConfirmed(true);
    setPlaceConfirmedFeedback(true);
    try {
      localStorage.setItem('whatif_place_confirmed', 'true');
    } catch {
      // ignore
    }
    if (onUpdateScenario) {
      onUpdateScenario({
        ...scenario,
        studyAreaPlaceId: targetPlace.id
      });
    }
    setTimeout(() => {
      setPlaceConfirmedFeedback(false);
    }, 4500);
  };

  const handleConfirmPlace = () => {
    handleConfirmSimulationTarget(
      mapPlaceId,
      inspectedFeature && checkDomainEligibility(scenario, inspectedFeature).isEligible
        ? inspectedFeature
        : null
    );
  };

  const handleAssumptionChange = (asmId: string, newValue: number) => {
    if (!onUpdateScenario) return;
    const updatedAssumptions = scenario.assumptions.map((a) =>
      a.id === asmId ? { ...a, value: newValue } : a
    );
    onUpdateScenario({
      ...scenario,
      assumptions: updatedAssumptions
    });
  };

  const selectedAlternative: SolutionAlternative | null = useMemo(() => {
    if (!selectedAltId) return null;
    return (
      scenario.alternatives.find((a) => a.id === selectedAltId) || null
    );
  }, [scenario.alternatives, selectedAltId]);

  const sequenceFollowUp = useMemo(() => {
    const requested = scenario.alternatives.find((alternative) =>
      alternative.id === sequenceFollowUpId && alternative.id !== selectedAlternative?.id
    );
    return requested || scenario.alternatives.find((alternative) =>
      alternative.id !== selectedAlternative?.id
    ) || null;
  }, [scenario.alternatives, sequenceFollowUpId, selectedAlternative]);

  const sequenceAlternative = useMemo(() => {
    if (sequenceFollowUp) {
      return composeAlternativeSequence(selectedAlternative, sequenceFollowUp);
    }
    return selectedAlternative;
  }, [selectedAlternative, sequenceFollowUp]);

  const baselineResult = useMemo(
    () => runBaselineSimulation(scenario),
    [scenario]
  );

  const allRankedResults = useMemo(() => {
    const raw = scenario.alternatives.map((alt) =>
      runAlternativeSimulation(scenario, alt)
    );
    return normalizeAndRankAlternatives(scenario, raw);
  }, [scenario]);

  const currentResult = useMemo(() => {
    if (!selectedAlternative) return baselineResult;
    return (
      allRankedResults.find(
        (r) => r.alternativeId === selectedAlternative.id
      ) || runAlternativeSimulation(scenario, selectedAlternative)
    );
  }, [selectedAlternative, allRankedResults, baselineResult, scenario]);

  const currentDeltas = useMemo(
    () => calculateAlternativeDeltas(scenario, currentResult, baselineResult),
    [scenario, currentResult, baselineResult]
  );

  const comparisonHighlights = useMemo(() => {
    return DigitalTwinAdapters.getComparisonHighlights(
      scenario,
      baselineResult,
      currentResult,
      selectedAlternative
    );
  }, [scenario, baselineResult, currentResult, selectedAlternative]);

  // Derived Comparison Changes & Summary for Change Navigator
  const comparisonData = useMemo(() => {
    return computeComparisonChanges(scenario, baselineResult, currentResult, selectedAlternative);
  }, [scenario, baselineResult, currentResult, selectedAlternative]);

  const activeChanges = comparisonData.changes;
  const comparisonSummary = comparisonData.summary;
  const currentActiveChange = activeChanges[selectedChangeIndex] || null;

  const handleSelectChangeIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= activeChanges.length) return;
      setSelectedChangeIndex(idx);
      const chg = activeChanges[idx];
      if (chg) {
        setSelectedAssetId(chg.id);
        const focus = getAssetCameraFocus(scenario, chg.id, mapPlaceId);
        if (focus) {
          setSharedCameraState((prev) => ({
            panX: focus.x,
            panZ: focus.z,
            distance: focus.distance,
            azimuth: prev?.azimuth ?? -0.45,
            elevation: Math.max(0.4, prev?.elevation ?? 0.65)
          }));
        }
      }
    },
    [activeChanges, scenario, mapPlaceId]
  );

  useEffect(() => {
    setSelectedChangeIndex(0);
    if (activeChanges.length > 0) {
      setSelectedAssetId(activeChanges[0].id);
    }
  }, [selectedAlternative, activeChanges.length]);

  useEffect(() => {
    if (!splitCompareMode || activeChanges.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSelectChangeIndex(Math.min(activeChanges.length - 1, selectedChangeIndex + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSelectChangeIndex(Math.max(0, selectedChangeIndex - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splitCompareMode, activeChanges.length, selectedChangeIndex, handleSelectChangeIndex]);

  const selectedAssetLocalComparison = useMemo(() => {
    if (!selectedAssetId) return null;
    if (scenario.domain === 'traffic') {
      const bOut = baselineResult.rawOutput.domain === 'traffic' ? baselineResult.rawOutput.result : null;
      const cOut = currentResult.rawOutput.domain === 'traffic' ? currentResult.rawOutput.result : null;
      if (!bOut || !cOut) return null;
      const stepIdx = Math.min(bOut.timeSteps.length - 1, Math.max(0, Math.floor((timelineProgress / 100) * bOut.timeSteps.length)));
      const baseSpd = bOut.timeSteps[stepIdx]?.cellSpeeds[selectedAssetId] ?? bOut.averageSpeedKmh;
      const altSpd = cOut.timeSteps[stepIdx]?.cellSpeeds[selectedAssetId] ?? cOut.averageSpeedKmh;
      const cellName = scenario.trafficNetwork?.cells.find((c) => c.id === selectedAssetId)?.name || selectedAssetId;
      const deltaPct = Math.round(((altSpd - baseSpd) / Math.max(0.1, baseSpd)) * 100);
      return {
        name: cellName,
        base: baseSpd,
        alt: altSpd,
        unit: 'km/h',
        deltaPct
      };
    } else if (scenario.domain === 'water') {
      const bOut = baselineResult.rawOutput.domain === 'water' ? baselineResult.rawOutput.result : null;
      const cOut = currentResult.rawOutput.domain === 'water' ? currentResult.rawOutput.result : null;
      if (!bOut || !cOut) return null;
      const baseP = bOut.nodeResults[selectedAssetId]?.pressureKPa ?? bOut.minPressureKPa;
      const altP = cOut.nodeResults[selectedAssetId]?.pressureKPa ?? cOut.minPressureKPa;
      const nodeName = scenario.waterNetwork?.nodes.find((n) => n.id === selectedAssetId)?.name || selectedAssetId;
      const deltaPct = Math.round(((altP - baseP) / Math.max(0.1, Math.abs(baseP))) * 100);
      return {
        name: nodeName,
        base: baseP,
        alt: altP,
        unit: 'kPa',
        deltaPct
      };
    } else if (scenario.domain === 'energy') {
      const bOut = baselineResult.rawOutput.domain === 'energy' ? baselineResult.rawOutput.result : null;
      const cOut = currentResult.rawOutput.domain === 'energy' ? currentResult.rawOutput.result : null;
      if (!bOut || !cOut) return null;
      const baseLoad = bOut.lineFlowsMw[selectedAssetId]?.loadingPct ?? 50;
      const altLoad = cOut.lineFlowsMw[selectedAssetId]?.loadingPct ?? 50;
      const line = scenario.powerNetwork?.lines.find((l) => l.id === selectedAssetId);
      const lineName = line ? `${line.fromBusId} → ${line.toBusId}` : selectedAssetId;
      const deltaPct = Math.round(altLoad - baseLoad);
      return {
        name: lineName,
        base: baseLoad,
        alt: altLoad,
        unit: '%',
        deltaPct
      };
    }
    return null;
  }, [selectedAssetId, scenario, baselineResult, currentResult, timelineProgress]);

  const baselineProblems = useMemo(
    () => runBaselineDiagnosis(scenario),
    [scenario]
  );

  const futureRiskOutcomes = useMemo(
    () =>
      runFutureIssuesUnderScenario(
        scenario,
        selectedAlternative?.id || scenario.alternatives[0]?.id
      ),
    [scenario, selectedAlternative]
  );

  const baselineFutureOutcomes = useMemo(
    () => runFutureIssuesUnderScenario(scenario, undefined),
    [scenario]
  );

  const practicalNextSteps = useMemo(() => {
    return generatePracticalNextSteps(scenario, selectedAlternative, currentResult);
  }, [scenario, selectedAlternative, currentResult]);

  const alternativeTradeOffs = useMemo(() => {
    return getAlternativeTradeOffs(scenario, selectedAlternative, currentResult);
  }, [scenario, selectedAlternative, currentResult]);

  // Find recommended solution
  const recommendedAlternative = useMemo(() => {
    const feasibleList = allRankedResults.filter((r) => r.feasible);
    if (feasibleList.length > 0) {
      const top = [...feasibleList].sort(
        (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
      )[0];
      return scenario.alternatives.find((alt) => alt.id === top.alternativeId) || null;
    }
    // If none feasible, top utility overall
    const top = [...allRankedResults].sort(
      (a, b) => b.normalizedScores.overallUtility - a.normalizedScores.overallUtility
    )[0];
    return scenario.alternatives.find((alt) => alt.id === top?.alternativeId) || null;
  }, [allRankedResults, scenario.alternatives]);

  const sequenceResult = useMemo(() => {
    return sequenceAlternative
      ? runAlternativeSimulation(scenario, sequenceAlternative)
      : baselineResult;
  }, [scenario, sequenceAlternative, baselineResult]);

  const sequenceFutureOutcomes = useMemo(() => {
    return runFutureIssuesUnderScenario(scenario, undefined, sequenceAlternative);
  }, [scenario, sequenceAlternative]);

  const osmRegionalTotals = useMemo(
    () =>
      Object.entries(OSM_CITY_COVERAGE)
        .reduce(
          (total, [, count]) => ({
            buildingFootprints: total.buildingFootprints + count.buildingFootprints,
            roadWays: total.roadWays + count.roadWays,
            powerFeatures: total.powerFeatures + count.powerFeatures,
            waterFacilities: total.waterFacilities + count.waterFacilities
          }),
          { buildingFootprints: 0, roadWays: 0, powerFeatures: 0, waterFacilities: 0 }
        ),
    []
  );

  const activeOsmCoverage = useMemo(() => {
    if (effectiveOsmFeatures.length > 0) {
      return summarizeOSMCoverage(
        effectiveOsmFeatures,
        getMapBounds(mapPlaceId, effectivePlaces)
      );
    }
    const fallback =
      mapPlaceId === 'region'
        ? osmRegionalTotals
        : OSM_CITY_COVERAGE[mapPlaceId as keyof typeof OSM_CITY_COVERAGE] ||
        osmRegionalTotals;
    return {
      buildingFootprints: fallback.buildingFootprints,
      buildingsWithTaggedHeight: 0,
      buildingsWithEstimatedHeight: fallback.buildingFootprints,
      roadWays: fallback.roadWays,
      powerFeatures: fallback.powerFeatures,
      waterFacilities: fallback.waterFacilities,
      waterways: 0,
      railways: 0,
      namedPlaces: 0,
      adminBoundaries: 0
    };
  }, [effectiveOsmFeatures, effectivePlaces, mapPlaceId, osmRegionalTotals]);

  useEffect(() => {
    if (!isPlaying || reducedMotion) return;
    const interval = setInterval(() => {
      setTimelineProgress((prev) => (prev + playbackSpeed * 2) % 100);
    }, 350);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, reducedMotion]);

  const handleChooseAlt = (altId: string | null) => {
    if (altId) {
      lastSelectedAltIdRef.current = altId;
    }
    setInternalAltId(altId);
    if (onSelectAlternative) onSelectAlternative(altId);
  };

  // Simple 6-Step + Final Journey Mapping:
  // Step 1: Problem or Action (stage 1)
  // Step 2: Select a Place (stage 2)
  // Step 3: Understand the Situation (stage 3)
  // Step 4: Compare Possible Solutions (stage 4)
  // Step 5: Findings & Recommended Next Steps (stage 5)
  // Step 6: Map and Before/After Comparison (stage 6)
  // Final: Estimation Complete (stage 7)
  const getSimpleStepNumber = (stage: number): number => {
    if (stage <= 1) return 1;
    if (stage === 2) return 2;
    if (stage === 3) return 3;
    if (stage === 4) return 4;
    if (stage === 5) return 5;
    if (stage === 6) return 6;
    return 7;
  };

  const handleSelectSimpleStep = (stepNumber: number) => {
    setActiveStage(stepNumber);
  };

  // Plain-Language Executive Summary answering the core decision questions
  const renderPlainLanguageExecutiveSummary = () => {
    const placeName = activeMapPlace?.label || scenario.studyAreaLabel || 'Active Study Area';
    const alt = selectedAlternative;
    const domain = scenario.domain;

    // 1. What is happening?
    let whatIsHappening = '';
    if (domain === 'traffic') {
      whatIsHappening = `In ${placeName}, traffic is moving slower than normal during peak morning commute hours due to road congestion (${baselineProblems.length} issue(s) detected).`;
    } else if (domain === 'water') {
      whatIsHappening = `In ${placeName}, several residential neighborhoods receive less water pressure than required during busy morning hours, particularly in elevated areas (${baselineProblems.length} issue(s) detected).`;
    } else {
      whatIsHappening = `In ${placeName}, electricity lines carry heavy loads during peak hours, creating reliability concerns for local equipment (${baselineProblems.length} issue(s) detected).`;
    }

    // 2. Action Evaluated
    let actionChosen = '';
    if (alt) {
      const costText = alt.costDataStatus === 'not-estimated' ? 'Cost not estimated' : formatCostEstimate(alt.capexCostMillion);
      const timeText = alt.scheduleDataStatus === 'not-estimated' ? 'Timeline not estimated' : `${alt.implementationMonths} mo delivery`;
      actionChosen = `Option ${alt.tag}: "${alt.name}" (${costText}, ${timeText}). Applies ${alt.modifications.length} planned changes in the model.`;
    } else {
      actionChosen = 'Baseline (Current Situation): No changes applied. Maintaining existing conditions.';
    }

    // 3. What May Improve
    let whatMayImprove = '';
    let waterOverpressureNote: string | null = null;
    if (alt) {
      const delta = currentDeltas;
      if (domain === 'water') {
        const waterAssessment = assessWaterPressureSummary(currentResult.rawOutput, delta.primaryImprovementPct);
        whatMayImprove = waterAssessment.whatMayImprove;
        waterOverpressureNote = waterAssessment.overpressureRiskNote;
      } else {
        whatMayImprove = `${delta.primaryLabel} improves by +${delta.primaryImprovementPct}% over baseline. ${currentResult.feasible ? 'Meets all configured required conditions.' : 'Alleviates the main congestion bottleneck.'}`;
      }
    } else {
      whatMayImprove = 'Zero operational improvement. Baseline conditions remain constrained under current demand patterns.';
    }

    // 4. What Else Could Happen
    const immediateTradeOff = alternativeTradeOffs.immediateTradeOffs[0]?.detail || 'Localized flow adjustments during project commissioning.';
    const secondaryRisk = alternativeTradeOffs.secondaryConsequences[0]?.detail || 'Potential downstream volume shift.';
    let whatElseCouldHappen = `${immediateTradeOff} Secondary effect: ${secondaryRisk}`;
    if (waterOverpressureNote) {
      whatElseCouldHappen += ` ${waterOverpressureNote}`;
    }

    // 5. What to Do Next
    const whatToDoNext = alt
      ? `Check affected locations with site teams, confirm estimated cost (${formatCostEstimate(alt.capexCostMillion)}), and plan implementation in planned phases.`
      : 'Select a proposed solution above to review its estimated improvements, costs, and practical steps.';

    // Technical Details: Calculated vs Uncertain
    const solverName = domain === 'traffic' ? 'Cell Transmission Model (CTM)' : domain === 'water' ? 'Darcy-Weisbach Hydraulic Network' : 'Linearized DC Power Flow (B-Matrix)';
    const calculatedVsUncertain = `Calculated by ${solverName}: asset throughput, pressures, and thermal limits. Uncertain: future severe flood events, extreme weather surges, and demographic growth are conditional stress scenarios, not guaranteed forecasts.`;

    const isBreached = currentResult.feasibilityStatus === 'breached' || !currentResult.feasible;
    const isIncomplete = currentResult.feasibilityStatus === 'incomplete' || ((currentResult.unverifiedConstraints?.length || 0) > 0);
    const badgeLabel = isBreached
      ? (currentResult.feasibilityLabel || '⚠ Important Limits Exceeded')
      : isIncomplete
        ? (currentResult.feasibilityLabel || '⚠ Incomplete / unverified checks')
        : '✓ Within Configured Limits';
    const badgeClass = isBreached
      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
      : isIncomplete
        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';

    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/95 via-indigo-950/30 to-slate-900/95 border border-cyan-500/30 shadow-xl space-y-4">
        {/* Answer Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                Plain-Language Overview
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                Executive Briefing
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-white mt-0.5">
              Infrastructure Findings for {placeName}
            </h2>
          </div>
          <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto border ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>

        {/* Cohesive Narrative Answer Sections */}
        <div className="space-y-3.5 text-xs">
          {/* 1. What is Happening */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>1. What is Happening</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {whatIsHappening}
            </p>
          </div>

          {/* 2. Action Tested */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>2. Action Tested</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {actionChosen}
            </p>
          </div>

          {/* 3. What May Improve */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>3. What May Improve</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {whatMayImprove}
            </p>
          </div>

          {/* 4. What Else Could Happen */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>4. What Else Could Happen (Risks & Disclosures)</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {whatElseCouldHappen}
            </p>
          </div>

          {/* 5. What to Do Next */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>5. What Should Happen Next</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-xs">
              {whatToDoNext}
            </p>
          </div>

          {/* Can this solution meet the required conditions? (Concise Summary) */}
          {currentResult.hydraulicStatus && (
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-xs font-bold text-white">
                  Can this solution meet the required conditions?
                </span>
                <span className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded border self-start sm:self-auto ${currentResult.hydraulicStatus.overallFeasibilityStatus === 'feasible'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  }`}>
                  {currentResult.hydraulicStatus.overallFeasibilityStatus === 'feasible'
                    ? 'FEASIBLE — All configured hard limits are satisfied'
                    : 'NOT FEASIBLE — Important limits are still exceeded'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Water Supply</span>
                  <span className="font-semibold text-emerald-300">Meets required minimum in target areas</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Maximum Safe Pressure</span>
                  <span className={currentResult.hydraulicStatus.maxPressureStatus === 'passed' ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
                    {currentResult.hydraulicStatus.maxPressureStatus === 'passed' ? 'Within safe pressure limit' : 'Exceeds configured safe pressure'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Connected Pipes</span>
                  <span className={currentResult.hydraulicStatus.velocityStatus === 'passed' ? 'font-semibold text-emerald-300' : 'font-semibold text-amber-300'}>
                    {currentResult.hydraulicStatus.velocityStatus === 'passed' ? 'Normal flow speed' : 'Some pipes operating outside design range'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Expandable Technical Evidence & Assumptions Disclosure */}
        <details className="group border-t border-slate-800 pt-3 text-xs">
          <summary className="flex items-center justify-between text-slate-400 hover:text-cyan-300 cursor-pointer font-semibold py-1 select-none">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>View Detailed Technical Information & Calculations</span>
            </span>
            <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
          </summary>
          <div className="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-3 text-slate-300">
            {/* Technical Constraint Status Matrix inside Details */}
            {currentResult.hydraulicStatus && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                  Hydraulic Constraint Status Matrix (AWWA / CPHEEO Technical Standards)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] font-mono">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">Min Pressure (≥ 180.0 kPa)</span>
                    <span className={currentResult.hydraulicStatus.minPressureStatus === 'passed' ? 'text-emerald-300' : 'text-rose-300'}>
                      {currentResult.hydraulicStatus.minPressureMessage}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">Max Pressure (≤ 550.0 kPa)</span>
                    <span className={currentResult.hydraulicStatus.maxPressureStatus === 'passed' ? 'text-emerald-300' : 'text-rose-300'}>
                      {currentResult.hydraulicStatus.maxPressureMessage}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">Pipe Velocity (≤ 2.0 m/s standard)</span>
                    <span className={currentResult.hydraulicStatus.velocityStatus === 'passed' ? 'text-emerald-300' : 'text-amber-300'}>
                      {currentResult.hydraulicStatus.velocityMessage}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">Head-Loss Gradient (≤ 12.0 m/km standard)</span>
                    <span className={currentResult.hydraulicStatus.headLossStatus === 'passed' ? 'text-emerald-300' : 'text-amber-300'}>
                      {currentResult.hydraulicStatus.headLossMessage}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">Calculated Physics vs. Uncertainties:</span>
              <p className="text-[11.5px] text-slate-300 mt-0.5 leading-relaxed">{calculatedVsUncertain}</p>
            </div>

            {currentResult.unverifiedConstraints && currentResult.unverifiedConstraints.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-400">Unverified Constraints & Operational Limits:</span>
                <ul className="list-disc list-inside text-[11px] text-amber-200/90 mt-1 space-y-0.5">
                  {currentResult.unverifiedConstraints.map((uv, idx) => (
                    <li key={idx}>{uv}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Model Version</div>
                <div className="text-white font-bold">{currentResult.modelVersion}</div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Solve Time</div>
                <div className="text-white font-bold">{currentResult.executionMs} ms</div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Baseline Metric</div>
                <div className="text-white font-bold">{baselineResult.metrics.primaryPerformance.toFixed(1)} {baselineResult.metrics.primaryPerformanceUnit}</div>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Simulated Metric</div>
                <div className="text-white font-bold">{currentResult.metrics.primaryPerformance.toFixed(1)} {currentResult.metrics.primaryPerformanceUnit}</div>
              </div>
            </div>
          </div>
        </details>
      </div>
    );
  };

  // Reusable Digital Twin Map Component (supports clean location selection mode and full simulation mode)
  const renderDigitalTwinMap = (
    heightClass = 'min-h-[480px]',
    mode: 'location-selection' | 'simulation' = 'simulation'
  ) => (
    <div className={`flex flex-col ${heightClass} w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800`}>
      {/* Map Header Bar */}
      <div className="rounded-t-2xl border-b border-slate-800 bg-slate-900/90 px-3.5 py-2.5 space-y-1.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              {mode === 'location-selection' ? 'Study Area Location' : 'Map Area'}
            </span>
            <select
              id="regional-map-place-select"
              aria-label="Select Map Area"
              value={mapPlaceId}
              onChange={(e) => setMapPlaceId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {groupedPlaceOptions.overview.map((place) => (
                <option key={place.id} value={place.id} className="bg-slate-950 text-white">
                  {place.label} · {place.district}
                </option>
              ))}
              {groupedPlaceOptions.cities.length > 0 && (
                <optgroup label="Cities & Core Hubs" className="bg-slate-950 text-cyan-300">
                  {groupedPlaceOptions.cities.map((place) => (
                    <option key={place.id} value={place.id} className="bg-slate-950 text-white">
                      {place.label} · {place.district}
                    </option>
                  ))}
                </optgroup>
              )}
              {groupedPlaceOptions.towns.length > 0 && (
                <optgroup label="OSM Towns" className="bg-slate-950 text-cyan-300">
                  {groupedPlaceOptions.towns.map((place) => (
                    <option key={place.id} value={place.id} className="bg-slate-950 text-white">
                      {place.label} · {place.district}
                    </option>
                  ))}
                </optgroup>
              )}
              {groupedPlaceOptions.districts.length > 0 && (
                <optgroup label="Districts & Authorities" className="bg-slate-950 text-cyan-300">
                  {groupedPlaceOptions.districts.map((place) => (
                    <option key={place.id} value={place.id} className="bg-slate-950 text-white">
                      {place.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* View Mode Switcher: 3D, HOLO, 2D */}
            <div role="group" aria-label="Map view mode" className="flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-950 p-0.5">
              <button
                type="button"
                aria-pressed={viewMode === '3d'}
                onClick={() => setViewMode('3d')}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${viewMode === '3d' ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                  }`}
              >
                3D
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'holo'}
                onClick={() => setViewMode('holo')}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${viewMode === 'holo' ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                  }`}
              >
                HOLO
              </button>
              <button
                type="button"
                aria-pressed={viewMode === '2d'}
                onClick={() => setViewMode('2d')}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${viewMode === '2d' ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                  }`}
              >
                2D
              </button>
            </div>

            {mode === 'location-selection' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>Location Selection Mode</span>
              </span>
            )}
          </div>

          {/* Solution Selector Chips over Map - Only in simulation mode */}
          {mode === 'simulation' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleChooseAlt(null)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${selectedAltId === null
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Baseline
                </button>
                {scenario.alternatives.map((alt, i) => (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => handleChooseAlt(alt.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${selectedAltId === alt.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    {alt.tag || `Sol ${String.fromCharCode(65 + i)}`}
                  </button>
                ))}
              </div>

              {/* 1-Click Before / After State Indicator & Fast Switcher */}
              {selectedAlternative ? (
                <div className="flex items-center gap-1">
                  <div className="px-2 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-400/50 text-[10px] font-bold text-cyan-200 flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>AFTER IMPLEMENTATION: {selectedAlternative.tag || 'Solution'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChooseAlt(null)}
                    className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                    title="1-click switch to Before Change (Baseline)"
                  >
                    <RotateCcw className="w-3 h-3 text-indigo-400" />
                    <span>⇄ View Before (Baseline)</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>BEFORE CHANGE: Baseline</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = lastSelectedAltIdRef.current || scenario.alternatives[0]?.id || null;
                      if (targetId) handleChooseAlt(targetId);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/50 text-[10px] font-bold text-cyan-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                    title="1-click switch to After Change state"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>⇄ View After Change ({scenario.alternatives.find(a => a.id === (lastSelectedAltIdRef.current || scenario.alternatives[0]?.id))?.tag || 'Sol A'})</span>
                  </button>
                </div>
              )}

              {/* Compare Before / After Split View Toggle */}
              <button
                id="whatif-compare-toggle-btn"
                type="button"
                onClick={() => {
                  setSplitCompareMode((prev) => {
                    const next = !prev;
                    if (next) {
                      let activeAlt = selectedAlternative;
                      if (!selectedAltId && scenario.alternatives.length > 0) {
                        activeAlt = scenario.alternatives[0];
                        handleChooseAlt(activeAlt.id);
                      }
                      const focus = DigitalTwinAdapters.getInterventionCameraFocus(scenario, activeAlt, mapPlaceId);
                      if (focus) {
                        setSharedCameraState({
                          panX: focus.x,
                          panZ: focus.z,
                          distance: focus.distance,
                          azimuth: -0.45,
                          elevation: 0.65
                        });
                      }
                    }
                    return next;
                  });
                }}
                aria-pressed={splitCompareMode}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer ${splitCompareMode
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg border border-cyan-400/50'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                title="Toggle side-by-side synchronized Before (Baseline) vs After (Selected Intervention) digital twin comparison"
              >
                <GitCompare className="w-3.5 h-3.5 text-cyan-300" />
                <span>{splitCompareMode ? 'Exit Comparison' : 'Compare Before / After'}</span>
              </button>

              {/* Dedicated AI Copilot Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  if (isCopilotDismissed || !showCommandCenterHUD) {
                    setShowCommandCenterHUD(true);
                    setIsCopilotDismissed(false);
                  } else {
                    setIsCopilotDismissed(true);
                  }
                }}
                aria-pressed={showCommandCenterHUD && !isCopilotDismissed}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer ${showCommandCenterHUD && !isCopilotDismissed
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                title="Open or Close AI Copilot & Simulation Insights"
                aria-label="Toggle AI Copilot"
              >
                <Sparkles className="w-3 h-3 text-cyan-300" />
                <span>{showCommandCenterHUD && !isCopilotDismissed ? 'AI Copilot Active' : 'Open AI Copilot'}</span>
              </button>
            </div>
          )}
        </div>

        {/* OSM Coverage & Disclosures Line */}
        <div className="flex flex-wrap items-center justify-between text-[9.5px] text-slate-400 gap-2">
          <span>
            OSM: <strong className="text-slate-200">{activeOsmCoverage.buildingFootprints.toLocaleString()}</strong> footprints ·{' '}
            {activeOsmCoverage.roadWays.toLocaleString()} roads ·{' '}
            {activeOsmCoverage.powerFeatures.toLocaleString()} power ·{' '}
            {activeOsmCoverage.waterFacilities.toLocaleString()} water
            <span className="text-slate-500 ml-1">(missing heights use 4.5 m estimates)</span>
          </span>
          <a
            href={OSM_ATTRIBUTION_URL}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 hover:text-cyan-100 underline underline-offset-2"
          >
            © OpenStreetMap · ODbL
          </a>
        </div>

        {/* Synthetic Solver Network & Verified Geography Notice */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
          <span className="text-slate-300 font-semibold">Model Provenance:</span>
          <span className="truncate">
            Geographic base, roads, water bodies & {activeOsmCoverage.buildingFootprints.toLocaleString()} buildings derived from OpenStreetMap (ODbL). Network assets (pipes, cells, power lines) are calibrated synthetic solver demonstration topologies, not verified local utility drawings.
          </span>
        </div>

        {/* Top Compact Comparison Toolbar & Summary */}
        {splitCompareMode && (
          <div className="space-y-2 shrink-0">
            {/* Top Toolbar: Mode Selector & Identifier */}
            <div className="bg-slate-950/95 border border-cyan-500/30 rounded-xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Synchronized 3D Comparison
                </span>
                <span className="text-xs font-semibold text-white">
                  Baseline (Before) vs {selectedAlternative ? selectedAlternative.name : 'Selected Solution'} (After)
                </span>
              </div>

              {/* 3-Way Mode Selector */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setComparisonSubMode('side-by-side')}
                    className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                      comparisonSubMode === 'side-by-side' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparisonSubMode('toggle')}
                    className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                      comparisonSubMode === 'toggle' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Toggle View
                  </button>
                  <button
                    type="button"
                    onClick={() => setComparisonSubMode('difference')}
                    className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                      comparisonSubMode === 'difference' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Difference Only
                  </button>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 hidden lg:inline">
                  {comparisonSubMode === 'difference'
                    ? 'Highlighting Modified & Stressed Assets'
                    : 'Cameras Locked 1:1 Geospatial'}
                </span>
              </div>
            </div>

            {/* Complete Comparison Summary Bar */}
            <ComparisonSummaryBar
              summary={comparisonSummary}
              alternativeName={selectedAlternative ? selectedAlternative.name : 'Selected Alternative'}
            />
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative min-h-[360px] flex flex-col">
        {mode === 'simulation' && splitCompareMode && viewMode !== '2d' ? (
          comparisonSubMode === 'toggle' ? (
            /* Toggle View Mode: Single full-width canvas with in-place Before/After switcher */
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-cyan-500/40 shadow-xl min-h-[460px] flex flex-col">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-slate-950/95 border border-cyan-500/70 rounded-xl p-1 shadow-2xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setToggleCompareTab('before')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    toggleCompareTab === 'before'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  BEFORE (Baseline)
                </button>
                <button
                  type="button"
                  onClick={() => setToggleCompareTab('after')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    toggleCompareTab === 'after'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AFTER ({selectedAlternative?.name || 'Selected Solution'})
                </button>
              </div>
              <DigitalTwinViewer3D
                scenario={scenario}
                selectedAlternative={toggleCompareTab === 'after' ? selectedAlternative : null}
                simulationResult={toggleCompareTab === 'after' ? currentResult : baselineResult}
                baselineResult={baselineResult}
                timelineProgress={timelineProgress}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                selectedAssetId={selectedAssetId}
                onSelectAsset={(id) => {
                  setSelectedAssetId(id);
                  if (id) {
                    const idx = activeChanges.findIndex((c) => c.id === id);
                    if (idx !== -1) setSelectedChangeIndex(idx);
                  }
                }}
                onSelectMapPlace={setMapPlaceId}
                discoveredPlaces={effectivePlaces}
                onDiscoveredPlaces={handleDiscoveredPlacesCallback}
                onFallbackTo2D={handleFallbackTo2D}
                mapPlaceId={mapPlaceId}
                hologram={viewMode === 'holo'}
                reducedMotion={reducedMotion}
                externalCameraState={sharedCameraState}
                onCameraChange={setSharedCameraState}
                highlightProblemHotspot={true}
                isComparisonView={true}
                comparisonLabel={
                  toggleCompareTab === 'before'
                    ? 'BEFORE: Baseline'
                    : `AFTER: ${selectedAlternative?.name || 'Selected Solution'}`
                }
                isMapHudVisible={showCommandCenterHUD}
                onToggleMapHud={setShowCommandCenterHUD}
              />
            </div>
          ) : comparisonSubMode === 'difference' ? (
            /* Difference Only Mode: Dims baseline and highlights modified & stressed assets */
            <div className="flex-1 relative rounded-2xl overflow-hidden border border-indigo-500/50 shadow-xl min-h-[460px] flex flex-col">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-xl bg-slate-950/95 border border-indigo-500/70 text-xs font-bold font-mono text-indigo-300 shadow-2xl backdrop-blur-md flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>DIFFERENCE OVERLAY: Highlighting modified assets & newly stressed infrastructure</span>
              </div>
              <DigitalTwinViewer3D
                scenario={scenario}
                selectedAlternative={selectedAlternative}
                simulationResult={currentResult}
                baselineResult={baselineResult}
                timelineProgress={timelineProgress}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                selectedAssetId={selectedAssetId}
                onSelectAsset={(id) => {
                  setSelectedAssetId(id);
                  if (id) {
                    const idx = activeChanges.findIndex((c) => c.id === id);
                    if (idx !== -1) setSelectedChangeIndex(idx);
                  }
                }}
                onSelectMapPlace={setMapPlaceId}
                discoveredPlaces={effectivePlaces}
                onDiscoveredPlaces={handleDiscoveredPlacesCallback}
                onFallbackTo2D={handleFallbackTo2D}
                mapPlaceId={mapPlaceId}
                hologram={viewMode === 'holo'}
                reducedMotion={reducedMotion}
                externalCameraState={sharedCameraState}
                onCameraChange={setSharedCameraState}
                highlightProblemHotspot={true}
                differenceMode={true}
                isComparisonView={true}
                comparisonLabel="DIFFERENCE OVERLAY"
                isMapHudVisible={showCommandCenterHUD}
                onToggleMapHud={setShowCommandCenterHUD}
              />
            </div>
          ) : (
            /* Side-by-Side Dual Synchronized View */
            <div className="flex-1 flex flex-col md:flex-row w-full h-full min-h-[460px] gap-2">
              {/* Desktop Left / Mobile Before: Baseline Digital Twin */}
              <div
                className={`flex-1 relative rounded-2xl overflow-hidden border border-slate-700/60 shadow-lg ${
                  mobileSplitTab === 'before' ? 'flex' : 'hidden md:flex'
                }`}
              >
                <DigitalTwinViewer3D
                  scenario={scenario}
                  selectedAlternative={null}
                  simulationResult={baselineResult}
                  baselineResult={baselineResult}
                  timelineProgress={timelineProgress}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={(id) => {
                    setSelectedAssetId(id);
                    if (id) {
                      const idx = activeChanges.findIndex((c) => c.id === id);
                      if (idx !== -1) setSelectedChangeIndex(idx);
                    }
                  }}
                  onSelectMapPlace={setMapPlaceId}
                  discoveredPlaces={effectivePlaces}
                  onDiscoveredPlaces={handleDiscoveredPlacesCallback}
                  onFallbackTo2D={handleFallbackTo2D}
                  mapPlaceId={mapPlaceId}
                  hologram={viewMode === 'holo'}
                  reducedMotion={reducedMotion}
                  externalCameraState={sharedCameraState}
                  onCameraChange={setSharedCameraState}
                  highlightProblemHotspot={true}
                  isComparisonView={true}
                  comparisonLabel="BEFORE: Baseline"
                  isSecondaryTwin={true}
                  isMapHudVisible={showCommandCenterHUD}
                  onToggleMapHud={setShowCommandCenterHUD}
                />
              </div>

              {/* Desktop Right / Mobile After: Selected Intervention Digital Twin */}
              <div
                className={`flex-1 relative rounded-2xl overflow-hidden border border-cyan-500/40 shadow-lg ${
                  mobileSplitTab === 'after' ? 'flex' : 'hidden md:flex'
                }`}
              >
                <DigitalTwinViewer3D
                  scenario={scenario}
                  selectedAlternative={selectedAlternative}
                  simulationResult={currentResult}
                  baselineResult={baselineResult}
                  timelineProgress={timelineProgress}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  selectedAssetId={selectedAssetId}
                  onSelectAsset={(id) => {
                    setSelectedAssetId(id);
                    if (id) {
                      const idx = activeChanges.findIndex((c) => c.id === id);
                      if (idx !== -1) setSelectedChangeIndex(idx);
                    }
                  }}
                  onSelectMapPlace={setMapPlaceId}
                  discoveredPlaces={effectivePlaces}
                  onDiscoveredPlaces={handleDiscoveredPlacesCallback}
                  onFallbackTo2D={handleFallbackTo2D}
                  mapPlaceId={mapPlaceId}
                  hologram={viewMode === 'holo'}
                  reducedMotion={reducedMotion}
                  externalCameraState={sharedCameraState}
                  onCameraChange={setSharedCameraState}
                  highlightProblemHotspot={true}
                  isComparisonView={true}
                  comparisonLabel={`AFTER: ${selectedAlternative?.name || 'Selected Solution'}`}
                  isMapHudVisible={showCommandCenterHUD}
                  onToggleMapHud={setShowCommandCenterHUD}
                />
              </div>
            </div>
          )
        ) : viewMode !== '2d' ? (
          <DigitalTwinViewer3D
            scenario={scenario}
            selectedAlternative={mode === 'location-selection' ? null : selectedAlternative}
            simulationResult={mode === 'location-selection' ? baselineResult : currentResult}
            baselineResult={baselineResult}
            timelineProgress={timelineProgress}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            onSelectMapPlace={setMapPlaceId}
            discoveredPlaces={effectivePlaces}
            onDiscoveredPlaces={handleDiscoveredPlacesCallback}
            onFallbackTo2D={handleFallbackTo2D}
            mapPlaceId={mapPlaceId}
            hologram={viewMode === 'holo'}
            reducedMotion={reducedMotion}
            externalCameraState={sharedCameraState}
            onCameraChange={setSharedCameraState}
            highlightProblemHotspot={mode === 'simulation'}
            mapMode={mode}
            isMapHudVisible={mode === 'simulation' ? showCommandCenterHUD : showLocationHud}
            onToggleMapHud={mode === 'simulation' ? setShowCommandCenterHUD : setShowLocationHud}
            showSimulationCoverage={showSimulationCoverage}
            onToggleSimulationCoverage={handleToggleSimulationCoverage}
            onInspectFeature={(feat) => setInspectedFeature(feat)}
            onConfirmLocation={(placeId, feature) => {
              handleConfirmSimulationTarget(placeId, feature);
            }}
          />
        ) : (
          <DigitalTwinViewer2D
            scenario={scenario}
            selectedAlternative={mode === 'location-selection' ? null : selectedAlternative}
            simulationResult={mode === 'location-selection' ? baselineResult : currentResult}
            baselineResult={baselineResult}
            timelineProgress={timelineProgress}
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            onSelectMapPlace={setMapPlaceId}
            onDiscoveredPlaces={handleDiscoveredPlacesCallback}
            mapPlaceId={mapPlaceId}
            reducedMotion={reducedMotion}
          />
        )}

        {/* Compact Change Navigator Bar docked at bottom of comparison canvas */}
        {mode === 'simulation' && splitCompareMode && showCommandCenterHUD && (
          <ChangeNavigatorBar
            changes={activeChanges}
            currentIndex={selectedChangeIndex}
            onSelectIndex={handleSelectChangeIndex}
            onExplainClick={() => setShowExplainModal(true)}
            isDifferenceMode={comparisonSubMode === 'difference'}
          />
        )}

        {/* Dubai Digital Twin-inspired Floating Command Center HUD */}
        {mode === 'simulation' && showCommandCenterHUD && !splitCompareMode && (
          <>
            {/* Top-Right Floating Agentic AI Insights Card (Positioned below top toolbar) */}
            {recommendedAlternative && !isCopilotDismissed && (
              <div className="absolute top-14 right-3 z-30 pointer-events-auto w-72 sm:w-80 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.8)] space-y-2.5 transition animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-cyan-300">
                      Agentic AI Copilot
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9.5px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCopilotDismissed(true);
                      }}
                      title="Close AI Copilot"
                      aria-label="Close AI Copilot"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/60 hover:border-rose-400 transition cursor-pointer shadow-md shrink-0 font-bold"
                    >
                      <X className="w-4 h-4 text-rose-200 hover:text-white" />
                    </button>
                  </div>
                </div>

                  <div className="space-y-1">
                    <div className="text-[9px] uppercase tracking-wider font-mono text-indigo-300 font-semibold">
                      Recommended Action
                    </div>
                    <div className="text-xs font-bold text-white leading-snug line-clamp-1">
                      {recommendedAlternative.tag}: {recommendedAlternative.name}
                    </div>
                    <p className="text-[10px] text-slate-300 leading-snug line-clamp-2">
                      {recommendedAlternative.description}
                    </p>
                  </div>

                  {/* Predicted Impact Badges (Dubai Twin Style) */}
                  <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
                    <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-slate-400 block text-[8px] uppercase">Predicted Gain</span>
                      <span className="text-emerald-400 font-bold">
                        +{currentDeltas.primaryImprovementPct}% {scenario.domain === 'traffic' ? 'Speed' : scenario.domain === 'water' ? 'Pressure' : 'Loss Relief'}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-center">
                      <span className="text-slate-400 block text-[8px] uppercase">Physical Check</span>
                      <span className={`font-bold ${currentResult.feasibilityStatus === 'incomplete'
                        ? 'text-amber-300'
                        : currentResult.feasible
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                        }`}>
                        {currentResult.feasibilityStatus === 'incomplete'
                          ? 'Unverified'
                          : currentResult.feasible
                            ? 'Feasible'
                            : 'Max Exceeded'}
                      </span>
                    </div>
                  </div>

                  {/* Apply to Simulation Button */}
                  <button
                    type="button"
                    onClick={() => handleChooseAlt(recommendedAlternative.id)}
                    className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${selectedAltId === recommendedAlternative.id
                      ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/50 cursor-default'
                      : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg'
                      }`}
                  >
                    {selectedAltId === recommendedAlternative.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Active in Simulation</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Apply to Simulation</span>
                      </>
                    )}
                  </button>
                  <p className="text-[8.5px] text-slate-400 text-center font-mono">
                    Modeled action for digital-twin testing · Not actual field construction
                  </p>
                </div>
              )}

            {/* Bottom-Left: Simulated System Stress Gauge */}
            <div className="absolute bottom-3 left-3 z-20 pointer-events-auto w-56 sm:w-64 rounded-2xl bg-slate-950/92 backdrop-blur-md border border-slate-800/90 p-3 shadow-xl space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-slate-300">
                  {scenario.domain === 'traffic' ? 'Traffic Congestion (Simulated)' : scenario.domain === 'water' ? 'Water Pressure Ratio (Simulated)' : 'Grid Thermal Stress (Simulated)'}
                </span>
                <span className="text-[9px] font-mono text-cyan-300 font-bold">
                  {currentResult.metrics.primaryPerformance.toFixed(1)} {currentResult.metrics.primaryPerformanceUnit}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* SVG Radial Gauge */}
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke={
                        currentResult.feasibilityStatus === 'incomplete'
                          ? '#f59e0b'
                          : currentResult.feasible
                            ? '#10b981'
                            : '#f43f5e'
                      }
                      strokeWidth="3.5"
                      strokeDasharray="88"
                      strokeDashoffset={Math.max(
                        0,
                        88 - (88 * Math.min(96, Math.max(16, 75 - currentDeltas.primaryImprovementPct * 0.7))) / 100
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[9px] font-mono font-bold text-white">
                    {Math.round(Math.min(96, Math.max(16, 75 - currentDeltas.primaryImprovementPct * 0.7)))}%
                  </span>
                </div>
                <div className="min-w-0 text-[10px] space-y-0.5">
                  <div className="font-semibold text-slate-200 truncate">
                    {currentResult.feasible ? 'Constraints Satisfied' : currentResult.feasibilityStatus === 'incomplete' ? 'Unchecked Max Limit' : 'Active Breach Detected'}
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono">
                    Solver: {currentResult.executionMs}ms (measured) · {scenario.domain === 'traffic' ? 'CTM v2.4' : scenario.domain === 'water' ? 'Darcy-Weisbach' : 'Linearized DC Power Flow (B-Matrix)'}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderSolution8Questions = (
    alt: SolutionAlternative,
    altSim?: AlternativeRunRecord,
    isSelected?: boolean,
    isRecommendedHighlight?: boolean
  ) => {
    const isFeasible = altSim?.feasible ?? false;
    const status = altSim?.feasibilityStatus;

    const name = alt.name;
    const desc = alt.description;

    const physicalChanges = alt.modifications
      .map((m) => `${m.label}: ${m.newValue} ${m.unit}`)
      .join(', ');

    let targetProblem = '';
    if (scenario.domain === 'traffic') {
      targetProblem = 'Relieves corridor bottlenecks, improves vehicle flow rate, and reduces queue spillback.';
    } else if (scenario.domain === 'water') {
      targetProblem = 'Restores minimum required delivery pressure and prevents localized water supply deficits.';
    } else {
      targetProblem = 'Relieves transmission branch thermal overloads and maintains bus voltage stability.';
    }

    const beneficiaries = `${activeMapPlace.label} residents, commuters, and critical public utility users.`;

    const altTradeOffs = altSim ? getAlternativeTradeOffs(scenario, alt, altSim) : undefined;
    const risks = altTradeOffs?.immediateTradeOffs?.length
      ? altTradeOffs.immediateTradeOffs.map((t) => t.detail).join('; ')
      : !isFeasible
        ? `Exceeds physical or safety limits (${altSim?.feasibilityLabel || 'limits exceeded'}).`
        : 'Requires temporary construction disruption and local utility coordination.';

    const costStr =
      alt.costDataStatus === 'not-estimated'
        ? 'Cost not estimated'
        : formatCostEstimate(alt.capexCostMillion);

    const timelineStr =
      alt.scheduleDataStatus === 'not-estimated'
        ? 'Timeline not estimated'
        : `${alt.implementationMonths} Months`;

    const suitabilityText =
      status === 'incomplete'
        ? 'Incomplete validation — requires additional sensor verification.'
        : isFeasible
          ? '✓ Suitable — Operates within all physical, safety, and regulatory limits.'
          : `⚠ Not Recommended — ${altSim?.feasibilityLabel || 'Safety or physical constraint violated'}.`;

    return (
      <div
        key={alt.id}
        className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
          isSelected
            ? 'bg-indigo-950/80 border-cyan-400 text-white ring-2 ring-cyan-400/50 shadow-xl'
            : isRecommendedHighlight
              ? 'bg-slate-900/90 border-indigo-500/50 text-slate-200 hover:border-indigo-400'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow">
              Option {alt.tag}
            </span>
            {isRecommendedHighlight && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ★ Recommended Solution
              </span>
            )}
            {isSelected && (
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Selected
              </span>
            )}
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
              status === 'incomplete'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : isFeasible
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
            }`}
          >
            {status === 'incomplete' ? 'Incomplete' : isFeasible ? 'Within Limits' : 'Exceeds Limits'}
          </span>
        </div>

        {/* 8 Human Questions */}
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
              1. What is this solution?
            </span>
            <h4 className="text-sm font-bold text-white">{name}</h4>
            <p className="text-slate-300 text-[11px]">{desc}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
              2. What if we do this?
            </span>
            <p className="text-slate-300 text-[11px]">
              {physicalChanges || 'Implements targeted physical adjustments.'}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              3. What problem could it solve?
            </span>
            <p className="text-slate-300 text-[11px]">{targetProblem}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 block">
              4. What could improve?
            </span>
            <p className="text-slate-300 text-[11px]">
              {scenario.domain === 'traffic'
                ? 'Corridor vehicle travel speeds increase and peak-hour queue delays are reduced across connected lanes.'
                : scenario.domain === 'water'
                  ? 'Delivery pressure at consumer taps is restored above the minimum required standard.'
                  : 'Line thermal loading drops below operating limits, preventing potential outage cascade.'}
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
              5. Who or what could benefit?
            </span>
            <p className="text-slate-300 text-[11px]">{beneficiaries}</p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              6. What could go wrong?
            </span>
            <p className="text-slate-300 text-[11px]">{risks}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                7. Estimated Cost
              </span>
              <span className="text-sm font-bold text-cyan-300">{costStr}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                8. Expected Timeline
              </span>
              <span className="text-sm font-bold text-slate-100">{timelineStr}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block mb-1">
              9. Is this solution suitable?
            </span>
            <div
              className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                status === 'incomplete'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : isFeasible
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {suitabilityText}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleChooseAlt(alt.id)}
          aria-pressed={isSelected}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
            isSelected
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{isSelected ? 'Active Solution for Simulation' : 'Select This Solution'}</span>
        </button>
      </div>
    );
  };

  const renderBaseline8Questions = () => {
    const isSelected = selectedAltId === null;

    return (
      <div
        className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 ${
          isSelected
            ? 'bg-indigo-950/80 border-cyan-400 text-white ring-2 ring-cyan-400/50 shadow-xl'
            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300">
              Baseline (Do Nothing)
            </span>
            {isSelected && (
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Selected
              </span>
            )}
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border bg-rose-500/20 text-rose-300 border-rose-500/40">
            Unresolved Issues
          </span>
        </div>

        <div className="space-y-3 text-xs leading-relaxed">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block">
              1. What is this solution?
            </span>
            <h4 className="text-sm font-bold text-white">Do Nothing (Current Network)</h4>
            <p className="text-slate-300 text-[11px]">
              Maintains all existing physical roads, pipes, and electrical lines in their current state without changes.
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
              2. What if we do this?
            </span>
            <p className="text-slate-300 text-[11px]">
              No capital budget is committed and no construction disruption occurs.
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              3. What problem could it solve?
            </span>
            <p className="text-slate-300 text-[11px]">
              None. The existing bottleneck and limit breaches remain completely unresolved.
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
              4. Who or what could benefit?
            </span>
            <p className="text-slate-300 text-[11px]">
              Saves immediate municipal expenditure, but local residents and users continue facing degraded service.
            </p>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
              5. What could go wrong?
            </span>
            <p className="text-slate-300 text-[11px]">
              Congestion, low water pressure, or equipment thermal overloads worsen as population and demand grow.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                6. Estimated Cost
              </span>
              <span className="text-sm font-bold text-slate-100">{formatCostEstimate(0)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                7. Expected Timeline
              </span>
              <span className="text-sm font-bold text-slate-100">Immediate (No work)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block mb-1">
              8. Is this solution suitable?
            </span>
            <div className="p-2.5 rounded-xl border text-[11px] font-semibold bg-rose-500/10 border-rose-500/30 text-rose-300">
              ⚠ Unsuitable — Active bottlenecks and safety/service violations continue.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleChooseAlt(null)}
          aria-pressed={isSelected}
          className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
            isSelected
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{isSelected ? 'Active Baseline for Comparison' : 'Select Baseline'}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-5 whatif-canvas-bg text-slate-100 max-w-7xl mx-auto w-full">
      <div role="status" aria-live="polite" className="sr-only">
        {`Step ${getSimpleStepNumber(activeStage)} of 7: ${STAGES[activeStage - 1]?.title || ''}. Study area: ${activeMapPlace.label}. Selected option: ${selectedAlternative ? `Option ${selectedAlternative.tag} ${selectedAlternative.name}` : 'Baseline'}.`}
      </div>
      {/* TOP HEADER: Breadcrumbs & Mode Switcher */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Problem-Solving Workspace
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              {scenario.domain} Solver
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
              Synthetic Demo Data
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Active Problem: <strong className="text-cyan-300">{activeProblem?.title || scenario.title}</strong>
          </p>
        </div>

        {/* View Mode & Tools Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch: Simple 4-Step vs Advanced 8 Stages vs Command Center */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setWorkspaceMode('guided');
                setJourneyNavMode('simple');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${workspaceMode === 'guided' && journeyNavMode === 'simple'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Simple Mode
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkspaceMode('guided');
                setJourneyNavMode('detailed');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${workspaceMode === 'guided' && journeyNavMode === 'detailed'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Advanced (8 Stages)
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode('command')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${workspaceMode === 'command'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Full Command Center
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOfflineAssistantOpen((open) => !open)}
            aria-expanded={offlineAssistantOpen}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Ask WhatIf · Offline</span>
          </button>

          {onOpenWalkthrough && (
            <button
              type="button"
              onClick={onOpenWalkthrough}
              aria-label="Open WhatIf User Guide"
              className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Guide</span>
            </button>
          )}
        </div>
      </header>

      {/* Offline Assistant Drawer if open */}
      {offlineAssistantOpen && (
        <OfflineProblemAssistant
          scenario={scenario}
          activeProblem={activeProblem}
          baselineResult={baselineResult}
          selectedResult={currentResult}
          alternatives={allRankedResults}
          baselineProblems={baselineProblems}
          futureOutcomes={futureRiskOutcomes}
          onClose={() => setOfflineAssistantOpen(false)}
        />
      )}

      {/* Central Guiding Question Banner (Clean, Calm, Single Entry) */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-cyan-950/70 border border-indigo-500/30 rounded-2xl p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-cyan-300 font-bold shrink-0">
            ?
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-wider uppercase text-cyan-400">
              Central Problem-Solving Question
            </p>
            <p className="text-xs sm:text-sm font-semibold text-slate-100 italic">
              “If I take this action here, what may improve, what else could happen, and what should I do next?”
            </p>
          </div>
        </div>
      </div>

      {/* GUIDED JOURNEY PROGRESS RAIL: SIMPLE 6-STEP + FINAL SCREEN (DEFAULT) */}
      {journeyNavMode === 'simple' ? (
        <nav aria-label="Simple Problem-Solving Journey" className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-xs uppercase tracking-wider text-cyan-400 font-bold">
                Clear Problem-Solving Path
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {activeStage === 7 ? 'Final Estimation' : `Step ${getSimpleStepNumber(activeStage)} of 6`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setJourneyNavMode('detailed')}
              className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer self-start sm:self-auto flex items-center gap-1.5"
            >
              <span>Show Detailed Engineering View</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { num: 1, title: '1. Problem or Action', subtitle: 'What issue or proposal?', stages: [1] },
              { num: 2, title: '2. Select a Place', subtitle: 'Where is this located?', stages: [2] },
              { num: 3, title: '3. Understand Situation', subtitle: 'What did we find?', stages: [3] },
              { num: 4, title: '4. Compare Solutions', subtitle: 'Evaluate options A, B, C', stages: [4] },
              { num: 5, title: '5. Findings & Next Steps', subtitle: 'Results & practical plan', stages: [5] },
              { num: 6, title: '6. Map & Comparison', subtitle: '3D twin before/after map', stages: [6] },
              { num: 7, title: 'Final. Estimation Complete', subtitle: 'Summary & final report', stages: [7] }
            ].map((st) => {
              const currentStep = getSimpleStepNumber(activeStage);
              const isCurrent = currentStep === st.num;
              const isPast = currentStep > st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => handleSelectSimpleStep(st.num)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex items-center gap-2 ${isCurrent
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                    : isPast
                      ? 'bg-slate-900/90 border-cyan-500/30 text-cyan-200'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isCurrent
                    ? 'bg-white text-indigo-700'
                    : isPast
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800 text-slate-400'
                    }`}>
                    {isPast ? <Check className="w-3 h-3" /> : st.num === 7 ? '✓' : st.num}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">{st.title}</div>
                    <div className={`text-[9px] truncate ${isCurrent ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {st.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
        <nav aria-label="Problem-Solving Stages" className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2 sm:p-2.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-2">
            <span>Current Stage: <strong className="text-white">{STAGES[activeStage - 1]?.title}</strong></span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-400">Step {activeStage} of 7</span>
              <button
                type="button"
                onClick={() => setJourneyNavMode('simple')}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 cursor-pointer"
              >
                Switch to Simple View
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {STAGES.map((stg) => {
              const isActive = activeStage === stg.id;
              const isCompleted = activeStage > stg.id;
              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => setActiveStage(stg.id)}
                  aria-current={isActive ? 'step' : undefined}
                  className={`px-2.5 py-1.5 rounded-xl text-left transition flex items-center gap-1.5 cursor-pointer text-xs ${isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                    : isCompleted
                      ? 'bg-slate-900/90 text-cyan-300 border border-cyan-500/25 hover:border-cyan-500/50'
                      : 'bg-slate-900/40 text-slate-400 border border-slate-800/80 hover:text-slate-200'
                    }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isActive
                    ? 'bg-white text-indigo-700'
                    : isCompleted
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-slate-800 text-slate-400'
                    }`}>
                    {isCompleted ? <Check className="w-2.5 h-2.5" /> : stg.id}
                  </span>
                  <span className="truncate">{stg.label.replace(/^\d+\.\s*/, '')}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Unavailable Problem Banner if selected */}
      {activeProblem?.available === false && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3 text-xs text-rose-200">
          <Ban className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <span>Unmodeled Physics Disclosure: {activeProblem.title}</span>
            </div>
            <p className="text-rose-200/90 leading-relaxed">
              {activeProblem.unavailableReason ||
                'This phenomenon requires equations not implemented in the current simplified deterministic domain solver. No fabricated metrics are generated for this problem.'}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* GUIDED JOURNEY VIEW: Renders the active stage focusedly      */}
      {/* ------------------------------------------------------------- */}
      {workspaceMode === 'guided' ? (
        <div className="flex flex-col gap-6">
          {/* STAGE 1: CHOOSE A DOMAIN & PROBLEM OR PROPOSE ACTION */}
          {activeStage === 1 && (
            <div className="space-y-5">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">Step 1:</span> Choose Domain & Problem or Propose Action
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Start problem-first with an observed operational bottleneck, or action-first by proposing an infrastructure intervention to simulate.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[10.5px] text-cyan-300 font-semibold">
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dual Workflow Enabled</span>
                </div>
              </div>

              {/* Top Workflow Mode Switcher: Problem-First vs Action-First */}
              <div className="flex flex-col sm:flex-row rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStage1WorkflowMode('problem-first')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${stage1WorkflowMode === 'problem-first'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                >
                  <HelpCircle className="w-4 h-4 text-cyan-300" />
                  <span>Problem-First: "This problem is happening here. What could we do?"</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStage1WorkflowMode('action-first')}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${stage1WorkflowMode === 'action-first'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Action-First: "What if we build, change, upgrade, or restrict this here?"</span>
                </button>
              </div>

              {/* Domain Switcher */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSwitchDomain('traffic')}
                  className={`p-4 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${scenario.domain === 'traffic'
                    ? 'bg-slate-900 border-cyan-400 text-white shadow-md'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                >
                  <Car className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Road Traffic & Corridors</div>
                    <div className="text-[10px] text-slate-400">14 Problem Statements</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchDomain('water')}
                  className={`p-4 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${scenario.domain === 'water'
                    ? 'bg-slate-900 border-cyan-400 text-white shadow-md'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                >
                  <Droplets className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Municipal Water Systems</div>
                    <div className="text-[10px] text-slate-400">14 Problem Statements</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchDomain('energy')}
                  className={`p-4 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${scenario.domain === 'energy'
                    ? 'bg-slate-900 border-cyan-400 text-white shadow-md'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                >
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Electrical Power Grid</div>
                    <div className="text-[10px] text-slate-400">14 Problem Statements</div>
                  </div>
                </button>
              </div>

              {/* PROBLEM-FIRST BRANCH */}
              {stage1WorkflowMode === 'problem-first' && (
                <div className="space-y-4">
                  {/* Sub-Tabs: Curated Catalog vs Custom Problem */}
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setProblemEntryMode('catalog')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${problemEntryMode === 'catalog'
                        ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      Curated Problem Catalog (14 Templates)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProblemEntryMode('custom')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${problemEntryMode === 'custom'
                        ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Describe Custom Problem in Plain Language</span>
                    </button>
                  </div>

                  {problemEntryMode === 'catalog' ? (
                    <>
                      {/* Problem Filter Bar */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                          type="text"
                          value={problemSearch}
                          onChange={(e) => setProblemSearch(e.target.value)}
                          aria-label={`Search ${domainProblems.length} ${scenario.domain} problem statements`}
                          placeholder={`Search ${domainProblems.length} ${scenario.domain} problem statements...`}
                          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      {/* Problem Statements List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                        {filteredDomainProblems.map((prob) => {
                          const isSelected = prob.id === selectedProblemId;
                          const isSupported = prob.available !== false;
                          return (
                            <button
                              key={prob.id}
                              type="button"
                              onClick={() => handleSelectProblemTemplate(prob.id)}
                              className={`p-4 rounded-xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${isSelected
                                ? 'bg-indigo-950/80 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.15)] ring-1 ring-cyan-400/50'
                                : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/50'
                                }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="text-xs font-bold text-white">{prob.title}</h3>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${isSupported
                                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                                    }`}>
                                    {isSupported ? 'Supported' : 'Unmodeled'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                  {prob.description}
                                </p>
                              </div>

                              <div className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px] font-medium">
                                <div className="flex justify-between text-slate-400">
                                  <span>Symptom:</span>
                                  <span className="text-rose-300 truncate ml-2">{prob.measurableSymptom}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                  <span>Limit:</span>
                                  <span className="text-cyan-300 truncate ml-2">{prob.thresholdConstraint}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Stage Navigation */}
                      <div className="flex justify-end pt-3 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setActiveStage(2)}
                          className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
                        >
                          <span>{journeyNavMode === 'simple' ? 'Proceed to Step 2: Place & Geography' : 'Continue to Stage 2: Place & Geography'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Custom Problem Entry Form */
                    <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-400" />
                          <span>Describe a Problem in Simple Words</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Tell WhatIf what you or residents are noticing. No engineering background is needed.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label htmlFor="custom-problem-what" className="text-xs font-bold text-slate-200">
                            1. What is happening? <span className="text-rose-400">*</span>
                          </label>
                          <input
                            id="custom-problem-what"
                            type="text"
                            value={customProblemWhat}
                            onChange={(e) => setCustomProblemWhat(e.target.value)}
                            placeholder={scenario.domain === 'traffic'
                              ? 'e.g., Traffic gets stuck near the market during morning peak hours'
                              : scenario.domain === 'water'
                                ? 'e.g., Water pressure drops severely in high-elevation residential zones'
                                : 'e.g., Frequent voltage dips and feeder trips during summer evening peak'}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="custom-problem-where" className="text-xs font-bold text-slate-200">
                            2. Where are you noticing this?
                          </label>
                          <input
                            id="custom-problem-where"
                            type="text"
                            value={customProblemWhere}
                            onChange={(e) => setCustomProblemWhere(e.target.value)}
                            placeholder="e.g., Main bypass corridor, Sector 4, or nearby hospital junction"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="custom-problem-notes" className="text-xs font-bold text-slate-200">
                            3. Tell us anything else you noticed (optional)
                          </label>
                          <textarea
                            id="custom-problem-notes"
                            rows={2}
                            value={customProblemNotes}
                            onChange={(e) => setCustomProblemNotes(e.target.value)}
                            placeholder="e.g., Long queues back up past the intersection; worse on weekends..."
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 resize-none"
                          />
                        </div>

                        <div className="pt-1">
                          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={customProblemUnknownMeasurements}
                              onChange={(e) => setCustomProblemUnknownMeasurements(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400 focus:ring-offset-slate-950"
                            />
                            <span>I don&apos;t know the exact measurements (WhatIf will use reasonable planning standards)</span>
                          </label>
                        </div>

                        {/* Optional Technical Section */}
                        <div className="pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setShowCustomTechInputs((prev) => !prev)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 cursor-pointer"
                          >
                            <span>Optional: Add technical numbers (speeds, pressures, flow rates)</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCustomTechInputs ? 'rotate-180' : ''}`} />
                          </button>

                          {showCustomTechInputs && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                              <div className="space-y-1">
                                <label htmlFor="custom-tech-symptom" className="text-[11px] font-semibold text-slate-300">Measurable Symptom</label>
                                <input
                                  id="custom-tech-symptom"
                                  type="text"
                                  value={customTechSymptom}
                                  onChange={(e) => setCustomTechSymptom(e.target.value)}
                                  placeholder="e.g., Speed < 18 km/h or Pressure < 120 kPa"
                                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <label htmlFor="custom-tech-limit" className="text-[11px] font-semibold text-slate-300">Engineering Constraint / Threshold</label>
                                <input
                                  id="custom-tech-limit"
                                  type="text"
                                  value={customTechLimit}
                                  onChange={(e) => setCustomTechLimit(e.target.value)}
                                  placeholder="e.g., Minimum speed >= 30 km/h or Pressure >= 140 kPa"
                                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={handleApplyCustomProblem}
                          disabled={!customProblemWhat.trim() && !customProblemTitle.trim()}
                          className="py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-600/20"
                        >
                          <span>Save Problem & Continue to Step 2: Select a Place</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION-FIRST BRANCH */}
              {stage1WorkflowMode === 'action-first' && (
                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-5">
                  <div className="border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Action-First Simulation</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">
                      “What if we build, change, operate, upgrade, or restrict this here?”
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Propose an engineering intervention directly in plain language, adjust scale and timeline parameters, and simulate immediate deterministic outcomes.
                    </p>
                  </div>

                  {/* Action Verb Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">1. Action Verb</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { verb: 'build', label: 'Build', desc: 'New bypass, retention basin, or spur' },
                        { verb: 'change', label: 'Change', desc: 'Signal splits, valve direction, dispatch' },
                        { verb: 'upgrade', label: 'Upgrade', desc: 'Add lane, widen conduit, battery storage' },
                        { verb: 'restrict', label: 'Restrict', desc: 'Demand management, throttling, pricing' }
                      ].map((item) => (
                        <button
                          key={item.verb}
                          type="button"
                          onClick={() => handleActionVerbChange(item.verb as typeof actionVerb)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${actionVerb === item.verb
                            ? 'bg-cyan-950/80 border-cyan-400 text-white ring-1 ring-cyan-400/40'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                        >
                          <div className="text-xs font-bold text-cyan-300 capitalize">{item.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Proposed Action Plain-Language Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="action-first-proposal" className="text-xs font-bold text-slate-300">2. Propose Action in Plain Language</label>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {actionDescription.length}/500 chars
                      </span>
                    </div>
                    <textarea
                      id="action-first-proposal"
                      rows={2}
                      value={actionDescription}
                      onChange={(e) => handleActionDescriptionChange(e.target.value)}
                      placeholder={`e.g. ${scenario.domain === 'traffic'
                        ? 'Add a dedicated peak-hour express lane and coordinate green-wave timing on the northern arterial corridor'
                        : scenario.domain === 'water'
                          ? 'Install a booster pump station and upgrade main conduit diameter to maintain minimum service pressure'
                          : 'Reconductor transmission feeder lines and deploy 40 MWh utility-scale battery storage for peak support'
                        }`}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>

                  {/* Essential Inputs: Scale, Timing, Budget */}
                  <div className="space-y-2">
                    <span id="action-first-essential-inputs" className="text-xs font-bold text-slate-300 block">3. Essential Model Inputs (Scale & Timing)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5" role="group" aria-labelledby="action-first-essential-inputs">
                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label htmlFor="action-scale-range" className="text-slate-300">Scale / Magnitude:</label>
                          <span className="text-cyan-300 font-bold">Level {actionScale}x</span>
                        </div>
                        <input
                          id="action-scale-range"
                          type="range"
                          min="1"
                          max="4"
                          step="1"
                          value={actionScale}
                          aria-valuetext={`Level ${actionScale}x`}
                          onChange={(e) => handleActionScaleChange(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                        <div className="text-[10px] text-slate-400">
                          {scenario.domain === 'traffic'
                            ? `+${actionScale} dedicated lane(s)`
                            : scenario.domain === 'water'
                              ? `+${(actionScale * 0.4).toFixed(1)} bar booster pressure`
                              : `+${actionScale * 25} MW line capacity`}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label htmlFor="action-months-range" className="text-slate-300">Delivery Timing:</label>
                          <span className="text-cyan-300 font-bold">{actionMonths} mo</span>
                        </div>
                        <input
                          id="action-months-range"
                          type="range"
                          min="3"
                          max="36"
                          step="3"
                          value={actionMonths}
                          aria-valuetext={`${actionMonths} months`}
                          onChange={(e) => handleActionMonthsChange(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                        <div className="text-[10px] text-slate-400">Estimated civil delivery horizon</div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <label htmlFor="action-capex-range" className="text-slate-300">Capital Budget:</label>
                          <span className="text-cyan-300 font-bold">{formatCostEstimate(actionCapex)}</span>
                        </div>
                        <input
                          id="action-capex-range"
                          type="range"
                          min="1.0"
                          max="35.0"
                          step="0.5"
                          value={actionCapex}
                          aria-valuetext={formatCostEstimate(actionCapex)}
                          onChange={(e) => handleActionCapexChange(Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                        <div className="text-[10px] text-slate-400">Estimated budget (${actionCapex.toFixed(1)}M USD reference)</div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Structured Action-First Validation & Semantic Parser Card */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-300">4. Physical Validation & Model Handoff</label>

                    {/* STATUS 1: UNRELATED OR INVALID */}
                    {parsedActionProposal.status === 'unrelated-or-invalid' && (
                      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 text-xs space-y-3">
                        <div className="flex items-start gap-2.5 text-rose-300">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="font-bold text-rose-200">
                              {parsedActionProposal.statusLabel}
                            </div>
                            <p className="text-slate-300 leading-relaxed">
                              {parsedActionProposal.rejectionReason}
                            </p>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                              {parsedActionProposal.guidanceMessage}
                            </p>
                          </div>
                        </div>

                        {parsedActionProposal.examplePrompts && parsedActionProposal.examplePrompts.length > 0 && (
                          <div className="pt-2 border-t border-rose-900/40 space-y-1.5">
                            <span className="text-[10px] font-bold text-rose-300/80 uppercase tracking-wider block">
                              Verified {scenario.domain.toUpperCase()} Example Prompts (Click to Use):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {parsedActionProposal.examplePrompts.map((prompt, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleActionDescriptionChange(prompt)}
                                  className="text-[11px] px-3 py-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 border border-rose-700/50 text-rose-100 text-left transition cursor-pointer"
                                >
                                  + {prompt}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STATUS 2: RELEVANT BUT UNSUPPORTED (UNMODELED PHYSICS BOUNDARY) */}
                    {parsedActionProposal.status === 'relevant-unsupported' && (
                      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/50 text-xs space-y-3">
                        <div className="flex items-start gap-2.5 text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-200">{parsedActionProposal.statusLabel}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900/60 text-amber-300 border border-amber-600/40">
                                Physical Boundary
                              </span>
                            </div>
                            <div className="font-semibold text-white">
                              {parsedActionProposal.unmodeledPhenomenon}
                            </div>
                            <p className="text-slate-300 leading-relaxed">
                              {parsedActionProposal.whyUnmodeled}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-amber-900/30 text-[11px]">
                          <div>
                            <span className="text-amber-400/80 font-bold block mb-0.5">Required Real-World Data:</span>
                            <span className="text-slate-300">{parsedActionProposal.requiredDataOrModel}</span>
                          </div>
                          <div>
                            <span className="text-emerald-400/80 font-bold block mb-0.5">Recommended Modeled Alternative:</span>
                            <span className="text-slate-300">{parsedActionProposal.recommendedSupportedAlternative}</span>
                          </div>
                        </div>

                        {parsedActionProposal.suggestedActionPrompt && (
                          <div className="pt-2 border-t border-amber-900/40 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleActionDescriptionChange(parsedActionProposal.suggestedActionPrompt!)}
                              className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                              <span>Use Recommended Modeled Action →</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STATUS 3: AMBIGUOUS OR INCOMPLETE INTENT */}
                    {parsedActionProposal.status === 'ambiguous-incomplete' && (
                      <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/50 text-xs space-y-3">
                        <div className="flex items-start gap-2.5 text-indigo-300">
                          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-indigo-200">{parsedActionProposal.statusLabel}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-600/40">
                                Intent Recognized
                              </span>
                            </div>
                            <p className="text-slate-300 font-medium">
                              {parsedActionProposal.clarificationQuestion}
                            </p>
                          </div>
                        </div>

                        {parsedActionProposal.clarificationOptions && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                            {parsedActionProposal.clarificationOptions.map((opt, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleActionDescriptionChange(opt.actionText)}
                                className="p-3 rounded-xl bg-slate-900/90 hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-500/50 text-left transition cursor-pointer space-y-1 group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-indigo-300 text-xs group-hover:text-indigo-200">
                                    {opt.label}
                                  </span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-200 border border-indigo-700/40">
                                    {opt.impactSummary}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">
                                  {opt.description}
                                </p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* STATUS 4: SUPPORTED & COMPLETE */}
                    {parsedActionProposal.status === 'supported-complete' && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-3.5 ring-1 ring-cyan-500/20">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="text-xs font-bold text-white">
                              {parsedActionProposal.statusLabel}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                              Physics-Validated
                            </span>
                          </div>
                          <span className="text-[10px] text-cyan-300 font-semibold px-2.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50" title={parsedActionProposal.confidenceLabel}>
                            {parsedActionProposal.confidenceLabel || `Semantic Match: Supported Template (${Math.round(parsedActionProposal.confidenceScore * 100)}%)`}
                          </span>
                        </div>

                        {/* Modeled Mechanism Summary */}
                        <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-xs">
                          <span className="text-cyan-300 font-bold block mb-1">Modeled Engineering Mechanism:</span>
                          <p className="text-slate-200 leading-relaxed">
                            {parsedActionProposal.modeledMechanismSummary}
                          </p>
                        </div>

                        {/* Cost & Timeline Review (INR formatted) */}
                        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">Estimated Cost</span>
                            <span className="font-bold text-cyan-300">{formatCostEstimate(parsedActionProposal.estimatedCapexMillion ?? 0)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">Annual Maintenance</span>
                            <span className="font-bold text-slate-300">{formatCostEstimate(parsedActionProposal.estimatedOpexMillion ?? 0)}/yr</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">Civil Timeline</span>
                            <span className="font-bold text-slate-100">{parsedActionProposal.deliveryMonths} months</span>
                          </div>
                        </div>

                        {/* Expandable Technical Governing Equations and Deltas */}
                        <details className="group border border-slate-800 rounded-lg p-2.5 bg-slate-900/60 text-xs">
                          <summary className="cursor-pointer text-slate-400 hover:text-cyan-300 font-semibold select-none flex items-center justify-between">
                            <span>View Detailed Technical Equations & Parameter Deltas</span>
                            <span className="text-[10px] text-cyan-400 group-open:rotate-180 transition-transform">▼</span>
                          </summary>
                          <div className="pt-2 space-y-3">
                            {/* Parameter Deltas Table */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-slate-300 block">
                                Target Asset & Solver Parameter Deltas:
                              </span>
                              <div className="overflow-x-auto rounded-lg border border-slate-800">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
                                    <tr>
                                      <th className="px-3 py-1.5">Target Asset</th>
                                      <th className="px-3 py-1.5">Parameter</th>
                                      <th className="px-3 py-1.5">Baseline</th>
                                      <th className="px-3 py-1.5">Target Value</th>
                                      <th className="px-3 py-1.5">Unit</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                    {parsedActionProposal.modifications?.map((mod, idx) => (
                                      <tr key={idx} className="hover:bg-slate-900/40">
                                        <td className="px-3 py-2 text-cyan-300 font-sans font-semibold">
                                          {parsedActionProposal.targetAssetName}
                                        </td>
                                        <td className="px-3 py-2 text-slate-200">{mod.label}</td>
                                        <td className="px-3 py-2 text-slate-400">{mod.originalValue}</td>
                                        <td className="px-3 py-2 text-emerald-400 font-bold">
                                          {mod.newValue}
                                        </td>
                                        <td className="px-3 py-2 text-slate-400">{mod.unit}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Governing Equation */}
                            {parsedActionProposal.governingEquation && (
                              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1 font-mono">
                                <div className="flex items-center justify-between text-indigo-300 font-bold font-sans">
                                  <span>Governing Model: {parsedActionProposal.governingEquation.name}</span>
                                  <span className="text-[10px] text-slate-400">Deterministic</span>
                                </div>
                                <div className="text-cyan-200 bg-slate-950/80 p-2 rounded border border-slate-800 text-xs overflow-x-auto">
                                  {parsedActionProposal.governingEquation.formula}
                                </div>
                                <p className="text-slate-400 font-sans text-[10px] mt-1">
                                  {parsedActionProposal.governingEquation.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        </details>

                        {/* Confirmation Toggle */}
                        <label className="flex items-center gap-2.5 p-2 rounded-lg bg-cyan-950/20 border border-cyan-800/40 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={actionConfirmed}
                            onChange={(e) => setActionConfirmed(e.target.checked)}
                            className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                          />
                          <span className="text-xs text-slate-200 font-semibold select-none">
                            I confirm these parameters accurately reflect my proposed intervention for simulation handoff.
                          </span>
                        </label>
                      </div>
                    )}
                  </div>

                  {actionFeedback && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                      {actionFeedback}
                    </div>
                  )}

                  {/* Apply & Simulate Button */}
                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      disabled={parsedActionProposal.status !== 'supported-complete'}
                      onClick={handleSimulateProposedAction}
                      className={`py-2.5 px-5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition ${parsedActionProposal.status === 'supported-complete'
                        ? 'bg-cyan-600 hover:bg-cyan-500 cursor-pointer shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-400/50'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {parsedActionProposal.status === 'supported-complete'
                          ? 'Simulate Proposed Action (Compare in Step 5)'
                          : parsedActionProposal.status === 'ambiguous-incomplete'
                            ? 'Select an Engineering Lever Above to Simulate'
                            : parsedActionProposal.status === 'relevant-unsupported'
                              ? 'Simulation Blocked — Model Boundary Reached'
                              : 'Simulation Blocked — Valid Engineering Action Required'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 2: PLACE & GEOGRAPHY (SELECT & CONFIRM PLACE) */}
          {activeStage === 2 && (
            <div className="space-y-5">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">
                      {journeyNavMode === 'simple' ? 'Step 2:' : 'Stage 2:'}
                    </span>{' '}
                    Place & Geography (Select & Confirm Place)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {journeyNavMode === 'simple'
                      ? 'Explore OpenStreetMap regional coverage, choose your study area, and confirm location to lock it for analysis.'
                      : 'Select and confirm the study area and explore OpenStreetMap regional infrastructure coverage.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLocationGuide((v) => !v)}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="How to choose an eligible location for simulation"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>How to Choose a Location</span>
                  </button>
                  {confirmedSimulationTarget && (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Location Confirmed</span>
                    </span>
                  )}
                </div>
              </div>

              {/* First-Time User Guide: How to Choose a Location */}
              {showLocationGuide && (
                <div className="p-4 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 text-xs text-slate-200 space-y-3 shadow-xl animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <HelpCircle className="w-4 h-4 text-cyan-400" />
                      <span>How to Choose a Location</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLocationGuide(false)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-indigo-900/50 transition cursor-pointer"
                      aria-label="Dismiss location guide"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <strong className="text-emerald-300 block font-bold">1. Green Areas</strong>
                      <span className="text-slate-300 leading-snug">
                        Green areas show where simulation is available for this problem.
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <strong className="text-slate-300 block font-bold">2. Grey Areas</strong>
                      <span className="text-slate-300 leading-snug">
                        Grey areas can still be freely explored, but simulation is not currently available there.
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <strong className="text-cyan-300 block font-bold">3. Select Green Area</strong>
                      <span className="text-slate-300 leading-snug">
                        Click on any highlighted green road or asset to inspect what can be simulated.
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <strong className="text-indigo-300 block font-bold">4. Confirm Location</strong>
                      <span className="text-slate-300 leading-snug">
                        Click "Confirm This Location" to lock your choice and continue to Step 3.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-500/20">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLocationGuide(false);
                        try {
                          localStorage.setItem('whatif_dont_show_location_guide', 'true');
                        } catch {}
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10.5px] font-semibold border border-slate-800 cursor-pointer"
                    >
                      Don't Show This Guide Again
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLocationGuide(false)}
                      className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer"
                    >
                      Got It
                    </button>
                  </div>
                </div>
              )}

              {/* Domain Coverage Plain English Explanation Banner */}
              {(() => {
                const expl = getDomainCoverageExplanation(scenario.domain);
                return (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/30 text-xs text-slate-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-slate-200 font-medium">
                        <strong>{expl.supportedLabel}:</strong> {expl.greenExplanation}
                      </p>
                      <p className="text-[11px] text-slate-400">{expl.greyExplanation}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Selected Problem Banner at Top */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Active Problem
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      scenario.domain === 'traffic'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : scenario.domain === 'water'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {scenario.domain.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-white truncate">
                      {activeProblem?.title || scenario.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {activeProblem?.description || scenario.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStage(1)}
                  className="self-start md:self-center shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                  title="Return to Step 1 to select a different problem or propose another action"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Problem</span>
                </button>
              </div>

              {/* Confirmation Feedback Banner if clicked */}
              {placeConfirmedFeedback && (
                <div role="status" className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-400/60 text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Location Confirmed:</strong> {confirmedSimulationTarget?.assetTitle || activeMapPlace.label} locked for {scenario.domain} simulation.
                  </span>
                </div>
              )}

              {/* Inspected Feature State Banner (Ensures 0 Contradiction) */}
              {inspectedFeature && (() => {
                const elig = checkDomainEligibility(scenario, inspectedFeature);
                if (!elig.isEligible) {
                  return (
                    <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-amber-300">
                          Inspecting: {inspectedFeature.title} (Simulation Unavailable Here — explore only)
                        </p>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          {elig.unsupportedMessage}
                        </p>
                        {confirmedSimulationTarget && (
                          <p className="text-[11px] text-slate-300 pt-1 border-t border-amber-500/20">
                            Currently Confirmed Location: <strong className="text-cyan-300">{confirmedSimulationTarget.assetTitle || confirmedSimulationTarget.placeLabel}</strong>. To change, select any green highlighted area.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2.5 animate-fadeIn">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-300">Simulation Available Here: </span>
                        <span>{inspectedFeature.title} has active network model coverage.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmSimulationTarget(mapPlaceId, inspectedFeature)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0 shadow"
                    >
                      Confirm This Location
                    </button>
                  </div>
                );
              })()}

              {/* Coverage Toggle & Legend Bar */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleSimulationCoverage(!showSimulationCoverage)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer border ${
                      showSimulationCoverage
                        ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                    title="Toggle visual green highlighting for supported simulation areas"
                  >
                    <span className={`w-2 h-2 rounded-full ${showSimulationCoverage ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span>Show Available Simulation Areas</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                      showSimulationCoverage ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {showSimulationCoverage ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>

                {showSimulationCoverage && (
                  <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50" />
                      <span className="font-semibold text-emerald-300">GREEN</span>
                      <span className="text-slate-400">— Simulation available here</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                      <span className="font-semibold text-slate-300">GREY</span>
                      <span className="text-slate-400">— Explore only</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="font-semibold text-amber-300">AMBER</span>
                      <span className="text-slate-400">— Unverified / limited</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Place Selection Controls & Confirmation Action */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>Study Area Region: <strong className="text-cyan-300">{activeMapPlace.label}</strong> ({activeMapPlace.district})</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Category: {activeMapPlace.category} · Coordinates: {activeMapPlace.lat.toFixed(4)}, {activeMapPlace.lon.toFixed(4)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={mapPlaceId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (onSelectMapPlace) onSelectMapPlace(newId);
                      setIsPlaceConfirmed(false);
                      setInspectedFeature(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    aria-label="Select study area"
                  >
                    {effectivePlaces.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.label} ({pl.district}) — {pl.category}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleConfirmPlace}
                    className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-extrabold text-slate-950 flex items-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isPlaceConfirmed ? 'Location Confirmed' : 'Confirm Study Area'}</span>
                  </button>
                </div>
              </div>

              {/* Embedded Clean Digital Twin Map for Location Selection */}
              {renderDigitalTwinMap('min-h-[460px]', 'location-selection')}

              {/* Stage Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveStage(1)}
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{journeyNavMode === 'simple' ? 'Back to Step 1: Problem' : 'Back to Stage 1: Problem'}</span>
                </button>
                <button
                  type="button"
                  disabled={!confirmedSimulationTarget}
                  onClick={() => setActiveStage(3)}
                  className={`py-2.5 px-5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                    confirmedSimulationTarget
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg shadow-indigo-600/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  }`}
                  title={
                    confirmedSimulationTarget
                      ? 'Continue to Step 3: What WhatIf Understood'
                      : 'Please confirm an eligible location before continuing'
                  }
                >
                  <span>{journeyNavMode === 'simple' ? 'Continue to Step 3: What WhatIf Understood' : 'Continue to Stage 3: What WhatIf Understood'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: WHAT WHATIF UNDERSTOOD (BASELINE & OPTIONS) */}
          {activeStage === 3 && (
            <div className="space-y-5">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-mono">
                      {journeyNavMode === 'simple' ? 'Step 3:' : 'Stage 3:'}
                    </span>{' '}
                    What WhatIf Understood
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Plain-language breakdown of what is happening, where, what evidence supports it, and which engineering limits are crossed.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[10.5px] text-cyan-300 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Deterministic Physics Engine</span>
                </div>
              </div>

              {/* Confirmed Study Area Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-slate-400">Confirmed Study Area:</span>
                  <span className="text-white font-bold">{activeMapPlace.label}</span>
                  <span className="text-slate-400">({activeMapPlace.district})</span>
                  <span className="px-2 py-0.5 rounded text-[9.5px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    ✓ Locked for Analysis
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStage(2)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10.5px] text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
                  title="Return to Step 2 to adjust study area"
                >
                  <span>Change Place</span>
                </button>
              </div>

              {/* 4 Plain-Language Explanation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold text-cyan-400">
                    1. What is Happening?
                  </div>
                  <h3 className="text-xs font-bold text-white">
                    {activeProblem?.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeProblem?.description}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-mono font-bold text-indigo-400">
                    2. Where is it Happening?
                  </div>
                  <h3 className="text-xs font-bold text-white">
                    {activeProblem?.affectedAssetIds?.join(', ') || 'Corridor Bottleneck'}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Affects {scenario.domain} network assets in the {scenario.studyAreaLabel || 'Guntur-NTR continuous study region'}.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                    3. Evidence & Observed Conditions
                  </div>
                  <h3 className="text-xs font-bold text-rose-300">
                    {activeProblem?.measurableSymptom}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {activeProblem?.baselineInputsSummary || 'Calibrated from baseline model telemetry.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                    4. Limits Being Crossed
                  </div>
                  <h3 className="text-xs font-bold text-cyan-300">
                    {activeProblem?.thresholdConstraint}
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Baseline analysis indicates {baselineProblems.length} constraint violation(s) requiring intervention.
                  </p>
                </div>
              </div>

              {/* Detailed Baseline Issues from Solver */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Baseline Issues Summary ({baselineProblems.length} Items)</span>
                  </h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold">
                    Current Baseline
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {baselineProblems.map((prob, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{prob.componentName}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${prob.severity === 'Breached'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                          {prob.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">{prob.symptom}</p>
                      <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 font-medium">
                        <span>Measured: <strong className="text-rose-300">{prob.measuredValue}</strong></span>
                        <span>Required: <strong className="text-cyan-300">{prob.limitValue}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsed Section: View Detailed Technical Information */}
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition-all">
                <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-slate-300 hover:text-white select-none">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>View Detailed Technical Information & Model Inputs</span>
                  </div>
                  <span className="text-[11px] text-cyan-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>

                <div className="pt-4 space-y-4">
                  {/* Explicit Active Inputs & Assumptions */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
                    <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Calibrated Baseline Model Inputs</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-300 text-[11px]">
                      {scenario.assumptions.slice(0, 4).map((asm) => (
                        <li key={asm.id} className="flex justify-between items-center py-0.5 border-b border-slate-800/40 last:border-0 font-mono text-[10.5px]">
                          <span className="text-slate-400">{asm.name}:</span>
                          <span className="text-cyan-300 font-bold">{asm.value} {asm.unit}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10.5px] text-slate-400 pt-1">
                      Calibrated against baseline solver topology across {scenario.studyAreaLabel || 'the study area'}.
                    </p>
                  </div>

                  {/* Missing / Unmodeled Real-World Data Disclosures */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
                    <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Data Disclosures & Model Boundaries</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-300 text-[11px]">
                      {practicalNextSteps.missingDataDisclosures.map((mis, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span>{mis}</span>
                        </li>
                      ))}
                      <li className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                        <span>Building heights missing from OSM use calibrated 4.5 m visual estimates.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Governing Mathematical Physics & Equation Disclosure */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold text-white">Governing Physics Equations</h4>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                        Deterministic Domain Solver
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-2">
                      {scenario.domain === 'traffic' && (
                        <div className="space-y-1.5">
                          <div className="font-mono text-cyan-300 text-[11px] font-bold">
                            Cell Transmission Model (CTM): q_i(t) = min(v · n[i-1](t), Q_max, w · (N_max - n_i(t)))
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Conservation of vehicles across discrete corridor segments. Density propagation and shockwave spillback calibrated for the study corridor.
                          </p>
                        </div>
                      )}
                      {scenario.domain === 'water' && (
                        <div className="space-y-1.5">
                          <div className="font-mono text-cyan-300 text-[11px] font-bold">
                            Hazen-Williams Hydraulic Head Loss: h_f = 10.67 · L · Q^1.852 / (C^1.852 · D^4.87)
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Frictional head loss in pressurized municipal supply pipes. Continuity enforced at all delivery junctions (ΣQ_in = ΣQ_out + Q_demand).
                          </p>
                        </div>
                      )}
                      {scenario.domain === 'energy' && (
                        <div className="space-y-1.5">
                          <div className="font-mono text-cyan-300 text-[11px] font-bold">
                            DC Power Flow: P_ij = (θ_i - θ_j) / X_ij
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Linearized active power flow across regional high-voltage transmission lines based on bus voltage phase angles and line reactances.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </details>

              {/* Proposed Candidate Solutions Preview */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Proposed Candidate Interventions ({scenario.alternatives.length} Solutions)</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Select an action below or compare in Step 4
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {scenario.alternatives.map((alt) => {
                    const isSelected = selectedAltId === alt.id;
                    return (
                      <button
                        key={alt.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleChooseAlt(alt.id)}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950/80 border-cyan-400 text-white ring-1 ring-cyan-400/50 shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                              Option {alt.tag}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-white">{alt.name}</h4>
                          <p className="text-[10.5px] text-slate-400 line-clamp-2">{alt.description}</p>
                        </div>
                        <div className="w-full pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-medium">
                          <span className="text-cyan-300 font-bold">{formatCostEstimate(alt.capexCostMillion)}</span>
                          <span className="text-slate-400">{alt.implementationMonths} mo</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stage Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveStage(2)}
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{journeyNavMode === 'simple' ? 'Back to Step 2: Place & Geography' : 'Back to Stage 2: Place & Geography'}</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveStage(4)}
                    className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    <span>{journeyNavMode === 'simple' ? 'Proceed to Step 4: Review & Compare Solutions' : 'Continue to Stage 4: Review Matching Solutions'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* STAGE 4: REVIEW & COMPARE CANDIDATE SOLUTIONS */}
          {activeStage === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">Step 4:</span>
                    <span>Review & Compare Candidate Solutions</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Every candidate solution is structured below answering 8 human questions to help you evaluate outcomes, trade-offs, and physical suitability.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{scenario.alternatives.length} Solutions + Baseline Evaluated</span>
                </div>
              </div>

              {/* Lead Highlight: Recommended Solution Card */}
              {(() => {
                const topAlt = recommendedAlternative || scenario.alternatives[0];
                const topSim = allRankedResults.find((r) => r.alternativeId === topAlt?.id);
                const isTopSelected = selectedAltId === topAlt?.id || (selectedAltId === null && topAlt?.id === scenario.alternatives[0]?.id);

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                        Top Recommended Solution
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Highest multi-criteria utility score ({topSim?.normalizedScores.overallUtility ?? 85}/100)
                      </span>
                    </div>
                    {renderSolution8Questions(topAlt, topSim, isTopSelected, true)}
                  </div>
                );
              })()}

              {/* Comparison Section: All Other Candidate Solutions & Baseline */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    All Candidate Options & Baseline
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Click any solution to select it for simulation
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Baseline Option Card */}
                  {renderBaseline8Questions()}

                  {/* Candidate Solutions */}
                  {scenario.alternatives
                    .filter((alt) => alt.id !== (recommendedAlternative?.id || scenario.alternatives[0]?.id))
                    .map((alt) => {
                      const isSelected = selectedAltId === alt.id;
                      const altSim = allRankedResults.find((r) => r.alternativeId === alt.id);
                      return renderSolution8Questions(alt, altSim, isSelected, false);
                    })}
                </div>
              </div>

              {/* Expandable Engineering Parameters Disclosure */}
              <details className="group border border-slate-800 rounded-xl p-3 bg-slate-950/60 text-xs text-slate-300">
                <summary className="flex items-center justify-between text-slate-400 hover:text-cyan-300 cursor-pointer font-semibold py-0.5 select-none">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>View Underlying Engineering Parameter Modifications</span>
                  </span>
                  <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 pt-2 border-t border-slate-800 space-y-2 text-[11px]">
                  {scenario.alternatives.map((alt) => (
                    <div key={alt.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                      <div className="font-bold text-slate-200">Option {alt.tag}: {alt.name}</div>
                      <ul className="list-disc list-inside text-slate-400 mt-1 space-y-0.5">
                        {alt.modifications.map((m, mi) => (
                          <li key={mi}>
                            {m.label}: {m.originalValue} → {m.newValue} {m.unit} (Target: {m.targetId})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>

              {/* Stage Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveStage(3)}
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Step 3: Situation & Baseline</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage(5)}
                  className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <span>Continue to Step 5: Final Comparison →</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: FINAL COMPARISON: ALL OPTIONS COMPARED */}
          {activeStage === 5 && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">Step 5:</span>
                    <span>Final Comparison: All Options Compared</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Direct plain-language comparison of Baseline, Solution A, Solution B, and Solution C answering 10 essential decision questions.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deterministic Decision Synthesis</span>
                </div>
              </div>

              {/* 10 Plain-Language Final Comparison Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Question 1: What was the original situation? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>1. What Was the Original Situation?</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">Unmitigated Baseline In {activeMapPlace.label}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Active {scenario.domain} bottleneck with {baselineProblems.length} limit breach(es). Current performance measured at{' '}
                    <strong className="text-rose-300">{baselineResult.metrics.primaryPerformance.toFixed(1)} {baselineResult.metrics.primaryPerformanceUnit}</strong>.
                    Residents and assets experience persistent service degradation without intervention.
                  </p>
                </div>

                {/* Question 2: What does each solution change? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>2. What Does Each Solution Change?</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 leading-snug">
                    <li><strong className="text-slate-400">Baseline:</strong> Zero physical modifications.</li>
                    {scenario.alternatives.map((alt) => (
                      <li key={alt.id}>
                        <strong className="text-cyan-300">Option {alt.tag}:</strong> {alt.name} — {alt.modifications.map((m) => `${m.label} (${m.newValue} ${m.unit})`).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Question 3: Which solution performs best? */}
                <div className="p-5 rounded-2xl bg-indigo-950/70 border border-indigo-500/40 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>3. Which Solution Performs Best?</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {allRankedResults[0] ? `${scenario.alternatives.find(a => a.id === allRankedResults[0].alternativeId)?.tag || 'Top Option'}: ${allRankedResults[0].metrics.primaryPerformance.toFixed(1)} ${allRankedResults[0].metrics.primaryPerformanceUnit}` : 'Evaluated candidate'}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Yields the highest operational gain (+{currentDeltas.primaryImprovementPct}% improvement over baseline) and scores{' '}
                    {allRankedResults[0]?.normalizedScores.overallUtility || 80}/100 across multi-criteria objectives.
                  </p>
                </div>

                {/* Question 4: How much will each cost? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>4. How Much Will Each Cost?</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Baseline:</span>
                      <span className="text-slate-200 font-bold">{formatCostEstimate(0)}</span>
                    </div>
                    {scenario.alternatives.map((alt) => (
                      <div key={alt.id} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Option {alt.tag}:</span>
                        <span className="text-cyan-300 font-bold">
                          {alt.costDataStatus === 'not-estimated' ? 'Cost n/e' : formatCostEstimate(alt.capexCostMillion)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Question 5: How long will each take to build or set up? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>5. How Long Will Each Take to Build or Set Up?</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Baseline:</span>
                      <span className="text-slate-200 font-bold">Immediate (0 mo)</span>
                    </div>
                    {scenario.alternatives.map((alt) => (
                      <div key={alt.id} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Option {alt.tag}:</span>
                        <span className="text-slate-100 font-bold">
                          {alt.scheduleDataStatus === 'not-estimated' ? 'Timeline n/e' : `${alt.implementationMonths} Months`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Question 6: What problems are still left unsolved? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-amber-400" />
                    <span>6. What Problems Are Still Left Unsolved?</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Baseline leaves all {baselineProblems.length} violations unresolved. Candidate solutions address the core corridor/junction directly, but secondary peripheral links continue to require routine telemetry monitoring and demand management.
                  </p>
                </div>

                {/* Question 7: What could go wrong or fail with each option? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>7. What Could Go Wrong or Fail with Each Option?</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 leading-snug">
                    <li><strong className="text-slate-400">Baseline:</strong> Unchecked spillback and cascading failures.</li>
                    {scenario.alternatives.map((alt) => {
                      const run = allRankedResults.find((r) => r.alternativeId === alt.id);
                      const altTrades = run ? getAlternativeTradeOffs(scenario, alt, run) : undefined;
                      const riskDesc = altTrades?.immediateTradeOffs?.[0]?.detail || 'Temporary construction delays and diversion traffic impact.';
                      return (
                        <li key={alt.id}>
                          <strong className="text-amber-300">Option {alt.tag}:</strong> {riskDesc}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Question 8: Does each option respect hard physical and safety limits? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>8. Does Each Option Respect Physical & Safety Limits?</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Baseline (Do Nothing):</span>
                      <span className="text-rose-400 font-bold">⚠ Violates Safety Limits</span>
                    </div>
                    {scenario.alternatives.map((alt) => {
                      const sim = allRankedResults.find((r) => r.alternativeId === alt.id);
                      const feasible = sim?.feasible ?? false;
                      return (
                        <div key={alt.id} className="flex items-center justify-between text-slate-300">
                          <span>Option {alt.tag} ({alt.name}):</span>
                          <span className={feasible ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {feasible ? '✓ Within Safe Limits' : '⚠ Exceeds Operational Limits'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Question 9: Which option offers the best value for money? */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    <span>9. Which Option Offers the Best Value for Money?</span>
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    {recommendedAlternative ? `${recommendedAlternative.tag}: ${recommendedAlternative.name}` : (selectedAlternative?.name || 'Selected Solution')}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Delivers the highest performance dividend relative to capital expenditure, with an estimated investment of{' '}
                    {formatCostEstimate(recommendedAlternative?.capexCostMillion || selectedAlternative?.capexCostMillion || 0)}.
                  </p>
                </div>

                {/* Question 10: What is the recommended final decision? */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-slate-900 border-2 border-indigo-500/60 shadow-xl space-y-2 md:col-span-2">
                  <div className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>10. What Is the Recommended Final Decision?</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white">
                    Proceed with {recommendedAlternative ? `${recommendedAlternative.tag}: ${recommendedAlternative.name}` : (selectedAlternative?.name || 'Candidate Intervention')}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    This solution provides the most balanced, physically sound intervention to resolve the {scenario.domain} bottleneck in {activeMapPlace.label}.
                    It respects all engineering threshold constraints, provides a {currentDeltas.primaryImprovementPct}% improvement in operational service, and can be implemented within {recommendedAlternative?.implementationMonths || 12} months.
                  </p>
                </div>
              </div>

              {/* 5. 5-Step Human Implementation Roadmap */}
              <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>Implementation Roadmap (5-Phase Delivery)</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/30">
                    Sequential Human Execution
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {[
                    { step: '1. Prepare', phase: 'Month 1-2', label: 'Approvals & Surveys', desc: 'Secure regulatory clearances, community alignment, and utility corridor verification.' },
                    { step: '2. Plan', phase: 'Month 2-4', label: 'Detailed Engineering', desc: 'Complete civil drawings, contractor tender documents, and safety hazard protocols.' },
                    { step: '3. Carry Out the Work', phase: 'Month 4-10', label: 'Phased Construction', desc: 'Execute infrastructure upgrades, pipe conduit installation, or signal modifications.' },
                    { step: '4. Check the Results', phase: 'Month 10-12', label: 'Testing & Verification', desc: 'Run sensor calibration, pressure tests, and speed verification under live peak load.' },
                    { step: '5. Handle Problems if They Occur', phase: 'Ongoing', label: 'Operations & Fallbacks', desc: 'Maintain contingency protocols, backup routes, and routine asset inspections.' }
                  ].map((phase, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-cyan-300">{phase.step}</span>
                          <span className="text-slate-400">{phase.phase}</span>
                        </div>
                        <h4 className="font-bold text-white mt-1">{phase.label}</h4>
                        <p className="text-[11px] text-slate-400 leading-snug mt-1">{phase.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Engineering Disclaimer */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Professional Engineering Boundary:</strong> WhatIf simulations provide mathematical decision support for regional planning. They do not constitute or replace stamped civil construction drawings or certified site safety inspections.
                </span>
              </div>

              {/* Expandable Technical Details */}
              <details className="group border border-slate-800 rounded-xl p-3 bg-slate-950/60 text-xs text-slate-300">
                <summary className="flex items-center justify-between text-slate-400 hover:text-cyan-300 cursor-pointer font-semibold py-0.5 select-none">
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span>View Detailed Technical Comparison, Trade-offs & Contingency Protocols</span>
                  </span>
                  <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
                </summary>

                <div className="mt-4 pt-3 border-t border-slate-800 space-y-5">
                  {/* Side-by-Side Comparison Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[11px]">
                          <th className="p-3 font-bold">Metric / Criterion</th>
                          <th className="p-3 font-bold">Baseline (Do Nothing)</th>
                          {scenario.alternatives.map((alt) => (
                            <th key={alt.id} className="p-3 font-bold text-white">
                              Option {alt.tag} ({alt.name})
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-slate-300">
                        <tr>
                          <td className="p-3 font-semibold text-slate-400">Primary Performance</td>
                          <td className="p-3 text-rose-300 font-bold font-mono">
                            {baselineResult.metrics.primaryPerformance.toFixed(1)} {baselineResult.metrics.primaryPerformanceUnit}
                          </td>
                          {scenario.alternatives.map((alt) => {
                            const r = allRankedResults.find((res) => res.alternativeId === alt.id);
                            const d = calculateAlternativeDeltas(scenario, r || baselineResult, baselineResult);
                            return (
                              <td key={alt.id} className="p-3 text-cyan-300 font-bold font-mono">
                                {r?.metrics.primaryPerformance.toFixed(1)} {r?.metrics.primaryPerformanceUnit}
                                <span className="text-[10px] text-emerald-400 ml-1.5 font-sans">
                                  (+{d.primaryImprovementPct}%)
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400">Feasibility Status</td>
                          <td className="p-3 text-rose-400 font-medium">
                            {baselineProblems.length} Violations
                          </td>
                          {scenario.alternatives.map((alt) => {
                            const r = allRankedResults.find((res) => res.alternativeId === alt.id);
                            return (
                              <td key={alt.id} className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r?.feasible
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                  }`}>
                                  {r?.feasible ? 'Feasible' : 'Breached'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400">Estimated Cost</td>
                          <td className="p-3 text-slate-400 font-medium">{formatCostEstimate(0)}</td>
                          {scenario.alternatives.map((alt) => (
                            <td key={alt.id} className="p-3 text-slate-200 font-medium">
                              {alt.costDataStatus === 'not-estimated' ? 'Not estimated' : formatCostEstimate(alt.capexCostMillion)}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400">Timeline</td>
                          <td className="p-3 text-slate-400 font-medium">0 mo</td>
                          {scenario.alternatives.map((alt) => (
                            <td key={alt.id} className="p-3 text-slate-200 font-medium">
                              {alt.scheduleDataStatus === 'not-estimated' ? 'Not estimated' : `${alt.implementationMonths} mo`}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-3 font-semibold text-slate-400">Score</td>
                          <td className="p-3 text-slate-400 font-bold">
                            {baselineResult.normalizedScores.overallUtility}/100
                          </td>
                          {scenario.alternatives.map((alt) => {
                            const r = allRankedResults.find((res) => res.alternativeId === alt.id);
                            return (
                              <td key={alt.id} className="p-3 text-emerald-400 font-bold">
                                {r?.normalizedScores.overallUtility}/100
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Contingency Rollback Protocols */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                      Contingency & Rollback Protocols
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {practicalNextSteps.recoveryActions.map((rec, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                          <span className="text-[10px] text-rose-300 font-bold block mb-1">
                            Protocol {i + 1}
                          </span>
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              {/* Stage Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveStage(4)}
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Step 4: Compare Solutions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage(6)}
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <span>Continue to Map & Before/After Comparison (Step 6) →</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 6: MAP AND BEFORE/AFTER COMPARISON */}
          {activeStage === 6 && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">Step 6:</span>
                    <span>Map and Before/After Comparison</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Compare the Baseline network with {selectedAlternative?.name || 'Selected Solution'} using synchronized 3D twin views and the Change Navigator.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow">
                    Option {selectedAlternative?.tag || 'A'}: {selectedAlternative?.name || 'Solution'}
                  </span>
                </div>
              </div>

              {/* Dedicated Full-Page 3D Digital Twin Map */}
              {renderDigitalTwinMap('min-h-[580px]', 'simulation')}

              {/* Stage Navigation */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveStage(5)}
                  className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-2 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Step 5: Findings & Final Comparison</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage(7)}
                  className="py-2.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-cyan-500/25"
                >
                  <span>Complete Estimation & View Final Summary →</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </button>
              </div>
            </div>
          )}

          {/* FINAL STAGE: ESTIMATION COMPLETE */}
          {activeStage === 7 && (
            <div className="space-y-6 max-w-4xl mx-auto py-4">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Estimation Complete</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Assessment Summary & Recommended Action
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                  Deterministic simulation results for {activeMapPlace.label} ({activeMapPlace.district}).
                </p>
              </div>

              {/* Summary Card */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-cyan-400 font-bold">
                      Selected Intervention ({scenario.domain.toUpperCase()})
                    </div>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {selectedAlternative?.name || 'Selected Solution'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Study Area: <strong className="text-slate-200">{activeMapPlace.label}</strong> · {activeMapPlace.district}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border self-start sm:self-auto ${currentResult.feasible
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}>
                    {currentResult.feasible ? '✓ Meets Engineering Standards' : '⚠ Requires Adjustments'}
                  </span>
                </div>

                {/* 4 Outcome Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Performance Output</span>
                    <div className="text-base font-bold text-cyan-300 font-mono">
                      {currentResult.metrics.primaryPerformance.toFixed(1)} {currentResult.metrics.primaryPerformanceUnit}
                    </div>
                    <span className="text-[10px] text-emerald-400 block font-semibold">
                      +{currentDeltas.primaryImprovementPct}% vs baseline
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Estimated Budget</span>
                    <div className="text-base font-bold text-white">
                      {formatCostEstimate(selectedAlternative?.capexCostMillion ?? 0)}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">Model estimate</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Timeline</span>
                    <div className="text-base font-bold text-white">
                      {selectedAlternative?.implementationMonths ?? 12} Months
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">Civil delivery</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Feasibility</span>
                    <div className={`text-sm font-bold ${currentResult.feasible ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {currentResult.feasible ? 'Feasible' : 'Exceeded'}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-medium">AWWA/CPHEEO</span>
                  </div>
                </div>

                {/* Synthesis Paragraph */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-2">
                  <p>
                    The deterministic model calculates that executing <strong>{selectedAlternative?.name}</strong> will improve {currentDeltas.primaryLabel.toLowerCase()} by {currentDeltas.primaryImprovementPct}% in {activeMapPlace.label} with an estimated planning budget commitment of {formatCostEstimate(selectedAlternative?.capexCostMillion ?? 0)}.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Prior to civil implementation, project sponsors should complete detailed ground surveys, utility coordination with local authorities, and certified engineering reviews.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveStage(6)}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Review 3D Twin Map (Step 6)</span>
                  </button>

                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onOpenReportModal}
                      className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/25"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Export Assessment Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartNewAssessment}
                      className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Start a New Assessment</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Professional Engineering Estimation Disclaimer */}
              <p className="text-center text-[11px] text-slate-400 max-w-xl mx-auto leading-relaxed">
                This is an engineering estimation tool based on mathematical simulation models. It is designed to assist planning and decision-making, not to replace stamped professional engineering drawings or certified safety inspections.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* COMMAND CENTER VIEW: Full simultaneous overview layout       */
        /* ------------------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* Left Column: Solution Selector */}
          <div className="lg:col-span-3 order-2 lg:order-1 whatif-card rounded-2xl p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">
                  Solutions ({scenario.alternatives.length})
                </h2>
                <span className="text-[10px] font-mono text-slate-400">
                  Select to simulate
                </span>
              </div>

              {/* Baseline Option */}
              <button
                type="button"
                onClick={() => handleChooseAlt(null)}
                className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${selectedAltId === null
                  ? 'bg-indigo-950/80 border-cyan-400/70 text-white shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                  : 'bg-slate-950/70 border-slate-800/90 text-slate-300 hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    0
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">Baseline (Do Nothing)</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {baselineResult.metrics.primaryPerformance.toFixed(1)} {baselineResult.metrics.primaryPerformanceUnit}
                    </div>
                  </div>
                </div>
                {selectedAltId === null && (
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 shrink-0">
                    <Check className="w-3 h-3" />
                  </span>
                )}
              </button>

              {/* Alternatives List */}
              <div className="space-y-2">
                {scenario.alternatives.map((alt, idx) => {
                  const isSelected = selectedAltId === alt.id;
                  const altSim = allRankedResults.find((r) => r.alternativeId === alt.id);
                  const letter = String.fromCharCode(65 + idx);

                  return (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() => handleChooseAlt(alt.id)}
                      className={`w-full p-3 rounded-xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${isSelected
                        ? 'bg-indigo-950/90 border-indigo-400 text-white shadow-[0_0_22px_rgba(99,102,241,0.28)]'
                        : 'bg-slate-950/75 border-slate-800/90 text-slate-300 hover:border-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-md font-mono text-[10px] font-bold flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300'
                            }`}>
                            {letter}
                          </span>
                          <span className="text-xs font-bold truncate">{alt.name}</span>
                        </div>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-indigo-500/30 border border-indigo-400 flex items-center justify-center text-cyan-300 shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pl-7">
                        <span className="font-mono text-cyan-300">
                          {altSim?.metrics.primaryPerformance.toFixed(1)} {altSim?.metrics.primaryPerformanceUnit}
                        </span>
                        <span className="font-mono">
                          Score {altSim?.normalizedScores.overallUtility}/100
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions in Left Col */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <button
                type="button"
                onClick={onOpenCompare}
                className="w-full py-2 px-3 rounded-xl whatif-pill-primary text-xs font-bold text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>Side-by-Side Compare</span>
              </button>
            </div>
          </div>

          {/* Right Column: KPIs + Map */}
          <div className="lg:col-span-9 order-1 lg:order-2 flex flex-col gap-4">
            {/* 3 KPI Telemetry Cards */}
            {!isTelemetryDismissed ? (
              <div className="space-y-1.5">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsTelemetryDismissed(true)}
                    className="px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                    title="Hide Telemetry Cards to maximize map area"
                    aria-label="Hide Telemetry Cards"
                  >
                    <span>−</span>
                    <span>Hide Telemetry</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="whatif-card-glow px-4 py-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">{currentDeltas.primaryLabel}</div>
                      <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                        {currentResult.metrics.primaryPerformance.toFixed(1)} {currentResult.metrics.primaryPerformanceUnit}
                        {selectedAlternative && (
                          <span className="text-xs font-mono text-emerald-400 ml-2">
                            (+{currentDeltas.primaryImprovementPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>

                  <div className="whatif-card px-4 py-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Total Lifecycle Cost</div>
                      <div className="text-lg font-extrabold text-white font-mono mt-0.5">
                        {selectedAlternative?.costDataStatus === 'not-estimated'
                          ? 'Not estimated'
                          : `$${currentResult.metrics.totalCostMillion.toFixed(2)}M`}
                      </div>
                    </div>
                    <DollarSign className="w-6 h-6 text-purple-400" />
                  </div>

                  <div className="whatif-card px-4 py-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Feasibility Status</div>
                      <div className={`text-base font-extrabold font-mono mt-0.5 ${currentResult.feasibilityStatus === 'incomplete'
                        ? 'text-amber-300'
                        : currentResult.feasible
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                        }`}>
                        {currentResult.feasibilityStatus === 'incomplete'
                          ? (currentResult.feasibilityLabel || 'Incomplete / Unverified Checks')
                          : currentResult.feasible
                            ? 'Constraints Satisfied'
                            : (currentResult.feasibilityLabel || 'Breach Detected')}
                      </div>
                    </div>
                    <ShieldCheck className={`w-6 h-6 ${currentResult.feasibilityStatus === 'incomplete' ? 'text-amber-400' : 'text-cyan-400'
                      }`} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsTelemetryDismissed(false)}
                  className="px-2.5 py-1 rounded-xl text-[10.5px] font-mono text-cyan-300 hover:text-cyan-200 bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 shadow transition flex items-center gap-1.5 cursor-pointer"
                  aria-label="Show Telemetry KPI Cards"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Show Telemetry KPI Cards</span>
                </button>
              </div>
            )}

            {/* Map */}
            {renderDigitalTwinMap('min-h-[520px]')}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PROGRESSIVE DISCLOSURE: Advanced Analysis & Decision Tools   */}
      {/* ------------------------------------------------------------- */}
      <section className="mt-4 border border-slate-800 rounded-2xl bg-slate-950/70 overflow-hidden" aria-label="Advanced Analysis">
        <button
          type="button"
          onClick={() => setAdvancedExpanded((p) => !p)}
          className="w-full p-4 flex items-center justify-between bg-slate-900/60 hover:bg-slate-900/90 transition text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Advanced Analysis, Assumptions & Sequential Planning</h2>
              <p className="text-[11px] text-slate-400">Governing physics equations, live sensitivity sliders, and sequential action composition</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <span>{advancedExpanded ? 'Hide Details' : 'Show Advanced Analysis'}</span>
            {advancedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {advancedExpanded && (
          <div className="p-5 space-y-6 border-t border-slate-800/80 animate-fadeIn">
            {/* Governing Physics Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-400">
                Governing Numerical Equations ({scenario.domain.toUpperCase()})
              </h3>
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                {scenario.domain === 'traffic' && (
                  <div>
                    <div className="text-cyan-300 font-bold">Cell Transmission Model (Daganzo, LWR):</div>
                    <div className="text-slate-400">Flow q_i(t) = min[v_f * rho_i, q_max, w * (rho_jam - rho_i+1)]</div>
                    <div className="text-slate-400">Conservation: rho_i(t+1) = rho_i(t) + (dt / L) * [q_in(t) - q_out(t)]</div>
                  </div>
                )}
                {scenario.domain === 'water' && (
                  <div>
                    <div className="text-cyan-300 font-bold">Darcy-Weisbach Hydraulic Friction Loss:</div>
                    <div className="text-slate-400">Head Loss h_f = f * (L / D) * (v^2 / (2 * g))</div>
                    <div className="text-slate-400">Friction Factor f via Swamee-Jain Colebrook explicit approximation</div>
                  </div>
                )}
                {scenario.domain === 'energy' && (
                  <div>
                    <div className="text-cyan-300 font-bold">Linearized DC Power Flow (B-Matrix):</div>
                    <div className="text-slate-400">Line Active Power P_ij = B_ij * (theta_i - theta_j)</div>
                    <div className="text-slate-400">Bus Power Balance: sum(P_gen) - P_load = sum(P_ij)</div>
                  </div>
                )}
              </div>
            </div>

            {/* Assumptions & Sensitivity Sliders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-indigo-400">
                  Simulated Baseline Assumptions & Sensitivity
                </h3>
                <span className="text-[10px] font-mono text-cyan-300">In-Browser Instant Recomputation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {scenario.assumptions.map((asm) => (
                  <div key={asm.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium truncate">{asm.name}</span>
                      <span className="font-mono font-bold text-cyan-300 shrink-0 ml-1">
                        {asm.value} {asm.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label={asm.name}
                      min={asm.rangeMin}
                      max={asm.rangeMax}
                      step={
                        asm.rangeMax - asm.rangeMin <= 2
                          ? 0.05
                          : asm.rangeMax - asm.rangeMin <= 50
                            ? 1
                            : 25
                      }
                      value={asm.value}
                      onChange={(e) => handleAssumptionChange(asm.id, Number(e.target.value))}
                      className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Sequential Interventions: "What happens if we act, then act again?" */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider text-emerald-400">
                  Sequential Interventions: Act, Then Act Again
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Composed Plan Evaluation</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-[10px] font-semibold text-slate-400">
                  Step 1 · Initial Action
                  <select
                    aria-label="Initial action"
                    value={selectedAltId || 'baseline'}
                    onChange={(e) => handleChooseAlt(e.target.value === 'baseline' ? null : e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="baseline">Baseline (Unmodified Network)</option>
                    {scenario.alternatives.map((alt) => (
                      <option key={alt.id} value={alt.id}>{alt.tag}: {alt.name}</option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] font-semibold text-slate-400">
                  Step 2 · Follow-up Action
                  <select
                    aria-label="Follow-up action"
                    value={sequenceFollowUp?.id || ''}
                    onChange={(e) => setSequenceFollowUpId(e.target.value || null)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">None</option>
                    {scenario.alternatives
                      .filter((alt) => alt.id !== selectedAlternative?.id)
                      .map((alt) => (
                        <option key={alt.id} value={alt.id}>{alt.tag}: {alt.name}</option>
                      ))}
                  </select>
                </label>
              </div>

              {sequenceAlternative && (
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 font-mono">
                  <div>
                    <span className="text-slate-400">Composed Plan Speed/Output: </span>
                    <strong className="text-cyan-300">{sequenceResult.metrics.primaryPerformance.toFixed(1)} {sequenceResult.metrics.primaryPerformanceUnit}</strong>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sequenceResult.feasible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {sequenceResult.feasible ? 'Within Constraints' : 'Violation in Composed Plan'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 10-Point Plain-Language Explain This Change Modal */}
      <ExplainChangeModal
        change={currentActiveChange}
        totalChanges={activeChanges.length}
        currentIndex={selectedChangeIndex}
        isOpen={showExplainModal}
        onClose={() => setShowExplainModal(false)}
        onNext={() => handleSelectChangeIndex(selectedChangeIndex + 1)}
        onPrev={() => handleSelectChangeIndex(selectedChangeIndex - 1)}
      />

      {/* 3D Map Hardware Compatibility Warning Dialog */}
      <MapCompatibilityModal
        isOpen={show3DCompatModal}
        onProceed3D={handleProceed3D}
        onFallback2D={handleFallback2D}
      />
    </div>
  );
};
