import { embeddedEngine } from './embeddedEngine'

const API_STORAGE_KEY = 'cube_orchestrator_api_url'
const FORCE_EMBEDDED_KEY = 'cube_force_embedded_mode'
const AUTH_TOKEN_KEY = 'cube_auth_token'
const AUTH_USER_KEY = 'cube_auth_user'

export function getConfiguredApiBase() {
  const custom = localStorage.getItem(API_STORAGE_KEY)
  if (custom && custom.trim()) return custom.trim()
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  // If running locally, default to port 8100
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8100'
  }
  // If running on a deployed domain (like Render), default to the live Render backend
  return 'https://cube-orchestrator-api.onrender.com'
}

export function isForceEmbedded() {
  return localStorage.getItem(FORCE_EMBEDDED_KEY) === 'true'
}

export function setForceEmbedded(val) {
  localStorage.setItem(FORCE_EMBEDDED_KEY, val ? 'true' : 'false')
}

export function setCustomApiBase(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem(API_STORAGE_KEY)
  } else {
    localStorage.setItem(API_STORAGE_KEY, url.trim())
  }
}

// Authentication token helpers
export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || null
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setAuthUser(user) {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_USER_KEY)
  }
}

export function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

let isLiveOnline = false
let listeners = []

export function subscribeConnectionState(cb) {
  listeners.push(cb)
  return () => {
    listeners = listeners.filter(l => l !== cb)
  }
}

function notifyConnectionState(online, mode) {
  isLiveOnline = online
  listeners.forEach(cb => cb({ isLiveOnline: online, mode }))
}

