import { embeddedEngine } from './embeddedEngine'

const API_STORAGE_KEY = 'cube_orchestrator_api_url'
const FORCE_EMBEDDED_KEY = 'cube_force_embedded_mode'

export function getConfiguredApiBase() {
  const custom = localStorage.getItem(API_STORAGE_KEY)
  if (custom && custom.trim()) return custom.trim()
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  // If running locally, default to port 8100
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:8100'
  }
  // If running on a deployed domain (like Vercel), default to relative /api or localhost
  return 'http://localhost:8100'
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

// Timeout fetch helper
async function fetchWithTimeout(resource, options = {}, timeoutMs = 3500) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(resource, {
      ...options,
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
        const res = await fetchWithTimeout(url, {}, 3000)
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
        }, 8000)
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
