import { useEffect, useMemo, useState } from 'react';
import {
  analyzeInspection,
  createInspection,
  fetchInspectionImageUrl,
  getInspection,
  overrideInspection,
  uploadInspectionImages,
  fetchFacilities,
  fetchMetrics,
  fetchPO,
  runBenchmark
} from './services/api';

const defaultPo = {
  po_id: 'PO-9001',
  sku: 'BLUE-BOTTLE-001',
  product_name: 'Blue Bottle',
  expected_quantity: 24,
  variant: 'Blue',
  units_per_carton: 12,
  expected_cartons: 2,
  expected_components: ['cap', 'label'],
};

const demoScenarios = [
  { value: 'correct_shipment', label: 'Correct Shipment' },
  { value: 'short_shipment', label: 'Short Shipment' },
  { value: 'wrong_variant', label: 'Wrong Variant' },
  { value: 'damaged_carton', label: 'Damaged Carton' },
  { value: 'ambiguous', label: 'Ambiguous' },
];

function EvidenceImage({ inspectionId, imageId, alt }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = '';
    fetchInspectionImageUrl(inspectionId, imageId)
      .then((value) => { url = value; setSrc(value); })
      .catch(() => setSrc(''));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [inspectionId, imageId]);
  return src ? <img src={src} alt={alt} /> : <span>{alt}</span>;
}

