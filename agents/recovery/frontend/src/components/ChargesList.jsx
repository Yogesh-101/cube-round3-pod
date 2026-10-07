import React from 'react';
import { Search, Filter, ExternalLink, Play } from 'lucide-react';
import VerdictBadge from './VerdictBadge';

export default function ChargesList({
  charges,
  filterVerdict,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onSelectCharge,
  onAssessCharge,
  assessingId
}) {
  const verdicts = [
    { key: 'ALL', label: 'All Charges' },
    { key: 'CONTRADICTED', label: '🔴 Contradicted (Claims)' },
    { key: 'SUPPORTED', label: '🟢 Supported (Valid)' },
    { key: 'SILENT', label: '⚪ Silent' },
    { key: 'PENDING', label: '🟡 Pending' },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="panel overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Verdict Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {verdicts.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterVerdict === tab.key
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by ID, SKU, reason..."
            className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Charges Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Charge ID</th>
              <th>Reason</th>
              <th>Shipment / Order</th>
              <th>SKU</th>
              <th>Amount</th>
              <th>Verdict</th>
              <th>Date</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                  No charges found matching current filter.
                </td>
              </tr>
            ) : (
              charges.map((chg) => {
                const verdict = chg.assessment ? chg.assessment.verdict : 'PENDING';
                const claimAmount = chg.assessment ? chg.assessment.claim_amount : null;
                const isCurrentlyAssessing = assessingId === chg.charge_id;

                return (
                  <tr
                    key={chg.charge_id}
                    onClick={() => onSelectCharge(chg.charge_id)}
                    className="hover:bg-slate-800/40 cursor-pointer"
                  >
                    <td className="font-mono font-semibold text-blue-400">
                      {chg.charge_id}
                    </td>
                    <td>
                      <div className="font-medium text-slate-200">{chg.reason}</div>
                    </td>
                    <td>
                      <div className="text-xs font-mono text-slate-300">
                        {chg.shipment_id || <span className="text-slate-500 italic">None</span>}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {chg.order_id || 'None'}
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-400">
                      {chg.sku || <span className="italic text-slate-600">Unspecified</span>}
                    </td>
                    <td className="font-mono font-bold text-slate-100">
                      ${chg.amount.toFixed(2)}
                    </td>
                    <td>
                      <VerdictBadge verdict={verdict} claimAmount={claimAmount} currency={chg.currency} />
                    </td>
                    <td className="text-xs text-slate-400">
                      {formatDate(chg.charge_date)}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onAssessCharge(chg.charge_id)}
                          disabled={isCurrentlyAssessing}
                          className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                          title="Run deterministic assessment"
                        >
                          <Play className={`h-3 w-3 ${isCurrentlyAssessing ? 'animate-spin text-blue-400' : ''}`} />
                          <span>Assess</span>
                        </button>

                        <button
                          onClick={() => onSelectCharge(chg.charge_id)}
                          className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                          title="Inspect detailed evidence"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
