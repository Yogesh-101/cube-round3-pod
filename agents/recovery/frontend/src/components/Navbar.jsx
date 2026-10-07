import React from 'react';
import { ShieldCheck, RefreshCw, UploadCloud, PlayCircle } from 'lucide-react';

export default function Navbar({ onOpenIngest, onSeedDemo, onAssessAll, isSeeding, isAssessing }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">RecoveryOS</h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Phase 1 Core
              </span>
            </div>
            <p className="text-xs text-slate-400">Deterministic Evidence-to-Recovery Decision Engine</p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSeedDemo}
            disabled={isSeeding}
            className="btn btn-secondary btn-sm"
            title="Reloads the canonical 8 sample scenarios"
          >
            <RefreshCw className={`h-4 w-4 ${isSeeding ? 'animate-spin' : ''}`} />
            <span>{isSeeding ? 'Seeding...' : 'Reset Demo Suite'}</span>
          </button>

          <button
            onClick={onOpenIngest}
            className="btn btn-secondary btn-sm"
            title="Upload CSV / JSON operational data"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Ingest Data</span>
          </button>

          <button
            onClick={onAssessAll}
            disabled={isAssessing}
            className="btn btn-primary btn-sm"
            title="Run deterministic decision engine across all charges"
          >
            <PlayCircle className={`h-4 w-4 ${isAssessing ? 'animate-spin' : ''}`} />
            <span>{isAssessing ? 'Assessing...' : 'Assess All Charges'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