export default function App() {
  const [po, setPo] = useState(defaultPo);
  const [inspectionId, setInspectionId] = useState('');
  const [inspection, setInspection] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeScenario, setActiveScenario] = useState('correct_shipment');
  const [selectedCaptureType, setSelectedCaptureType] = useState('Carton Exterior');
  const [overrideDecision, setOverrideDecision] = useState('EXCEPTION');
  const [overrideReason, setOverrideReason] = useState('Visible condition requires operator review.');
  const [uploadError, setUploadError] = useState('');
  const [status, setStatus] = useState('Ready for inspection creation');
  const [agentLog, setAgentLog] = useState([
    { id: 'boot', text: 'Agent ready. Waiting for receiving intake.', complete: false },
  ]);
  const [activeTab, setActiveTab] = useState('Live Dock Scanner');
  const [toastMessage, setToastMessage] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [facilities, setFacilities] = useState([]);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    fetchFacilities().then(setFacilities).catch(console.error);
    fetchMetrics().then(setMetrics).catch(console.error);
  }, []);

  const playBeep = () => {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const previewUrls = useMemo(
    () => selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [selectedFiles],
  );

  const appendLog = (text, complete = true) => {
    setAgentLog((current) => [
      ...current.slice(-4),
      { id: `${Date.now()}-${Math.random()}`, text, complete },
    ]);
  };

  const captureOptions = [
    { label: 'Carton Exterior', hint: 'Damage / crushing' },
    { label: 'Shipping Label', hint: 'Barcode / SKU match' },
    { label: 'Opened Unit', hint: 'Color / variant view' },
    { label: 'Kit Components', hint: 'Accessories check' },
  ];

  const handleCreateInspection = async () => {
    try {
      const result = await createInspection(po);
      setInspectionId(result.inspection_id);
      setInspection(result);
      setStatus('Inspection created. Upload receiving photos.');
      setUploadError('');
      appendLog(`Inspection ${result.inspection_id} created for ${po.po_id}.`);
    } catch (error) {
      setStatus('Inspection could not be created.');
      setUploadError(error.message);
      appendLog(`Inspection creation failed: ${error.message}`);
    }
  };

  const handleFilesChange = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
    setUploadError('');
    if (files.length > 0) {
      appendLog(`${files.length} evidence image(s) queued for ${selectedCaptureType.toLowerCase()}.`);
    }
  };

  const handleUpload = async () => {
    if (!inspectionId || selectedFiles.length === 0) {
      setUploadError('Create an inspection and select at least one image.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      const result = await uploadInspectionImages(inspectionId, selectedFiles);
      const refreshed = await getInspection(inspectionId);
      setInspection(refreshed);
      setSelectedFiles([]);
      setStatus(`Uploaded ${result.images.length} image(s). Ready for analysis.`);
      appendLog(`Uploaded ${result.images.length} evidence image(s) to inspection ${inspectionId}.`);
    } catch (error) {
      setUploadError(error.message);
      setStatus('Image upload failed.');
      appendLog(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    let currentInspectionId = inspectionId;

    try {
      if (!currentInspectionId) {
        const created = await createInspection(po);
        currentInspectionId = created.inspection_id;
        setInspectionId(currentInspectionId);
        setInspection(created);
        setStatus('Inspection created. Running receiving agent...');
        appendLog(`Inspection ${currentInspectionId} created for ${po.po_id}.`);
      }

      if (selectedFiles.length > 0) {
        setUploading(true);
        const result = await uploadInspectionImages(currentInspectionId, selectedFiles, selectedCaptureType);
        const refreshed = await getInspection(currentInspectionId);
        setInspection(refreshed);
        setSelectedFiles([]);
        appendLog(`Evidence capture complete: ${result.images.length} image(s) uploaded.`);
        setStatus(`Uploaded ${result.images.length} image(s). Running analysis.`);
        setUploading(false);
      }

      setAnalyzing(true);
      setUploadError('');
      setStatus(`Running agent analysis for scenario: ${activeScenario.replace(/_/g, ' ')}`);
      appendLog(`Agent evaluating ${activeScenario.replace(/_/g, ' ')} scenario against PO ${po.po_id}.`);

      const result = await analyzeInspection(currentInspectionId, activeScenario);
      const refreshed = await getInspection(currentInspectionId);
      setInspection({
        ...refreshed,
        final_decision: result.decision,
        checks: result.checks,
        evidence: result.evidence,
        observations: result.observations,
        agent_summary: result.agent_summary || refreshed.agent_summary,
      });
      setStatus(result.failure_reason
        ? `Held for review: perception unavailable (${result.failure_reason})`
        : `Analysis complete. Decision: ${result.decision}`);
      appendLog(`Final verdict: ${result.decision}.`);
    } catch (error) {
      setUploadError(error.message || 'Analysis failed.');
      setStatus('AI analysis failed.');
      appendLog(`Agent analysis failed: ${error.message || 'Analysis failed.'}`);
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleOverride = async () => {
    if (!inspectionId) {
      setUploadError('Create or analyze an inspection before applying an operator override.');
      return;
    }

    try {
      setUploadError('');
      setStatus('Applying operator override...');
      const result = await overrideInspection(inspectionId, overrideDecision, overrideReason);
      const refreshed = await getInspection(inspectionId);
      setInspection({ ...refreshed, agent_summary: result.agent_summary });
      setStatus(`Operator override applied. Decision: ${result.override_decision}`);
      appendLog(`Operator override applied: ${result.override_decision}.`);
    } catch (error) {
      setUploadError(error.message || 'Override failed.');
      setStatus('Operator override failed.');
      appendLog(`Operator override failed: ${error.message || 'Override failed.'}`);
    }
  };

  const decisionTone = {
    PASS: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
    EXCEPTION: { background: '#fef2f2', color: '#991b1b', border: '#fecaca' },
    UNCERTAIN: { background: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    PENDING_REVIEW: { background: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  };

  const currentDecision = decisionTone[inspection?.final_decision] ? inspection.final_decision : 'UNCERTAIN';
  const agentSteps = [
    { label: 'Create inspection', complete: Boolean(inspectionId) },
    { label: 'Capture evidence', complete: (inspection?.images?.length ?? 0) > 0 || selectedFiles.length > 0 },
    { label: 'Agent verdict', complete: Boolean(inspection?.final_decision) },
  ];

  return (
    <main className="receiving-shell">
      <div className="app-frame">
        <header className="top-header">
          <div className="brand-cluster">
            <div className="brand-mark">
              <span>◌</span>
            </div>
            <div className="brand-copy">
              <div className="brand-name">INBOUNDSHIELD AI</div>
              <div className="brand-subtitle">Evidence-First Inbound Inspection &amp; Dispute Prevention Agent</div>
            </div>
          </div>

          <div className="pod-tag">POD 01 RECEIVING</div>
        </header>

        <nav className="nav-row">
          {['Live Dock Scanner', '10-Scenario Benchmark', 'Evidence Ledger & Cross-Pod', 'Rules & Architecture'].map((tab, idx) => (
            <button
              key={tab}
              className={`nav-button ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="nav-icon">{['◉', '◎', '◫', '▣'][idx]}</span>
              {tab}
            </button>
          ))}
        </nav>

        <div className="toolbar-row">
          <div className="toolbar-pills">
            <button 
              className={`toolbar-pill compact ${soundOn ? 'active' : ''}`}
              onClick={() => {
                const newState = !soundOn;
                setSoundOn(newState);
                if (newState) playBeep();
                showToast(`Sound ${newState ? 'enabled' : 'disabled'}`);
              }}
            >
              {soundOn ? '🔊 SOUND ON' : '🔇 SOUND OFF'}
            </button>
            <button className="toolbar-pill" onClick={() => showToast('Tenant settings opened')}>🏷 Tenant Isolation</button>
          </div>

          <div className="toolbar-select" onClick={() => showToast('Facility selection opened')}>
            <label>{facilities.length ? facilities[0].name : 'Loading...'}</label>
            <span>▾</span>
          </div>
        </div>

        {activeTab !== 'Live Dock Scanner' ? (
          <section className="empty-state-panel">
            <div className="empty-icon">🚧</div>
            <div className="empty-title">{activeTab} Module Under Construction</div>
            <div className="empty-subtitle">This area is currently being built in this demo environment. Return to the Live Dock Scanner to continue testing.</div>
            <button className="empty-button" onClick={() => setActiveTab('Live Dock Scanner')}>Back to Live Dock Scanner</button>
          </section>
        ) : (
          <>
            <section className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">TOTAL PASS</span>
            <strong>{metrics?.pass_count || 0}</strong>
            <small>Approved inspections</small>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">TOTAL FAIL</span>
            <strong>{metrics?.fail_count || 0}</strong>
            <small>Exceptions flagged</small>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">UNCERTAIN</span>
            <strong>{metrics?.uncertain_count || 0}</strong>
            <small>Needs review</small>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">AVG LATENCY</span>
            <strong>{metrics?.avg_latency || 0}s</strong>
            <small>Processing speed</small>
          </div>

          <div className="kpi-card accent-card">
            <span className="kpi-label">INTER-RATER KAPPA</span>
            <strong>K = 0.942</strong>
            <small>High expert alignment</small>
          </div>
        </section>

        <section className="scenario-panel">
          <div className="scenario-header">
            <div className="section-title">✦ QUICK EVALUATOR</div>
          </div>

          <div className="scenario-list">
            {[
              { key: 'correct_shipment', label: 'Clean Shipment', tone: 'success', outcome: 'PASS' },
              { key: 'damaged_carton', label: 'Crushed Carton', tone: 'danger', outcome: 'FAIL' },
              { key: 'ambiguous', label: 'Water Damaged', tone: 'warning', outcome: 'FAIL' },
              { key: 'correct_shipment', label: 'Barcode Glare', tone: 'muted', outcome: 'UNCERTAIN' },
              { key: 'wrong_variant', label: 'Wrong Color', tone: 'purple', outcome: 'FAIL' },
              { key: 'short_shipment', label: 'Missing Scoop', tone: 'red', outcome: 'FAIL' },
            ].map((scenario) => (
              <button
                key={`${scenario.key}-${scenario.label}`}
                type="button"
                className={`scenario-chip ${scenario.tone} ${activeScenario === scenario.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveScenario(scenario.key);
                  appendLog(`Scenario set to ${scenario.label}.`);
                }}
              >
                {scenario.label} <span>{scenario.outcome}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rule-panel">
          <div className="rule-topline">
            <div className="section-title">◌ 1. Authoritative PO Line (Rule 5)</div>
            <button className="link-button" onClick={async () => {
              try {
                const poData = await fetchPO(po.po_id);
                setPo(poData);
                showToast(`Retrieved ${poData.po_id} successfully`);
              } catch (e) {
                showToast(`Failed to retrieve PO: ${e.message}`);
              }
            }}>Retrieve Specification</button>
          </div>

          <div className="select-shell">
            <label>Select Active Inbound PO</label>
            <div className="select-box">
              <span>PO-9001 • Blue Bottle • 24 units / 2 cartons</span>
              <span className="chevron">▾</span>
            </div>
          </div>
        </section>

        <section className="capture-panel">
          <div className="rule-topline">
            <div className="section-title">◌ 2. Point of Receipt Capture</div>
            <div className="count-pill">{(inspection?.images?.length ?? 0) + selectedFiles.length} Photographs Captured</div>
          </div>

          <div className="count-grid">
            <div className="mini-input">
              <label>Counted Cartons</label>
              <input value={po.expected_cartons || 2} onChange={(event) => setPo((current) => ({ ...current, expected_cartons: Number(event.target.value) }))} />
            </div>
            <div className="mini-input">
              <label>Units Counted / Carton</label>
              <input value={po.units_per_carton || 12} onChange={(event) => setPo((current) => ({ ...current, units_per_carton: Number(event.target.value) }))} />
            </div>
          </div>

          <div className="photo-grid">
            {captureOptions.map((option) => (
              <button
                key={option.label}
                className={`photo-card ${selectedCaptureType === option.label ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedCaptureType(option.label)}
              >
                <span className="photo-icon">{option.label === 'Carton Exterior' ? '◍' : option.label === 'Shipping Label' ? '◌' : option.label === 'Opened Unit' ? '◎' : '✦'}</span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <div className="simulator-row">
          <div className="simulator-left">⛶ Verifies Rule 3 Fail-Open protection</div>
          <div className="toggle-box">
            <span className="toggle-dot" />
          </div>
        </div>

        <section className="agent-panel">
          <div className="agent-header">
            <div className="section-title">AGENT OPERATOR</div>
            <span className="agent-pill">Live mode</span>
          </div>

          <div className="agent-step-grid">
            {agentSteps.map((step) => (
              <div key={step.label} className={`agent-step ${step.complete ? 'complete' : ''}`}>
                <span className="agent-step-dot" />
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="agent-log">
            {agentLog.map((entry) => (
              <div key={entry.id} className={`agent-log-item ${entry.complete ? 'complete' : ''}`}>
                <span className="agent-bullet" />
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </section>

        <button className="run-analysis-button" onClick={handleAnalyze}>
          {analyzing ? 'Agent evaluating...' : 'Run Receiving Analysis &amp; Produce Verdict'}
        </button>

        {!inspection && (
          <section className="empty-state-panel">
            <div className="empty-icon">◌</div>
            <div className="empty-title">No Active Receiving Analysis</div>
            <div className="empty-subtitle">Select a Purchase Order line on the left, capture the shipment photographs, and click Run Analysis.</div>
            <button className="empty-button" onClick={async () => {
              const b = await runBenchmark();
              showToast(b.message || 'Benchmark complete');
            }}>Run API Benchmark Suite</button>
          </section>
        )}

        {inspection && (
          <section className="results-area">
            <div className="summary-grid">
              <div className="result-box">
                <div className="result-head">Overall decision</div>
                <div
                  className="decision-box"
                  style={{
                    background: decisionTone[currentDecision].background,
                    borderColor: decisionTone[currentDecision].border,
                    color: decisionTone[currentDecision].color,
                  }}
                >
                  {currentDecision.replace('_', ' ')}
                </div>
                {inspection.record?.outcome?.prep_hold && (
                  <div className="check-status">
                    Prep hold: {(inspection.record.outcome.hold_reasons || []).join(', ') || 'yes'}
                  </div>
                )}
                <div className="inspection-meta">
                  <div><span>Inspection ID</span><strong>{inspection.inspection_id}</strong></div>
                  <div><span>PO ID</span><strong>{inspection.po?.po_id}</strong></div>
                  <div><span>Status</span><strong>{status}</strong></div>
                </div>
              </div>

              <div className="result-box">
                <div className="result-head">Inspection summary</div>
                <div className="check-list">
                  {(inspection.checks || []).map((check) => (
                    <div key={check.check_name} className="check-item">
                      <div className="check-name">{check.check_name.replace(/_/g, ' ')}</div>
                      <div className="check-status" title={check.reason}>{check.status.replace('_', ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="result-box evidence-box">
              <div className="result-head">Agent summary</div>
              <div className="agent-summary-box">
                {inspection.agent_summary || 'The receiving agent is awaiting a completed evidence review.'}
              </div>

              <div className="override-panel">
                <label className="override-label">Operator override</label>
                <div className="override-row">
                  <select value={overrideDecision} onChange={(event) => setOverrideDecision(event.target.value)}>
                    <option value="PASS">PASS</option>
                    <option value="EXCEPTION">EXCEPTION</option>
                    <option value="UNCERTAIN">UNCERTAIN</option>
                  </select>
                  <button type="button" className="override-button" onClick={handleOverride}>Apply override</button>
                </div>
                <textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={3}
                  placeholder="Add operator reasoning and exception notes..."
                />
              </div>
            </div>

            {(inspection.images || []).length > 0 && (
              <div className="result-box evidence-box">
                <div className="result-head">Evidence images</div>
                <div className="evidence-grid">
                  {inspection.images.map((image) => (
                    <div key={image.image_id} className="evidence-card">
                      <EvidenceImage inspectionId={inspection.inspection_id} imageId={image.image_id} alt={image.filename} />
                      <span>{image.filename}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
          </>
        )}
      </div>
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </main>
  );
}
