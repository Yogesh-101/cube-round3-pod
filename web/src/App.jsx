import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import './App.css'
import { 
  orchestratorApi, 
  getConfiguredApiBase, 
  setCustomApiBase, 
  isForceEmbedded, 
  setForceEmbedded,
  subscribeConnectionState 
} from './apiClient'
<<<<<<< HEAD
import WorkflowStudio from './WorkflowStudio'
=======
import AgentWorkspace from './components/AgentWorkspace'
import AuthModal from './components/AuthModal'
>>>>>>> 68bf0176cf2b9bea0e8baadf7c934899b770cb63

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

function formatDuration(ms) {
  if (!ms && ms !== 0) return null
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function App({ defaultMode = 'dashboard' }) {
  const navigate = useNavigate()
  const { stage: urlStage } = useParams()
  const [activeTab, setActiveTab] = useState(defaultMode === 'agents' || urlStage ? 'agents' : 'dashboard') // 'dashboard' | 'agents' | 'inspect' | 'results'
  const [selectedAgentStage, setSelectedAgentStage] = useState(urlStage || 'receiving')
  const [currentUser, setCurrentUser] = useState(orchestratorApi.getAuthUser())
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState('login')
  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [engineMode, setEngineMode] = useState('detecting') // 'live' | 'embedded' | 'detecting'
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [customApiUrlInput, setCustomApiUrlInput] = useState(getConfiguredApiBase())
  const [testResult, setTestResult] = useState(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [forceEmbeddedMode, setForceEmbeddedModeState] = useState(isForceEmbedded())
  
  const [recentWorkflows, setRecentWorkflows] = useState([])
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)

  const [unitId, setUnitId] = useState('UNIT-0001')
  const [orgId, setOrgId] = useState('org_demo_alpha')
  
  const [workflow, setWorkflow] = useState(null)
  const [investigation, setInvestigation] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  
  // UX enhancement states
  const [quickUnit, setQuickUnit] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const [tableFilter, setTableFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedStages, setExpandedStages] = useState({})

  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3200)
  }

  const copyToClipboard = (text, successMsg = "Copied to clipboard!") => {
    if (!text) return
    navigator.clipboard.writeText(text)
    showToast(successMsg, 'seal')
  }

  const toggleStage = (idx) => {
    setExpandedStages(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }))
  }

  const fetchHealth = async () => {
    setLoadingHealth(true)
    try {
      const data = await orchestratorApi.fetchHealth()
      setHealth(data)
      setEngineMode(data.mode === 'embedded' ? 'embedded' : 'live')
    } catch (err) {
      console.error("Health check error:", err)
      setEngineMode('embedded')
    } finally {
      setLoadingHealth(false)
    }
  }

  const fetchWorkflows = async (targetOrg = null) => {
    setLoadingWorkflows(true)
    try {
      const data = await orchestratorApi.fetchWorkflows(targetOrg || orgId)
      if (Array.isArray(data)) {
        setRecentWorkflows(data)
      }
    } catch (err) {
      console.warn("Recent workflows load error:", err)
    } finally {
      setLoadingWorkflows(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    fetchWorkflows()
    const unsubscribe = subscribeConnectionState(({ isLiveOnline, mode }) => {
      setEngineMode(mode)
    })
    const interval = setInterval(() => {
      fetchHealth()
    }, 15000)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [orgId])

  useEffect(() => {
    orchestratorApi.fetchMe().then(user => {
      if (user) setCurrentUser(user)
    })
  }, [])

  useEffect(() => {
    if (urlStage) {
      setSelectedAgentStage(urlStage)
      setActiveTab('agents')
    }
  }, [urlStage])

  const selectWorkflow = async (wf) => {
    setWorkflow(wf)
    setErrorMsg(null)
    setActiveTab('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // Attempt to load investigation
    try {
      const invData = await orchestratorApi.getInvestigation(wf.workflow_id)
      setInvestigation(invData)
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
    setQuickUnit('')
    setWorkflow(null)
    setInvestigation(null)
    setErrorMsg(null)
    setExecuting(true)
    setActiveTab('results')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showToast(`Launching multi-agent pipeline for ${target}...`, 'info')

    try {
      const { data, isLive } = await orchestratorApi.runWorkflow(orgId, target)
      setWorkflow(data)
      setEngineMode(isLive ? 'live' : 'embedded')
      fetchWorkflows()
      const outcome = getOutcome(data)
      showToast(
        `Finished execution for ${target}: ${outcome} (${isLive ? 'Live API' : 'Embedded Engine'})`, 
        outcome === 'CLEAN' || outcome === 'PASS' ? 'seal' : (outcome === 'EXCEPTION' ? 'stop' : 'warn')
      )

      // Fetch intelligence Phase 2 results
      try {
        const invData = await orchestratorApi.investigateWorkflow(data.workflow_id)
        setInvestigation(invData)
      } catch (invErr) {
        console.warn("Phase 2 investigation error:", invErr)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || "Failed to run workflow.")
      showToast(err.message || "Workflow execution failed", 'stop')
    } finally {
      setExecuting(false)
    }
  }

  const exportEvidence = () => {
    if (!workflow) return
    const bundleData = {
      workflow,
      investigation,
      exported_at: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(bundleData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-${workflow.workflow_id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast("Downloaded complete evidence bundle JSON", "seal")
  }

  const isHealthy = health?.status === 'ok'
  const outcomeStr = getOutcome(workflow)
  const reasonStr = getReason(workflow)

  // Stats calculation
  const totalCount = recentWorkflows.length
  const sealedCount = recentWorkflows.filter(w => getOutcome(w) === 'CLEAN' || getOutcome(w) === 'PASS').length
  const stopCount = recentWorkflows.filter(w => getOutcome(w) === 'EXCEPTION' || getOutcome(w) === 'FAIL').length
  const reviewCount = recentWorkflows.filter(w => getOutcome(w) === 'NEEDS_REVIEW' || getOutcome(w) === 'INCOMPLETE').length

  // Filtered workflows for dashboard
  const filteredWorkflows = recentWorkflows.filter(wf => {
    const outcome = getOutcome(wf)
    const matchesFilter = 
      tableFilter === 'ALL' ? true :
      tableFilter === 'CLEAN' ? (outcome === 'CLEAN' || outcome === 'PASS') :
      tableFilter === 'EXCEPTION' ? (outcome === 'EXCEPTION' || outcome === 'FAIL') :
      tableFilter === 'REVIEW' ? (outcome === 'NEEDS_REVIEW' || outcome === 'INCOMPLETE') : true

    const query = searchQuery.toLowerCase().trim()
    if (!query) return matchesFilter

    const matchesQuery = 
      (wf.subject_id || '').toLowerCase().includes(query) ||
      (wf.workflow_id || '').toLowerCase().includes(query) ||
      (getReason(wf) || '').toLowerCase().includes(query) ||
      (wf.context?.route || '').toLowerCase().includes(query)

    return matchesFilter && matchesQuery
  })

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

          {/* Mobile hamburger toggle */}
          <button 
            type="button" 
            className="nav-toggle" 
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileNavOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <nav id="mainNav" className={mobileNavOpen ? 'open' : ''} aria-label="Main">
            <a 
              href="/" 
              onClick={(e) => { 
                e.preventDefault()
                navigate('/')
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              Home
            </a>

            <a 
              href="#dashboard" 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={(e) => { 
                e.preventDefault()
                setActiveTab('dashboard')
                setMobileNavOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
              </svg>
              Dashboard
            </a>

            <a 
              href="#agents" 
              className={activeTab === 'agents' ? 'active' : ''} 
              onClick={(e) => { 
                e.preventDefault()
                setActiveTab('agents')
                setMobileNavOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              5 Agents Mode
            </a>
            
            <a 
              href="#inspect" 
              className={activeTab === 'inspect' ? 'active' : ''} 
              onClick={(e) => { 
                e.preventDefault()
                setActiveTab('inspect')
                setMobileNavOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              Pipeline Run
            </a>

            <a 
              href="#studio" 
              className={activeTab === 'studio' ? 'active' : ''} 
              onClick={(e) => { 
                e.preventDefault()
                setActiveTab('studio')
                setMobileNavOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              Omni Studio
            </a>

            <a 
              href="#results" 
              className={activeTab === 'results' ? 'active' : ''} 
              onClick={(e) => { 
                e.preventDefault()
                setActiveTab('results')
                setMobileNavOpen(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              Results {workflow ? `(${workflow.subject_id || 'Active'})` : ''}
            </a>

            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--brand-300)', fontWeight: 600 }}>
                  👤 {currentUser.name || currentUser.email.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await orchestratorApi.logout()
                    setCurrentUser(null)
                    showToast('Logged out successfully', 'info')
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--edge)',
                    borderRadius: '6px',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('login')
                    setShowAuthModal(true)
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    padding: '5px 10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalMode('register')
                    setShowAuthModal(true)
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.8rem', padding: '5px 10px' }}
                >
                  Register
                </button>
              </div>
            )}

            <div className="org-switch">
              <label>Org</label>
              <input 
                value={orgId} 
                onChange={e => setOrgId(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    fetchWorkflows(e.target.value)
                    showToast(`Switched active tenant to ${e.target.value}`, 'info')
                  }
                }}
                spellCheck="false" 
                autoComplete="off" 
                placeholder="org_..." 
                title="Press Enter to filter by tenant org"
              />
            </div>

            <button 
              type="button"
              className="health" 
              onClick={(e) => { e.preventDefault(); setShowSettingsModal(true) }} 
              title={engineMode === 'live' ? "Connected to live backend. Click to manage connection." : "Backend offline — running on embedded orchestrator engine. Click to configure."}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <span className={`dot ${engineMode === 'live' ? 'ok' : ''}`} style={engineMode === 'embedded' ? { background: '#38bdf8' } : {}}></span>
              <span id="healthText" style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em' }}>
                {loadingHealth ? 'CONNECTING...' : (engineMode === 'live' ? 'LIVE API' : 'DEMO ENGINE')}
              </span>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
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

              {/* KPI Stat Cards */}
              <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="stat">
                  <div className="stat-label">Total Inspections</div>
                  <div className="stat-value">{loadingWorkflows ? '—' : totalCount}</div>
                  <div className="stat-sub">recorded runs</div>
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

              {/* FIVE INDEPENDENT AGENT WORKSPACES CARDS */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <span className="eyebrow" style={{ color: 'var(--brand-400)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Modular Architecture</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                      Five Independent Agent Workspaces
                    </h2>
                    <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      Execute, test, and inspect individual agents in isolation without running upstream or downstream stages.
                    </p>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSelectedAgentStage('receiving'); setActiveTab('agents'); }}
                  >
                    Open Workspace Hub ▶
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                  {[
                    { stage: 'receiving', icon: '📥', title: 'Receiving Agent', desc: 'Dock Intake & PO Shortfall Verification', tag: 'Stage 1' },
                    { stage: 'prep', icon: '📦', title: 'Prep Agent', desc: 'Amazon FBA Polybag & Barcode Prep', tag: 'Stage 2' },
                    { stage: 'pack', icon: '📦', title: 'Pack Agent', desc: 'MFN Order-Blind Vision & Seal Verification', tag: 'Stage 3' },
                    { stage: 'returns', icon: '🔄', title: 'Returns Agent', desc: 'Customer Return Grading & Restock Disposition', tag: 'Stage 4' },
                    { stage: 'recovery', icon: '💰', title: 'Recovery Agent', desc: 'Amazon Fee Audit & Claim Dossier Builder', tag: 'Stage 5' },
                  ].map((ag) => (
                    <div 
                      key={ag.stage}
                      className="card"
                      style={{
                        padding: '18px',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                        border: '1px solid var(--edge)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                      onClick={() => {
                        setSelectedAgentStage(ag.stage)
                        setActiveTab('agents')
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--brand-500)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--edge)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '1.6rem' }}>{ag.icon}</span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: 'var(--surface3)', color: 'var(--brand-300)', fontWeight: 700 }}>
                          {ag.tag}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
                        {ag.title}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.45, flex: 1 }}>
                        {ag.desc}
                      </p>
                      <span style={{ fontSize: '0.78rem', color: 'var(--brand-400)', fontWeight: 600 }}>
                        Run Independently →
                      </span>
                    </div>
                  ))}
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
                    <button className="btn btn-ghost btn-sm" onClick={() => fetchWorkflows()} title="Refresh">
                      Refresh List
                    </button>
                  </div>

                  {/* Filter and Search Bar */}
                  <div className="filter-bar">
                    <div className="filter-chips">
                      <button 
                        type="button" 
                        className={`filter-chip ${tableFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTableFilter('ALL')}
                      >
                        All ({recentWorkflows.length})
                      </button>
                      <button 
                        type="button" 
                        className={`filter-chip ${tableFilter === 'CLEAN' ? 'active' : ''}`}
                        onClick={() => setTableFilter('CLEAN')}
                      >
                        Clean ({sealedCount})
                      </button>
                      <button 
                        type="button" 
                        className={`filter-chip ${tableFilter === 'EXCEPTION' ? 'active' : ''}`}
                        onClick={() => setTableFilter('EXCEPTION')}
                      >
                        Exceptions ({stopCount})
                      </button>
                      <button 
                        type="button" 
                        className={`filter-chip ${tableFilter === 'REVIEW' ? 'active' : ''}`}
                        onClick={() => setTableFilter('REVIEW')}
                      >
                        Review ({reviewCount})
                      </button>
                    </div>

                    <input 
                      type="text"
                      className="table-search-input"
                      placeholder="Filter unit or reason..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {loadingWorkflows ? (
                    <div className="loading">
                      <div className="spinner"></div>
                      <div>Loading recent workflows...</div>
                    </div>
                  ) : filteredWorkflows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-400)' }}>
                      <p style={{ marginBottom: 12 }}>
                        {recentWorkflows.length === 0 ? "No workflows recorded yet." : "No workflows matched your search filter."}
                      </p>
                      {recentWorkflows.length === 0 ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('inspect')}>
                          Run Your First Inspection
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setTableFilter('ALL'); setSearchQuery('') }}>
                          Clear Filters
                        </button>
                      )}
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
                          {filteredWorkflows.slice(0, 15).map((wf) => {
                            const outcome = getOutcome(wf)
                            const reason = getReason(wf)
                            const isSeal = outcome === 'CLEAN' || outcome === 'PASS'
                            const isStop = outcome === 'EXCEPTION' || outcome === 'FAIL'
                            return (
                              <tr 
                                key={wf.workflow_id} 
                                className="row-link"
                                onClick={() => selectWorkflow(wf)}
                                title="Click to view detailed audit trail"
                              >
                                <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>
                                  <span className="mono">{wf.subject_id}</span>
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
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      selectWorkflow(wf)
                                    }}
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
                    <div style={{ marginTop: 4 }}>
                      <strong>System State:</strong> {engineMode === 'live' ? '100% Operational (Live Orchestrator)' : '100% Operational (Embedded Engine)'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* =========================================================================
              VIEW: INDIVIDUAL AGENT WORKSPACES
              ========================================================================= */}
          {activeTab === 'agents' && (
            <AgentWorkspace
              initialStage={selectedAgentStage}
              onSwitchToWorkflow={() => setActiveTab('inspect')}
              showToast={showToast}
            />
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
                      style={{ border: unitId === 'UNIT-0001' ? '1px solid var(--seal)' : undefined, background: unitId === 'UNIT-0001' ? 'rgba(52, 211, 153, 0.1)' : undefined }}
                    >
                      <span className="dot ok" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--seal)', marginRight: 6 }}></span>
                      UNIT-0001 (Clean Pass)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0002')}
                      style={{ border: unitId === 'UNIT-0002' ? '1px solid var(--stop)' : undefined, background: unitId === 'UNIT-0002' ? 'rgba(248, 113, 113, 0.1)' : undefined }}
                    >
                      <span className="dot down" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--stop)', marginRight: 6 }}></span>
                      UNIT-0002 (Prep Exception)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0003')}
                      style={{ border: unitId === 'UNIT-0003' ? '1px solid var(--uncertain)' : undefined, background: unitId === 'UNIT-0003' ? 'rgba(251, 191, 36, 0.1)' : undefined }}
                    >
                      <span className="dot" style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--uncertain)', marginRight: 6 }}></span>
                      UNIT-0003 (Degraded / Review)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0004')}
                      style={{ border: unitId === 'UNIT-0004' ? '1px solid var(--brand-500)' : undefined }}
                    >
                      UNIT-0004
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => setUnitId('UNIT-0005')}
                      style={{ border: unitId === 'UNIT-0005' ? '1px solid var(--brand-500)' : undefined }}
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
              VIEW: OMNI STUDIO
              ========================================================================= */}
          {activeTab === 'studio' && (
            <WorkflowStudio 
              orgId={orgId} 
              onRunComplete={(wf) => {
                setWorkflow(wf);
                setActiveTab('results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }} 
            />
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
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => runWorkflow(null, workflow.subject_id)}
                      disabled={executing}
                      title="Re-run pipeline for this unit"
                    >
                      ↺ Re-run Unit
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => copyToClipboard(JSON.stringify(workflow, null, 2), "Copied full workflow JSON state!")}
                    >
                      Copy JSON State
                    </button>
                    <button 
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={exportEvidence}
                      title="Export complete immutable evidence ledger JSON"
                    >
                      Export Evidence Bundle ⤓
                    </button>
                  </div>
                )}
              </div>

              {/* Error Alert Banner */}
              {errorMsg && (
                <div style={{ padding: '16px 20px', background: 'var(--stop-soft)', border: '1px solid var(--stop-edge)', borderRadius: 'var(--radius)', color: 'var(--stop)', marginBottom: 20 }}>
                  <strong>Execution Notice:</strong> {errorMsg}
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
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '0.85rem', color: 'var(--ink-400)', flexWrap: 'wrap' }}>
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
                      <div style={{ color: 'var(--ink-400)' }}>Unit: <strong style={{ color: '#fff' }} className="mono">{workflow.subject_id}</strong></div>
                      <div style={{ color: 'var(--ink-400)', marginTop: 4 }}>ID: <span className="mono">{workflow.workflow_id}</span></div>
                    </div>
                  </div>

                  {/* Dedicated Results Layout: Left column for Stages/Manifest, Right column for Phase 2 & Test presets */}
                  <div className="results-layout">
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
                          <span className="badge badge-info no-dot" style={{ fontSize: '0.72rem' }}>
                            5 Stages Orchestrated
                          </span>
                        </div>

                        <ul className="flow">
                          {(workflow.stage_results || []).map((stage, i) => {
                            const isCompleted = stage.state === 'completed'
                            const isSkipped = stage.state === 'skipped'
                            const vStr = stage.verdict ? (typeof stage.verdict === 'object' ? (stage.verdict.verdict || JSON.stringify(stage.verdict)) : stage.verdict) : null
                            const oStr = stage.outcome ? (typeof stage.outcome === 'object' ? (stage.outcome.outcome || JSON.stringify(stage.outcome)) : stage.outcome) : null
                            const isExpanded = !!expandedStages[i]
                            const durationText = formatDuration(stage.duration_ms)

                            return (
                              <li key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                                <span className="flow-n">{i + 1}</span>
                                <div style={{ width: '100%', minWidth: 0 }}>
                                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6}}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <strong style={{color: '#fff', textTransform: 'uppercase', fontSize: '0.95rem'}}>{stage.stage}</strong>
                                      {stage.agent_id && (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-400)', fontFamily: 'var(--font-mono)' }}>
                                          @{stage.agent_id}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                                      {durationText && (
                                        <span style={{ fontSize: '0.72rem', color: 'var(--brand-300)', fontFamily: 'var(--font-mono)' }}>
                                          ⚡ {durationText}
                                        </span>
                                      )}
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

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                    <p className="faint" style={{ fontSize: '0.85rem', margin: 0 }}>
                                      {isSkipped ? `Skipped: ${stage.skipped_reason || 'Condition not applicable'}` : (oStr ? `Outcome: ${oStr}` : (stage.error || 'Finished cleanly'))}
                                    </p>
                                    <button 
                                      type="button" 
                                      className="btn-link"
                                      onClick={() => toggleStage(i)}
                                      style={{ fontSize: '0.72rem' }}
                                    >
                                      {isExpanded ? 'Hide Details ▲' : 'Inspect Audit ▼'}
                                    </button>
                                  </div>

                                  {stage.record_id && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>Record:</span>
                                      <button 
                                        type="button"
                                        className="evidence-chip"
                                        onClick={() => copyToClipboard(stage.record_id, `Copied record ${stage.record_id}`)}
                                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                        title="Click to copy record ID"
                                      >
                                        <span>{stage.record_id}</span>
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                      </button>
                                    </div>
                                  )}

                                  {/* Expandable audit payload */}
                                  {isExpanded && (
                                    <div style={{ marginTop: 10, padding: 12, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
                                        <div><span style={{ color: 'var(--ink-400)' }}>Agent ID:</span> <strong className="mono">{stage.agent_id || 'n/a'}</strong></div>
                                        <div><span style={{ color: 'var(--ink-400)' }}>Attempts:</span> <span className="mono">{stage.attempts || 1}</span></div>
                                        <div><span style={{ color: 'var(--ink-400)' }}>Needs Human:</span> <span className="mono">{String(stage.needs_human ?? false)}</span></div>
                                        <div><span style={{ color: 'var(--ink-400)' }}>Evidence Status:</span> <span className="mono">{stage.evidence_status || 'completed'}</span></div>
                                      </div>
                                      {stage.next_step_recommendation && (
                                        <div style={{ marginTop: 6, color: 'var(--brand-300)' }}>
                                          <strong>Recommendation:</strong> {
                                            typeof stage.next_step_recommendation === 'object'
                                              ? `${stage.next_step_recommendation.action || 'Unknown'} - ${stage.next_step_recommendation.reason || ''}`
                                              : stage.next_step_recommendation
                                          }
                                        </div>
                                      )}
                                      {stage.error && (
                                        <div style={{ marginTop: 6, color: 'var(--stop)' }}>
                                          <strong>Error details:</strong> {stage.error}
                                        </div>
                                      )}
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
                          <span className="badge badge-seal no-dot" style={{ fontSize: '0.7rem' }}>
                            SHA-256 Verified
                          </span>
                        </div>
                        <p className="hint" style={{ marginBottom: 14 }}>
                          Append-only records with SHA-256 cryptographic verification. Click any ID to copy:
                        </p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(workflow.evidence_references || []).map((refId, i) => (
                            <button 
                              key={i} 
                              type="button"
                              className="evidence-chip"
                              onClick={() => copyToClipboard(refId, `Copied evidence ref: ${refId}`)}
                              title="Click to copy SHA-256 evidence reference"
                            >
                              <span>{refId}</span>
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Phase 2 Intelligence & Quick Test Presets */}
                    <div className="results-sidebar">
                      <div className="card card-accent">
                        <div className="card-head">
                          <h2>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8, color: 'var(--brand-400)'}}>
                              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            Phase 2 Intelligence (Breeth)
                          </h2>
                          <span className={`badge ${investigation?.ai_used ? 'badge-seal' : 'badge-info'}`}>
                            {investigation?.ai_status || 'DETERMINISTIC'}
                          </span>
                        </div>

                        {investigation ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--ink-400)', display: 'block', fontWeight: 700 }}>AI Reasoner</span>
                                <strong style={{ color: '#fff' }}>Breeth Graph Memory</strong>
                              </div>
                              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--brand-300)' }}>
                                Active
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

                      {/* Clean, Non-Overflowing Test Presets Switcher Card */}
                      <div className="card quick-test-card">
                        <div className="card-head">
                          <h2>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 8, color: 'var(--brand-400)'}}>
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            Run Another Test
                          </h2>
                          <span className="badge badge-info no-dot" style={{ fontSize: '0.7rem' }}>
                            Branch Presets
                          </span>
                        </div>
                        <p className="hint" style={{ marginBottom: 16 }}>
                          Quick-switch physical units to verify tenant isolation, defect trapping, and branch execution.
                        </p>

                        <div className="preset-list">
                          {/* Preset 1: Clean Pass */}
                          <button 
                            type="button"
                            className={`preset-item ${workflow?.subject_id === 'UNIT-0001' ? 'is-active' : ''}`}
                            onClick={() => runWorkflow(null, 'UNIT-0001')}
                            disabled={executing}
                          >
                            <div className="preset-main">
                              <div className="preset-title">
                                <span className="dot ok" />
                                <span className="mono">UNIT-0001</span>
                                <span className="preset-label">Clean Pass</span>
                              </div>
                              <span className="badge badge-seal">PASS</span>
                            </div>
                            <div className="preset-sub">
                              100% compliant flow across intake, prep, and recovery
                            </div>
                          </button>

                          {/* Preset 2: Prep Exception */}
                          <button 
                            type="button"
                            className={`preset-item ${workflow?.subject_id === 'UNIT-0002' ? 'is-active' : ''}`}
                            onClick={() => runWorkflow(null, 'UNIT-0002')}
                            disabled={executing}
                          >
                            <div className="preset-main">
                              <div className="preset-title">
                                <span className="dot down" />
                                <span className="mono">UNIT-0002</span>
                                <span className="preset-label">Prep Exception</span>
                              </div>
                              <span className="badge badge-stop">EXCEPTION</span>
                            </div>
                            <div className="preset-sub">
                              Simulates visual prep defect &amp; stop-and-fix halt
                            </div>
                          </button>

                          {/* Preset 3: Needs Review */}
                          <button 
                            type="button"
                            className={`preset-item ${workflow?.subject_id === 'UNIT-0003' ? 'is-active' : ''}`}
                            onClick={() => runWorkflow(null, 'UNIT-0003')}
                            disabled={executing}
                          >
                            <div className="preset-main">
                              <div className="preset-title">
                                <span className="dot" style={{ background: 'var(--uncertain)' }} />
                                <span className="mono">UNIT-0003</span>
                                <span className="preset-label">Needs Review</span>
                              </div>
                              <span className="badge badge-uncertain">REVIEW</span>
                            </div>
                            <div className="preset-sub">
                              Degraded recovery ledger requiring human adjudication
                            </div>
                          </button>
                        </div>

                        {/* Inline Custom Unit Quick Input */}
                        <div className="quick-custom-box">
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault()
                              if (quickUnit.trim()) {
                                runWorkflow(null, quickUnit.trim())
                              }
                            }}
                            className="quick-unit-form"
                          >
                            <input 
                              type="text"
                              value={quickUnit}
                              onChange={(e) => setQuickUnit(e.target.value)}
                              placeholder="Unit ID (e.g. UNIT-0004)..."
                              className="quick-input"
                              disabled={executing}
                            />
                            <button 
                              type="submit" 
                              className="btn btn-primary btn-sm"
                              disabled={executing || !quickUnit.trim()}
                            >
                              {executing ? '...' : 'Run Unit'}
                            </button>
                          </form>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                            <button 
                              type="button"
                              className="btn-link"
                              onClick={() => setActiveTab('inspect')}
                            >
                              Open Inspection Form →
                            </button>
                            {workflow && (
                              <button
                                type="button"
                                className="btn-link"
                                onClick={() => runWorkflow(null, workflow.subject_id)}
                                title="Re-execute current unit"
                                disabled={executing}
                              >
                                ↺ Re-run Current
                              </button>
                            )}
                          </div>
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

      {/* Floating Toast Notification Container */}
      <div id="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type === 'seal' ? 'is-seal' : (t.type === 'stop' ? 'is-stop' : (t.type === 'warn' ? 'is-uncertain' : ''))}`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Backend Connection Settings Modal */}
      {showSettingsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div className="card" style={{ maxWidth: 520, width: '100%', border: '1px solid var(--border)', background: 'var(--surface1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Backend Connection Settings</h2>
              <button 
                type="button"
                className="btn btn-ghost btn-sm" 
                onClick={() => { setShowSettingsModal(false); setTestResult(null) }}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 18, padding: 12, borderRadius: 'var(--radius-sm)', background: engineMode === 'live' ? 'var(--seal-soft)' : 'var(--surface2)', border: `1px solid ${engineMode === 'live' ? 'var(--seal-edge)' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className={`dot ${engineMode === 'live' ? 'ok' : ''}`} style={engineMode === 'embedded' ? { background: '#38bdf8' } : {}}></span>
                <strong style={{ fontSize: '0.9rem', color: engineMode === 'live' ? 'var(--seal)' : '#38bdf8' }}>
                  {engineMode === 'live' ? 'Connected to Live Orchestrator' : 'Embedded Engine Active (Zero-Config)'}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-400)' }}>
                {engineMode === 'live' 
                  ? 'Requests are routed directly to the live backend server.' 
                  : 'Backend is offline or unreachable on this machine. Running in-browser embedded engine with 14 benchmark workflows, full evidence records, and Phase 2 AI intelligence.'}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-300)', marginBottom: 6 }}>
                Backend API Endpoint URL
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  value={customApiUrlInput} 
                  onChange={e => setCustomApiUrlInput(e.target.value)}
                  placeholder="http://localhost:8100"
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '0.85rem' }}
                />
                <button 
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={testingConnection}
                  onClick={async () => {
                    setTestingConnection(true)
                    setTestResult(null)
                    const res = await orchestratorApi.testConnection(customApiUrlInput)
                    setTestingConnection(false)
                    setTestResult(res)
                    if (res.ok) {
                      setCustomApiBase(customApiUrlInput)
                      setForceEmbedded(false)
                      setForceEmbeddedModeState(false)
                      fetchHealth()
                      fetchWorkflows()
                      showToast('Connected to backend!', 'seal')
                    }
                  }}
                >
                  {testingConnection ? 'Testing...' : 'Test & Connect'}
                </button>
              </div>
              {testResult && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: testResult.ok ? 'var(--seal)' : 'var(--stop)' }}>
                  {testResult.ok ? '✓ Backend reached successfully!' : `✕ Could not reach endpoint (${testResult.error}). Embedded fallback active.`}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--ink-300)' }}>
                <input 
                  type="checkbox" 
                  checked={forceEmbeddedMode} 
                  onChange={e => {
                    const checked = e.target.checked
                    setForceEmbeddedModeState(checked)
                    setForceEmbedded(checked)
                    fetchHealth()
                    fetchWorkflows()
                    showToast(checked ? 'Switched to Demo Engine' : 'Switched to Auto Detection', 'info')
                  }}
                />
                Force Embedded Demo Engine (Ignore remote backend)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCustomApiBase('')
                  setForceEmbedded(false)
                  setForceEmbeddedModeState(false)
                  const def = getConfiguredApiBase()
                  setCustomApiUrlInput(def)
                  fetchHealth()
                  fetchWorkflows()
                  setShowSettingsModal(false)
                  showToast('Reset to default configuration', 'info')
                }}
              >
                Reset Default
              </button>
              <button 
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setCustomApiBase(customApiUrlInput)
                  fetchHealth()
                  fetchWorkflows()
                  setShowSettingsModal(false)
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
        onAuthSuccess={(user) => {
          setCurrentUser(user)
          showToast(`Welcome, ${user.name || user.email}!`, 'seal')
        }}
      />

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
