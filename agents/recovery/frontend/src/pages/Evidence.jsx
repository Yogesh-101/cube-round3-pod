import React, { useState, useEffect } from 'react';
import { fetchAllEvidence } from '../services/api';
import { Search, MapPin, Clock, Tag, RefreshCw, AlertCircle, FileText } from 'lucide-react';

export default function Evidence() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadEvidence = async () => {
    try {
      setError(null);
      const data = await fetchAllEvidence({
        evidence_type: typeFilter,
        search: searchQuery
      });
      setEvidenceList(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load evidence records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [typeFilter, searchQuery]);

  const types = [
    { key: 'ALL', label: 'All Records' },
    { key: 'prep', label: 'Prep' },
    { key: 'packing', label: 'Packing' },
    { key: 'receiving', label: 'Receiving' },
    { key: 'returns', label: 'Returns' },
  ];

  return (
    <div className="page-container space-y-5">
      {/* Title & Description */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">Evidence Explorer</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Fulfillment logs verified across prep, packing, receiving, and returns
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {types.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                typeFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, source, SKU..."
            className="form-input text-xs pl-8 py-1.5"
          />
        </div>
      </div>

      {/* Evidence Cards Grid */}
      {loading ? (
        <div className="saas-card p-16 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mb-2" />
          <p className="text-xs">Loading operational evidence...</p>
        </div>
      ) : error ? (
        <div className="saas-card p-8 text-center text-red-400 text-xs">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
          <p>{error}</p>
        </div>
      ) : evidenceList.length === 0 ? (
        <div className="saas-card p-16 text-center text-slate-400 text-xs">
          No evidence records found matching current criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {evidenceList.map((ev) => {
            const resUpper = ev.result.toUpperCase();
            const isPass = ['PASS', 'VERIFIED', 'INTACT', 'COMPLIANT'].includes(resUpper);
            const isFail = ['FAIL', 'FAILED', 'DAMAGED', 'DISCREPANCY'].includes(resUpper);

            return (
              <div key={ev.evidence_id} className="saas-card p-4 hover:border-slate-700 transition-colors space-y-3">
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-blue-400">
                      {ev.evidence_id}
                    </span>
                    {ev.source_dataset === 'cube_official' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-semibold">
                        Cube Official
                      </span>
                    )}
                    <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {ev.evidence_type}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      isPass
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : isFail
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {ev.result}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {ev.source}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(ev.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-200 leading-relaxed">
                  {ev.description}
                </p>

                {/* Traceability links */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                  {ev.unit_id && <span>Unit: <strong className="text-cyan-400">{ev.unit_id}</strong></span>}
                  <span>Shipment: <strong className="text-slate-300">{ev.shipment_id || '—'}</strong></span>
                  <span>Order: <strong className="text-slate-300">{ev.order_id || '—'}</strong></span>
                  <span>SKU: <strong className="text-slate-300">{ev.sku || '—'}</strong></span>
                </div>

                {/* Metadata JSON / File lineage if present */}
                {ev.reference_data && Object.keys(ev.reference_data).length > 0 && (
                  <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-slate-400 flex items-center justify-between">
                    <div className="truncate">
                      <span className="text-slate-500 mr-2 font-bold">SOURCE:</span>
                      <span className="text-slate-300">{ev.reference_data.source_file || 'operational_log'}</span>
                      {ev.reference_data.source_row && (
                        <span className="text-slate-500 ml-1">(row {ev.reference_data.source_row})</span>
                      )}
                    </div>
                    {ev.reference_data.operator_verdict && (
                      <span className="text-slate-400 font-semibold shrink-0">Verdict: {ev.reference_data.operator_verdict}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
