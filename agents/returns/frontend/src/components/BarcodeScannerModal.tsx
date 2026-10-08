import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ScanBarcode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Zap,
  Volume2,
  VolumeX,
  Keyboard,
  Package,
} from 'lucide-react';
import { OrderRecord } from '../types';
import { Barcode } from './Barcode';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableOrders: OrderRecord[];
  onSelectOrder: (order: OrderRecord) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  availableOrders,
  onSelectOrder,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [lastScanned, setLastScanned] = useState<OrderRecord | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [laserActive, setLaserActive] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable in some browser settings
    }
  };

  const handleProcessScan = (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    // Search orderId, returnId, SKU, or serial
    const match = availableOrders.find(
      (o) =>
        o.orderId.toUpperCase() === trimmed ||
        o.returnId.toUpperCase() === trimmed ||
        o.product.sku.toUpperCase() === trimmed ||
        o.serialNumber.toUpperCase() === trimmed ||
        trimmed.includes(o.orderId.toUpperCase()) ||
        trimmed.includes(o.returnId.toUpperCase())
    );

    playBeep();

    if (match) {
      setLastScanned(match);
      setScanMessage(`Verified: ${match.orderId} (${match.product.name})`);
    } else {
      setScanMessage(`No catalog match found for barcode: "${trimmed}"`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessScan(manualInput);
    setManualInput('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full my-8 overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  Optical Barcode Intake Scanner
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
                  USB Wedge & Laser Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan carton shipping label, RMA barcode, or physical SKU to retrieve order BOM.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title={soundEnabled ? 'Mute scan beep' : 'Enable scan beep'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scanner Viewport with Laser Animation */}
        <div className="p-6 space-y-5">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-[16/7] flex items-center justify-center select-none shadow-inner">
            {/* Viewfinder Target */}
            <div className="relative w-72 h-28 border-2 border-indigo-500/60 rounded-lg flex flex-col items-center justify-center p-2 bg-indigo-950/20">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-indigo-400 -mt-0.5 -ml-0.5" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-indigo-400 -mt-0.5 -mr-0.5" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-indigo-400 -mb-0.5 -ml-0.5" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-indigo-400 -mb-0.5 -mr-0.5" />

              {/* Animated Red Laser Line */}
              {laserActive && (
                <div className="absolute inset-x-2 h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse" />
              )}

              <ScanBarcode className="w-10 h-10 text-indigo-400/40 mb-1" />
              <span className="text-[10px] font-mono text-indigo-300">
                ALIGN CARTON OR DEVICE BARCODE HERE
              </span>
            </div>

            {/* Status Pill */}
            <div className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Decoder Active: Code-128 / Code-39 / EAN-13</span>
            </div>
          </div>

          {/* Wedge Input Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                <span>Barcode Scanner Wedge / Manual Input:</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Press Enter to decode</span>
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Scan or enter RMA / Order / SKU (e.g., ORD-10984, RET-88421)..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
              >
                Decode
              </button>
            </div>
          </form>

          {/* Quick Simulated Scans */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Quick Barcode Presets (Click to Simulate Scan):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {availableOrders.map((ord) => {
                const isBoxSwap = ord.scenarioType === 'BOX_SWAP';
                return (
                  <button
                    key={ord.orderId}
                    type="button"
                    onClick={() => handleProcessScan(ord.orderId)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isBoxSwap
                        ? 'bg-amber-950/30 border-amber-800/80 hover:border-amber-600'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-white text-[11px]">
                        {ord.orderId}
                      </span>
                      {isBoxSwap && (
                        <span className="text-[8px] font-bold text-amber-300 bg-amber-950 border border-amber-800 px-1 py-0.2 rounded">
                          SWAP
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {ord.product.sku}
                    </div>
                    <div className="mt-1.5 flex justify-center">
                      <Barcode value={ord.orderId} height={20} displayValue={false} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scanned Result Banner */}
          {lastScanned && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Barcode Verified: {lastScanned.orderId}</span>
                </div>
                <div className="text-slate-200 font-medium">
                  {lastScanned.product.name}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  RMA: {lastScanned.returnId} · SKU: {lastScanned.product.sku}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSelectOrder(lastScanned);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
              >
                <span>Load in Inspection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {scanMessage && !lastScanned && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{scanMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Standard 1D / 2D Symbology Decoder</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
