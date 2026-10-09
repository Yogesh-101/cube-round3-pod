import defaultWorkflows from './data/embeddedWorkflows.json'
import defaultInvestigations from './data/embeddedInvestigations.json'

const STORAGE_KEY = 'cube_embedded_custom_workflows'

function getStoredWorkflows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveStoredWorkflow(wf) {
  try {
    const existing = getStoredWorkflows()
    const updated = [wf, ...existing.filter(w => w.workflow_id !== wf.workflow_id)].slice(0, 50)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {
    console.warn('Failed to persist embedded workflow', e)
  }
}

export const embeddedEngine = {
  isEmbedded: true,

  async getHealth() {
    return {
      status: 'ok',
      mode: 'embedded',
      flow: 'standard-v1',
      agents: {
        receiving: { status: 'ok', mode: 'embedded' },
        prep: { status: 'ok', mode: 'embedded' },
        pack: { status: 'ok', mode: 'embedded' },
        returns: { status: 'ok', mode: 'embedded' },
        recovery: { status: 'ok', mode: 'embedded' }
      }
    }
  },

  async listWorkflows(orgId = null) {
    const stored = getStoredWorkflows()
    const all = [...stored, ...defaultWorkflows]
    const seen = new Set()
    const deduplicated = []
    
    for (const wf of all) {
      if (!seen.has(wf.workflow_id)) {
        seen.add(wf.workflow_id)
        if (!orgId || wf.org_id === orgId) {
          deduplicated.push(wf)
        }
      }
    }
    return deduplicated
  },

  async getWorkflow(workflowId) {
    const stored = getStoredWorkflows()
    const found = stored.find(w => w.workflow_id === workflowId) ||
                  defaultWorkflows.find(w => w.workflow_id === workflowId)
    return found || null
  },

  async getInvestigation(workflowId) {
    if (defaultInvestigations[workflowId]) {
      return defaultInvestigations[workflowId]
    }
    // Generate synthetic phase 2 investigation for unknown workflows
    return {
      workflow_id: workflowId,
      subject_id: workflowId.split('-').pop() || 'UNIT-0001',
      org_id: workflowId.includes('bravo') ? 'org_demo_bravo' : 'org_demo_alpha',
      generated_at: new Date().toISOString(),
      overall_recommendation: 'NO_CLAIM',
      total_claimable_usd: 0.00,
      confidence_score: 0.98,
      charge_investigations: [],
      evidence_gaps: [],
      audit_trail: [
        {
          timestamp: new Date().toISOString(),
          step: 'evidence_collection',
          status: 'completed',
          details: 'Gathered immutable physical evidence records.'
        },
        {
          timestamp: new Date().toISOString(),
          step: 'breeth_reasoning',
          status: 'completed',
          details: 'Verified against Breeth episodic memory graph.'
        }
      ]
    }
  },

  async runWorkflow(orgId, unitId) {
    // Artificial small delay to give realistic execution feel
    await new Promise(r => setTimeout(r, 600))

    const cleanUnit = (unitId || 'UNIT-0001').trim()
    const cleanOrg = (orgId || 'org_demo_alpha').trim()
    const targetWfId = `WF-${cleanOrg}-${cleanUnit}`

    // Check if we have an existing template for this unit
    const template = defaultWorkflows.find(w => w.subject_id === cleanUnit) ||
                     defaultWorkflows.find(w => w.workflow_id.includes(cleanUnit))

    let resultWf
    const nowIso = new Date().toISOString()

    if (template) {
      // Clone template with refreshed timestamps & org
      resultWf = JSON.parse(JSON.stringify(template))
      resultWf.workflow_id = targetWfId
      resultWf.org_id = cleanOrg
      resultWf.subject_id = cleanUnit
      resultWf.timestamps = {
        created_at: nowIso,
        updated_at: nowIso,
        completed_at: nowIso
      }
      if (resultWf.final_outcome) {
        resultWf.final_outcome.workflow_id = targetWfId
        resultWf.final_outcome.decided_at = nowIso
      }
    } else {
      // Dynamically generate standard compliant workflow for novel unit
      const unitNum = parseInt(cleanUnit.replace(/\D/g, '') || '1', 10)
      const isMfn = unitNum % 2 === 0
      const route = isMfn ? 'mfn' : 'fba'
      const isReturned = unitNum % 5 === 0

      resultWf = {
        schema_version: '1.0',
        workflow_id: targetWfId,
        flow_id: 'standard-v1',
        org_id: cleanOrg,
        subject_id: cleanUnit,
        context: {
          route,
          returned: isReturned
        },
        status: 'COMPLETED',
        status_reason: 'all required stages finished',
        current_stage: 'recovery',
        previous_stage: isMfn ? 'pack' : 'prep',
        stage_results: [
          {
            stage: 'receiving',
            agent_id: 'receiving-stub@0',
            state: 'completed',
            skipped_reason: null,
            record_id: `RCV-${cleanUnit}`,
            evidence_status: 'completed',
            verdict: 'PASS',
            outcome: 'accept',
            needs_human: false,
            next_step_recommendation: { action: 'continue', reason: 'Intake validated; 0 defects' },
            runs: 1,
            attempts: 1,
            started_at: nowIso,
            finished_at: nowIso,
            duration_ms: 120,
            error: null
          },
          {
            stage: 'prep',
            agent_id: 'prep-stub@0',
            state: isMfn ? 'skipped' : 'completed',
            skipped_reason: isMfn ? "route='mfn' not in ['fba']" : null,
            record_id: isMfn ? null : `PRP-${cleanUnit}`,
            evidence_status: isMfn ? null : 'completed',
            verdict: isMfn ? null : 'PASS',
            outcome: isMfn ? null : 'compliant',
            needs_human: false,
            runs: isMfn ? 0 : 1,
            attempts: isMfn ? 0 : 1,
            duration_ms: isMfn ? null : 150
          },
          {
            stage: 'pack',
            agent_id: 'pack-manager@2',
            state: isMfn ? 'completed' : 'skipped',
            skipped_reason: isMfn ? null : "route='fba' not in ['mfn']",
            record_id: isMfn ? `PCK-${cleanUnit}` : null,
            evidence_status: isMfn ? 'completed' : null,
            verdict: isMfn ? 'PASS' : null,
            outcome: isMfn ? 'seal' : null,
            needs_human: false,
            runs: isMfn ? 1 : 0,
            attempts: isMfn ? 1 : 0,
            duration_ms: isMfn ? 180 : null
          },
          {
            stage: 'returns',
            agent_id: 'returns-manager@1',
            state: isReturned ? 'completed' : 'skipped',
            skipped_reason: isReturned ? null : 'returned=False not in [True]',
            record_id: isReturned ? `RTN-${cleanUnit}` : null,
            verdict: isReturned ? 'PASS' : null,
            outcome: isReturned ? 'restock' : null,
            runs: isReturned ? 1 : 0
          },
          {
            stage: 'recovery',
            agent_id: 'recovery-manager@2',
            state: 'completed',
            skipped_reason: null,
            record_id: `RCY-${cleanUnit}`,
            verdict: isReturned ? 'FAIL' : 'PASS',
            outcome: isReturned ? 'claim_recommended' : 'no_discrepancy',
            runs: 1
          }
        ],
        evidence_references: [`RCV-${cleanUnit}`, isMfn ? `PCK-${cleanUnit}` : `PRP-${cleanUnit}`, `RCY-${cleanUnit}`],
        timestamps: {
          created_at: nowIso,
          updated_at: nowIso,
          completed_at: nowIso
        },
        errors: [],
        overrides: [],
        final_outcome: {
          workflow_id: targetWfId,
          outcome: isReturned ? 'CLAIM_RECOMMENDED' : 'CLEAN',
          verdict: isReturned ? 'FAIL' : 'PASS',
          reason: isReturned ? 'Physical return discrepancies validated upstream.' : '100% compliant flow across intake, packaging, and billing.',
          needs_human: false,
          provisional: false,
          claimable_usd: isReturned ? 2.50 : null,
          contributing_records: [`RCV-${cleanUnit}`, isMfn ? `PCK-${cleanUnit}` : `PRP-${cleanUnit}`],
          effective_verdicts: {
            receiving: 'PASS',
            [isMfn ? 'pack' : 'prep']: 'PASS',
            recovery: isReturned ? 'FAIL' : 'PASS'
          },
          decided_by: 'orchestrator (embedded)',
          decided_at: nowIso
        }
      }
    }

    saveStoredWorkflow(resultWf)
    return resultWf
  },

  async applyOverride(workflowId, { record_id, new_verdict, actor, reason }) {
    const wf = await this.getWorkflow(workflowId)
    if (!wf) throw new Error(`Workflow ${workflowId} not found`)
    
    const override = {
      record_id,
      new_verdict,
      actor: actor || 'operator',
      reason: reason || 'Manual audit override',
      created_at: new Date().toISOString()
    }

    wf.overrides = [...(wf.overrides || []), override]
    if (wf.final_outcome) {
      wf.final_outcome.outcome = new_verdict === 'PASS' ? 'CLEAN' : 'EXCEPTION'
      wf.final_outcome.verdict = new_verdict
      wf.final_outcome.reason = `Override by ${override.actor}: ${override.reason}`
      wf.final_outcome.decided_at = new Date().toISOString()
    }
    saveStoredWorkflow(wf)
    return wf
  },

  async resumeWorkflow(workflowId) {
    const wf = await this.getWorkflow(workflowId)
    if (!wf) throw new Error(`Workflow ${workflowId} not found`)
    wf.status = 'COMPLETED'
    wf.status_reason = 'resumed and concluded'
    saveStoredWorkflow(wf)
    return wf
  }
}
