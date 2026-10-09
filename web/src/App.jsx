import React, { useState, useEffect } from 'react'
import './App.css'

// Safe Error Boundary to guarantee zero white-screen crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Dashboard caught rendering error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: 600, margin: '0 auto', borderColor: 'var(--stop-edge)' }}>
            <h2 style={{ color: 'var(--stop)', marginBottom: 12 }}>Rendering Exception Caught</h2>
            <p className="faint" style={{ marginBottom: 20 }}>
              {this.state.error?.message || "An unexpected error occurred while rendering the page."}
            </p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Helpers for safe serialization
function getOutcome(wf) {
  if (!wf) return 'UNKNOWN'
  if (typeof wf.final_outcome === 'string') return wf.final_outcome
  if (typeof wf.final_outcome === 'object' && wf.final_outcome) {
    return wf.final_outcome.outcome || wf.final_outcome.verdict || 'UNKNOWN'
  }
  return wf.status || 'UNKNOWN'
}

function getReason(wf) {
  if (!wf) return ''
  if (typeof wf.final_outcome === 'object' && wf.final_outcome?.reason) {
    return wf.final_outcome.reason
  }
  return wf.status_reason || ''
}

function formatSafe(val) {
  if (val === null || val === undefined) return 'N/A'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'inspect' | 'results'
  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  
  const [recentWorkflows, setRecentWorkflows] = useState([])
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)

  const [unitId, setUnitId] = useState('UNIT-0001')
  const [orgId, setOrgId] = useState('org_demo_alpha')
  
  const [workflow, setWorkflow] = useState(null)
  const [investigation, setInvestigation] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [copied, setCopied] = useState(false)

  const fetchHealth = () => {
    setLoadingHealth(true)
    fetch('http://localhost:8100/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data)
        setLoadingHealth(false)
      })
      .catch(err => {
        console.error("Health check error:", err)
        setLoadingHealth(false)
      })
  }

  const fetchWorkflows = () => {
    setLoadingWorkflows(true)
    fetch('http://localhost:8100/workflows')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecentWorkflows(data)
        }
        setLoadingWorkflows(false)
      })
      .catch(err => {
        console.warn("Recent workflows load error:", err)
        setLoadingWorkflows(false)
      })
  }

  useEffect(() => {
    fetchHealth()
    fetchWorkflows()
    const interval = setInterval(() => {
      fetchHealth()
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const selectWorkflow = async (wf) => {
    setWorkflow(wf)
    setErrorMsg(null)
    setActiveTab('results')
    
    // Attempt to load investigation
    try {
      const invRes = await fetch(`http://localhost:8100/phase2/investigation/${wf.workflow_id}`)
      if (invRes.ok) {
        const invData = await invRes.json()
        setInvestigation(invData)
      } else {
        setInvestigation(null)
      }
    } catch (e) {
      console.warn("Failed to fetch investigation:", e)
      setInvestigation(null)
    }
  }

  const runWorkflow = async (e, targetUnit = null) => {
    if (e && e.preventDefault) e.preventDefault()
    const target = (targetUnit || unitId || '').trim()
    if (!target || !orgId) return

    setUnitId(target)
    setWorkflow(null)
    setInvestigation(null)
    setErrorMsg(null)
    setExecuting(true)
    setActiveTab('results') // Seamlessly switch to Results page immediately!

    try {
      const res = await fetch('http://localhost:8100/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, unit_id: target })
      })
      
      if (!res.ok) {
        throw new Error(`API returned ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      setWorkflow(data)
      fetchWorkflows()

      // Fetch intelligence Phase 2 results
      try {
        const invRes = await fetch(`http://localhost:8100/phase2/investigate/${data.workflow_id}`, {
          method: 'POST',
        })
        if (invRes.ok) {
          const invData = await invRes.json()
          setInvestigation(invData)
        }
      } catch (invErr) {
        console.warn("Phase 2 investigation error:", invErr)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || "Failed to run workflow. Make sure orchestrator is running on port 8100.")
    } finally {
      setExecuting(false)
    }
  }

  const isHealthy = health?.status === 'ok'
  const outcomeStr = getOutcome(workflow)
  const reasonStr = getReason(workflow)

  // Stats calculation
  const totalCount = recentWorkflows.length
  const sealedCount = recentWorkflows.filter(w => getOutcome(w) === 'CLEAN' || getOutcome(w) === 'PASS').length
  const stopCount = recentWorkflows.filter(w => getOutcome(w) === 'EXCEPTION' || getOutcome(w) === 'FAIL').length
  const reviewCount = recentWorkflows.filter(w => getOutcome(w) === 'NEEDS_REVIEW' || getOutcome(w) === 'INCOMPLETE').length

  const copyWorkflowJson = () => {
    if (!workflow) return
    navigator.clipboard.writeText(JSON.stringify(workflow, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>

      <header>
        <div className="container">
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); setActiveTab('dashboard') }}>
            <span className="logo-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/>
                <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
              </svg>
            </span>
            System Orchestrator
          </a>

          <nav id="mainNav" aria-label="Main">
            <a 
              href="#dashboard" 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={(e) => { e.preventDefault(); setActiveTab('dashboard') }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
              </svg>
              Dashboard
            </a>
            
            <a 
              href="#inspect" 
              className={activeTab === 'inspect' ? 'active' : ''} 
              onClick={(e) => { e.preventDefault(); setActiveTab('inspect') }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              New Inspection
            </a>

            <a 
              href="#results" 
              className={activeTab === 'results' ? 'active' : ''} 
              onClick={(e) => { e.preventDefault(); setActiveTab('results') }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              Results {workflow ? `(${workflow.subject_id || 'Active'})` : ''}
            </a>

            <div className="org-switch">
              <label>Org</label>
              <input 
                value={orgId} 
                onChange={e => setOrgId(e.target.value)} 
                spellCheck="false" 
                autoComplete="off" 
                placeholder="org_..." 
              />
            </div>

            <a className="health" href="#" onClick={(e) => { e.preventDefault(); fetchHealth() }} title="Refresh API health">
              <span className={`dot ${isHealthy ? 'ok' : 'down'}`}></span>
              <span id="healthText">{loadingHealth ? 'API...' : (isHealthy ? 'API OK' : 'DEGRADED')}</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        <div className="container">

          {/* Operating Rules Banner matching Pack Manager */}
          <div className="bench-rules" aria-label="Operating rules" style={{display: 'flex', gap: '20px', padding: '14px 20px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--ink-100)', marginBottom: '24px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-400)', flexWrap: 'wrap'}}>
            <span>100% Deterministic Final Output</span>
            <span>Multi-Agent Intelligent Reasoning</span>
            <span>Breeth Intent Memory Active</span>
            <span>Isolated Tenancy ({orgId})</span>
          </div>

          {/* =========================================================================
              VIEW 1: DASHBOARD
              ========================================================================= */}
          {activeTab === 'dashboard' && (
            <>
              <div className="page-head">
                <div className="page-head-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <span className="eyebrow">Production Engine</span>
                    <h1>Orchestration Dashboard</h1>
                    <p>End-to-end multi-agent pipeline monitoring and audit control. Orchestrates Receiving, Prep, Pack, Returns, and Recovery.</p>
                  </div>
                  <button 
                    className="btn btn-primary btn-lg" 
                    onClick={() => setActiveTab('inspect')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{marginRight: 8}}>
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    New Inspection
                  </button>
                </div>
              </div>

              {/* KPI Stat Cards matching Pack Manager */}
              <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="stat">
                  <div className="stat-label">Total Inspections</div>
                  <div className="stat-value">{loadingWorkflows ? '—' : totalCount}</div>
                  <div className="stat-sub">in tenant {orgId}</div>
                </div>
                <div className="stat is-seal">
                  <div className="stat-label">Sealed / Clean</div>
                  <div className="stat-value">{loadingWorkflows ? '—' : sealedCount}</div>
                  <div className="stat-sub">passed all stages</div>
                </div>
                <div className="stat is-stop">
                  <div className="stat-label">Stop &amp; Fix</div>
                  <div className="stat-value">{loadingWorkflows ? '—' : stopCount}</div>
                  <div className="stat-sub">exceptions detected</div>
                </div>
                <div className="stat is-uncertain">
                  <div className="stat-label">Needs Review</div>
                  <div className="stat-value">{loadingWorkflows ? '—' : reviewCount}</div>
                  <div className="stat-sub">requires human review</div>
                </div>
              </div>

              <div className="grid-sidebar">
                {/* Recent Inspections Table */}
                <div className="card">
                  <div className="card-head" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
                    <h2>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}>
                        <path d="M3 5h18M3 12h18M3 19h18"/>
                      </svg>
                      Recent Workflow Runs
                    </h2>
                    <button className="btn btn-ghost btn-sm" onClick={fetchWorkflows} title="Refresh">
                      Refresh List
                    </button>
                  </div>

                  {loadingWorkflows ? (
                    <div className="loading">
                      <div className="spinner"></div>
                      <div>Loading recent workflows...</div>
                    </div>
                  ) : recentWorkflows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-400)' }}>
                      <p style={{ marginBottom: 12 }}>No workflows recorded yet for this organization.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('inspect')}>
                        Run Your First Inspection
                      </button>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="kv">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--ink-400)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '12px 16px' }}>Target Unit</th>
                            <th style={{ padding: '12px 16px' }}>Route</th>
                            <th style={{ padding: '12px 16px' }}>Outcome</th>
                            <th style={{ padding: '12px 16px' }}>Reason</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentWorkflows.slice(0, 10).map((wf) => {
                            const outcome = getOutcome(wf)
                            const reason = getReason(wf)
                            const isSeal = outcome === 'CLEAN' || outcome === 'PASS'
                            const isStop = outcome === 'EXCEPTION' || outcome === 'FAIL'
                            return (
                              <tr key={wf.workflow_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>
                                  {wf.subject_id}
                                </td>
                                <td style={{ padding: '14px 16px', textTransform: 'uppercase', fontSize: '0.8rem', color: 'var(--ink-300)' }}>
                                  {wf.context?.route || 'FBA'}
                                </td>
                                <td style={{ padding: '14px 16px' }}>
                                  <span className={`badge ${isSeal ? 'badge-seal' : (isStop ? 'badge-stop' : 'badge-uncertain')}`}>
                                    {outcome}
                                  </span>
                                </td>
                                <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--ink-400)', maxWidth: 280 }} className="truncate">
                                  {reason || 'Complete'}
                                </td>
                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                  <button 
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => selectWorkflow(wf)}
                                  >
                                    View Results →
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right Rail: Agent Health */}
                <div className="card">
                  <div className="card-head">
                    <h2>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8, color: 'var(--brand-400)'}}>
                        <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 4v16"/>
                      </svg>
                      Network Health
                    </h2>
                  </div>
                  <p className="hint" style={{marginBottom: 16}}>5-agent decentralized cluster status.</p>
                  
                  {health ? (
                    <div className="table-wrap">
                      <table className="kv">
                        <tbody>
                          {Object.entries(health.agents || {}).map(([name, data]) => (
                            <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 14px', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.8125rem' }}>
                                {name}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <span className={`badge ${data.status === 'ok' ? 'badge-seal' : 'badge-stop'}`}>
                                  {data.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="loading">
                      <div className="spinner"></div>
                      <div>Pinging agents...</div>
                    </div>
                  )}

                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--ink-400)' }}>
                    <div><strong>Flow ID:</strong> {health?.flow || 'standard-v1'}</div>
                    <div style={{ marginTop: 4 }}><strong>System State:</strong> {isHealthy ? '100% Operational' : 'Degraded Fallback Active'}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* =========================================================================
              VIEW 2: NEW INSPECTION / PIPELINE FORM
              ========================================================================= */}
          {activeTab === 'inspect' && (
            <div style={{ maxWidth: 840, margin: '0 auto' }}>
              <div className="page-head">
                <span className="eyebrow">Execution Pipeline</span>
                <h1>Trigger New Inspection</h1>
                <p>Run the complete 5-agent verification sequence for a physical inventory unit. Evaluates intake, prep, packing seals, return anomalies, and financial claims.</p>
              </div>

              <div className="card card-accent" style={{ marginBottom: 24 }}>
                <form onSubmit={runWorkflow}>
                  <div className="form-group">
                    <label>Target Unit ID <span className="req">*</span></label>
                    <input 
                      value={unitId} 
                      onChange={e => setUnitId(e.target.value)} 
                      placeholder="e.g. UNIT-0001" 
                      required 
                      disabled={executing}
                      style={{ fontSize: '1.1rem', padding: '12px 16px' }}
                    />
                    <div className="hint" style={{ marginTop: 8 }}>
                      Select a sample test unit or enter any custom unit ID:
                    </div>
                  </div>

                  {/* Sample Unit Quick-Picks */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0001')}
                      style={{ border: unitId === 'UNIT-0001' ? '1px solid var(--seal)' : undefined }}
                    >
                      <span className="dot ok" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--seal)', marginRight: 6 }}></span>
                      UNIT-0001 (Clean Pass)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0002')}
                      style={{ border: unitId === 'UNIT-0002' ? '1px solid var(--stop)' : undefined }}
                    >
                      <span className="dot down" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--stop)', marginRight: 6 }}></span>
                      UNIT-0002 (Prep Exception)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0003')}
                      style={{ border: unitId === 'UNIT-0003' ? '1px solid var(--uncertain)' : undefined }}
                    >
                      <span className="dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--uncertain)', marginRight: 6 }}></span>
                      UNIT-0003 (Degraded / Review)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0004')}
                    >
                      UNIT-0004
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0005')}
                    >
                      UNIT-0005
                    </button>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg btn-block" 
                    disabled={executing || !unitId}
                  >
                    {executing ? (
                      <>
                        <div className="spinner" style={{width: 18, height: 18, borderWidth: 2, marginRight: 10, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff'}}></div>
                        Executing Complete 5-Agent Flow...
                      </>
                    ) : (
                      "Start Investigation"
                    )}
                  </button>
                </form>
              </div>

              <div className="card">
                <h2>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>
                  </svg>
                  How the Orchestration Flow Runs
                </h2>
                <ol className="flow" style={{ marginTop: 16 }}>
                  <li>
                    <span className="flow-n">1</span>
                    <p><strong>Receiving Agent:</strong> Validates ASN cargo intake and barcode physical identity.</p>
                  </li>
                  <li>
                    <span className="flow-n">2</span>
                    <p><strong>Prep / Inspection Agent:</strong> Performs high-resolution visual quality and packaging analysis.</p>
                  </li>
                  <li>
                    <span className="flow-n">3</span>
                    <p><strong>Pack Manager:</strong> Verifies complete box SKU assembly, label orientation, and sealing.</p>
                  </li>
                  <li>
                    <span className="flow-n">4</span>
                    <p><strong>Returns Agent:</strong> Evaluates customer return grading and defect condition classification.</p>
                  </li>
                  <li>
                    <span className="flow-n">5</span>
                    <p><strong>Recovery &amp; Breeth Intelligence:</strong> Resolves dispute evidence, checks fee schedules, and creates audit dossiers.</p>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 3: RESULTS (NEXT PAGE CONTENT)
              ========================================================================= */}
          {activeTab === 'results' && (
            <div>
              {/* Back & Action Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setActiveTab('inspect')}
                >
                  ← Back to Inspect Form
                </button>
                {workflow && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost btn-sm" onClick={copyWorkflowJson}>
                      {copied ? "✓ Copied JSON!" : "Copy JSON State"}
                    </button>
                    <a 
                      href={`http://localhost:8100/workflows/${workflow.workflow_id}/evidence`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      Export Evidence Bundle ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Error Alert Banner */}
              {errorMsg && (
                <div style={{ padding: '16px 20px', background: 'var(--stop-soft)', border: '1px solid var(--stop-edge)', borderRadius: 'var(--radius)', color: 'var(--stop)', marginBottom: 20 }}>
                  <strong>Execution Error:</strong> {errorMsg}
                </div>
              )}

              {/* Loading State While Executing */}
              {executing && (
                <div className="card card-accent" style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3, margin: '0 auto 20px auto' }}></div>
                  <h2 style={{ justifyContent: 'center', fontSize: '1.4rem', marginBottom: 8 }}>
                    Running Multi-Agent Orchestration
                  </h2>
                  <p className="hint" style={{ fontSize: '1rem', maxWidth: 500, margin: '0 auto 20px auto' }}>
                    Executing pipeline for <strong className="mono" style={{ color: 'var(--brand-300)' }}>{unitId}</strong> under tenant <strong className="mono">{orgId}</strong>...
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '0.85rem', color: 'var(--ink-400)' }}>
                    <span>✓ Receiving</span>
                    <span>→ Prep</span>
                    <span>→ Pack</span>
                    <span>→ Returns</span>
                    <span>→ Recovery (Breeth)</span>
                  </div>
                </div>
              )}

              {/* Empty State If No Workflow Loaded Yet */}
              {!executing && !workflow && !errorMsg && (
                <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <h2 style={{ justifyContent: 'center', marginBottom: 12 }}>No Investigation Selected</h2>
                  <p className="faint" style={{ marginBottom: 20 }}>
                    Enter a target unit ID and click "Start Investigation" to view live multi-agent results.
                  </p>
                  <button className="btn btn-primary" onClick={() => setActiveTab('inspect')}>
                    Go to Inspection Form
                  </button>
                </div>
              )}

              {/* Loaded Workflow Results */}
              {!executing && workflow && (
                <>
                  {/* Prominent Pack Manager Decision Banner */}
                  <div className={`decision-banner ${outcomeStr === 'CLEAN' || outcomeStr === 'PASS' ? 'decision-seal' : (outcomeStr === 'NEEDS_REVIEW' || outcomeStr === 'INCOMPLETE' ? 'decision-uncertain' : 'decision-stop')}`}>
                    <div className="db-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {(outcomeStr === 'CLEAN' || outcomeStr === 'PASS') && <path d="M20 6 9 17l-5-5"/>}
                        {(outcomeStr === 'NEEDS_REVIEW' || outcomeStr === 'INCOMPLETE') && <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>}
                        {outcomeStr !== 'CLEAN' && outcomeStr !== 'PASS' && outcomeStr !== 'NEEDS_REVIEW' && outcomeStr !== 'INCOMPLETE' && <path d="M18 6 6 18M6 6l12 12"/>}
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="db-label">{outcomeStr}</div>
                      <div className="db-sub">{reasonStr || 'Deterministic multi-agent orchestrator decision'}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      <div style={{ color: 'var(--ink-400)' }}>Unit: <strong style={{ color: '#fff' }}>{workflow.subject_id}</strong></div>
                      <div style={{ color: 'var(--ink-400)', marginTop: 4 }}>ID: <span className="mono">{workflow.workflow_id}</span></div>
                    </div>
                  </div>

                  {/* 2-Column Main Results Layout */}
                  <div className="grid-sidebar">
                    <div className="stack">
                      
                      {/* 5-Agent Stage Execution Flow */}
                      <div className="card">
                        <div className="card-head">
                          <h2>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8, color: 'var(--brand-400)'}}>
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            Stage Execution Pipeline
                          </h2>
                        </div>

                        <ul className="flow">
                          {(workflow.stage_results || []).map((stage, i) => {
                            const isCompleted = stage.state === 'completed'
                            const isSkipped = stage.state === 'skipped'
                            const vStr = stage.verdict ? (typeof stage.verdict === 'object' ? (stage.verdict.verdict || JSON.stringify(stage.verdict)) : stage.verdict) : null
                            const oStr = stage.outcome ? (typeof stage.outcome === 'object' ? (stage.outcome.outcome || JSON.stringify(stage.outcome)) : stage.outcome) : null

                            return (
                              <li key={i}>
                                <span className="flow-n">{i + 1}</span>
                                <div>
                                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6}}>
                                    <strong style={{color: '#fff', textTransform: 'uppercase', fontSize: '0.95rem'}}>{stage.stage}</strong>
                                    <div style={{display: 'flex', gap: 8}}>
                                      <span className={`badge ${isCompleted ? 'badge-seal' : (isSkipped ? 'badge-pending' : 'badge-stop')}`}>
                                        {stage.state}
                                      </span>
                                      {vStr && (
                                        <span className={`badge ${vStr === 'PASS' ? 'badge-seal' : (vStr === 'FAIL' ? 'badge-stop' : 'badge-uncertain')}`}>
                                          {vStr}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="faint" style={{ fontSize: '0.85rem' }}>
                                    {isSkipped ? `Skipped: ${stage.skipped_reason || 'Condition not applicable'}` : (oStr ? `Outcome: ${oStr}` : (stage.error || 'Finished cleanly'))}
                                  </p>
                                  {stage.record_id && (
                                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--brand-300)', marginTop: 4 }}>
                                      Evidence Record: {stage.record_id}
                                    </div>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>

                      {/* Immutable Evidence Records Card */}
                      <div className="card">
                        <div className="card-head">
                          <h2>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8}}>
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                            </svg>
                            Evidence Manifest
                          </h2>
                        </div>
                        <p className="hint" style={{ marginBottom: 12 }}>
                          Append-only records with SHA-256 cryptographic verification.
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(workflow.evidence_references || []).map((refId, i) => (
                            <span key={i} className="mono" style={{ padding: '6px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--brand-300)' }}>
                              {refId}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Phase 2 Intelligence & Breeth Reasoning */}
                    <div className="stack">
                      <div className="card card-accent">
                        <div className="card-head">
                          <h2>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8, color: 'var(--brand-400)'}}>
                              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            Phase 2 Intelligence (Breeth)
                          </h2>
                        </div>

                        {investigation ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--ink-400)', display: 'block', fontWeight: 700 }}>AI Reasoner</span>
                                <strong style={{ color: '#fff' }}>Breeth Graph Memory</strong>
                              </div>
                              <span className={`badge ${investigation.ai_used ? 'badge-seal' : 'badge-pending'}`}>
                                {investigation.ai_status || 'DETERMINISTIC'}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                              <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--ink-400)', fontWeight: 700 }}>Decision</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: 4 }}>
                                  {investigation.overall_decision || 'NO_CLAIM'}
                                </div>
                              </div>
                              <div style={{ padding: 12, background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--ink-400)', fontWeight: 700 }}>Claimable USD</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-300)', marginTop: 4 }}>
                                  ${Number(investigation.total_claimable_usd || 0).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {/* Charge Investigations */}
                            {(investigation.charge_investigations || []).length > 0 ? (
                              <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--ink-400)', fontWeight: 700, marginBottom: 8 }}>
                                  Charge Discrepancies
                                </div>
                                {investigation.charge_investigations.map((charge, i) => (
                                  <div key={i} style={{ marginBottom: 12, padding: 12, background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                      <strong style={{ color: 'var(--brand-300)' }}>{charge.charge_type}</strong>
                                      <span className={`badge ${charge.decision === 'CLAIM' ? 'badge-seal' : (charge.decision === 'REVIEW' ? 'badge-uncertain' : 'badge-stop')}`}>
                                        {charge.decision}
                                      </span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--ink-400)', margin: 0 }}>
                                      {formatSafe(charge.final_reason)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: 16 }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--seal)', fontWeight: 600 }}>✓ Zero Fee Discrepancies</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--ink-400)', marginTop: 2 }}>
                                  All upstream carrier and warehouse billing matches the physical evidence ledger.
                                </div>
                              </div>
                            )}

                            {/* Evidence Health & Gaps */}
                            <div>
                              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--ink-400)', fontWeight: 700, marginBottom: 8 }}>
                                Evidence Health
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <span className={`badge ${(investigation.evidence_gaps || []).length === 0 ? 'badge-seal' : 'badge-stop'}`}>
                                  {(investigation.evidence_gaps || []).length === 0 ? 'SUFFICIENT' : 'GAPS FOUND'}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--ink-300)' }}>
                                  {(investigation.evidence_gaps || []).length === 0 ? 'Complete immutable trail' : `${investigation.evidence_gaps.length} missing stage(s)`}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="loading" style={{ padding: '24px 12px' }}>
                            <div className="spinner" style={{ width: 22, height: 22 }}></div>
                            <div>Synthesizing Breeth reasoning...</div>
                          </div>
                        )}
                      </div>

                      {/* Action Trigger Card */}
                      <div className="card">
                        <h2>Run Another Test</h2>
                        <p className="hint" style={{ marginBottom: 14 }}>
                          Choose another physical unit to verify tenant isolation and deterministic branching.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => runWorkflow(null, 'UNIT-0001')}>UNIT-0001 (Clean)</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => runWorkflow(null, 'UNIT-0002')}>UNIT-0002 (Exception)</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => runWorkflow(null, 'UNIT-0003')}>UNIT-0003 (Review)</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('inspect')}>Custom Unit...</button>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </main>

      <footer>
        <div className="container" style={{display: 'flex', justifyContent: 'space-between', padding: '24px 0', color: 'var(--ink-400)', fontSize: '0.8125rem', flexWrap: 'wrap', gap: 12}}>
          <span>System Orchestrator v2.0.0 · Pack Manager Edition</span>
          <span>100% Deterministic Evidence Output · Content SHA-256 Verified</span>
        </div>
      </footer>
    </>
  )
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
