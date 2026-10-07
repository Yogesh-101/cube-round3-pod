import React, { useState } from 'react';
import { X, Play, ShieldAlert, CheckCircle, HelpCircle, Layers, ArrowRight, Clock, MapPin, Tag } from 'lucide-react';
import VerdictBadge from './VerdictBadge';

export default function ChargeModal({ charge, evidenceData, onClose, onReAssess, isAssessing }) {
  if (!charge) return null;

  const assessment = charge.assessment;
  const verdict = assessment ? assessment.verdict : 'PENDING';
  const claimAmount = assessment ? assessment.claim_amount : 0.0;
  const resolution = charge.resolution;

  const relevantEvidence = evidenceData?.relevant_evidence || charge.relevant_evidence || [];
  const allLinkedEvidence = evidenceData?.all_linked_evidence || [];

  const [activeTab, setActiveTab] = useState('relevant'); // 'relevant' or 'all'

  const displayedEvidence = activeTab === 'relevant' ? relevantEvidence : allLinkedEvidence;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold font-mono text-white">{charge.charge_id}</h2>
              <VerdictBadge verdict={verdict} claimAmount={claimAmount} currency={charge.currency} />
            </div>
            <p className="text-sm text-slate-300 font-medium">{charge.reason}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div>
              <div className="text-xs uppercase text-slate-400 font-semibold">Charge Amount</div>
              <div className="text-lg font-mono font-bold text-white mt-0.5">
                ${charge.amount.toFixed(2)} <span className="text-xs text-slate-400">{charge.currency}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400 font-semibold">Defensible Claim</div>
              <div className="text-lg font-mono font-bold text-red-400 mt-0.5">
                ${claimAmount.toFixed(2)} <span className="text-xs text-slate-400">{charge.currency}</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400 font-semibold">Status</div>
              <div className="text-sm font-semibold text-slate-200 mt-1 uppercase tracking-wide">
                {charge.status}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-slate-400 font-semibold">Charge Date</div>
              <div className="text-xs font-mono text-slate-300 mt-1">
                {new Date(charge.charge_date).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Entity Resolution Hierarchy */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-400" /> Deterministic Entity Resolution
              </span>
              {resolution && (
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  resolution.resolution_status === 'RESOLVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : resolution.resolution_status === 'PARTIALLY_RESOLVED'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {resolution.resolution_status}
                </span>
              )}
            </div>

            {/* Path flow breadcrumbs */}
            {resolution && (
              <div className="font-mono text-xs text-blue-300 p-2.5 rounded bg-slate-950/80 border border-slate-800 flex flex-wrap items-center gap-2">
                <span>Charge ({charge.charge_id})</span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className={resolution.shipment_id ? 'text-indigo-300' : 'text-slate-500 italic'}>
                  Shipment ({resolution.shipment_id || 'unresolved'})
                </span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className={resolution.order_id ? 'text-indigo-300' : 'text-slate-500 italic'}>
                  Order ({resolution.order_id || 'unresolved'})
                </span>
                <ArrowRight className="h-3 w-3 text-slate-500" />
                <span className={resolution.sku ? 'text-indigo-300' : 'text-slate-500 italic'}>
                  SKU ({resolution.sku || 'unresolved'})
                </span>
              </div>
            )}

            {/* Resolution Notes */}
            {resolution?.notes && resolution.notes.length > 0 && (
              <div className="mt-2 text-xs text-slate-400 space-y-1">
                {resolution.notes.map((note, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-slate-400">
                    <span className="h-1 w-1 rounded-full bg-blue-400" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assessment Verdict & Rule Reasoning */}
          <div className={`p-4 rounded-xl border ${
            verdict === 'CONTRADICTED'
              ? 'bg-red-950/20 border-red-500/30'
              : verdict === 'SUPPORTED'
              ? 'bg-emerald-950/20 border-emerald-500/30'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Decision Engine Evaluation
              </span>
              <button
                onClick={() => onReAssess(charge.charge_id)}
                disabled={isAssessing}
                className="btn btn-primary btn-sm !py-1 text-xs"
              >
                <Play className={`h-3 w-3 ${isAssessing ? 'animate-spin' : ''}`} />
                <span>{isAssessing ? 'Evaluating...' : 'Re-Run Assessment'}</span>
              </button>
            </div>

            {assessment ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <VerdictBadge verdict={verdict} claimAmount={claimAmount} currency={charge.currency} />
                  <span className="text-xs text-slate-400 font-mono">
                    Assessed at: {new Date(assessment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-sans mt-2">
                  {assessment.reason}
                </p>
                <div className="text-xs text-slate-400 pt-1 font-mono">
                  Referenced Evidence IDs: {assessment.evidence_ids?.length > 0 ? assessment.evidence_ids.join(', ') : 'None'}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400 italic">
                Charge has not been assessed yet. Click "Re-Run Assessment" to evaluate evidence deterministically.
              </div>
            )}
          </div>

          {/* Evidence Traceability Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                  Traceable Fulfillment Evidence
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {displayedEvidence.length} records
                </span>
              </div>

              {/* Tabs for relevant vs all linked evidence */}
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveTab('relevant')}
                  className={`px-2.5 py-1 rounded font-medium ${
                    activeTab === 'relevant' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Relevant Domain ({relevantEvidence.length})
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded font-medium ${
                    activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Linked ({allLinkedEvidence.length})
                </button>
              </div>
            </div>

            {displayedEvidence.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-sm">
                No evidence found for this dispute. System verified zero fabricated records.
              </div>
            ) : (
              <div className="space-y-3">
                {displayedEvidence.map((ev) => {
                  const resUpper = ev.result.toUpperCase();
                  const isPass = ['PASS', 'VERIFIED', 'INTACT', 'COMPLIANT'].includes(resUpper);
                  const isFail = ['FAIL', 'FAILED', 'DAMAGED', 'DISCREPANCY', 'DEFECTIVE'].includes(resUpper);

                  return (
                    <div
                      key={ev.evidence_id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-blue-400">
                            {ev.evidence_id}
                          </span>
                          <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {ev.evidence_type}
                          </span>
                          <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            isPass
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isFail
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-slate-700 text-slate-200'
                          }`}>
                            {ev.result}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-500" /> {ev.source}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" /> {new Date(ev.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-normal">
                        {ev.description}
                      </p>

                      {/* Reference JSON data */}
                      {ev.reference_data && Object.keys(ev.reference_data).length > 0 && (
                        <div className="mt-2.5 p-2 rounded bg-slate-900 border border-slate-800/80 font-mono text-[11px] text-slate-400 overflow-x-auto">
                          <span className="text-slate-500 mr-2 font-bold">METADATA:</span>
                          {JSON.stringify(ev.reference_data)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Evidence strictly immutable & traceable to fulfillment stations
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
