import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  
  const [unitId, setUnitId] = useState('')
  const [orgId, setOrgId] = useState('org_demo_alpha')
  
  const [workflow, setWorkflow] = useState(null)
  const [investigation, setInvestigation] = useState(null)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8100/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data)
        setLoadingHealth(false)
      })
      .catch(err => {
        console.error(err)
        setLoadingHealth(false)
      })
  }, [])

  const runWorkflow = async (e) => {
    e.preventDefault()
    if (!unitId || !orgId) return;
    
    setWorkflow(null)
    setInvestigation(null)
    setExecuting(true)
    try {
      const res = await fetch('http://localhost:8100/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, unit_id: unitId })
      })
      
      if (!res.ok) {
         throw new Error(`API returned ${res.status}`)
      }
      const data = await res.json()
      setWorkflow(data)

      // Fetch intelligence Phase 2 results
      const invRes = await fetch(`http://localhost:8100/phase2/investigate/${data.workflow_id}`, {
        method: 'POST',
      })
      if (invRes.ok) {
         const invData = await invRes.json()
         setInvestigation(invData)
      }
    } catch (err) {
      console.error(err)
      alert("Failed to run workflow. Make sure orchestrator is running on port 8100.")
    } finally {
      setExecuting(false)
    }
  }

  const isHealthy = health?.status === 'ok';

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>

      <header>
        <div className="container">
          <a href="/" className="logo">
              <span className="logo-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/>
                      <path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>
                  </svg>
              </span>
              System Orchestrator
          </a>

          <button className="nav-toggle" type="button" aria-label="Toggle navigation">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
          </button>

          <nav id="mainNav" aria-label="Main">
            <a href="/" className="active" aria-current="page">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                    <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
                </svg>
                Dashboard
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

            <a className="health" href="#" onClick={(e) => e.preventDefault()} title="API health">
                <span className={`dot ${isHealthy ? 'ok' : 'down'}`}></span>
                <span id="healthText">{loadingHealth ? 'API' : (isHealthy ? 'API OK' : 'DEGRADED')}</span>
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        <div className="container">
          
          <div className="page-head">
              <div className="page-head-row">
                  <div>
                      <span className="eyebrow">Production Engine</span>
                      <h1>Orchestration Dashboard</h1>
                      <p>End-to-end integration control across all 5 intelligent agents. Triggers workflow execution and visualizes the finalized intent memory and evidence outcomes.</p>
                  </div>
              </div>
          </div>

          <div className="bench-rules" aria-label="Operating rules" style={{display: 'flex', gap: '20px', padding: '16px 20px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--ink-100)', marginBottom: '24px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-400)'}}>
              <span>100% Deterministic Final Output</span>
              <span>Multi-Agent Intelligent Reasoning</span>
              <span>Breeth Intent Memory Active</span>
              <span>Isolated Tenancy</span>
          </div>

          <div className="grid-sidebar">
            <div className="stack">
              <div className="card card-accent">
                <div className="card-head">
                  <h2>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', color: 'var(--brand-400)'}}>
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Execute Pipeline
                  </h2>
                </div>
                <form onSubmit={runWorkflow}>
                  <div className="form-group">
                    <label>Target Unit ID <span className="req">*</span></label>
                    <input 
                      value={unitId} 
                      onChange={e => setUnitId(e.target.value)} 
                      placeholder="e.g. UNIT-0001" 
                      required 
                      disabled={executing}
                    />
                    <div className="hint">The physical unit tracking identifier to inspect.</div>
                  </div>
                  
                  <button type="submit" className="btn btn-primary btn-block" disabled={executing}>
                    {executing ? (
                      <>
                        <div className="spinner" style={{width: 16, height: 16, borderWidth: 2, marginRight: 8, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff'}}></div>
                        Running Complete Flow...
                      </>
                    ) : (
                       "Start Investigation"
                    )}
                  </button>
                </form>
              </div>

              {workflow && (
                <div className="card">
                  <div className="card-head">
                    <h2>Workflow Details: {workflow.workflow_id}</h2>
                  </div>
                  
                  <div className={`decision-banner ${workflow.final_outcome === 'CLEAN' ? 'decision-seal' : (workflow.final_outcome === 'NEEDS_REVIEW' ? 'decision-uncertain' : 'decision-stop')}`}>
                    <div className="db-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        {workflow.final_outcome === 'CLEAN' && <path d="M20 6 9 17l-5-5"/>}
                        {workflow.final_outcome === 'NEEDS_REVIEW' && <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>}
                        {workflow.final_outcome !== 'CLEAN' && workflow.final_outcome !== 'NEEDS_REVIEW' && <path d="M18 6 6 18M6 6l12 12"/>}
                      </svg>
                    </div>
                    <div>
                      <div className="db-label">{workflow.final_outcome || 'UNKNOWN'}</div>
                      <div className="db-sub">Final Outcome via Orchestrator</div>
                    </div>
                  </div>

                  <ul className="flow">
                    {workflow.stage_results.map((stage, i) => (
                      <li key={i}>
                        <span className="flow-n">{i + 1}</span>
                        <div>
                          <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                            <strong style={{color: 'var(--text)', textTransform: 'uppercase'}}>{stage.stage}</strong>
                            <span className={`badge ${stage.state === 'completed' ? 'badge-seal' : (stage.state === 'skipped' ? 'badge-pending' : 'badge-stop')}`}>
                                {stage.state}
                            </span>
                          </div>
                          <p className="faint">
                            {stage.verdict ? `Verdict: ${stage.verdict}` : `Outcome: ${stage.outcome || 'N/A'}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {investigation && (
                <div className="card card-accent">
                  <div className="card-head">
                    <h2>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', color: 'var(--brand-400)'}}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Phase 2 Intelligence
                    </h2>
                  </div>
                  
                  <div style={{marginBottom: 16}}>
                    <strong style={{display: 'block', marginBottom: 4}}>AI Reasoner (Breeth)</strong>
                    <span className={`badge ${investigation.ai_used ? 'badge-seal' : 'badge-pending'}`}>
                        {investigation.ai_status}
                    </span>
                  </div>

                  {investigation.charge_investigations.map((charge, i) => (
                    <div key={i} style={{marginBottom: 16, padding: 12, background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 8}}>
                        <strong style={{color: 'var(--brand-300)'}}>{charge.charge_type} Charge</strong>
                        <span className={`badge ${charge.decision === 'CLAIM' ? 'badge-seal' : (charge.decision === 'REVIEW' ? 'badge-uncertain' : 'badge-stop')}`}>
                            {charge.decision}
                        </span>
                      </div>
                      <p style={{fontSize: '0.85rem', marginBottom: 8, color: 'var(--ink-400)'}}>
                         {charge.final_reason}
                      </p>
                      
                      {charge.evidence_health && (
                        <div style={{marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12}}>
                           <strong style={{display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: 6}}>Evidence Health</strong>
                           <span className={`badge ${charge.evidence_health.status === 'SUFFICIENT' ? 'badge-seal' : 'badge-stop'}`}>
                             {charge.evidence_health.status}
                           </span>
                           <p style={{fontSize: '0.8rem', color: 'var(--ink-400)', marginTop: 4}}>{charge.evidence_health.details}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {investigation.evidence_gaps && investigation.evidence_gaps.length > 0 && (
                     <div style={{marginTop: 16}}>
                        <strong style={{display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: 8}}>Detected Gaps</strong>
                        {investigation.evidence_gaps.map((gap, i) => (
                           <div key={i} style={{padding: 8, border: '1px solid var(--stop-edge)', background: 'var(--stop-soft)', borderRadius: 'var(--radius-sm)', marginBottom: 8}}>
                              <strong style={{color: 'var(--stop)', fontSize: '0.85rem'}}>{gap.required_stage.toUpperCase()} MISSING</strong>
                              <p style={{fontSize: '0.8rem', margin: '4px 0 0 0', color: 'var(--text)'}}>{gap.reason}</p>
                           </div>
                        ))}
                     </div>
                  )}
                  
                </div>
              )}
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-head">
                    <h2>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px', color: 'var(--brand-400)'}}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M8 4v16"/></svg>
                        Network Health
                    </h2>
                </div>
                <p className="hint" style={{marginBottom: '16px'}}>Live status of the 5-agent system.</p>
                {health ? (
                  <div className="table-wrap">
                    <table className="kv">
                      <tbody>
                        {Object.entries(health.agents || {}).map(([name, data]) => (
                          <tr key={name}>
                            <td style={{textTransform: 'uppercase'}}>{name}</td>
                            <td className="mono">
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
                    <div>Pinging Agents...</div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <footer>
          <div className="container" style={{display: 'flex', justifyContent: 'space-between', padding: '24px 0', color: 'var(--ink-400)', fontSize: '0.8125rem'}}>
              <span>System Orchestrator v2.0.0</span>
              <span className="spacer"></span>
              <span>Evidence schema 1.0.0 · content hash is SHA-256 of the evidence record</span>
          </div>
      </footer>
    </>
  )
}

export default App
