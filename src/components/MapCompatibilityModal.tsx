import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers, AlertTriangle, CheckCircle2, Monitor } from 'lucide-react';
import { useModalA11y } from '../utils/useModalA11y';

interface MapCompatibilityModalProps {
  isOpen: boolean;
  onProceed3D: () => void;
  onFallback2D: () => void;
  onClose?: () => void;
}

export const MapCompatibilityModal: React.FC<MapCompatibilityModalProps> = ({
  isOpen,
  onProceed3D,
  onFallback2D,
  onClose
}) => {
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      onFallback2D();
    }
  }, [onClose, onFallback2D]);

  useModalA11y(isOpen, handleDismiss, dialogRef);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      setHasWebGL(Boolean(gl));
    } catch {
      setHasWebGL(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProceed = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      try {
        localStorage.setItem('whatif_dont_show_3d_compat', 'true');
      } catch {
        // ignore
      }
    }
    onProceed3D();
  };

  const handleFallback = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      try {
        localStorage.setItem('whatif_dont_show_3d_compat', 'true');
      } catch {
        // ignore
      }
    }
    onFallback2D();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compat-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            {hasWebGL ? <Monitor className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
          </div>
          <div>
            <h2 id="compat-modal-title" className="text-base font-bold text-white">
              Before opening the 3D map
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              This view uses your device&apos;s graphics capabilities to display buildings and infrastructure in 3D. Performance may vary depending on your device and browser.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            {hasWebGL ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">3D Graphics Supported</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">3D Acceleration Not Detected</span>
              </>
            )}
          </div>
          <p className="text-slate-400">
            {hasWebGL
              ? 'Integrated and dedicated graphics cards can both render this view. You can also switch to the lighter 2D map at any time.'
              : 'WebGL hardware acceleration appears disabled. We recommend using the 2D map for smooth performance.'}
          </p>
        </div>

        {/* Don't show me again checkbox */}
        <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded border border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/30 focus:ring-2 cursor-pointer"
          />
          <span>Don&apos;t show me this again</span>
        </label>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleFallback}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Open 2D Map Instead</span>
          </button>
          {hasWebGL && (
            <button
              type="button"
              onClick={handleProceed}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-md shadow-cyan-500/20"
            >
              Continue to 3D Map
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
