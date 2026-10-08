import React from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  Package,
  Layers,
} from 'lucide-react';
import { ReturnInspectionRecord } from '../types';
import { Barcode } from './Barcode';

interface InspectionReportModalProps {
  inspection: ReturnInspectionRecord;
  onClose: () => void;
}

export const InspectionReportModal: React.FC<InspectionReportModalProps> = ({
  inspection,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full my-8 overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Top Actions Bar */}
        <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-white">
              Official Warehouse Certification Report
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <div className="p-8 space-y-6 bg-slate-900 text-slate-200 text-xs print:text-black print:bg-white print:p-4">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white print:text-black">
                  RETURN<span className="text-indigo-400">IQ</span>
                </span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Warehouse Return Inspection Report
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Automated Multi-Signal Vision & Deterministic Disposition Audit
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 font-mono">
              <Barcode
                value={inspection.returnId}
                height={32}
                lightBackground={false}
                className="print:hidden"
              />
              <Barcode
                value={inspection.returnId}
                height={32}
                lightBackground={true}
                className="hidden print:inline-flex"
              />
              <div className="text-[11px] text-slate-400">Order: {inspection.orderId}</div>
              <div className="text-[10px] text-slate-500">Date: {inspection.inspectionDate}</div>
            </div>
          </div>

          {/* Product & Order Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950/80 print:bg-slate-100 rounded-lg border border-slate-800 print:border-slate-300">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Product</span>
              <span className="font-semibold text-white print:text-black truncate block">
                {inspection.product.name}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">SKU</span>
              <span className="font-mono text-slate-300 print:text-black block">
                {inspection.product.sku}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Serial</span>
              <span className="font-mono text-slate-300 print:text-black block">
                {inspection.serialNumber}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-medium">Final Disposition</span>
              <span className="font-bold text-indigo-400 print:text-indigo-700 block">
                {inspection.finalDecision}
              </span>
            </div>
          </div>

          {/* Four Core Pillars of Inspection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Identity & Box Swap Verification */}
            <div className="p-3.5 rounded border border-slate-800 bg-slate-950/50 print:bg-white print:border-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white print:text-black">1. Product Identity</span>
                <span className="font-medium text-emerald-400">
                  {inspection.aiAnalysis.identity.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 print:text-slate-700">
                Detected: {inspection.aiAnalysis.identity.detectedProduct}
              </p>
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                Box Model: {inspection.aiAnalysis.identity.boxVsDeviceComparison.boxModel} · Device: {inspection.aiAnalysis.identity.boxVsDeviceComparison.deviceModel}
              </div>
            </div>

            {/* 2. Completeness Check */}
            <div className="p-3.5 rounded border border-slate-800 bg-slate-950/50 print:bg-white print:border-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white print:text-black">2. Completeness Check</span>
                <span className="font-mono font-medium text-slate-300 print:text-black">
                  {inspection.aiAnalysis.completeness.detectedCount} /{' '}
                  {inspection.aiAnalysis.completeness.expectedCount} Items
                </span>
              </div>
              <p className="text-[11px] text-slate-300 print:text-slate-700">
                {inspection.aiAnalysis.completeness.missingCount === 0
                  ? 'All factory parts verified present'
                  : `Missing: ${inspection.aiAnalysis.completeness.missingComponents.join(', ')}`}
              </p>
            </div>

            {/* 3. Condition Assessment */}
            <div className="p-3.5 rounded border border-slate-800 bg-slate-950/50 print:bg-white print:border-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white print:text-black">3. Condition Assessment</span>
                <span className="text-[10px] text-slate-400">Scale: {inspection.aiAnalysis.condition.scale}</span>
              </div>
              <p className="text-[11px] text-white print:text-black font-medium">
                {inspection.aiAnalysis.condition.result}
              </p>
            </div>

            {/* 4. Return Integrity */}
            <div className="p-3.5 rounded border border-slate-800 bg-slate-950/50 print:bg-white print:border-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white print:text-black">4. Return Integrity</span>
                <span className="font-medium text-emerald-400">
                  {inspection.aiAnalysis.integrity.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 print:text-slate-700">
                SKU: {inspection.aiAnalysis.integrity.skuMatch ? 'Match' : 'Mismatch'} · Serial: {inspection.aiAnalysis.integrity.serialMatch ? 'Match' : 'Mismatch'} · Box-Device: {inspection.aiAnalysis.integrity.boxDeviceConsistency}
              </p>
            </div>
          </div>

          {/* Disposition Decision Justification */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-950/60 print:bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white print:text-black">
                Decision Engine Rule Justification
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Rule: {inspection.recommendation.ruleName}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-300 print:text-slate-800">
              {inspection.recommendation.reasons.map((r, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-indigo-400">✓</span>
                  <span>{r.point}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Decision Audit Timeline */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Decision Audit Trail:
            </span>
            <div className="divide-y divide-slate-800 print:divide-slate-300 border-t border-b border-slate-800 print:border-slate-300 text-[11px]">
              {inspection.auditTrail.map((ev, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-500 tabular-nums">{ev.timestamp}</span>
                    <span className="text-slate-200 print:text-black font-medium">{ev.action}</span>
                  </div>
                  <div className="text-slate-400 print:text-slate-600">
                    {ev.user} · <span className="font-semibold text-slate-300 print:text-black">{ev.result}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operator Signature Block */}
          <div className="pt-4 border-t border-slate-800 print:border-slate-300 flex items-center justify-between text-slate-400 text-[11px]">
            <div>
              Certified Inspector: <strong className="text-white print:text-black">{inspection.operator}</strong>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              System ID: RETURNIQ-VISION-CERT-2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
