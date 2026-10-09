"""Claim Dossier Generation.

Generates structured, traceable claim dossiers from validated charge investigations.
Only created when deterministic validation confirms a claim.
"""
from __future__ import annotations

from .schemas import ChargeInvestigation, ClaimDossier


def build_claim_dossier(investigation: ChargeInvestigation) -> ClaimDossier:
    """Build a structured claim dossier from a verified charge investigation.
    
    This function should only be called if investigation.decision == "CLAIM".
    """
    if investigation.decision != "CLAIM":
        raise ValueError("Cannot build a claim dossier for a non-CLAIM decision.")
        
    dossier = ClaimDossier(
        workflow_id=investigation.workflow_id,
        subject_id=investigation.subject_id,
        org_id="UNKNOWN",  # Will be populated by runner
        charge_id=investigation.charge_id,
        charge_type=investigation.charge_type,
        charge_amount_usd=investigation.amount_usd,
        decision=investigation.decision,
        claimable_amount_usd=investigation.amount_usd,
        evidence_ids=investigation.retrieved_evidence_ids,
        reasoning=investigation.final_reason,
        confidence=investigation.final_confidence,
        deterministic_validated=True,
    )
    
    # AI additions if present
    if investigation.ai_reasoning:
        dossier.evidence_summary = investigation.ai_reasoning.reasoning_summary
        dossier.missing_evidence = investigation.ai_reasoning.missing_evidence
        dossier.contradictions = investigation.ai_reasoning.contradictions
        dossier.recommended_action = investigation.ai_reasoning.recommended_action
    else:
        dossier.evidence_summary = investigation.deterministic_reason
        dossier.recommended_action = "claim"
        
    # Make sure we explicitly list the evidence that triggered the claim
    if investigation.deterministic_evidence_ids:
        # Move the directly contradicting evidence to the top
        for eid in investigation.deterministic_evidence_ids:
            if eid in dossier.evidence_ids:
                dossier.evidence_ids.remove(eid)
                dossier.evidence_ids.insert(0, eid)
            else:
                dossier.evidence_ids.insert(0, eid)
                
    return dossier
