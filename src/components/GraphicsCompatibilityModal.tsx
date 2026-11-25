import React, { useState, useEffect, useRef } from 'react';
import { useModalA11y } from '../utils/useModalA11y';
import {
  Monitor,
  Cpu,
  Layers,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
  Gauge,
  Sliders,
  MapPin,
  Sparkles
} from 'lucide-react';

export type GraphicsProfile = 'recommended' | 'high' | 'performance' | '2d';

export interface GraphicsCapabilities {
  webgl1: boolean;
  webgl2: boolean;
  renderer: string;
  vendor: string;
  maxTextureSize: number;
  isSoftware: boolean;
  recommendedProfile: GraphicsProfile;
  tierDescription: string;
}

export function detectGraphicsCapabilities(): GraphicsCapabilities {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      webgl1: true,
      webgl2: true,
      renderer: 'Simulated Environment',
      vendor: 'Standard Graphics',
      maxTextureSize: 4096,
      isSoftware: false,
      recommendedProfile: 'recommended',
      tierDescription: 'Standard WebGL 2 Acceleration'
    };
  }

  const canvas = document.createElement('canvas');
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  let isGl2 = false;

  try {
    gl = canvas.getContext('webgl2');
    if (gl) isGl2 = true;
  } catch {
    // fallback
  }

  if (!gl) {
    try {
      gl = canvas.getContext('webgl') || (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    } catch {
      // failed
    }
  }

  if (!gl) {
    return {
      webgl1: false,
      webgl2: false,
      renderer: 'Unavailable',
      vendor: 'Unavailable',
      maxTextureSize: 0,
      isSoftware: true,
      recommendedProfile: '2d',
      tierDescription: 'No WebGL acceleration detected. 2D fallback recommended.'
    };
  }

  let renderer = 'Standard WebGL Adapter';
  let vendor = 'Standard Vendor';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || renderer;
    vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || vendor;
  }

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
  const isSoftware = /swiftshader|llvmpipe|software|mesa/i.test(renderer);
  const isDedicatedGpu = /nvidia|geforce|rtx|gtx|radeon|amd|apple m[1-9]/i.test(renderer);

  let recommendedProfile: GraphicsProfile = 'recommended';
  let tierDescription = 'Hardware-Accelerated WebGL 2';

  if (isSoftware || maxTextureSize < 4096) {
    recommendedProfile = 'performance';
    tierDescription = 'Software / Low-Memory GPU detected. Performance Mode recommended.';
  } else if (isDedicatedGpu && maxTextureSize >= 8192) {
    recommendedProfile = 'high';
    tierDescription = 'High-Performance Dedicated GPU detected. High Quality recommended.';
  } else {
    recommendedProfile = 'recommended';
    tierDescription = 'Standard Accelerated GPU. Recommended Quality auto-tuned for 60 FPS.';
  }

  return {
    webgl1: true,
    webgl2: isGl2,
    renderer,
    vendor,
    maxTextureSize,
    isSoftware,
    recommendedProfile,
    tierDescription
  };
}

interface GraphicsCompatibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyProfile: (profile: GraphicsProfile) => void;
  currentProfile?: GraphicsProfile;
}

