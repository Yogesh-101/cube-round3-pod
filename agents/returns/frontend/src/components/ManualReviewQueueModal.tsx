import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Camera,
  CheckCircle,
  ShieldAlert,
  ArrowRight,
  Eye,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { ReturnInspectionRecord, OrderRecord, DispositionType } from '../types';

interface ManualReviewQueueModalProps {
  inspections: ReturnInspectionRecord[];
  flaggedOrders: OrderRecord[];
  onClose: () => void;
  onInspectOrder: (order: OrderRecord) => void;
  onViewInspection: (inspection: ReturnInspectionRecord) => void;
  onResolveReview: (inspectionId: string, resolution: DispositionType, notes: string) => void;
}

export const ManualReviewQueueModal: React.FC<ManualReviewQueueModalProps> = ({
  inspections,
  flaggedOrders,
  onClose,
  onInspectOrder,
  onViewInspection,
  onResolveReview,
}) => {
  const [selectedInspection, setSelectedInspection] = useState<ReturnInspectionRecord | null>(
    inspections.find((i) => i.status === 'MANUAL_REVIEW') || inspections[0] || null
  );

  const [resolutionAction, setResolutionAction] = useState<DispositionType>('REFURBISH');
  const [reviewNotes, setReviewNotes] = useState('');
  const [showResolveSuccess, setShowResolveSuccess] = useState(false);

  const pendingItems = inspections.filter((i) => i.status === 'MANUAL_REVIEW');

  const handleApplyResolution = () => {
    if (!selectedInspection) return;
    onResolveReview(selectedInspection.id, resolutionAction, reviewNotes);
    setShowResolveSuccess(true);
    setTimeout(() => {
      setShowResolveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full my-8 overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Tier-2 Manual Review & Integrity Escalation Queue
              </h2>
              <p className="text-[11px] text-slate-400">
                Review items flagged for potential box-swaps, serial discrepancies, or unclear captures.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Left Column: Flagged Queue List */}
          <div className="md:col-span-5 space-y-3 border-r border-slate-800 pr-0 md:pr-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
                Flagged Returns ({pendingItems.length})
              </span>
              <span className="text-[10px] text-amber-400 font-mono">Supervisor Queue</span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {pendingItems.length === 0 ? (
                <div className="p-4 text-center text-slate-500 rounded bg-slate-950/40">
                  No pending returns in review queue.
                </div>
              ) : (
                pendingItems.map((item) => {
                  const isSelected = selectedInspection?.id === item.id;
                  const isSwap = item.aiAnalysis.integrity.status === 'POTENTIAL_PRODUCT_SWAP';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedInspection(item)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-950/30'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-white tabular-nums">
                          {item.returnId}
                        </span>
                        {isSwap ? (
                          <span className="text-[9px] font-bold text-amber-300 bg-amber-950 border border-amber-800 px-1 py-0.2 rounded">
                            BOX SWAP ALERT
                          </span>
                        ) : (
                          <span className="text-[10px] text-sky-400 font-mono">
                            {item.aiAnalysis.identity.status}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-200 font-medium truncate">{item.product.name}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-1">
                        {item.aiAnalysis.integrity.flags[0] || 'Manual audit required'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Test Pre-Staged Flagged Returns directly */}
            <div className="pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1.5">
                Load Flagged Test Scenarios:
              </span>
              <div className="space-y-1.5">
                {flaggedOrders.map((ord) => (
                  <button
                    key={ord.orderId}
                    onClick={() => {
                      onInspectOrder(ord);
                      onClose();
                    }}
                    className="w-full text-left p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <span className="font-mono text-amber-300 text-[11px] font-bold">
                        {ord.orderId}
                      </span>
                      <span className="text-slate-300 text-[11px] ml-2">{ord.product.brand} {ord.product.model}</span>
                    </div>
                    <span className="text-[10px] text-indigo-400 font-medium">Inspect →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Inspection Diagnostic & Resolution */}
          <div className="md:col-span-7 space-y-4">
            {selectedInspection ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      Diagnostic for {selectedInspection.returnId} ({selectedInspection.orderId})
                    </h3>
                    <button
                      onClick={() => onViewInspection(selectedInspection)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" /> Full Inspection Workspace
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Product: {selectedInspection.product.name}
                  </p>
                </div>

                {/* Specific Flag Reasoning Alert */}
                <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Exact Reason for Manual Review:</span>
                  </div>
                  <div className="space-y-1 text-slate-300 pl-5 text-[11px]">
                    {selectedInspection.aiAnalysis.integrity.flags.map((flag, idx) => (
                      <div key={idx}>· {flag}</div>
                    ))}
                    {selectedInspection.aiAnalysis.identity.evidence.map((ev, idx) => (
                      <div key={idx}>· {ev}</div>
                    ))}
                  </div>
                </div>

                {/* Box vs Device Conflict Summary */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-slate-200">
                    Product & Box Identifier Discrepancy:
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="text-slate-400">
                      Expected Box SKU: <span className="font-mono text-white">{selectedInspection.product.sku}</span>
                    </div>
                    <div className="text-slate-400">
                      Physical Model: <span className="text-amber-300 font-semibold">{selectedInspection.aiAnalysis.identity.detectedProduct}</span>
                    </div>
                  </div>
                </div>

                {/* Supervisor Action Form */}
                <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-lg space-y-3">
                  <div className="font-semibold text-slate-200">
                    Supervisor Resolution Actions:
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">
                      Choose Resolution Outcome:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(['RESTOCK', 'REFURBISH', 'LIQUIDATE', 'DISPOSE'] as DispositionType[]).map(
                        (action) => (
                          <button
                            key={action}
                            onClick={() => setResolutionAction(action)}
                            className={`p-1.5 rounded border text-[11px] font-semibold transition-all ${
                              resolutionAction === action
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {action}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">
                      Supervisor Audit Notes / Investigation Summary:
                    </label>
                    <textarea
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="e.g., Verified substitute device physically in intake bay. Customer contact initiated."
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => alert('Re-capture notification sent to intake imaging station.')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Request New Image</span>
                    </button>

                    <button
                      onClick={handleApplyResolution}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded shadow flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve & Finalize</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Select an inspection from the queue to view diagnostic details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
