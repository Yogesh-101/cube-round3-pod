import React, { useState } from 'react';
import { X, Upload, FileCode, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ingestJson, ingestFile } from '../services/api';

export default function IngestModal({ onClose, onIngestSuccess }) {
  const [mode, setMode] = useState('json_text'); // 'json_text' or 'file_upload'
  const [jsonText, setJsonText] = useState(JSON.stringify({
    charges: [
      {
        charge_id: "CHG-CUSTOM-001",
        shipment_id: "SH-1002",
        order_id: "ORD-2002",
        sku: "SKU-HOME-02",
        reason: "Packaging Defect Charge",
        amount: 88.50,
        currency: "USD"
      }
    ]
  }, null, 2));

  const [selectedFile, setSelectedFile] = useState(null);
  const [recordType, setRecordType] = useState('charges');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setErrorMsg(null);

    try {
      if (mode === 'json_text') {
        let parsed;
        try {
          parsed = JSON.parse(jsonText);
        } catch (err) {
          throw new Error(`Invalid JSON syntax: ${err.message}`);
        }
        const res = await ingestJson(parsed);
        setResult(res);
        if (res.charges_ingested > 0 || res.orders_ingested > 0 || res.shipments_ingested > 0 || res.evidence_ingested > 0) {
          onIngestSuccess();
        }
      } else {
        if (!selectedFile) {
          throw new Error('Please select a .json or .csv file to upload');
        }
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (selectedFile.name.endsWith('.csv')) {
          formData.append('record_type', recordType);
        }
        const res = await ingestFile(formData);
        setResult(res);
        onIngestSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Ingestion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Ingest Operational & Financial Data</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Ingest Mode Tabs */}
          <div className="flex gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('json_text'); setResult(null); setErrorMsg(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === 'json_text' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Paste JSON Payload
            </button>
            <button
              type="button"
              onClick={() => { setMode('file_upload'); setResult(null); setErrorMsg(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                mode === 'file_upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Upload CSV / JSON File
            </button>
          </div>

          {mode === 'json_text' ? (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                JSON Document (charges, orders, shipments, evidence)
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={9}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                placeholder='{ "charges": [...], "evidence": [...] }'
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Select File (.json or .csv)
                </label>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              {selectedFile && selectedFile.name.endsWith('.csv') && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                    CSV Record Type
                  </label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="charges">charges</option>
                    <option value="orders">orders</option>
                    <option value="shipments">shipments</option>
                    <option value="evidence">evidence</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success / Ingest Report */}
          {result && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-slate-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Ingestion Completed</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-300 mt-2 font-mono text-[11px]">
                <div>Charges: +{result.charges_ingested}</div>
                <div>Orders: +{result.orders_ingested}</div>
                <div>Shipments: +{result.shipments_ingested}</div>
                <div>Evidence: +{result.evidence_ingested}</div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-amber-400 text-[11px]">
                  Validation warnings: {result.errors.length} records skipped safely.
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-sm"
            >
              {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
              <span>{loading ? 'Processing...' : 'Run Ingestion'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
