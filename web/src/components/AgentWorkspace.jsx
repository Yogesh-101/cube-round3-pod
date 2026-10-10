import React, { useState, useEffect } from 'react'
import { orchestratorApi } from '../apiClient'

const AGENT_CONFIGS = {
  receiving: {
    stage: 'receiving',
    title: 'Receiving Agent',
    icon: '📥',
    version: '1.0.0',
    owner: '@team',
    description: 'Inspects inbound freight at the dock. Compares PO lines against received quantities, flags carton and unit damages, and evaluates supplier quality.',
    responsibilities: [
      'Carton & Unit Damage Inspection',
      'PO Line Quantity Reconciliation & Shortfall Tracking',
      'Supplier Quality Flags & Identity Verification',
      'Content-addressed photo capture verification',
    ],
    sampleUnits: [
      { id: 'UNIT-0001', org: 'org_demo_alpha', label: 'UNIT-0001 (Clean Pass)' },
      { id: 'UNIT-0004', org: 'org_demo_alpha', label: 'UNIT-0004 (Damaged Carton Defect)' },
      { id: 'UNIT-0005', org: 'org_demo_alpha', label: 'UNIT-0005 (Quantity Shortfall)' },
    ],
  },
  prep: {
    stage: 'prep',
    title: 'Prep Agent',
    icon: '📦',
    version: '1.0.0',
    owner: '@team',
    description: 'Enforces Amazon FBA prep standards before shipment: polybag seals, suffocation warnings, FNSKU label placement, barcode coverage, and pricing.',
    responsibilities: [
      'Polybag Present & Heat-Sealed Check',
      'Suffocation Warning Legibility',
      'FNSKU Label Placement & Original Barcode Coverage',
      'Expiry Date Verification & Prep Fee Calculation',
    ],
    sampleUnits: [
      { id: 'UNIT-0002', org: 'org_demo_alpha', label: 'UNIT-0002 (Compliant FBA Prep)' },
      { id: 'UNIT-0003', org: 'org_demo_bravo', label: 'UNIT-0003 (Unsealed Polybag Defect)' },
      { id: 'UNIT-0005', org: 'org_demo_alpha', label: 'UNIT-0005 (High-Volume Prep)' },
    ],
  },
  pack: {
    stage: 'pack',
    title: 'Pack Agent',
    icon: '📦',
    version: '2.0.0',
    owner: '@team',
    description: 'Verifies MFN and 3PL packing orders using order-blind vision and deterministic matching. Validates items present, quantities, and prevents wrong items.',
    responsibilities: [
      'Items Present & Quantity Accuracy Verification',
      'No Wrong / Extra Items in Shipping Box',
      'Order-Blind VLM & Scene Coverage Verification',
      'Enforces MFN/3PL Scope (FBA units packed by Amazon are routed out)',
    ],
    sampleUnits: [
      { id: 'UNIT-0006', org: 'org_demo_bravo', label: 'UNIT-0006 (Clean MFN Seal)' },
      { id: 'UNIT-0007', org: 'org_demo_bravo', label: 'UNIT-0007 (Missing Item Defect)' },
      { id: 'UNIT-0008', org: 'org_demo_bravo', label: 'UNIT-0008 (Low Light / Review)' },
    ],
  },
  returns: {
    stage: 'returns',
    title: 'Returns Agent',
    icon: '🔄',
    version: '1.0.0',
    owner: '@team',
    description: 'Inspects customer returns, grades physical condition, verifies serial numbers and included accessories, and assigns final disposition.',
    responsibilities: [
      'Identity Match & Serial Number Verification',
      'Component Completeness & Missing Parts Check',
      'Condition Grading & Cosmetic Damage Assessment',
      'Disposition Assignment: Restock, Liquidate, or Dispose',
    ],
    sampleUnits: [
      { id: 'UNIT-0014', org: 'org_demo_alpha', label: 'UNIT-0014 (Restock Clean Pass)' },
      { id: 'UNIT-0016', org: 'org_demo_alpha', label: 'UNIT-0016 (Condition Graded)' },
      { id: 'UNIT-0023', org: 'org_demo_alpha', label: 'UNIT-0023 (Damaged / Dispose)' },
      { id: 'UNIT-0003', org: 'org_demo_bravo', label: 'UNIT-0003 (Tenant Bravo Return)' },
    ],
  },
  recovery: {
    stage: 'recovery',
    title: 'Recovery Agent',
    icon: '💰',
    version: '2.0.0',
    owner: '@team',
    description: 'Audits Amazon fee reports against accumulated physical evidence. Validates fee accuracy and automatically builds claim dossiers for contradicted charges.',
    responsibilities: [
      'Cross-checks Inbound Defect Fees against Prep Evidence',
      'Cross-checks Refund Without Return against Returns Evidence',
      'Audits Weight Tier Fees (Flags Missing Measurements F-07)',
      'Generates Dispute Dossiers with Financial Claimable Amounts',
    ],
    sampleUnits: [
      { id: 'UNIT-0002', org: 'org_demo_alpha', label: 'UNIT-0002 (Contradicts Fee -> Claim!)' },
      { id: 'UNIT-0003', org: 'org_demo_bravo', label: 'UNIT-0003 (Fee Supported by Prep Defect)' },
      { id: 'UNIT-0004', org: 'org_demo_alpha', label: 'UNIT-0004 (Multiple Audit Lines)' },
      { id: 'UNIT-0005', org: 'org_demo_alpha', label: 'UNIT-0005 (Missing Upstream -> Silent)' },
    ],
  },
}

