import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Building2,
  Droplets,
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileQuestion,
  Search,
  Ban,
  PlusCircle,
  Sparkles,
  LoaderCircle,
  MapPin
} from 'lucide-react';
import { Scenario, DomainType, ProblemStatement } from '../types';
import { formatCostEstimate } from '../utils/currencyFormatter';
import {
  DEFAULT_SCENARIOS,
  PROBLEM_CATALOG,
  applyProblemTemplateToScenario
} from '../models/defaultScenarios';
import { REGIONAL_MAP_PLACES, RegionalMapPlace, getMapPlace } from '../models/regionalMap';
import {
  AIProblemDraft,
  applyAIProblemDraftToScenario,
  buildAIProblemContext,
  validateAIProblemDraft
} from '../models/aiProblemAgent';

interface CreateScenarioModalProps {
  initialMode?: 'catalog' | 'custom' | 'ai';
  discoveredPlaces?: RegionalMapPlace[];
  onClose: () => void;
  onCreateScenario: (scenario: Scenario) => void;
}

export const CreateScenarioModal: React.FC<CreateScenarioModalProps> = ({
  initialMode = 'catalog',
  discoveredPlaces,
  onClose,
  onCreateScenario
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDomain, setSelectedDomain] = useState<DomainType>('traffic');
  const [selectedCategory, setSelectedCategory] = useState<string>('Urban Planning');
  const [selectedProblemId, setSelectedProblemId] = useState<string>(() =>
    initialMode === 'custom'
      ? 'custom'
      : initialMode === 'ai'
      ? 'ai-custom'
      : PROBLEM_CATALOG.traffic[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [title, setTitle] = useState(() =>
    initialMode === 'custom'
      ? 'Custom TRAFFIC Infrastructure Study'
      : initialMode === 'ai'
      ? 'AI TRAFFIC Planning Study'
      : PROBLEM_CATALOG.traffic[0]?.title ||
        'Campus Inflow Congestion & Ring Road Spillback'
  );
  const [description, setDescription] = useState(() =>
    initialMode === 'custom'
      ? 'User-defined traffic network stress and mitigation scenario using full digital-twin topology.'
      : initialMode === 'ai'
      ? 'An AI-assisted problem proposal that will be checked by the selected domain solver.'
      : PROBLEM_CATALOG.traffic[0]?.description ||
        'Morning peak commute (8-10 AM) causes bottleneck queuing at Campus Main Intersection.'
  );
  const [customSymptom, setCustomSymptom] = useState<string>(
    'Peak demand exceeds corridor/network service threshold'
  );
  const [customThreshold, setCustomThreshold] = useState<string>(
    'Speed >= 22.0 km/h & Density <= 0.70 * k_j'
  );
  const [aiMode, setAiMode] = useState(initialMode === 'ai');
  const [aiProblemBrief, setAiProblemBrief] = useState('');
  const [studyAreaPlaceId, setStudyAreaPlaceId] = useState('region');
  const [studyAreaLabel, setStudyAreaLabel] = useState('');
  const [validationError, setValidationError] = useState('');
  const [aiDraft, setAiDraft] = useState<AIProblemDraft | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiStatusChecked, setAiStatusChecked] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  const selectablePlaces = useMemo(() => {
    const base =
      discoveredPlaces && discoveredPlaces.length > 0
        ? discoveredPlaces
        : REGIONAL_MAP_PLACES;
    return base.filter((p) => p.category !== 'village');
  }, [discoveredPlaces]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    fetch('/api/agent/status')
      .then((response) => response.ok ? response.json() : null)
      .then((status) => {
        if (active) setAiConfigured(Boolean(status?.configured));
      })
      .catch(() => {
        if (active) setAiConfigured(false);
      })
      .finally(() => {
        if (active) setAiStatusChecked(true);
      });
    return () => { active = false; };
  }, []);

  const categories = [
    {
      id: 'Urban Planning',
      domain: 'traffic' as DomainType,
      label: 'Urban Planning (Traffic)',
      icon: Building2
    },
    {
      id: 'Water Utility',
      domain: 'water' as DomainType,
      label: 'Water Utility (Hydraulics)',
      icon: Droplets
    },
    {
      id: 'Energy',
      domain: 'energy' as DomainType,
      label: 'Energy Grid (Power Flow)',
      icon: Zap
    }
  ];

  const domainCatalog = useMemo(
    () => PROBLEM_CATALOG[selectedDomain] || [],
    [selectedDomain]
  );

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return domainCatalog;
    const q = searchQuery.toLowerCase();
    return domainCatalog.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.measurableSymptom.toLowerCase().includes(q)
    );
  }, [domainCatalog, searchQuery]);

  // Preview scenario generated from full 16-node/16-cell/12-bus domain base + selected problem template
  const previewScenario = useMemo(() => {
    const baseTemplate =
      DEFAULT_SCENARIOS.find((s) => s.domain === selectedDomain) ||
      DEFAULT_SCENARIOS[0];
    if (aiMode && aiDraft && selectedProblemId === 'ai-custom') {
      return applyAIProblemDraftToScenario(baseTemplate, aiDraft, studyAreaPlaceId, studyAreaLabel);
    }
    if (selectedProblemId === 'custom') {
      return baseTemplate;
    }
    if (selectedProblemId === 'ai-custom') return baseTemplate;
    return applyProblemTemplateToScenario(baseTemplate, selectedProblemId);
  }, [selectedDomain, selectedProblemId, aiMode, aiDraft, studyAreaPlaceId, studyAreaLabel]);

  const activeCatalogProblem = useMemo(
    () => domainCatalog.find((p) => p.id === selectedProblemId),
    [domainCatalog, selectedProblemId]
  );

  const handleSelectDomainCategory = (catId: string, dom: DomainType) => {
    setSelectedCategory(catId);
    setSelectedDomain(dom);
    setAiMode(false);
    setAiDraft(null);
    setAiError('');
    setSearchQuery('');

    const catalogProblems = PROBLEM_CATALOG[dom] || [];
    const firstProb = catalogProblems[0];
    if (firstProb) {
      setSelectedProblemId(firstProb.id);
      setTitle(firstProb.title);
      setDescription(firstProb.description);
      setCustomSymptom(firstProb.measurableSymptom);
      setCustomThreshold(firstProb.thresholdConstraint);
    }
  };

  const handleSelectProblemTemplate = (prob: ProblemStatement) => {
    setAiMode(false);
    setAiDraft(null);
    setAiError('');
    setSelectedProblemId(prob.id);
    setTitle(prob.title);
    setDescription(prob.description);
    setCustomSymptom(prob.measurableSymptom);
    setCustomThreshold(prob.thresholdConstraint);
  };

  const handleSelectCustomProblem = () => {
    setAiMode(false);
    setAiDraft(null);
    setSelectedProblemId('custom');
    setTitle(`Custom ${selectedDomain.toUpperCase()} Infrastructure Study`);
    setDescription(
      `User-defined ${selectedDomain} network stress and mitigation scenario using full digital-twin topology.`
    );
  };

  const handleSelectAIProblem = () => {
    setAiMode(true);
    setAiDraft(null);
    setAiError('');
    setSelectedProblemId('ai-custom');
    setTitle(`AI ${selectedDomain.toUpperCase()} Planning Study`);
    setDescription('An AI-assisted problem proposal that will be checked by the selected domain solver.');
  };

  const handleGenerateAIDraft = async () => {
    const baseScenario = DEFAULT_SCENARIOS.find((scenario) => scenario.domain === selectedDomain) || DEFAULT_SCENARIOS[0];
    if (aiProblemBrief.trim().length < 12) {
      setAiError('Describe the problem in at least 12 characters. Include what is missing or failing and who/what is affected.');
      return;
    }
    setAiBusy(true);
    setAiError('');
    setAiDraft(null);
    try {
      const selectedArea = getMapPlace(studyAreaPlaceId, selectablePlaces);
      const response = await fetch('/api/agent/problem-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: aiProblemBrief.trim(),
          domain: selectedDomain,
          studyArea: studyAreaLabel.trim() || selectedArea?.label || 'Regional study area',
          context: buildAIProblemContext(baseScenario)
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'The AI service is unavailable right now.');
      const draft = validateAIProblemDraft(result?.draft, baseScenario);
      setAiDraft(draft);
      setTitle(draft.title);
      setDescription(draft.description);
      setCustomSymptom(draft.measurableSymptom);
      setStep(2);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Could not create an AI draft.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleFinish = () => {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 3) {
      setValidationError('Please enter a scenario title (at least 3 characters).');
      setStep(1);
      return;
    }
    setValidationError('');
    if (selectedProblemId === 'ai-custom' && !aiDraft) {
      setAiError('Generate and review the AI draft before starting its simulation.');
      setStep(1);
      return;
    }
    const baseTemplate =
      DEFAULT_SCENARIOS.find((s) => s.domain === selectedDomain) ||
      DEFAULT_SCENARIOS[0];
    const clonedBase: Scenario = JSON.parse(JSON.stringify(baseTemplate));
    clonedBase.id = `scen-${selectedDomain}-${Date.now()}`;
    clonedBase.updatedAt = 'Just now';
    clonedBase.status = 'completed';

    const resolvedAreaLabel =
      studyAreaLabel.trim() ||
      getMapPlace(studyAreaPlaceId, selectablePlaces)?.label ||
      'Regional Corridor Overview';

    let configuredScenario: Scenario;
    if (selectedProblemId === 'ai-custom' && aiDraft) {
      configuredScenario = applyAIProblemDraftToScenario(
        clonedBase,
        aiDraft,
        studyAreaPlaceId,
        resolvedAreaLabel
      );
    } else if (
      selectedProblemId !== 'custom' &&
      activeCatalogProblem &&
      activeCatalogProblem.available !== false
    ) {
      configuredScenario = applyProblemTemplateToScenario(
        clonedBase,
        selectedProblemId
      );
      configuredScenario.title = cleanTitle || configuredScenario.title;
      configuredScenario.description =
        description.trim() || configuredScenario.description;
      configuredScenario.studyAreaPlaceId = studyAreaPlaceId;
      configuredScenario.studyAreaLabel = resolvedAreaLabel;
      if (configuredScenario.problemStatement) {
        configuredScenario.problemStatement = {
          ...configuredScenario.problemStatement,
          title: cleanTitle || configuredScenario.problemStatement.title,
          description:
            description.trim() || configuredScenario.problemStatement.description
        };
      }
    } else if (
      selectedProblemId !== 'custom' &&
      activeCatalogProblem &&
      activeCatalogProblem.available === false
    ) {
      configuredScenario = {
        ...clonedBase,
        title: cleanTitle || activeCatalogProblem.title,
        description: description.trim() || activeCatalogProblem.description,
        studyAreaPlaceId,
        studyAreaLabel: resolvedAreaLabel,
        problemStatement: activeCatalogProblem
      };
    } else {
      configuredScenario = {
        ...clonedBase,
        title: cleanTitle || `Custom ${selectedDomain.toUpperCase()} Scenario`,
        description:
          description.trim() || 'User-defined infrastructure simulation study',
        studyAreaPlaceId,
        studyAreaLabel: resolvedAreaLabel,
        problemStatement: {
          id: `prob-custom-${selectedDomain}-${Date.now()}`,
          title: cleanTitle || `Custom ${selectedDomain.toUpperCase()} Problem`,
          description:
            description.trim() || 'User-defined infrastructure challenge definition',
          domain: selectedDomain,
          affectedAssetIds:
            clonedBase.problemStatement?.affectedAssetIds || [],
          measurableSymptom: customSymptom.trim() || 'Peak demand exceeds corridor threshold',
          thresholdConstraint: customThreshold.trim() || 'Within engineering limits',
          horizon: '5 Years (2026-2031)',
          units:
            selectedDomain === 'traffic'
              ? 'km/h, veh/km/lane, veh/h'
              : selectedDomain === 'water'
              ? 'kPa, m/s, m/km'
              : 'MW, % thermal loading',
          dataSource: 'Synthetic demo data — user-configured simulation',
          baselineInputsSummary: 'Custom user-configured baseline study',
          available: true
        }
      };
    }

    onCreateScenario(configuredScenario);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create New Scenario"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header matching reference 03 */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Create New Scenario
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            </h2>
            <p className="text-xs text-slate-400">
              Define a real-world problem from {domainCatalog.length} domain templates or create a custom study.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Step Stepper matching reference 03 */}
        <div className="px-8 py-3 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-center gap-4 text-xs">
          {[
            { num: 1, label: 'Problem' },
            { num: 2, label: 'Solutions' },
            { num: 3, label: 'Assumptions' },
            { num: 4, label: 'Review' }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                  step === s.num
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : step > s.num
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span
                className={`font-semibold ${
                  step === s.num ? 'text-white' : 'text-slate-500'
                }`}
              >
                {s.label}
              </span>
              {s.num < 4 && <div className="w-8 h-px bg-slate-800" />}
            </div>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto max-h-[62vh] space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Select Category & Engineering Domain
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          handleSelectDomainCategory(cat.id, cat.domain)
                        }
                        className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950/70 border-indigo-500 text-white shadow'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileQuestion className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      Problem Catalog ({domainCatalog.filter((p) => p.available !== false).length} Working +{' '}
                      {domainCatalog.filter((p) => p.available === false).length} Disclosures)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectCustomProblem}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                      selectedProblemId === 'custom'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <PlusCircle className="w-3 h-3" />
                    <span>Custom Problem</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAIProblem}
                    aria-pressed={aiMode}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                      aiMode
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-cyan-700 hover:text-cyan-200'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI Scenario Agent</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${domainCatalog.length} ${selectedDomain} problem templates...`}
                    aria-label="Search Problem Templates"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {filteredCatalog.map((prob) => {
                    const isChosen = selectedProblemId === prob.id;
                    const isUnavailable = prob.available === false;
                    return (
                      <button
                        key={prob.id}
                        type="button"
                        onClick={() => handleSelectProblemTemplate(prob)}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-start justify-between gap-2 text-xs cursor-pointer ${
                          isChosen
                            ? 'bg-indigo-950/60 border-indigo-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isUnavailable
                                  ? 'bg-rose-400'
                                  : isChosen
                                  ? 'bg-cyan-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            <span className="truncate">{prob.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {prob.description}
                          </p>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 border ${
                            isUnavailable
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                          }`}
                        >
                          {isUnavailable
                            ? 'Unavailable for this model'
                            : prob.thresholdConstraint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="text-[10px] text-slate-400">
                  Study area on regional map ({selectablePlaces.length} places/areas)
                  <select
                    aria-label="Study area on regional map"
                    value={studyAreaPlaceId}
                    onChange={(event) => setStudyAreaPlaceId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    {selectablePlaces.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.label} · {place.district}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-slate-400">
                  Specific project site / corridor (optional)
                  <input
                    value={studyAreaLabel}
                    onChange={(event) => setStudyAreaLabel(event.target.value.slice(0, 100))}
                    placeholder="e.g. Inner Ring Road or New Layout"
                    maxLength={100}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </label>
              </div>

              {selectedProblemId === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/15">
                  <label className="text-[10px] text-slate-300">
                    Measurable symptom
                    <input
                      value={customSymptom}
                      onChange={(e) => setCustomSymptom(e.target.value.slice(0, 120))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="text-[10px] text-slate-300">
                    Engineering threshold constraint
                    <input
                      value={customThreshold}
                      onChange={(e) => setCustomThreshold(e.target.value.slice(0, 120))}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>
              )}

              {aiMode && (
                <section className="rounded-2xl border border-cyan-500/35 bg-cyan-950/15 p-3.5 space-y-3" aria-labelledby="ai-scenario-agent-title">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="ai-scenario-agent-title" className="text-xs font-bold text-cyan-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> WhatIf AI Scenario Agent
                    </h3>
                    <span className={`text-[9px] rounded-full px-2 py-0.5 border ${aiConfigured ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>
                      {aiConfigured ? 'API key detected' : aiStatusChecked ? 'Setup needed' : 'Checking setup'}
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-300">
                    Describe a new real-world problem. AI drafts solver inputs, three or more intervention options, and future stress cases. WhatIf’s domain solver calculates the results after you initialize the study.
                  </p>
                  <label htmlFor="ai-problem-brief" className="text-[10px] text-slate-400 block">
                    Your problem statement
                    <textarea
                      id="ai-problem-brief"
                      value={aiProblemBrief}
                      onChange={(event) => setAiProblemBrief(event.target.value.slice(0, 1600))}
                      rows={3}
                      maxLength={1600}
                      placeholder="Example: A new residential layout has no connected water supply yet. Estimate the pressure and demand requirements under the stated concept assumptions, compare possible supply options, and test what happens during a dry-season demand increase."
                      className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </label>
                  <p className="text-[9px] leading-relaxed text-slate-500">
                    Privacy: when you click Generate, the problem text and the selected solver’s allowed parameters are sent to Google Gemini. Free-tier content may be used by Google to improve its services. Do not enter personal or confidential data.
                  </p>
                  <p className="text-[9px] leading-relaxed text-amber-200/80">
                    Cost: free-tier access is quota-limited, and WhatIf cannot check a Google project’s billing status. Keep billing disabled for zero-cost use; a billing-enabled project may incur charges.
                  </p>
                  {!aiConfigured && (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-[10px] leading-relaxed text-amber-100" role="status">
                      {aiStatusChecked
                        ? <>To turn on online AI without a paid service, create a Gemini API key in a Google AI Studio free-tier project, keep billing disabled, add the key as <code>GEMINI_API_KEY</code> in the local <code>.env.local</code> file, and restart WhatIf. Do not paste the key into chat or browser code.</>
                        : 'Checking the local AI service…'}
                    </div>
                  )}
                  {aiError && <p role="alert" className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-2.5 text-[10px] text-rose-200">{aiError}</p>}
                  <button
                    type="button"
                    onClick={handleGenerateAIDraft}
                    disabled={!aiConfigured || aiBusy || aiProblemBrief.trim().length < 12}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/60 bg-cyan-500/15 px-3 py-2 text-[11px] font-bold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {aiBusy ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiBusy ? 'Drafting and checking inputs…' : 'Generate solver-ready draft'}
                  </button>
                  {aiDraft && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-[10px] text-emerald-100">
                      Draft validated: {aiDraft.baselineChanges.length} baseline changes · {aiDraft.alternatives.length} solver options · {aiDraft.futureCases.length} future stress tests. Values are proposals; solver results are calculated after initialization.
                    </div>
                  )}
                </section>
              )}

              {activeCatalogProblem?.available === false && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5">
                  <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block">
                      Unavailable for this model: {activeCatalogProblem.title}
                    </strong>
                    <span className="text-[11px]">
                      {activeCatalogProblem.unavailableReason}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Scenario Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Substation Thermal Overload Mitigation"
                />
                {validationError && (
                  <p role="alert" className="text-[10px] text-rose-300 mt-1">
                    {validationError}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Problem Description
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {description.length}/300
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="Define the infrastructure challenge and desired outcomes..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Candidate Solutions ({previewScenario.alternatives.length} Configured for Problem)
                </label>
                <span className="text-[10px] text-amber-400 font-semibold">
                  Synthetic demo data — not real infrastructure data
                </span>
              </div>

              {previewScenario.alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">
                      [{alt.tag}] {alt.name}
                    </span>
                    <span className="text-[10px] text-cyan-300 font-mono font-bold">
                      {alt.costDataStatus === 'not-estimated' ? 'Cost not estimated' : `${formatCostEstimate(alt.capexCostMillion)} (Estimated)`}
                      {' · '}
                      {alt.scheduleDataStatus === 'not-estimated' ? 'timeline not estimated' : `${alt.implementationMonths} mo (Synthetic)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{alt.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {alt.modifications.map((mod, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-emerald-300"
                      >
                        {mod.targetId}: {mod.originalValue} → {mod.newValue} {mod.unit}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Declared Assumptions & Hard Constraints ({selectedDomain.toUpperCase()} SI Units)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {previewScenario.assumptions.map((asm) => (
                  <div
                    key={asm.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <span className="text-slate-400 block text-[10px]">
                      {asm.name}
                    </span>
                    <strong className="text-white font-mono">
                      {asm.value} {asm.unit} (Range: {asm.rangeMin}–{asm.rangeMax})
                    </strong>
                  </div>
                ))}
                {previewScenario.constraints.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30"
                  >
                    <span className="text-cyan-300 block text-[10px]">
                      Constraint: {c.name}
                    </span>
                    <strong className="text-white font-mono">
                      {c.operator} {c.threshold} {c.unit} ({c.severity})
                    </strong>
                  </div>
                ))}
              </div>
              {aiDraft && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <strong className="mb-1 block text-amber-200">AI-stated assumptions</strong>
                    {aiDraft.assumptions.length > 0
                      ? <ul className="list-disc pl-4 text-slate-300 space-y-1">{aiDraft.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>
                      : <span className="text-slate-400">No extra assumptions returned.</span>}
                  </div>
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3">
                    <strong className="mb-1 block text-rose-200">Data still needed for a site-specific study</strong>
                    {aiDraft.missingData.length > 0
                      ? <ul className="list-disc pl-4 text-slate-300 space-y-1">{[...aiDraft.missingData, 'Site-specific CAPEX and OPEX estimates', 'Implementation duration and dependencies'].map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                      : <ul className="list-disc pl-4 text-slate-300 space-y-1"><li>Site-specific CAPEX and OPEX estimates</li><li>Implementation duration and dependencies</li><li>Verify site data before relying on the concept model</li></ul>}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready for Deterministic Initialization</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Scenario <strong>'{title}'</strong> configured with{' '}
                  {selectedCategory} ({selectedDomain.toUpperCase()} solver),{' '}
                  {previewScenario.alternatives.length} candidate solutions, and full digital-twin network topology.
                </p>
                {aiDraft && (
                  <p className="text-[10px] leading-relaxed text-amber-200">
                    AI concept for {studyAreaLabel.trim() || getMapPlace(studyAreaPlaceId, selectablePlaces)?.label}. Solver values and topology remain illustrative; future outcomes are conditional stress tests, not predictions.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-lg shadow-indigo-500/25 cursor-pointer"
            >
              <span>
                Next:{' '}
                {step === 1
                  ? 'Define Solutions'
                  : step === 2
                  ? 'Assumptions'
                  : 'Review'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={selectedProblemId === 'ai-custom' && !aiDraft}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Initialize Simulation</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