export const GraphicsCompatibilityModal: React.FC<GraphicsCompatibilityModalProps> = ({
  isOpen,
  onClose,
  onApplyProfile,
  currentProfile
}) => {
  const [caps, setCaps] = useState<GraphicsCapabilities | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<GraphicsProfile>('recommended');
  const [rememberPreference, setRememberPreference] = useState<boolean>(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(isOpen, onClose, dialogRef);

  useEffect(() => {
    if (isOpen) {
      const detected = detectGraphicsCapabilities();
      setCaps(detected);

      const saved = localStorage.getItem('whatif_graphics_preference') as GraphicsProfile | null;
      if (saved && ['recommended', 'high', 'performance', '2d'].includes(saved)) {
        setSelectedProfile(saved);
      } else if (currentProfile) {
        setSelectedProfile(currentProfile);
      } else {
        setSelectedProfile(detected.recommendedProfile);
      }
    }
  }, [isOpen, currentProfile]);

  if (!isOpen || !caps) return null;

  const handleConfirm = () => {
    if (rememberPreference) {
      localStorage.setItem('whatif_graphics_preference', selectedProfile);
      localStorage.setItem('whatif_graphics_checked', 'true');
    }
    onApplyProfile(selectedProfile);
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="graphics-compat-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 id="graphics-compat-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>3D Digital Twin — Graphics Configuration</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  GPU Pre-Flight
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Optimized visual fidelity and rendering performance for your hardware
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close graphics modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs">
          {/* Detected Hardware Diagnostic Strip */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Detected Hardware Diagnostics
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                {caps.webgl2 ? 'WebGL 2 Accelerated' : caps.webgl1 ? 'WebGL 1 Standard' : 'Software Only'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
              <div className="truncate">
                <strong className="text-slate-300 font-semibold">Renderer:</strong>{' '}
                <span className="text-cyan-300">{caps.renderer}</span>
              </div>
              <div>
                <strong className="text-slate-300 font-semibold">Max Texture:</strong>{' '}
                <span className="text-cyan-300">{caps.maxTextureSize.toLocaleString()} px</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 italic">
              ℹ {caps.tierDescription}
            </div>
          </div>

          {/* 4 Profile Cards */}
          <div className="space-y-2" role="radiogroup" aria-labelledby="graphics-profile-heading">
            <span id="graphics-profile-heading" className="text-xs font-bold text-slate-200 block">
              Select Graphics Profile:
            </span>

            {/* Profile 1: Recommended Quality */}
            <label
              htmlFor="graphics-profile-recommended"
              className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                selectedProfile === 'recommended'
                  ? 'bg-cyan-500/10 border-cyan-400/80 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                id="graphics-profile-recommended"
                type="radio"
                name="graphics-profile"
                checked={selectedProfile === 'recommended'}
                onChange={() => setSelectedProfile('recommended')}
                className="mt-1 accent-cyan-400"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Recommended Quality</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ★ Auto-Selected (60 FPS)
                    </span>
                  </span>
                  <Gauge className="w-4 h-4 text-cyan-400" />
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Balanced fidelity & high framerate. Extruded 3D OSM buildings, multi-class asphalt road ribbons,
                  natural vegetation canopy clusters, anti-aliased geometry, and dynamic daylight/cyber lighting.
                </p>
              </div>
            </label>

            {/* Profile 2: High Quality */}
            <label
              htmlFor="graphics-profile-high"
              className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                selectedProfile === 'high'
                  ? 'bg-cyan-500/10 border-cyan-400/80 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                id="graphics-profile-high"
                type="radio"
                name="graphics-profile"
                checked={selectedProfile === 'high'}
                onChange={() => setSelectedProfile('high')}
                className="mt-1 accent-cyan-400"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span>High Quality</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      Dedicated GPU
                    </span>
                  </span>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Maximum visual realism. High-density procedural building facades, soft shadows, maximum vegetation canopy
                  instancing, full lane marking ribbons, and extended horizon draw distance. Recommended for dedicated NVIDIA/AMD/Apple GPUs.
                </p>
              </div>
            </label>

            {/* Profile 3: Performance Mode */}
            <label
              htmlFor="graphics-profile-performance"
              className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                selectedProfile === 'performance'
                  ? 'bg-cyan-500/10 border-cyan-400/80 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                id="graphics-profile-performance"
                type="radio"
                name="graphics-profile"
                checked={selectedProfile === 'performance'}
                onChange={() => setSelectedProfile('performance')}
                className="mt-1 accent-cyan-400"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span>Performance Mode</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Battery & Integrated GPUs
                    </span>
                  </span>
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Streamlined geometry and lightweight shaders. Reduced instancing and simplified facades for silky-smooth
                  60 FPS on low-power laptops, integrated Intel Iris/UHD graphics, or battery operation.
                </p>
              </div>
            </label>

            {/* Profile 4: 2D Interactive GIS Map Fallback */}
            <label
              htmlFor="graphics-profile-2d"
              className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                selectedProfile === '2d'
                  ? 'bg-cyan-500/10 border-cyan-400/80 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                id="graphics-profile-2d"
                type="radio"
                name="graphics-profile"
                checked={selectedProfile === '2d'}
                onChange={() => setSelectedProfile('2d')}
                className="mt-1 accent-cyan-400"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span>2D Interactive GIS Map Fallback</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-700 text-slate-300">
                      Zero 3D WebGL
                    </span>
                  </span>
                  <MapPin className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  Traditional 2D vector and Carto/OSM raster map interface. Runs cleanly on any device with zero 3D WebGL overhead.
                </p>
              </div>
            </label>
          </div>

          {/* Remember Preference Checkbox */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <input
              type="checkbox"
              id="remember-pref"
              checked={rememberPreference}
              onChange={(e) => setRememberPreference(e.target.checked)}
              className="accent-cyan-400 rounded cursor-pointer"
            />
            <label htmlFor="remember-pref" className="text-slate-300 text-[11px] cursor-pointer">
              Remember my choice on this device (you can change this anytime from the map toolbar)
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedProfile('2d');
              onApplyProfile('2d');
              onClose();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
          >
            Use 2D Map Instead
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply & Enter Digital Twin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
