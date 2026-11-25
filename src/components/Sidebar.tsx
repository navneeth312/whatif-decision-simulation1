import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Cpu,
  GitCompare,
  History,
  Sparkles,
  Bookmark,
  ShieldAlert,
  Flame,
  Compass
} from 'lucide-react';

export type ActiveTab =
  | 'landing'
  | 'dashboard'
  | 'simulation'
  | 'map'
  | 'compare'
  | 'history'
  | 'decision-tools';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenCreateModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreateModal
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'simulation', label: 'Simulations', icon: Cpu },
    { id: 'map', label: 'Map', icon: Compass },
    { id: 'compare', label: 'Compare', icon: GitCompare },
    { id: 'decision-tools', label: 'Decision Tools', icon: ShieldAlert, badge: '14' },
    { id: 'history', label: 'Insights & History', icon: History }
  ] as const;

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="hidden md:flex w-64 bg-slate-950/95 border-r border-slate-800/80 flex-col justify-between py-6 px-4 select-none shrink-0"
    >
      <div>
        {/* Brand Logo matching reference */}
        <button
          type="button"
          onClick={() => onSelectTab('landing')}
          className="w-full text-left flex items-center gap-3 px-3 py-2 mb-6 cursor-pointer group rounded-xl"
          title="WhatIf Command Center Home"
          aria-label="Go to WhatIf Home Screen"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-xl font-black bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
                W
              </span>
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
              WhatIf
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </span>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-semibold block">
              Decision Simulation
            </span>
          </div>
        </button>

        {/* Quick Action: Create Scenario button */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          aria-label="Create New Scenario"
          className="w-full mb-6 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Scenario</span>
        </button>

        {/* Navigation items */}
        <nav aria-label="Workspace Sections" className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelectTab(item.id as ActiveTab)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {'badge' in item && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Trust Badge & Legal notice */}
      <div className="pt-4 border-t border-slate-900/80">
        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Planning Simulation</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            Synthetic demo models. Validate with qualified engineers before real-world infrastructure decisions.
          </p>
        </div>
      </div>
    </aside>
  );
};
