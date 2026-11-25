import React, { useMemo, useState } from 'react';
import {
  Search,
  Sparkles,
  FileText,
  Download,
  HelpCircle
} from 'lucide-react';
import { Scenario } from '../types';

interface NavbarProps {
  scenarios: Scenario[];
  activeScenarioId: string;
  profileName?: string;
  profileInitials?: string;
  onSelectScenario: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenReportModal: () => void;
  onOpenDecisionTools?: () => void;
  onOpenImportExport: () => void;
  onOpenProfileSettings: () => void;
  onGoToLanding: () => void;
  onOpenWalkthrough?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  scenarios,
  activeScenarioId,
  profileName = 'Local Demo',
  profileInitials = 'LP',
  onSelectScenario,
  onOpenReportModal,
  onOpenDecisionTools,
  onOpenImportExport,
  onOpenProfileSettings,
  onOpenWalkthrough
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const matchingScenarios = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return scenarios.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.studyAreaLabel || '').toLowerCase().includes(q) ||
        (s.problemStatement?.title || '').toLowerCase().includes(q)
    );
  }, [scenarios, searchQuery]);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 px-3 sm:px-6 flex items-center justify-between z-30 shrink-0 gap-3 relative">
      {/* Left: Search (Desktop lg+) & Scenario selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className="relative hidden lg:block w-48 xl:w-60 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                setSearchOpen(false);
              } else if (e.key === 'Enter' && matchingScenarios[0]) {
                e.preventDefault();
                onSelectScenario(matchingScenarios[0].id);
                setSearchQuery('');
                setSearchOpen(false);
              }
            }}
            aria-label="Search scenarios"
            aria-expanded={searchOpen && searchQuery.trim().length > 0}
            placeholder="Search scenarios, domains..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
          />
          {searchOpen && searchQuery.trim().length > 0 && (
            <div
              role="listbox"
              aria-label="Matching scenarios"
              className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-slate-700 bg-slate-950 shadow-2xl p-1 max-h-60 overflow-y-auto z-40"
            >
              {matchingScenarios.length > 0 ? (
                matchingScenarios.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={item.id === activeScenarioId}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelectScenario(item.id);
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-indigo-500/15 flex items-center justify-between gap-2 text-slate-200 cursor-pointer"
                  >
                    <span className="truncate font-semibold">{item.title}</span>
                    <span className="text-[10px] font-mono uppercase text-cyan-300 shrink-0">
                      {item.domain}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2.5 py-2 text-[11px] text-slate-400">
                  No scenarios match "{searchQuery.trim()}".
                </p>
              )}
            </div>
          )}
        </div>

        {/* Active Scenario Selector Dropdown - safely bounded and responsive */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-[280px] sm:max-w-[340px] xl:max-w-[420px]">
          <span className="text-xs text-slate-300 hidden sm:inline shrink-0">
            Scenario:
          </span>
          <select
            aria-label="Select Active Scenario"
            value={activeScenarioId}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="bg-slate-900/95 border border-slate-700/80 text-xs font-semibold text-white px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer min-w-0 w-full truncate"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.domain.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center synthetic demo label (Only shown on extra wide displays without crowding) */}
      <div className="hidden min-[1680px]:flex items-center gap-2 shrink-0">
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 whitespace-nowrap">
          ● Deterministic Solver Active
        </span>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-900/60 border border-slate-800 text-slate-300 whitespace-nowrap">
          Demo data — synthetic, not real infrastructure data
        </span>
      </div>

      {/* Right: Quick actions & Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenWalkthrough && (
          <button
            type="button"
            onClick={onOpenWalkthrough}
            aria-label="Open 8-Step Walkthrough Guide"
            title="Open Guided Tour / Help"
            className="px-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-xs font-semibold text-indigo-200 flex items-center gap-1.5 transition cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenImportExport}
          aria-label="Import and Export Data"
          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
          title="Import / Export Scenario (JSON, CSV)"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden lg:inline">Data</span>
        </button>

        <button
          type="button"
          onClick={onOpenReportModal}
          aria-label="Open Scenario Simulation Report"
          title="Open Scenario Report"
          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="hidden lg:inline">Report</span>
        </button>

        <div className="h-6 w-px bg-slate-800 mx-0.5 hidden sm:block" />

        {/* User Profile & Settings - Single-Device Local Storage */}
        <button
          type="button"
          onClick={onOpenProfileSettings}
          aria-label="Open Local Profile and Settings"
          className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition shrink-0"
          title="Local Profile & Storage Settings (Browser-Only · No Cloud Sync)"
        >
          <span className="text-[10px] text-slate-300 font-medium hidden xl:inline max-w-[96px] truncate">
            {profileName}
          </span>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 p-0.5 shadow">
            <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center font-bold text-xs text-white">
              {profileInitials}
            </div>
          </div>
        </button>
      </div>
    </header>
  );
};
