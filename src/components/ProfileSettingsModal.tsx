import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Sliders, HardDrive, RotateCcw, Check } from 'lucide-react';
import {
  DEFAULT_LOCAL_PROFILE,
  deriveInitials,
  LocalProfileSettings,
  MapViewMode
} from '../models/localStorageStore';

interface ProfileSettingsModalProps {
  profile: LocalProfileSettings;
  storageBytes: number;
  scenarioCount: number;
  historyCount: number;
  onSaveProfile: (next: LocalProfileSettings) => void;
  onResetAllData: () => void;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  profile,
  storageBytes,
  scenarioCount,
  historyCount,
  onSaveProfile,
  onResetAllData,
  onClose
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [defaultMapView, setDefaultMapView] = useState<MapViewMode>(profile.defaultMapView);
  const [motionPreference, setMotionPreference] = useState<'system' | 'reduced'>(profile.motionPreference);
  const [persistHistory, setPersistHistory] = useState(profile.persistHistory);
  const [show3DCompatNotice, setShow3DCompatNotice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('whatif_dont_show_3d_compat') !== 'true';
    } catch {
      return true;
    }
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = displayName.replace(/[<>]/g, '').trim() || DEFAULT_LOCAL_PROFILE.displayName;
    onSaveProfile({
      displayName: cleanedName.slice(0, 40),
      initials: deriveInitials(cleanedName),
      defaultMapView,
      motionPreference,
      persistHistory
    });
    if (typeof window !== 'undefined') {
      try {
        if (show3DCompatNotice) {
          localStorage.removeItem('whatif_dont_show_3d_compat');
        } else {
          localStorage.setItem('whatif_dont_show_3d_compat', 'true');
        }
      } catch {
        // ignore
      }
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-profile-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/75">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-bold text-xs text-white">
                {deriveInitials(displayName)}
              </div>
            </div>
            <div>
              <h2 id="local-profile-settings-title" className="text-base font-extrabold text-white flex items-center gap-2">
                Local Profile & Preferences
              </h2>
              <p className="text-[11px] text-slate-400">
                Browser-only settings & workspace storage controls
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Profile and Settings"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh] text-xs">
          <div className="p-3.5 rounded-2xl bg-emerald-950/25 border border-emerald-500/35 text-emerald-200 space-y-1 text-[11px]">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Local-Only Privacy Disclosure</span>
            </div>
            <p className="leading-relaxed text-emerald-100/90">
              Your scenarios, assumptions, run logs, and profile preferences stay strictly on this device in browser <code className="font-mono">localStorage</code>. No account, tracking, or cloud database is used. Online AI runs only if configured locally and explicitly invoked inside Create Scenario.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Local Planner Name
              </span>
              <input
                type="text"
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                placeholder="Local Planner"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-cyan-400" />
                  Default Map Mode
                </span>
                <select
                  value={defaultMapView}
                  onChange={(e) => setDefaultMapView(e.target.value as MapViewMode)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="3d">Normal 3D Digital Twin</option>
                  <option value="holo">Holographic 3D View</option>
                  <option value="2d">2D OpenStreetMap + Overlay</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Motion & Fly-To
                </span>
                <select
                  value={motionPreference}
                  onChange={(e) => setMotionPreference(e.target.value as 'system' | 'reduced')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="system">Follow OS / Browser Setting</option>
                  <option value="reduced">Always Prefer Reduced Motion</option>
                </select>
              </label>
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-white block">Record Local Simulation Run History</span>
                <span className="text-[10px] text-slate-400">
                  Saves solution evaluations locally for the Insights & History log
                </span>
              </div>
              <input
                type="checkbox"
                checked={persistHistory}
                onChange={(e) => setPersistHistory(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <div>
                <span className="font-semibold text-white block">3D Hardware Compatibility Notice</span>
                <span className="text-[10px] text-slate-400">
                  Prompts before opening the 3D map to ensure device compatibility
                </span>
              </div>
              <input
                type="checkbox"
                checked={show3DCompatNotice}
                onChange={(e) => setShow3DCompatNotice(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
              />
            </label>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-300">
              <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <div className="font-semibold text-white">Local Browser Storage</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {scenarioCount} scenarios · {historyCount} run logs · {(storageBytes / 1024).toFixed(1)} KB used
                </div>
              </div>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-[11px] font-semibold text-rose-300 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Demo Data
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onResetAllData();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-[11px] font-bold text-white cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-[11px] text-emerald-400 font-semibold">
              {savedNotice && 'Preferences saved to local browser storage.'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl whatif-pill-primary text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Save Preferences
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

