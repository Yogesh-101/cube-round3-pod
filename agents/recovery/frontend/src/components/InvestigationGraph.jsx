import React, { useState, useEffect } from 'react';
import { fetchInvestigationGraph, simulateEvidenceFeedback } from '../services/api';
import VerdictBadge from './VerdictBadge';
import {
  GitCommit,
  Clock,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Layers,
  ShieldCheck,
  FileText,
  DollarSign,
  Package,
  Truck,
  Box,
  Cpu,
  RotateCcw
} from 'lucide-react';

export default function InvestigationGraph({ chargeId, onInvestigateAI }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('both'); // 'both', 'graph', 'timeline'
  const [submittingStage, setSubmittingStage] = useState(null);

  const loadGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchInvestigationGraph(chargeId);
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load investigation graph');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFeedback = async (stage) => {
    setSubmittingStage(stage);
    try {
      await simulateEvidenceFeedback({
        chargeId: chargeId,
        upstreamStage: stage,
        result: 'PASS',
        description: `Simulated closed-loop evidence submission from ${stage.toUpperCase()} workstation`
      });
      await loadGraph();
    } catch (err) {
      alert(`Evidence feedback submission failed: ${err.message}`);
    } finally {
      setSubmittingStage(null);
    }
  };

  useEffect(() => {
    if (chargeId) {
      loadGraph();
    }
  }, [chargeId]);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-xs">Building relational investigation graph & timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span>{error}</span>
        </div>
        <button onClick={loadGraph} className="btn btn-secondary btn-sm text-xs">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Extract key nodes for the visual flow
  const chargeNode = data.nodes.find(n => n.type === 'charge');
  const orderNode = data.nodes.find(n => n.type === 'order');
  const shipmentNode = data.nodes.find(n => n.type === 'shipment');
  const skuNode = data.nodes.find(n => n.type === 'sku');
  const evidenceNodes = data.nodes.filter(n => n.type === 'evidence');
  const assessmentNode = data.nodes.find(n => n.type === 'assessment');
  const decisionNode = data.nodes.find(n => n.type === 'decision');

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recovery Investigation</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold font-mono">
              {data.charge_id}
            </span>
            {data.is_ai_evaluated && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold">
                AI Evaluated
              </span>
            )}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {data.charge_reason} — Levied: <strong className="text-white font-mono">${data.charge_amount.toFixed(2)}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-semibold text-slate-400">Verdict & Defensible Claim</div>
            <div className="flex items-center gap-2 mt-0.5 justify-end">
              <VerdictBadge verdict={data.verdict} claimAmount={data.claim_amount} />
              <span className="text-sm font-bold font-mono text-white">
                ${data.claim_amount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                viewMode === 'both' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                viewMode === 'graph' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                viewMode === 'timeline' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      {/* 1. VISUAL INVESTIGATION GRAPH / CHAIN */}
      {(viewMode === 'both' || viewMode === 'graph') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Evidence Investigation Graph</span>
            </div>
            <span className="text-[11px] text-slate-400">Verified Relational Source of Truth</span>
          </div>

          {/* Node Flow Diagram */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 min-w-[700px]">
              
              {/* Node 1: Charge */}
              <div className="flex-1 w-full md:w-auto p-3 rounded-lg bg-slate-900 border border-slate-700/80 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <DollarSign className="h-3 w-3 text-amber-400" />
                  <span>Charge</span>
                </div>
                <div className="font-mono text-xs font-bold text-white mt-1 truncate" title={chargeNode?.data?.charge_id}>
                  {chargeNode?.data?.charge_id || data.charge_id}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  ${data.charge_amount.toFixed(2)}
                </div>
              </div>

              <ArrowRight className="hidden md:block h-4 w-4 text-slate-600 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-slate-600 shrink-0" />

              {/* Node 2: Order */}
              <div className={`flex-1 w-full md:w-auto p-3 rounded-lg border text-center ${
                orderNode?.status === 'verified'
                  ? 'bg-slate-900 border-slate-700/80'
                  : 'bg-red-950/20 border-dashed border-red-500/40 text-red-300'
              }`}>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <Box className="h-3 w-3 text-blue-400" />
                  <span>Order</span>
                </div>
                <div className="font-mono text-xs font-bold text-white mt-1 truncate">
                  {orderNode?.data?.order_id || 'Missing Order'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                  {orderNode?.status || 'unresolved'}
                </div>
              </div>

              <ArrowRight className="hidden md:block h-4 w-4 text-slate-600 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-slate-600 shrink-0" />

              {/* Node 3: Shipment */}
              <div className={`flex-1 w-full md:w-auto p-3 rounded-lg border text-center ${
                shipmentNode?.status === 'verified'
                  ? 'bg-slate-900 border-slate-700/80'
                  : 'bg-red-950/20 border-dashed border-red-500/40 text-red-300'
              }`}>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <Truck className="h-3 w-3 text-cyan-400" />
                  <span>Shipment</span>
                </div>
                <div className="font-mono text-xs font-bold text-white mt-1 truncate">
                  {shipmentNode?.data?.shipment_id || 'Missing Shipment'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                  {shipmentNode?.status || 'unresolved'}
                </div>
              </div>

              <ArrowRight className="hidden md:block h-4 w-4 text-slate-600 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-slate-600 shrink-0" />

              {/* Node 4: SKU */}
              <div className={`flex-1 w-full md:w-auto p-3 rounded-lg border text-center ${
                skuNode?.status === 'verified'
                  ? 'bg-slate-900 border-slate-700/80'
                  : 'bg-slate-900/40 border-dashed border-slate-700 text-slate-400'
              }`}>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <Package className="h-3 w-3 text-emerald-400" />
                  <span>SKU</span>
                </div>
                <div className="font-mono text-xs font-bold text-white mt-1 truncate">
                  {skuNode?.data?.sku || 'Unspecified'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                  {skuNode?.status || 'unresolved'}
                </div>
              </div>

              <ArrowRight className="hidden md:block h-4 w-4 text-slate-600 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-slate-600 shrink-0" />

              {/* Node 5: Operational Evidence */}
              <div className="flex-1 w-full md:w-auto p-3 rounded-lg bg-slate-900 border border-slate-700/80 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <FileText className="h-3 w-3 text-violet-400" />
                  <span>Evidence Logs</span>
                </div>
                <div className="text-xs font-bold text-white mt-1 font-mono">
                  {evidenceNodes.filter(n => n.status !== 'missing').length} Records
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {data.missing_evidence_types.length > 0 ? (
                    <span className="text-amber-400">{data.missing_evidence_types.length} Missing</span>
                  ) : (
                    <span className="text-emerald-400">Complete</span>
                  )}
                </div>
              </div>

              <ArrowRight className="hidden md:block h-4 w-4 text-slate-600 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-slate-600 shrink-0" />

              {/* Node 6: Assessment */}
              <div className="flex-1 w-full md:w-auto p-3 rounded-lg bg-slate-900 border border-slate-700/80 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <Cpu className="h-3 w-3 text-purple-400" />
                  <span>{data.is_ai_evaluated ? 'AI Audit' : 'Deterministic'}</span>
                </div>
                <div className="mt-1 flex justify-center">
                  <VerdictBadge verdict={data.verdict} claimAmount={data.claim_amount} />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {data.evidence_strength}
                </div>
              </div>

              <ArrowRight className="hidden md:block h-4 w-4 text-slate-600 shrink-0" />
              <ArrowDown className="md:hidden h-4 w-4 text-slate-600 shrink-0" />

              {/* Node 7: Recovery Decision */}
              <div className={`flex-1 w-full md:w-auto p-3 rounded-lg border text-center ${
                data.verdict === 'CONTRADICTED'
                  ? 'bg-red-950/20 border-red-500/40'
                  : data.verdict === 'SUPPORTED'
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-slate-900 border-slate-700/80'
              }`}>
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  <span>Decision</span>
                </div>
                <div className="font-mono text-xs font-bold text-white mt-1">
                  ${data.claim_amount.toFixed(2)}
                </div>
                <div className="text-[10px] font-semibold mt-0.5 truncate text-slate-300">
                  {data.verdict === 'CONTRADICTED' ? 'Recovery Claim' : data.verdict === 'SUPPORTED' ? 'Valid Fee' : 'Silent'}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 2. EVIDENCE BREAKDOWN (SUPPORTING vs CONTRADICTING vs MISSING) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contradicting Evidence (Supports Recovery Claim) */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase">
              <CheckCircle2 className="h-4 w-4" />
              <span>Contradicting Charge ({data.contradicting_evidence.length})</span>
            </div>
            <span className="text-[10px] text-slate-400">Favorable Proof</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Operational records showing compliant/intact handoff, proving the fee was incorrectly levied.
          </p>
          {data.contradicting_evidence.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-[11px] rounded bg-slate-900/60 border border-slate-800/80">
              No contradicting operational evidence found.
            </div>
          ) : (
            <div className="space-y-2">
              {data.contradicting_evidence.map((ev) => (
                <div key={ev.evidence_id} className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-emerald-300">{ev.evidence_id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold font-mono text-[10px]">
                      {ev.result}
                    </span>
                  </div>
                  <div className="text-slate-300">{ev.description}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                    <span>{ev.source}</span>
                    <span>{ev.timestamp_str}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supporting Evidence (Supports Levied Fee) */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 uppercase">
              <XCircle className="h-4 w-4" />
              <span>Supporting Charge ({data.supporting_evidence.length})</span>
            </div>
            <span className="text-[10px] text-slate-400">Defect Logs</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Operational records documenting actual defects, damage, or shortages justifying the penalty fee.
          </p>
          {data.supporting_evidence.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-[11px] rounded bg-slate-900/60 border border-slate-800/80">
              No defect logs supporting this penalty.
            </div>
          ) : (
            <div className="space-y-2">
              {data.supporting_evidence.map((ev) => (
                <div key={ev.evidence_id} className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/30 text-[11px] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-red-300">{ev.evidence_id}</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-semibold font-mono text-[10px]">
                      {ev.result}
                    </span>
                  </div>
                  <div className="text-slate-300">{ev.description}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                    <span>{ev.source}</span>
                    <span>{ev.timestamp_str}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missing Expected Evidence Types */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase">
              <AlertTriangle className="h-4 w-4" />
              <span>Missing Types ({data.missing_evidence_types.length})</span>
            </div>
            <span className="text-[10px] text-slate-400">Audit Gaps</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            Expected evidence types for reason <em>"{data.charge_reason}"</em> that were not found in database.
          </p>
          {data.missing_evidence_types.length === 0 ? (
            <div className="p-3 text-center text-emerald-400 text-[11px] rounded bg-emerald-950/20 border border-emerald-500/30">
              All expected evidence types accounted for.
            </div>
          ) : (
            <div className="space-y-2">
              {data.missing_evidence_types.map((mType, idx) => {
                const isSubmitting = submittingStage === mType;
                return (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 uppercase">{mType} Inspection</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                        MISSING
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Expected operational proof is absent from warehouse telemetry.
                    </p>
                    <div className="pt-1 flex items-center justify-between border-t border-amber-500/20">
                      <span className="text-[10px] text-amber-400 font-mono">Closed-Loop Stage: {mType}</span>
                      <button
                        onClick={() => handleSimulateFeedback(mType)}
                        disabled={isSubmitting}
                        className="btn btn-secondary btn-sm !py-0.5 !px-2 text-[10px] flex items-center gap-1 border-amber-500/30 text-amber-300 hover:text-white"
                        title="Simulate routing gap back to upstream stage and re-investigating"
                      >
                        <RotateCcw className={`h-3 w-3 ${isSubmitting ? 'animate-spin' : ''}`} />
                        <span>{isSubmitting ? 'Submitting...' : `Submit ${mType} Proof`}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. CHRONOLOGICAL INVESTIGATION TIMELINE */}
      {(viewMode === 'both' || viewMode === 'timeline') && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Chronological Investigation Timeline</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {data.timeline.length} Sequenced Events
            </span>
          </div>

          {data.timeline.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No timestamped events available for this charge investigation.
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {data.timeline.map((event, idx) => {
                const isDispatched = event.event_type === 'shipment_dispatched';
                const isCharge = event.event_type === 'charge_logged';
                const isAssessment = event.event_type === 'assessment_completed';
                const isEvidence = event.event_type.startsWith('evidence_');

                let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                if (event.status_badge === 'CONTRADICTED' || event.status_badge === 'PASS' || event.status_badge === 'VERIFIED') {
                  badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                } else if (event.status_badge === 'SUPPORTED' || event.status_badge === 'FAIL' || event.status_badge === 'DAMAGED') {
                  badgeColor = 'bg-red-500/20 text-red-400 border-red-500/30';
                } else if (event.status_badge === 'PENALTY') {
                  badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                }

                return (
                  <div key={event.id || idx} className="relative group">
                    {/* Circle Node on Timeline */}
                    <div className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-slate-900 border-2 border-blue-500 group-hover:scale-125 transition-transform" />

                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors text-xs space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-white font-semibold">{event.title}</strong>
                          {event.status_badge && (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${badgeColor}`}>
                              {event.status_badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {event.timestamp_str}
                        </div>
                      </div>

                      <p className="text-slate-300 text-xs leading-relaxed">
                        {event.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                        <span>Source: <strong className="text-slate-300">{event.source || 'Warehouse System'}</strong></span>
                        {event.evidence_id && (
                          <span>Evidence ID: <strong className="text-blue-400">{event.evidence_id}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
