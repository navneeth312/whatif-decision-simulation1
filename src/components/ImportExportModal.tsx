import React, { useRef, useState } from 'react';
import { useModalA11y } from '../utils/useModalA11y';
import { X, Download, Upload, AlertTriangle, CheckCircle2, ShieldCheck, Copy, Check } from 'lucide-react';
import { Scenario } from '../types';
import {
  runAlternativeSimulation,
  escapeCsvCell,
  sanitizeAndValidateScenarioImport
} from '../models/decisionEngines';

interface ImportExportModalProps {
  scenario: Scenario;
  onImportScenario: (scenario: Scenario) => void;
  onClose: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  scenario,
  onImportScenario,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'export-json' | 'export-csv' | 'import-json'>('export-json');
  const [importJsonText, setImportJsonText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(true, onClose, dialogRef);

  // Generate exported JSON
  const exportedJson = JSON.stringify(scenario, null, 2);

  // Generate CSV representation
  const generateCsv = (): string => {
    const headers = [
      'Scenario Title',
      'Domain',
      'Alternative Name',
      'Alternative Tag',
      'CAPEX ($M) (Synthetic)',
      'Annual OPEX ($M) (Synthetic)',
      'Implementation (Months)',
      'Calculated Primary Metric',
      'Unit',
      'Constraint Status'
    ];

    const rows: string[][] = [];
    scenario.alternatives.forEach((alt) => {
      const run = runAlternativeSimulation(scenario, alt);
      rows.push([
        scenario.title,
        scenario.domain,
        alt.name,
        alt.tag,
        alt.costDataStatus === 'not-estimated' ? 'Not estimated' : String(alt.capexCostMillion),
        alt.costDataStatus === 'not-estimated' ? 'Not estimated' : String(alt.opexAnnualMillion),
        alt.scheduleDataStatus === 'not-estimated' ? 'Not estimated' : String(alt.implementationMonths),
        run.metrics.primaryPerformance !== undefined ? String(run.metrics.primaryPerformance.toFixed(2)) : 'Uncalculated',
        run.metrics.primaryPerformanceUnit || scenario.objectives[0]?.unit || '',
        (run.unverifiedConstraints?.length || 0) > 0
          ? 'Partial check'
          : run.constraintViolations.length > 0
          ? 'Violated'
          : 'Passed'
      ]);
    });

    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(','))
    ];

    return csvLines.join('\r\n');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.id}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const csvContent = generateCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.id}-comparison.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    setValidationError(null);
    const result = sanitizeAndValidateScenarioImport(importJsonText);
    if (!result.valid) {
      setValidationError(result.errors.join(' | '));
      return;
    }
    onImportScenario(result.scenario);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setValidationError('File exceeds maximum allowed size (1 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') {
        setValidationError('Uploaded file could not be read as UTF-8 text.');
        return;
      }
      setImportJsonText(text);
      setValidationError(null);
    };
    reader.onerror = () => {
      setValidationError('Failed to read the selected JSON file.');
    };
    reader.readAsText(file);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Import and Export Scenarios"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Import & Export Data
              </h2>
              <p className="text-xs text-slate-400">
                JSON & CSV with schema validation & formula-injection protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Import and Export options" className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'export-json'}
            onClick={() => setActiveTab('export-json')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'export-json'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Export JSON
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'export-csv'}
            onClick={() => setActiveTab('export-csv')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'export-csv'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Export CSV
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'import-json'}
            onClick={() => setActiveTab('import-json')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'import-json'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Import JSON
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {activeTab === 'export-json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Scenario: <strong className="text-white">{scenario.title}</strong> ({scenario.domain.toUpperCase()})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(exportedJson)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                  <button
                    onClick={handleDownloadJson}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .json</span>
                  </button>
                </div>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap select-all">
                {exportedJson}
              </pre>
            </div>
          )}

          {activeTab === 'export-csv' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">
                    Alternative Comparison Table ({scenario.alternatives.length} alternatives)
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    Formula injection protection enabled (escapes =, +, -, @)
                  </span>
                </div>
                <button
                  onClick={handleDownloadCsv}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .csv</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap select-all">
                {generateCsv()}
              </pre>
            </div>
          )}

          {activeTab === 'import-json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="import-json-textarea" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Paste JSON Scenario or Upload File
                </label>
                <label className="cursor-pointer px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    aria-label="Upload scenario JSON file"
                    className="sr-only"
                  />
                </label>
              </div>

              <textarea
                id="import-json-textarea"
                aria-label="Paste Scenario JSON"
                value={importJsonText}
                onChange={(e) => {
                  setImportJsonText(e.target.value);
                  setValidationError(null);
                }}
                rows={10}
                placeholder="Paste valid Scenario JSON here..."
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
              />

              {validationError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Validate & Import Scenario</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with mandatory disclosure */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Single-device demo · browser storage only · no cloud sync
          </span>
          <span className="text-[10px] text-slate-400">
            Exported data contains only user-configured parameters & calculated outputs
          </span>
        </div>
      </div>
    </div>
  );
};
