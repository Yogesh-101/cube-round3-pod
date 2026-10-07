import React from 'react';
import { DollarSign, CheckCircle2, XCircle, HelpCircle, FileText, ArrowUpRight } from 'lucide-react';

export default function DashboardMetrics({ summary }) {
  if (!summary) return null;

  const currency = summary.currency || 'USD';
  const formatMoney = (val) => `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Potential Claim Amount (CONTRADICTED Recovery) */}
      <div className="panel p-5 relative overflow-hidden border-red-500/30 bg-gradient-to-br from-slate-900 to-red-950/20">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
            <ArrowUpRight className="h-4 w-4" /> Defensible Claim Recovery
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 font-mono">
            {summary.contradicted_count} contradicted
          </span>
        </div>
        <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
          {formatMoney(summary.potential_claim_amount)}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Disputed fees with defensible operational evidence (PASS logs)
        </p>
      </div>

      {/* 2. Total Charges Levied */}
      <div className="panel p-5 border-slate-800">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-blue-400" /> Total Ingested Charges
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            {summary.total_charges} charges
          </span>
        </div>
        <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
          {formatMoney(summary.total_charge_amount)}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Total gross chargebacks and penalty fees under audit
        </p>
      </div>

      {/* 3. Supported Charges (Valid Penalties) */}
      <div className="panel p-5 border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/20">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Supported (Valid)
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono">
            🟢 {summary.supported_count}
          </span>
        </div>
        <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
          {summary.supported_count}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Charges confirmed by internal warehouse defect/shortage logs
        </p>
      </div>

      {/* 4. Silent / Ambiguous Cases */}
      <div className="panel p-5 border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800/30">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4" /> Silent (Incomplete)
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            ⚪ {summary.silent_count}
          </span>
        </div>
        <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
          {summary.silent_count}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Missing, partial, or conflicting evidence (safe default, $0 claim)
        </p>
      </div>
    </div>
  );
}