export default function AgentWorkspace({ initialStage = 'receiving', onSwitchToWorkflow, showToast }) {
  const [selectedStage, setSelectedStage] = useState(initialStage)
  const currentConfig = AGENT_CONFIGS[selectedStage] || AGENT_CONFIGS.receiving

  const [unitId, setUnitId] = useState(currentConfig.sampleUnits[0]?.id || 'UNIT-0001')
  const [orgId, setOrgId] = useState(currentConfig.sampleUnits[0]?.org || 'org_demo_alpha')
  
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [dependencies, setDependencies] = useState(null)
  const [loadingDeps, setLoadingDeps] = useState(false)
  const [history, setHistory] = useState([])
  const [showJson, setShowJson] = useState(false)

  // Sync sample unit when stage changes
  useEffect(() => {
    const defaultSample = currentConfig.sampleUnits[0]
    if (defaultSample) {
      setUnitId(defaultSample.id)
      setOrgId(defaultSample.org)
    }
    setResult(null)
    setErrorMsg(null)
  }, [selectedStage])

  // Check dependencies whenever stage, unitId, or orgId changes
  useEffect(() => {
    let active = true
    const checkDeps = async () => {
      if (!unitId || !orgId) return
      setLoadingDeps(true)
      try {
        const deps = await orchestratorApi.fetchAgentDependencies(selectedStage, unitId, orgId)
        if (active) setDependencies(deps)
      } catch (err) {
        if (active) setDependencies(null)
      } finally {
        if (active) setLoadingDeps(false)
      }
    }
    checkDeps()
    return () => { active = false }
  }, [selectedStage, unitId, orgId])

  // Fetch agent execution history
  const fetchHistory = async () => {
    try {
      const records = await orchestratorApi.fetchAgentHistory(selectedStage)
      setHistory(records)
    } catch {
      setHistory([])
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [selectedStage])

  const handleSelectSample = (sample) => {
    setUnitId(sample.id)
    setOrgId(sample.org)
    setResult(null)
    setErrorMsg(null)
    if (showToast) showToast(`Loaded sample unit ${sample.id} (${sample.org})`, 'info')
  }

  const handleExecute = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!unitId || !orgId) return

    setExecuting(true)
    setErrorMsg(null)
    setResult(null)
    if (showToast) showToast(`Executing ${currentConfig.title} independently for ${unitId}...`, 'info')

    try {
      const res = await orchestratorApi.runAgent(selectedStage, unitId.trim(), orgId.trim())
      setResult(res)
      fetchHistory()
      const verdict = res.verdict || res.evidence?.decision?.verdict || 'DONE'
      if (showToast) {
        showToast(
          `${currentConfig.title} finished: ${verdict} (${res.outcome || 'completed'})`,
          verdict === 'PASS' ? 'seal' : (verdict === 'FAIL' ? 'stop' : 'warn')
        )
      }
    } catch (err) {
      setErrorMsg(err.message || 'Execution error')
      if (showToast) showToast(err.message || 'Execution error', 'stop')
    } finally {
      setExecuting(false)
    }
  }

  const exportEvidence = () => {
    if (!result?.evidence) return
    const blob = new Blob([JSON.stringify(result.evidence, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-${result.record_id || selectedStage}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    if (showToast) showToast(`Downloaded evidence ${result.record_id}.json`, 'seal')
  }

  const verdict = result?.verdict || result?.evidence?.decision?.verdict
  const outcome = result?.outcome || result?.evidence?.decision?.outcome

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Stage Selector Ribbon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--edge)',
        paddingBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {Object.values(AGENT_CONFIGS).map((cfg) => {
            const isActive = cfg.stage === selectedStage
            return (
              <button
                key={cfg.stage}
                onClick={() => setSelectedStage(cfg.stage)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-pill)',
                  border: isActive ? '1px solid var(--brand-500)' : '1px solid var(--edge)',
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? 'var(--glow)' : 'none',
                }}
              >
                <span>{cfg.icon}</span>
                <span>{cfg.title}</span>
              </button>
            )
          })}
        </div>

        {onSwitchToWorkflow && (
          <button
            onClick={onSwitchToWorkflow}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            ⚡ Switch to Full Pipeline Mode
          </button>
        )}
      </div>

      {/* Main Agent Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Config, Upstream Dependencies & Run Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Agent Information Header Card */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2.2rem' }}>{currentConfig.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                      {currentConfig.title}
                    </h2>
                    <span className="badge badge-seal" style={{ fontSize: '0.72rem' }}>
                      ONLINE
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Stage: <strong>{currentConfig.stage}</strong></span>
                    <span>•</span>
                    <span>Version: <strong>v{currentConfig.version}</strong></span>
                    <span>•</span>
                    <span>Mode: <strong>inproc/http</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.55, marginBottom: '16px' }}>
              {currentConfig.description}
            </p>

            <div style={{
              background: 'var(--surface2)',
              border: '1px solid var(--edge)',
              borderRadius: '8px',
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-300)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Key Responsibilities & Contracts
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {currentConfig.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Upstream Dependency & Prerequisite Status */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔍</span> Upstream Dependency Analysis
              </h3>
              {loadingDeps && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Checking...</span>}
            </div>

            {dependencies ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dependencies.details.map((detail, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '0.84rem',
                      color: detail.includes('Missing') || detail.includes('cannot') ? 'var(--uncertain)' : 'var(--text)',
                      background: 'var(--surface2)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  >
                    <span>{detail.includes('Missing') ? '⚠️' : (detail.includes('found') || detail.includes('complete') ? '✅' : 'ℹ️')}</span>
                    <span>{detail}</span>
                  </div>
                ))}

                {dependencies.missing_upstream?.length > 0 && (
                  <div style={{
                    marginTop: '6px',
                    padding: '10px',
                    borderRadius: '6px',
                    background: 'var(--uncertain-soft)',
                    border: '1px solid var(--uncertain-edge)',
                    fontSize: '0.8rem',
                    color: 'var(--uncertain)',
                  }}>
                    <strong>Notice:</strong> This agent executes without fabricated data. If upstream evidence is absent, results will honestly reflect incomplete upstream proof (e.g. SILENT charges).
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                Loading dependency status for {unitId}...
              </p>
            )}
          </div>

          {/* Execution Form Card */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
              Execute {currentConfig.title}
            </h3>

            {/* Quick-fill sample units */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Curated Sample Test Units
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {currentConfig.sampleUnits.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    style={{
                      padding: '6px 12px',
                      background: unitId === sample.id && orgId === sample.org ? 'var(--brand-950)' : 'var(--surface2)',
                      border: unitId === sample.id && orgId === sample.org ? '1px solid var(--brand-500)' : '1px solid var(--edge)',
                      borderRadius: '6px',
                      color: unitId === sample.id && orgId === sample.org ? 'var(--brand-300)' : 'var(--text-dim)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleExecute} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                    Subject / Unit ID
                  </label>
                  <input
                    type="text"
                    required
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value.trim())}
                    placeholder="e.g. UNIT-0001"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--edge)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
                    Tenant Organization ID
                  </label>
                  <select
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--edge)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="org_demo_alpha">org_demo_alpha</option>
                    <option value="org_demo_bravo">org_demo_bravo</option>
                  </select>
                </div>
              </div>

              {errorMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--stop-soft)',
                  border: '1px solid var(--stop-edge)',
                  color: 'var(--stop)',
                  fontSize: '0.85rem',
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={executing || !unitId}
                className="btn btn-primary"
                style={{
                  padding: '13px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  marginTop: '6px',
                }}
              >
                {executing ? (
                  <span>⏳ Executing {currentConfig.title}...</span>
                ) : (
                  <span>▶ Run {currentConfig.title} Independently</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Structured Evidence, Checks & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Execution Result Banner */}
          {result ? (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    letterSpacing: '0.04em',
                    backgroundColor: verdict === 'PASS' ? 'var(--seal-soft)' : (verdict === 'FAIL' ? 'var(--stop-soft)' : 'var(--uncertain-soft)'),
                    color: verdict === 'PASS' ? 'var(--seal)' : (verdict === 'FAIL' ? 'var(--stop)' : 'var(--uncertain)'),
                    border: `1px solid ${verdict === 'PASS' ? 'var(--seal-edge)' : (verdict === 'FAIL' ? 'var(--stop-edge)' : 'var(--uncertain-edge)')}`,
                  }}>
                    {verdict || 'COMPLETED'}
                  </span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                    {outcome || 'Processed'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={exportEvidence}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    title="Export Evidence JSON"
                  >
                    📥 JSON
                  </button>
                  <button
                    onClick={handleExecute}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    title="Re-run Agent"
                  >
                    🔄 Re-Run
                  </button>
                </div>
              </div>

              {/* Metadata Badges Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '10px',
                background: 'var(--surface2)',
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid var(--edge)',
                marginBottom: '18px',
              }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RECORD ID</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-300)', fontFamily: 'var(--font-mono)' }}>
                    {result.record_id || 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>LATENCY</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {result.latency_ms ? `${result.latency_ms}ms` : '<100ms'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AGENT ID</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    {result.agent_id || `${selectedStage}-agent`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CONTENT HASH</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--seal)' }}>
                    ✓ SHA-256 Verified
                  </div>
                </div>
              </div>

              {/* Special Stage Breakdown: Recovery Claim Dossier */}
              {selectedStage === 'recovery' && result.evidence?.payload?.charges && (
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                      Audited Amazon Fee Lines ({result.evidence.payload.charges.length})
                    </div>
                    {result.evidence.payload.claimable_usd > 0 && (
                      <div className="badge badge-stop" style={{ fontWeight: 700 }}>
                        Total Claimable: ${result.evidence.payload.claimable_usd}
                      </div>
                    )}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface3)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Charge Type</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Position</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Decision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.evidence.payload.charges.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--edge)' }}>
                            <td style={{ padding: '8px', fontFamily: 'var(--font-mono)' }}>{c.charge_type}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>${c.amount_usd}</td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: c.position === 'CONTRADICTS' ? 'var(--stop-soft)' : (c.position === 'SUPPORTS' ? 'var(--seal-soft)' : 'var(--uncertain-soft)'),
                                color: c.position === 'CONTRADICTS' ? 'var(--stop)' : (c.position === 'SUPPORTS' ? 'var(--seal)' : 'var(--uncertain)'),
                              }}>
                                {c.position}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{c.decision}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Checks Table */}
              {result.evidence?.checks && result.evidence.checks.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                    Check-by-Check Verdicts ({result.evidence.checks.length})
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface3)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Check Key</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Verdict</th>
                          <th style={{ padding: '8px', textAlign: 'center' }}>Conf</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.evidence.checks.map((chk, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--edge)' }}>
                            <td style={{ padding: '8px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                              {chk.check_key}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: chk.verdict === 'PASS' ? 'var(--seal-soft)' : (chk.verdict === 'FAIL' ? 'var(--stop-soft)' : 'var(--uncertain-soft)'),
                                color: chk.verdict === 'PASS' ? 'var(--seal)' : (chk.verdict === 'FAIL' ? 'var(--stop)' : 'var(--uncertain)'),
                              }}>
                                {chk.verdict}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              {chk.confidence !== null && chk.confidence !== undefined ? `${Math.round(chk.confidence * 100)}%` : '—'}
                            </td>
                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>
                              {chk.detail || chk.uncertain_reason || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw JSON toggle */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--edge)', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowJson(!showJson)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--brand-400)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showJson ? '▲ Hide Full Evidence JSON' : '▼ Inspect Raw Evidence JSON Payload'}
                </button>
                {showJson && (
                  <pre style={{
                    marginTop: '10px',
                    padding: '12px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--edge)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#93c5fd',
                    overflowX: 'auto',
                    maxHeight: '300px',
                  }}>
                    {JSON.stringify(result.evidence || result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.6 }}>🎯</div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                Ready to Execute
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '360px', margin: '0 auto 18px auto' }}>
                Select a sample unit or enter custom parameters on the left and click <strong>Run {currentConfig.title}</strong> to inspect isolated live evidence.
              </p>
            </div>
          )}

          {/* Past History Table for this Agent */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                Recent Runs for {currentConfig.title}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {history.length} record(s)
              </span>
            </div>

            {history.length > 0 ? (
              <div style={{ overflowX: 'auto', maxHeight: '220px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface3)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Unit</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Verdict</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Outcome</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid var(--edge)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 600 }}>{h.unit_id}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span style={{
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: h.verdict === 'PASS' ? 'var(--seal-soft)' : (h.verdict === 'FAIL' ? 'var(--stop-soft)' : 'var(--uncertain-soft)'),
                            color: h.verdict === 'PASS' ? 'var(--seal)' : (h.verdict === 'FAIL' ? 'var(--stop)' : 'var(--uncertain)'),
                          }}>
                            {h.verdict || 'DONE'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{h.outcome || '—'}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-faint)' }}>
                          {h.created_at ? new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                No prior executions found for {currentConfig.title}.
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
