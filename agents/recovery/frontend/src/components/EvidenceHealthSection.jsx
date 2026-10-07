import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchEvidenceHealth } from '../services/api';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Filter
} from 'lucide-react';

export default function EvidenceHealthSection({ onSelectCharge }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvidenceHealth();
      setHealth(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load evidence health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  if (loading) {
    return (
      <div className="saas-card p-6 flex flex-col items-center justify-center text-slate-400 space-y-2">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-xs">Auditing evidence coverage and detecting operational gaps...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saas-card p-4 border-red-500/30 bg-red-950/20 text-red-300 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span>{error}</span>
        </div>
        <button onClick={loadHealth} className="btn btn-secondary btn-sm text-xs">
          Retry
        </button>
      </div>
    );
  }

  if (!health) return null;

  const gaps = health.evidence_gaps || [];
  const filteredGaps = gaps.filter(g => {
    if (filterType === 'ALL') return true;
    if (filterType === 'HIGH') return g.severity === 'HIGH';
    if (filterType === 'CONFLICT') return g.gap_type === 'CONFLICTING_EVIDENCE';
    if (filterType === 'NO_EV') return g.gap_type === 'NO_EVIDENCE';
    if (filterType === 'MISSING') return g.gap_type === 'MISSING_EXPECTED_TYPE';
    return true;
  });

  return (
    <div className="saas-card space-y-5">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Evidence Health & Gap Detection
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold font-mono">
              Proactive Audit
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time audit of evidence completeness, missing records, entity gaps, and conflicting logs
          </p>
        </div>

        <button
          onClick={loadHealth}
          className="btn btn-secondary btn-sm text-xs self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh Health</span>
        </button>
      </div>

      {/* Health Overview Metrics & Progress Bar */}
      <div className="px-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Coverage Percentage */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Coverage Percentage</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-mono text-white">
                {health.evidence_coverage_percentage}%
              </span>
              <span className="text-[11px] text-slate-400">of charges fully evidenced</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 ${
                health.evidence_coverage_percentage >= 80 ? 'bg-emerald-500' :
                health.evidence_coverage_percentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, health.evidence_coverage_percentage))}%` }}
            />
          </div>
        </div>

        {/* Sufficient Evidence */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold uppercase text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Sufficient Evidence</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {health.charges_with_sufficient_evidence} / {health.total_charges}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Complete verifiable proof</div>
        </div>

        {/* Evidence Gaps Detected */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] font-semibold uppercase text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Charges with Gaps</span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {health.charges_with_evidence_gaps}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Missing or incomplete logs</div>
        </div>

        {/* Requiring Attention */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-red-500/30 bg-red-950/10">
          <div className="text-[11px] font-semibold uppercase text-red-400 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Attention Required</span>
          </div>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">
            {health.investigations_requiring_attention}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Conflicting / zero evidence</div>
        </div>
      </div>

      {/* Actionable Gaps List */}
      <div className="px-5 pb-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>Detected Evidence Gaps & Attention Items</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
              {filteredGaps.length}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                filterType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({gaps.length})
            </button>
            <button
              onClick={() => setFilterType('HIGH')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                filterType === 'HIGH' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              High Severity
            </button>
            <button
              onClick={() => setFilterType('CONFLICT')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                filterType === 'CONFLICT' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Conflicts
            </button>
            <button
              onClick={() => setFilterType('NO_EV')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                filterType === 'NO_EV' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              No Evidence
            </button>
            <button
              onClick={() => setFilterType('MISSING')}
              className={`px-2 py-0.5 text-[11px] rounded font-medium transition-colors ${
                filterType === 'MISSING' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Missing Types
            </button>
          </div>
        </div>

        {filteredGaps.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
            No evidence gaps found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="saas-table">
              <thead>
                <tr>
                  <th>Charge ID</th>
                  <th>Levied Reason</th>
                  <th>Amount</th>
                  <th>Gap Classification</th>
                  <th>Severity</th>
                  <th>Audit Finding & Description</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGaps.map((item, idx) => {
                  const isHigh = item.severity === 'HIGH';
                  const isMed = item.severity === 'MEDIUM';

                  return (
                    <tr key={`${item.charge_id}-${idx}`}>
                      <td className="font-mono text-xs font-bold text-blue-400">
                        <Link to={`/charges?search=${encodeURIComponent(item.charge_id)}`} className="hover:underline">
                          {item.charge_id}
                        </Link>
                      </td>
                      <td className="text-xs text-slate-200 font-medium max-w-[180px] truncate" title={item.reason}>
                        {item.reason}
                      </td>
                      <td className="font-mono text-xs font-bold text-white">
                        ${item.amount.toFixed(2)}
                      </td>
                      <td>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-300">
                          {item.gap_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                          isHigh ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          isMed ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="text-xs text-slate-300 max-w-[280px]">
                        <p className="truncate" title={item.description}>{item.description}</p>
                        {item.responsible_stage && (
                          <div className="text-[10px] text-cyan-400 mt-0.5 font-mono">
                            Upstream Route: <strong className="uppercase">{item.responsible_stage}</strong>
                          </div>
                        )}
                        {item.expected_types && item.expected_types.length > 0 && (
                          <div className="text-[10px] text-amber-400 mt-0.5">
                            Expected: {item.expected_types.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/charges?search=${encodeURIComponent(item.charge_id)}`}
                          className="btn btn-secondary btn-sm text-[11px] inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
