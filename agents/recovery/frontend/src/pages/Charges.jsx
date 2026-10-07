import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchCharges,
  fetchChargeDetail,
  fetchChargeEvidence,
  assessCharge,
  investigateChargeWithAI,
  fetchAICheck
} from '../services/api';
import VerdictBadge from '../components/VerdictBadge';
import {
  Search,
  Play,
  ExternalLink,
  X,
  ArrowRight,
  Layers,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck
} from 'lucide-react';
import InvestigationGraph from '../components/InvestigationGraph';

export default function Charges() {
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerdict, setFilterVerdict] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Detail Modal state
  const [selectedCharge, setSelectedCharge] = useState(null);
  const [chargeEvidence, setChargeEvidence] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assessingId, setAssessingId] = useState(null);

  // Phase 2 AI Investigation state
  const [aiAssessment, setAiAssessment] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Phase 3 Modal Tab state ('investigation', 'ai', 'evidence')
  const [modalTab, setModalTab] = useState('investigation');

  const loadCharges = async () => {
    try {
      setError(null);
      const data = await fetchCharges({
        verdict: filterVerdict,
        search: searchQuery
      });
      setCharges(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load charges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
  }, [filterVerdict, searchQuery]);

  // Open charge details modal
  const handleOpenDetail = async (chargeId) => {
    setDetailLoading(true);
    setAiAssessment(null);
    setAiError(null);
    setModalTab('investigation');
    try {
      const [detail, ev] = await Promise.all([
        fetchChargeDetail(chargeId),
        fetchChargeEvidence(chargeId)
      ]);
      setSelectedCharge(detail);
      setChargeEvidence(ev);

      // Check if an AI assessment exists for this charge
      fetchAICheck(chargeId)
        .then(setAiAssessment)
        .catch(() => setAiAssessment(null));
    } catch (err) {
      alert(`Failed to load charge details: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedCharge(null);
    setChargeEvidence(null);
    setAiAssessment(null);
    setAiError(null);
  };

  // Run AI Investigation
  const handleAIInvestigate = async (chargeId) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await investigateChargeWithAI(chargeId);
      setAiAssessment(res);

      // Refresh charge details and charges list so metrics reflect update
      const [updatedDetail, updatedEv] = await Promise.all([
        fetchChargeDetail(chargeId),
        fetchChargeEvidence(chargeId)
      ]);
      setSelectedCharge(updatedDetail);
      setChargeEvidence(updatedEv);
      loadCharges();
    } catch (err) {
      setAiError(err.message || 'AI Investigation failed');
    } finally {
      setAiLoading(false);
    }
  };

  // Re-assess charge deterministically
  const handleAssess = async (chargeId) => {
    setAssessingId(chargeId);
    try {
      await assessCharge(chargeId);
      await loadCharges();
      if (selectedCharge?.charge_id === chargeId) {
        const [updatedDetail, updatedEv] = await Promise.all([
          fetchChargeDetail(chargeId),
          fetchChargeEvidence(chargeId)
        ]);
        setSelectedCharge(updatedDetail);
        setChargeEvidence(updatedEv);
      }
    } catch (err) {
      alert(`Assessment failed: ${err.message}`);
    } finally {
      setAssessingId(null);
    }
  };

  // Pagination calculation
  const totalPages = Math.ceil(charges.length / pageSize) || 1;
  const paginatedCharges = useMemo(() => {
    const start = (page - 1) * pageSize;
    return charges.slice(start, start + pageSize);
  }, [charges, page, pageSize]);

  const verdicts = [
    { key: 'ALL', label: 'All' },
    { key: 'CONTRADICTED', label: 'Contradicted (Red)' },
    { key: 'SUPPORTED', label: 'Supported (Green)' },
    { key: 'SILENT', label: 'Silent (Gray)' },
    { key: 'PENDING', label: 'Pending (Amber)' },
  ];

  return (
    <div className="page-container space-y-5">
      {/* Title & Description */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">Dispute Charges</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Audited fulfillment fee discrepancies and deterministic evidence resolutions
        </p>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Verdict Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1">
          {verdicts.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFilterVerdict(tab.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                filterVerdict === tab.key
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
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search ID, reason, SKU..."
            className="form-input text-xs pl-8 py-1.5"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="saas-card">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mb-2" />
            <p className="text-xs">Loading charges...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-xs">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p>{error}</p>
          </div>
        ) : charges.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            No charges found matching current search/filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="saas-table">
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
                {paginatedCharges.map((chg) => {
                  const verdict = chg.assessment?.verdict || 'PENDING';
                  const claimAmount = chg.assessment?.claim_amount ?? null;
                  const isAssessing = assessingId === chg.charge_id;

                  return (
                    <tr
                      key={chg.charge_id}
                      onClick={() => handleOpenDetail(chg.charge_id)}
                      className="hover:bg-slate-800/40 cursor-pointer"
                    >
                      <td className="font-mono font-semibold text-blue-400 text-xs">
                        {chg.charge_id}
                      </td>
                      <td className="text-slate-200 text-xs font-medium max-w-xs truncate" title={chg.reason}>
                        {chg.reason}
                      </td>
                      <td className="text-xs">
                        <div className="font-mono text-slate-300">{chg.shipment_id || '—'}</div>
                        <div className="font-mono text-[11px] text-slate-400">{chg.order_id || '—'}</div>
                      </td>
                      <td className="font-mono text-xs text-slate-400">
                        {chg.sku || '—'}
                      </td>
                      <td className="font-mono text-xs font-bold text-white">
                        ${chg.amount.toFixed(2)}
                      </td>
                      <td>
                        <VerdictBadge verdict={verdict} claimAmount={claimAmount} currency={chg.currency} />
                      </td>
                      <td className="text-xs text-slate-400">
                        {new Date(chg.charge_date).toLocaleDateString()}
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAssess(chg.charge_id)}
                            disabled={isAssessing}
                            className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                            title="Run deterministic decision engine"
                          >
                            <Play className={`h-3 w-3 ${isAssessing ? 'animate-spin' : ''}`} />
                            <span>Assess</span>
                          </button>
                          <button
                            onClick={() => handleOpenDetail(chg.charge_id)}
                            className="btn btn-secondary btn-sm !py-1 !px-2 text-xs"
                            title="View full evidence trace & AI investigation"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {charges.length > 0 && (
          <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {Math.min((page - 1) * pageSize + 1, charges.length)} to {Math.min(page * pageSize, charges.length)} of {charges.length} charges
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-sm !py-1 !px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary btn-sm !py-1 !px-2"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Charge Detail Modal */}
      {selectedCharge && (
        <div className="modal-overlay" onClick={handleCloseDetail}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold font-mono text-white">{selectedCharge.charge_id}</h2>
                  <VerdictBadge
                    verdict={selectedCharge.assessment?.verdict}
                    claimAmount={selectedCharge.assessment?.claim_amount}
                  />
                </div>
                <p className="text-xs text-slate-300 font-medium">{selectedCharge.reason}</p>
              </div>
              <button
                onClick={handleCloseDetail}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Phase 3 Modal Tabs Navigation */}
            <div className="flex border-b border-slate-800 bg-slate-950 px-5 pt-2.5 gap-2 overflow-x-auto">
              <button
                onClick={() => setModalTab('investigation')}
                className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'investigation'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>Investigation Graph & Timeline</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  Phase 3
                </span>
              </button>

              <button
                onClick={() => setModalTab('ai')}
                className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'ai'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>AI Recovery Agent</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                  Phase 2
                </span>
              </button>

              <button
                onClick={() => setModalTab('evidence')}
                className={`pb-2.5 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                  modalTab === 'evidence'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Evidence & Traceability</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                  {(chargeEvidence?.relevant_evidence || selectedCharge.relevant_evidence || []).length}
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5">
              {/* Charge Information Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <div className="text-[11px] uppercase font-semibold text-slate-400">Charge Amount</div>
                  <div className="text-sm font-bold font-mono text-white mt-0.5">
                    ${selectedCharge.amount.toFixed(2)} {selectedCharge.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase font-semibold text-slate-400">Claim Amount</div>
                  <div className="text-sm font-bold font-mono text-red-400 mt-0.5">
                    ${(selectedCharge.assessment?.claim_amount || 0).toFixed(2)} {selectedCharge.currency}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase font-semibold text-slate-400">Status</div>
                  <div className="text-xs font-semibold text-slate-300 mt-1 uppercase">
                    {selectedCharge.status}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase font-semibold text-slate-400">Charge Date</div>
                  <div className="text-xs font-mono text-slate-300 mt-1">
                    {new Date(selectedCharge.charge_date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* TAB 1: PHASE 3 INVESTIGATION GRAPH & TIMELINE */}
              {modalTab === 'investigation' && (
                <InvestigationGraph
                  chargeId={selectedCharge.charge_id}
                  onInvestigateAI={() => {
                    setModalTab('ai');
                    handleAIInvestigate(selectedCharge.charge_id);
                  }}
                />
              )}

              {/* TAB 2: PHASE 2 AI AGENT INVESTIGATION */}
              {modalTab === 'ai' && (
                <div className="p-4 rounded-xl bg-slate-900/90 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">AI Investigation</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                      Phase 2 Agent
                    </span>
                  </div>

                  <button
                    onClick={() => handleAIInvestigate(selectedCharge.charge_id)}
                    disabled={aiLoading}
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                    id="btn-ai-investigate"
                  >
                    <Bot className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                    <span>{aiLoading ? 'Investigating with AI...' : 'Investigate with AI'}</span>
                  </button>
                </div>

                {/* AI Loading State */}
                {aiLoading && (
                  <div className="p-5 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                    <p className="text-xs text-slate-300 font-medium">
                      Agent analyzing charge domain, ranking semantic evidence, and reasoning...
                    </p>
                  </div>
                )}

                {/* AI Error State */}
                {aiError && (
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{aiError}</span>
                  </div>
                )}

                {/* AI Assessment Result */}
                {aiAssessment && !aiLoading && (
                  <div className="space-y-3.5 pt-1 text-xs">
                    {/* Fallback Notice if AI was unavailable */}
                    {aiAssessment.is_fallback && (
                      <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                        <span>AI unavailable — deterministic assessment used.</span>
                      </div>
                    )}

                    {/* AI Assessment Metrics Header */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">AI Verdict</div>
                        <div className="mt-1">
                          <VerdictBadge verdict={aiAssessment.verdict} claimAmount={aiAssessment.claim_amount} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Claim Amount</div>
                        <div className="text-sm font-mono font-bold text-white mt-1">
                          ${aiAssessment.claim_amount.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Evidence Strength</div>
                        <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                          aiAssessment.evidence_strength === 'STRONG' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          aiAssessment.evidence_strength === 'MODERATE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                          aiAssessment.evidence_strength === 'WEAK' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {aiAssessment.evidence_strength}
                        </span>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Domain Category</div>
                        <div className="text-xs font-semibold text-slate-300 mt-1 capitalize">
                          {aiAssessment.charge_category}
                        </div>
                      </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] uppercase font-semibold text-slate-400">
                        Reasoning & Findings
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {aiAssessment.reason}
                      </p>
                    </div>

                    {/* Missing Information if applicable */}
                    {aiAssessment.missing_information && aiAssessment.missing_information.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 space-y-1">
                        <div className="font-semibold text-[11px] uppercase flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Missing Information ({aiAssessment.missing_information.length})</span>
                        </div>
                        <ul className="text-[11px] space-y-1 pl-4 list-disc text-amber-200">
                          {aiAssessment.missing_information.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evidence Used List */}
                    <div className="space-y-2">
                      <div className="text-[11px] uppercase font-semibold text-slate-400">
                        Evidence Used ({aiAssessment.evidence_details?.length || aiAssessment.evidence_ids?.length || 0})
                      </div>
                      {(!aiAssessment.evidence_details || aiAssessment.evidence_details.length === 0) ? (
                        <div className="p-3 text-center text-slate-500 text-[11px] bg-slate-950 rounded border border-slate-800">
                          No evidence records were attributed to this decision.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {aiAssessment.evidence_details.map((ev) => {
                            const resUpper = (ev.result || '').toUpperCase();
                            const isPass = ['PASS', 'VERIFIED', 'INTACT', 'COMPLIANT'].includes(resUpper);
                            const isFail = ['FAIL', 'FAILED', 'DAMAGED', 'DISCREPANCY'].includes(resUpper);

                            return (
                              <div key={ev.evidence_id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-blue-400">{ev.evidence_id}</span>
                                    <span className="uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{ev.evidence_type}</span>
                                    <span className={`font-bold px-1.5 py-0.5 rounded ${
                                      isPass ? 'bg-emerald-500/10 text-emerald-400' :
                                      isFail ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-300'
                                    }`}>
                                      {ev.result}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-slate-400 text-[10px]">
                                    <span>{ev.source}</span>
                                    <span>•</span>
                                    <span>{new Date(ev.timestamp).toLocaleString()}</span>
                                  </div>
                                </div>
                                <p className="text-slate-300 text-xs">{ev.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!aiAssessment && !aiLoading && !aiError && (
                  <div className="p-4 text-center text-slate-400 text-xs bg-slate-950 rounded-lg border border-slate-800">
                    No AI investigation run yet for this charge. Click "Investigate with AI" above to run live reasoning.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRACEABILITY & DETERMINISTIC EVIDENCE LOGS */}
            {modalTab === 'evidence' && (
              <div className="space-y-4">
                {/* Traceability Flow */}
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-blue-400" />
                  <span>Traceability Chain</span>
                </div>
                <div className="traceability-chain">
                  <div className="trace-node">
                    <span className="text-slate-400">Charge:</span>
                    <strong className="text-blue-400">{selectedCharge.charge_id}</strong>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 trace-arrow" />
                  <div className="trace-node">
                    <span className="text-slate-400">Shipment:</span>
                    <strong>{selectedCharge.resolution?.shipment_id || selectedCharge.shipment_id || 'unresolved'}</strong>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 trace-arrow" />
                  <div className="trace-node">
                    <span className="text-slate-400">Order:</span>
                    <strong>{selectedCharge.resolution?.order_id || selectedCharge.order_id || 'unresolved'}</strong>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 trace-arrow" />
                  <div className="trace-node">
                    <span className="text-slate-400">SKU:</span>
                    <strong>{selectedCharge.resolution?.sku || selectedCharge.sku || 'unresolved'}</strong>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 trace-arrow" />
                  <div className="trace-node">
                    <span className="text-slate-400">Evidence:</span>
                    <strong className="text-emerald-400">{(chargeEvidence?.relevant_evidence || selectedCharge.relevant_evidence || []).length} items</strong>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 trace-arrow" />
                  <div className="trace-node">
                    <span className="text-slate-400">Assessment:</span>
                    <strong className={
                      selectedCharge.assessment?.verdict === 'CONTRADICTED' ? 'text-red-400' :
                      selectedCharge.assessment?.verdict === 'SUPPORTED' ? 'text-emerald-400' : 'text-slate-300'
                    }>
                      {selectedCharge.assessment?.verdict || 'PENDING'}
                    </strong>
                  </div>
                </div>
                {selectedCharge.resolution?.notes?.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                    {selectedCharge.resolution.notes.map((n, i) => (
                      <div key={i}>• {n}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Deterministic Decision Engine Evaluation */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Deterministic Engine Baseline
                  </div>
                  <button
                    onClick={() => handleAssess(selectedCharge.charge_id)}
                    disabled={assessingId === selectedCharge.charge_id}
                    className="btn btn-secondary btn-sm !py-1 text-xs"
                  >
                    <Play className={`h-3 w-3 ${assessingId === selectedCharge.charge_id ? 'animate-spin' : ''}`} />
                    <span>Re-evaluate</span>
                  </button>
                </div>
                {selectedCharge.assessment ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <VerdictBadge
                        verdict={selectedCharge.assessment.verdict}
                        claimAmount={selectedCharge.assessment.claim_amount}
                      />
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(selectedCharge.assessment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {selectedCharge.assessment.reason}
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    Unassessed. Click "Re-evaluate" to run deterministic assessment.
                  </div>
                )}
              </div>

              {/* Evidence Cards */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Verified Fulfillment Evidence ({(chargeEvidence?.relevant_evidence || selectedCharge.relevant_evidence || []).length})
                </div>

                {(chargeEvidence?.relevant_evidence || selectedCharge.relevant_evidence || []).length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-950 rounded-lg border border-slate-800">
                    No relevant evidence found for this dispute scope. Never fabricated.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(chargeEvidence?.relevant_evidence || selectedCharge.relevant_evidence || []).map((ev) => {
                      const resUpper = ev.result.toUpperCase();
                      const isPass = ['PASS', 'VERIFIED', 'INTACT', 'COMPLIANT'].includes(resUpper);
                      const isFail = ['FAIL', 'FAILED', 'DAMAGED', 'DISCREPANCY'].includes(resUpper);

                      return (
                        <div key={ev.evidence_id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-blue-400">
                                {ev.evidence_id}
                              </span>
                              <span className="text-[11px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {ev.evidence_type}
                              </span>
                              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                isPass
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : isFail
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
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

                          <p className="text-xs text-slate-300">{ev.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end">
              <button onClick={handleCloseDetail} className="btn btn-secondary btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
