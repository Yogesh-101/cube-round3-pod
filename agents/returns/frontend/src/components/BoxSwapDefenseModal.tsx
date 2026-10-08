import React from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  ScanBarcode,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Box,
  Fingerprint,
  Eye,
  Workflow,
  HelpCircle,
} from 'lucide-react';

interface BoxSwapDefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchDemoScenario?: () => void;
}

export const BoxSwapDefenseModal: React.FC<BoxSwapDefenseModalProps> = ({
  isOpen,
  onClose,
  onLaunchDemoScenario,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full my-8 overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  The Box-Swap Problem & Multi-Signal Solution
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] font-mono font-bold">
                  Core Engineering Specification
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                How RETURNIQ prevents box-swap return fraud when all standard barcodes are on the exterior packaging.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs text-slate-300 max-h-[80vh] overflow-y-auto">
          {/* Section 1: The Core Dilemma */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-rose-400 block">
              1. The Vulnerability of Traditional Return Stations
            </span>
            <h3 className="text-sm font-bold text-white">
              Why Traditional Warehouse Scanners Fail
            </h3>
            <p className="text-slate-300 leading-relaxed">
              In conventional returns processing, logistics operators scan the UPC, SKU, and serial number sticker on the <strong className="text-white">outer retail carton</strong>. 
              If a customer returns the genuine box of a $1,200 flagship item but places an older $200 device, a brick, or a defective replica inside:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-200">
                <strong className="block text-white mb-0.5">Standard Scanner:</strong>
                Scans outer carton barcode → Reports 100% Match → Approves instant refund.
              </div>
              <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-200">
                <strong className="block text-white mb-0.5">Inventory Contamination:</strong>
                Box is marked as "pristine" and restocked on warehouse shelves for resale.
              </div>
              <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-200">
                <strong className="block text-white mb-0.5">Downstream Impact:</strong>
                Next buyer receives wrong product, triggering negative brand reviews and chargebacks.
              </div>
            </div>
          </div>

          {/* Section 2: RETURNIQ's Multi-Layered Technical Solution */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-indigo-400 block">
                2. The RETURNIQ 5-Layer Technical Solution
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Zero Single-Point-of-Failure</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Layer 1: Optical De-coupling */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <div className="w-5 h-5 rounded bg-indigo-950 border border-indigo-700 flex items-center justify-center text-[10px] font-mono">
                    1
                  </div>
                  <span>Optical De-coupling (Box ≠ Product)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  RETURNIQ decouples packaging evidence from physical hardware evidence. The system mandates 6 distinct angles, inspecting the <strong className="text-slate-200">physical chassis separately</strong> from the outer retail carton. Outer box barcodes are never accepted as proof of product identity.
                </p>
              </div>

              {/* Layer 2: Micro-Chassis Laser Etch OCR */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <div className="w-5 h-5 rounded bg-indigo-950 border border-indigo-700 flex items-center justify-center text-[10px] font-mono">
                    2
                  </div>
                  <span>Micro-Laser Chassis Serial OCR</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  The vision pipeline identifies laser-etched serials directly on the hardware body (e.g. inside SIM tray slots, USB-C ports, headband sliders, or metal baseplates) and cross-compares that against the outer box printed sticker serial.
                </p>
              </div>

              {/* Layer 3: Physical Geometry & Port Fingerprinting */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <div className="w-5 h-5 rounded bg-indigo-950 border border-indigo-700 flex items-center justify-center text-[10px] font-mono">
                    3
                  </div>
                  <span>Hardware Geometry & Port Signatures</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Computer vision verifies unforgeable hardware features:
                  <br />• <strong>Connector types:</strong> USB-C vs. older Lightning / Micro-USB.
                  <br />• <strong>Optical lens geometry:</strong> Camera count, spacing, and sensor depth.
                  <br />• <strong>Materials & buttons:</strong> Titanium vs stainless steel, Action button vs mute switch.
                </p>
              </div>

              {/* Layer 4: Molded Pulp Tray Form-Fitting */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <div className="w-5 h-5 rounded bg-indigo-950 border border-indigo-700 flex items-center justify-center text-[10px] font-mono">
                    4
                  </div>
                  <span>Interior Molded Pulp Tray Analysis</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Premium product boxes feature vacuum-molded or pulp trays custom-contoured down to sub-millimeter tolerances. When a different device is inserted, telltale gaps, tilted angles, or damaged inserts are immediately flagged by vision segmentation.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: The 3-Way Cross-Verification Decision Matrix */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-900/60 space-y-3">
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-amber-400 block">
              3. The 3-Way Cross-Verification Matrix
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/80 font-mono text-[9px] font-bold block">
                  1. EXPECTED
                </span>
                <span className="text-white font-bold block mt-1">Product A</span>
                <span className="text-[10px] text-slate-400 block">Original Order BOM</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/80 font-mono text-[9px] font-bold block">
                  2. DETECTED (BOX OCR)
                </span>
                <span className="text-emerald-400 font-bold block mt-1">Product A (Box Matches)</span>
                <span className="text-[10px] text-slate-400 block">Carton Label & Barcode</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-amber-900/60 space-y-1">
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/80 font-mono text-[9px] font-bold block">
                  3. DETECTED (CHASSIS)
                </span>
                <span className="text-amber-300 font-bold block mt-1">Product B (Mismatch!)</span>
                <span className="text-[10px] text-slate-400 block">Physical Hardware Body</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Triggered System Status: "Potential Product Mismatch — Manual Review Required."</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Non-Accusatory Protocol:</strong> Instead of immediately accusing the customer of fraud, the system marks the return as a potential mismatch and routes it to a Tier-2 supervisor. This handles shipping mis-picks, return slip mix-ups, or supplier box discrepancies with professional integrity while preventing fraudulent refunds.
              </p>
            </div>
          </div>

          {/* Section 4: Live Scenario Demonstration */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Test the Live Box-Swap Scenario in RETURNIQ
              </span>
              <p className="text-[11px] text-slate-400">
                Order <strong className="text-white font-mono">ORD-10984</strong> contains an authentic iPhone 15 Pro Max box with an older iPhone 12 Pro inside. Run the AI inspection to watch the multi-signal detection in real time.
              </p>
            </div>
            {onLaunchDemoScenario && (
              <button
                onClick={() => {
                  onClose();
                  onLaunchDemoScenario();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all flex items-center gap-2 shrink-0 shadow-md"
              >
                <span>Launch Box-Swap Test</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            RETURNIQ Anti-Swap Hardware Intelligence · Spec v2.6
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
