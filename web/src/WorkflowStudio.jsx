import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Code, Box, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { orchestratorApi } from './apiClient';

export default function WorkflowStudio({ orgId, onRunComplete }) {
  const [dataPayload, setDataPayload] = useState('{\n  "use_stub": false,\n  "product_type": "electronics",\n  "serial_number": "SN-987654321",\n  "condition": "new",\n  "qty_ordered": 10,\n  "qty_received": 10\n}');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      // Create a dynamic unit ID
      const dynamicUnitId = "OMNI-" + Math.floor(Math.random() * 10000);
      
      // We pass the dynamic data to the orchestrator run
      const { data } = await orchestratorApi.runWorkflow(orgId, dynamicUnitId, {
        context: {
          case: JSON.parse(dataPayload)
        }
      });
      setResult(data);
      if(onRunComplete) onRunComplete(data);
    } catch (e) {
      console.error(e);
      setResult({ error: e.message || "Execution Failed" });
    }
    setIsRunning(false);
  };

  return (
    <div className="studio-container" style={{ padding: '24px', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Box size={24} color="var(--brand-400)" />
            Omni-Data Studio
          </h2>
          <p style={{ color: 'var(--ink-400)', margin: '8px 0 0 0', fontSize: '0.9rem' }}>
            Inject arbitrary JSON data to dynamically evaluate products, records, or arbitrary inputs across the OmniAgent pipeline.
          </p>
        </div>
        <button 
          className="btn btn-primary btn-lg" 
          onClick={handleRun}
          disabled={isRunning}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)' }}
        >
          {isRunning ? <span className="spinner"></span> : <Play size={18} />}
          {isRunning ? 'Processing...' : 'Run Omni-Pipeline'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Input Panel */}
        <div className="card" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#94a3b8' }}>
            <Code size={16} />
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Dynamic Data Payload (JSON)</h3>
          </div>
          <textarea 
            value={dataPayload}
            onChange={(e) => setDataPayload(e.target.value)}
            style={{ 
              width: '100%', 
              height: '300px', 
              background: 'transparent', 
              border: 'none', 
              color: '#38bdf8', 
              fontFamily: 'monospace',
              fontSize: '14px',
              resize: 'none',
              outline: 'none'
            }}
            spellCheck="false"
          />
        </div>

        {/* Output Panel */}
        <div className="card" style={{ background: 'var(--surface2)', overflowY: 'auto', maxHeight: '360px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--ink-400)' }}>Pipeline Results</h3>
          
          {!result && !isRunning && (
             <div style={{ textAlign: 'center', color: 'var(--ink-400)', marginTop: '60px' }}>
               Run the pipeline to see OmniAgent analysis results.
             </div>
          )}

          {isRunning && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '16px' }}
            >
               <div className="spinner" style={{ width: '32px', height: '32px', borderTopColor: 'var(--brand-400)' }}></div>
               <span style={{ color: 'var(--brand-400)', fontWeight: 600 }}>OmniAgent Evaluating Data...</span>
            </motion.div>
          )}

          {result && !result.error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span className={`badge ${result.final_outcome === 'CLEAN' || result.final_outcome === 'PASS' ? 'badge-seal' : 'badge-stop'}`} style={{ fontSize: '1rem', padding: '6px 12px' }}>
                  {result.final_outcome || result.status}
                </span>
                <span style={{ color: 'var(--ink-300)', fontWeight: 600 }}>Workflow: {result.workflow_id}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {result.stage_results?.map((stage, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `3px solid ${stage.outcome === 'PASS' || stage.outcome === 'completed' ? '#34d399' : stage.outcome === 'skipped' ? '#94a3b8' : '#f87171'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ textTransform: 'capitalize' }}>{stage.stage}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-400)', textTransform: 'uppercase' }}>{stage.outcome}</span>
                    </div>
                    {stage.verdict && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--ink-300)' }}>
                        Verdict: <strong style={{ color: stage.verdict === 'PASS' ? '#34d399' : '#f87171' }}>{stage.verdict}</strong>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {result && result.error && (
            <div style={{ color: '#f87171', padding: '16px', background: 'rgba(248,113,113,0.1)', borderRadius: '8px' }}>
              <AlertTriangle size={20} style={{ marginBottom: '8px' }} />
              <div>{result.error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