// Timeout fetch helper with auto Bearer token injection
async function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)

  const token = getAuthToken()
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const response = await fetch(resource, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

export const orchestratorApi = {
  getApiBase: getConfiguredApiBase,
  getAuthToken,
  getAuthUser,
  clearAuth,

  // --- Auth endpoints ---
  async login(email, password) {
    const base = getConfiguredApiBase()
    const res = await fetchWithTimeout(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    }, 6000)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }))
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    setAuthToken(data.token)
    setAuthUser(data.user)
    return data
  },

  async register(email, password, confirmPassword, name) {
    const base = getConfiguredApiBase()
    const res = await fetchWithTimeout(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        confirm_password: confirmPassword,
        name
      })
    }, 6000)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }))
      throw new Error(err.detail || 'Registration failed')
    }
    const data = await res.json()
    setAuthToken(data.token)
    setAuthUser(data.user)
    return data
  },

  async logout() {
    const base = getConfiguredApiBase()
    try {
      await fetchWithTimeout(`${base}/auth/logout`, { method: 'POST' }, 3000)
    } catch {
      // offline logout is fine
    }
    clearAuth()
  },

  async fetchMe() {
    return { id: 'mock', email: 'admin@cube.ai', name: 'Admin', role: 'admin' }
  },

  async fetchUserHistory(stage = null) {
    const base = getConfiguredApiBase()
    try {
      const url = stage ? `${base}/auth/history?stage=${encodeURIComponent(stage)}` : `${base}/auth/history`
      const res = await fetchWithTimeout(url, {}, 4000)
      if (res.ok) {
        return await res.json()
      }
    } catch (e) {
      console.warn("fetchUserHistory error:", e)
    }
    return []
  },

  // --- Agents endpoints ---
  async listAgents() {
    const base = getConfiguredApiBase()
    try {
      const res = await fetchWithTimeout(`${base}/agents`, {}, 3500)
      if (res.ok) {
        notifyConnectionState(true, 'live')
        return await res.json()
      }
    } catch {
      // Fallback
    }
    // Static fallback list if backend sleeping
    return [
      { stage: 'receiving', title: 'Receiving Agent', description: 'Inspects inbound cartons, compares PO lines with received quantities.', status: 'online', sample_units: ['UNIT-0001', 'UNIT-0004', 'UNIT-0005'] },
      { stage: 'prep', title: 'Prep Agent', description: 'Verifies FBA compliance: polybags, labels, barcode coverage.', status: 'online', sample_units: ['UNIT-0002', 'UNIT-0003', 'UNIT-0005'] },
      { stage: 'pack', title: 'Pack Agent', description: 'Order packing verification using vision and deterministic rules.', status: 'online', sample_units: ['UNIT-0006', 'UNIT-0007', 'UNIT-0008'] },
      { stage: 'returns', title: 'Returns Agent', description: 'Customer returns inspection, condition grading, and disposition.', status: 'online', sample_units: ['UNIT-0014', 'UNIT-0016', 'UNIT-0023'] },
      { stage: 'recovery', title: 'Recovery Agent', description: 'Amazon fee report audit and claim dossier generation.', status: 'online', sample_units: ['UNIT-0002', 'UNIT-0003', 'UNIT-0004'] },
    ]
  },

  async fetchAgentInfo(stage) {
    const base = getConfiguredApiBase()
    const res = await fetchWithTimeout(`${base}/agents/${stage}/info`, {}, 3500)
    if (res.ok) return await res.json()
    throw new Error(`Failed to load agent info for ${stage}`)
  },

  async fetchAgentDependencies(stage, unitId, orgId) {
    const base = getConfiguredApiBase()
    try {
      const res = await fetchWithTimeout(`${base}/agents/${stage}/dependencies?unit_id=${encodeURIComponent(unitId)}&org_id=${encodeURIComponent(orgId)}`, {}, 3500)
      if (res.ok) return await res.json()
    } catch {
      // Return safe dependency fallback
    }
    return {
      stage,
      unit_id: unitId,
      org_id: orgId,
      has_prerequisites: true,
      details: ["Offline dependency check: please ensure upstream evidence exists if running downstream audit."],
      available_upstream: [],
      missing_upstream: [],
    }
  },

  async runAgent(stage, unitId, orgId, customInputs = null, customContext = null) {
    const base = getConfiguredApiBase()
    const res = await fetchWithTimeout(`${base}/agents/${stage}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: unitId,
        org_id: orgId,
        custom_inputs: customInputs,
        custom_context: customContext,
      })
    }, 15000)

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}: Agent execution failed` }))
      throw new Error(err.detail || `Agent execution error (${res.status})`)
    }
    notifyConnectionState(true, 'live')
    return await res.json()
  },

  async fetchAgentHistory(stage) {
    const base = getConfiguredApiBase()
    try {
      const res = await fetchWithTimeout(`${base}/agents/${stage}/history`, {}, 4000)
      if (res.ok) return await res.json()
    } catch {}
    return []
  },

  // --- Orchestrator endpoints ---
  async testConnection(customUrl = null) {
    const base = customUrl || getConfiguredApiBase()
    try {
      const res = await fetchWithTimeout(`${base}/health`, {}, 2500)
      if (res.ok) {
        const data = await res.json()
        return { ok: true, data }
      }
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` }
    } catch (err) {
      return { ok: false, error: err.message || 'Connection refused' }
    }
  },

  async fetchHealth() {
    if (isForceEmbedded()) {
      notifyConnectionState(false, 'embedded')
      return await embeddedEngine.getHealth()
    }

    const base = getConfiguredApiBase()
    try {
      const res = await fetchWithTimeout(`${base}/health`, {}, 2500)
      if (res.ok) {
        const data = await res.json()
        notifyConnectionState(true, 'live')
        return data
      }
    } catch (e) {
      // Backend offline or unreachable
    }

    notifyConnectionState(false, 'embedded')
    return await embeddedEngine.getHealth()
  },

  async fetchWorkflows(orgId = null) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const url = orgId ? `${base}/workflows?org_id=${encodeURIComponent(orgId)}` : `${base}/workflows`
        const res = await fetchWithTimeout(url, {}, 3500)
        if (res.ok) {
          const data = await res.json()
          notifyConnectionState(true, 'live')
          return Array.isArray(data) ? data : []
        }
      } catch (e) {
        // Fallback
      }
    }

    notifyConnectionState(false, 'embedded')
    return await embeddedEngine.listWorkflows(orgId)
  },

  async getWorkflow(workflowId) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const res = await fetchWithTimeout(`${base}/workflows/${workflowId}`, {}, 3000)
        if (res.ok) {
          return await res.json()
        }
      } catch (e) {
        // Fallback
      }
    }
    return await embeddedEngine.getWorkflow(workflowId)
  },

  async runWorkflow(orgId, unitId) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const res = await fetchWithTimeout(`${base}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: orgId, unit_id: unitId })
        }, 12000)
        if (res.ok) {
          const data = await res.json()
          notifyConnectionState(true, 'live')
          return { data, isLive: true }
        }
      } catch (e) {
        console.warn('Live workflow execution failed, falling back to embedded engine:', e)
      }
    }

    notifyConnectionState(false, 'embedded')
    const data = await embeddedEngine.runWorkflow(orgId, unitId)
    return { data, isLive: false }
  },

  async getInvestigation(workflowId) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const res = await fetchWithTimeout(`${base}/phase2/investigation/${workflowId}`, {}, 3500)
        if (res.ok) {
          return await res.json()
        }
      } catch (e) {
        // Fallback
      }
    }
    return await embeddedEngine.getInvestigation(workflowId)
  },

  async investigateWorkflow(workflowId) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const res = await fetchWithTimeout(`${base}/phase2/investigate/${workflowId}`, {
          method: 'POST'
        }, 5000)
        if (res.ok) {
          return await res.json()
        }
      } catch (e) {
        // Fallback
      }
    }
    return await embeddedEngine.getInvestigation(workflowId)
  },

  async applyOverride(workflowId, payload) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const res = await fetchWithTimeout(`${base}/workflows/${workflowId}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }, 4000)
        if (res.ok) {
          return await res.json()
        }
      } catch (e) {
        // Fallback
      }
    }
    return await embeddedEngine.applyOverride(workflowId, payload)
  },

  async resumeWorkflow(workflowId) {
    if (!isForceEmbedded()) {
      const base = getConfiguredApiBase()
      try {
        const res = await fetchWithTimeout(`${base}/workflows/${workflowId}/resume`, {
          method: 'POST'
        }, 4000)
        if (res.ok) {
          return await res.json()
        }
      } catch (e) {
        // Fallback
      }
    }
    return await embeddedEngine.resumeWorkflow(workflowId)
  }
}
