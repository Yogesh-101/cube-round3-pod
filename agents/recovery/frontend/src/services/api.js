const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('recoveryos_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// --- Auth APIs ---
export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function registerUser({ full_name, email, password, confirm_password }) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, email, password, confirm_password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Registration failed');
  }
  return res.json();
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    throw new Error('Unauthorized');
  }
  return res.json();
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    localStorage.removeItem('recoveryos_token');
    localStorage.removeItem('recoveryos_user');
  }
}

// --- Dashboard & Charges APIs ---
export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/dashboard/summary`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch dashboard summary: ${res.statusText}`);
  return res.json();
}

export async function fetchCharges(params = {}) {
  const query = new URLSearchParams();
  if (params.verdict && params.verdict !== 'ALL') {
    query.set('verdict', params.verdict);
  }
  if (params.search) {
    query.set('search', params.search);
  }
  if (params.reason) {
    query.set('reason', params.reason);
  }

  const url = `${API_BASE}/charges${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch charges: ${res.statusText}`);
  return res.json();
}

export async function fetchChargeDetail(chargeId) {
  const res = await fetch(`${API_BASE}/charges/${encodeURIComponent(chargeId)}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch charge detail: ${res.statusText}`);
  return res.json();
}

export async function fetchChargeEvidence(chargeId) {
  const res = await fetch(`${API_BASE}/charges/${encodeURIComponent(chargeId)}/evidence`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch charge evidence: ${res.statusText}`);
  return res.json();
}

export async function fetchAllEvidence(params = {}) {
  const query = new URLSearchParams();
  if (params.evidence_type && params.evidence_type !== 'ALL') {
    query.set('evidence_type', params.evidence_type);
  }
  if (params.search) {
    query.set('search', params.search);
  }
  const url = `${API_BASE}/evidence${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch evidence list: ${res.statusText}`);
  return res.json();
}

export async function assessCharge(chargeId) {
  const res = await fetch(`${API_BASE}/charges/${encodeURIComponent(chargeId)}/assess`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to assess charge: ${res.statusText}`);
  return res.json();
}

export async function assessAllCharges() {
  const res = await fetch(`${API_BASE}/charges/assess-all`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to assess all charges: ${res.statusText}`);
  return res.json();
}

export async function seedDemoData(runAssessments = true) {
  const res = await fetch(`${API_BASE}/demo/seed?run_assessments=${runAssessments}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to seed demo data: ${res.statusText}`);
  return res.json();
}

export async function ingestJson(payload) {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Ingestion failed');
  }
  return res.json();
}

export async function ingestFile(formData) {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'File ingestion failed');
  }
  return res.json();
}

// --- Phase 2 AI APIs ---
export async function investigateChargeWithAI(chargeId) {
  const res = await fetch(`${API_BASE}/ai/charges/${encodeURIComponent(chargeId)}/investigate`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'AI Investigation failed');
  }
  return res.json();
}

export async function fetchAICheck(chargeId) {
  const res = await fetch(`${API_BASE}/ai/charges/${encodeURIComponent(chargeId)}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch AI assessment');
  }
  return res.json();
}

export async function fetchAIStatus() {
  const res = await fetch(`${API_BASE}/ai/status`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch AI status');
  return res.json();
}

// --- Phase 3 Differentiation APIs ---
export async function fetchInvestigationGraph(chargeId) {
  const res = await fetch(`${API_BASE}/charges/${encodeURIComponent(chargeId)}/investigation`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch investigation graph');
  }
  return res.json();
}

export async function fetchEvidenceHealth() {
  const res = await fetch(`${API_BASE}/dashboard/evidence-health`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch evidence health: ${res.statusText}`);
  return res.json();
}

// --- Official Cube Data & Evaluation APIs ---
export async function fetchOfficialStatus() {
  const res = await fetch(`${API_BASE}/official/status`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch official status: ${res.statusText}`);
  return res.json();
}

export async function ingestOfficialData(clearExisting = false) {
  const res = await fetch(`${API_BASE}/official/ingest?clear_existing=${clearExisting}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to ingest official Cube data');
  }
  return res.json();
}

export async function fetchOfficialEvaluation() {
  const res = await fetch(`${API_BASE}/official/evaluation`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch official evaluation: ${res.statusText}`);
  return res.json();
}

export async function simulateEvidenceFeedback({ chargeId, upstreamStage, result = 'PASS', description = null }) {
  const query = new URLSearchParams({
    charge_id: chargeId,
    upstream_stage: upstreamStage,
    result: result
  });
  if (description) {
    query.set('description', description);
  }
  const res = await fetch(`${API_BASE}/feedback/simulate?${query.toString()}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to submit evidence feedback');
  }
  return res.json();
}


