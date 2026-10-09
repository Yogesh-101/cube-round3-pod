"""Intelligent Recovery Investigation Runner.

Orchestrates the intelligent investigation workflow for charges:
Charge → Retrieve Evidence → Check Sufficiency → AI Reasoning → Deterministic Validation → Decision.
"""
from __future__ import annotations

from .schemas import ChargeInvestigation, InvestigationResult, EvidenceGap
from .evidence_health import assess_charge_evidence_health, detect_evidence_gaps
from .evidence_retrieval import retrieve_relevant_evidence
from .ai_reasoner import run_charge_reasoning
from .investigation import build_investigation_graph, build_investigation_timeline


def investigate_charge(
    charge: dict,
    subject_id: str,
    org_id: str,
    workflow_id: str,
    all_evidence_records: list[dict],
    overrides: list[dict] = None,
) -> ChargeInvestigation:
    """Investigate a single charge end-to-end."""
    overrides = overrides or []
    charge_id = charge.get("line_id", "")
    charge_type = charge.get("charge_type", "unknown")
    amount_usd = float(charge.get("amount_usd", 0))
    
    inv = ChargeInvestigation(
        charge_id=charge_id,
        charge_type=charge_type,
        amount_usd=amount_usd,
        subject_id=subject_id,
        workflow_id=workflow_id,
        order_id=charge.get("order_id"),
        shipment_id=charge.get("fba_shipment_id"),
        sku=charge.get("sku"),
    )
    
    # 1. Evidence Retrieval
    relevant_evidence = retrieve_relevant_evidence(charge, subject_id, org_id, all_evidence_records)
    inv.retrieved_evidence_ids = [r.get("record_id") for r in relevant_evidence]
    
    # 2. Deterministic Evidence Health
    inv.evidence_health = assess_charge_evidence_health(charge_id, charge_type, relevant_evidence)
    
    # 3. Detect Gaps
    if inv.evidence_health.status != "SUFFICIENT":
        inv.gaps = detect_evidence_gaps([charge], all_evidence_records, subject_id, workflow_id)
        
    # 4. AI Reasoning
    if inv.evidence_health.status != "INSUFFICIENT":
        # Only reason if we have some evidence
        ai_output, ai_status = run_charge_reasoning(charge, relevant_evidence)
        inv.ai_reasoning = ai_output
    else:
        ai_output, ai_status = None, "UNAVAILABLE"
        
    # 5. Deterministic Validation (Phase 1 logic equivalent)
    # The deterministic rule is the absolute safety bound.
    # We do a basic check based on evidence health and presence of FAIL verdicts.
    det_verdict = "SILENT"
    det_reason = ""
    det_evidence_ids = []
    
    def effective_verdict(rec: dict) -> str:
        for override in reversed(overrides):
            if override["supersedes"]["record_id"] == rec["record_id"]:
                return override["new_verdict"]
        return rec.get("decision", {}).get("verdict")
    
    if inv.evidence_health.status == "INSUFFICIENT":
        det_verdict = "SILENT"
        det_reason = "Insufficient evidence to support or contradict the charge."
    else:
        # Match Phase 1 stub semantics
        if charge_type == "inbound_defect_fee":
            prep = next((r for r in relevant_evidence if r.get("stage") == "prep"), None)
            if prep:
                v = effective_verdict(prep)
                if v == "PASS":
                    det_verdict = "CONTRADICTS"
                    det_reason = "Prep evidence shows the unit compliant"
                    det_evidence_ids.append(prep.get("record_id"))
                elif v == "FAIL":
                    det_verdict = "SUPPORTS"
                    det_reason = "Prep evidence shows a defect"
                    det_evidence_ids.append(prep.get("record_id"))
                else:
                    det_verdict = "SILENT"
                    det_reason = "Prep evidence is uncertain"
                    det_evidence_ids.append(prep.get("record_id"))
        elif charge_type == "refund_issued_item_not_returned":
            ret = next((r for r in relevant_evidence if r.get("stage") == "returns"), None)
            if ret and ret.get("checks"):
                v = effective_verdict(ret)
                if v == "PASS":
                    det_verdict = "CONTRADICTS"
                    det_reason = "Returns record shows the right item came back"
                    det_evidence_ids.append(ret.get("record_id"))
                else:
                    det_verdict = "SILENT"
                    det_reason = "Returns evidence is uncertain or fails"
                    det_evidence_ids.append(ret.get("record_id"))
        elif charge_type == "fulfilment_fee_weight_tier":
            det_verdict = "SILENT"
            det_reason = "no measured weight/dimensions upstream (finding F-07)"
        elif charge_type == "lost_inbound":
            det_verdict = "SILENT"
            det_reason = "receiving shortfall is supplier-side, not channel-side loss (finding F-10)"
            
        # Generic fallback if charge type not matched but we have FAIL evidence
        if det_verdict == "SILENT" and not det_reason:
            for rec in relevant_evidence:
                v = effective_verdict(rec)
                if v == "FAIL":
                    det_verdict = "CONTRADICTS"
                    det_reason = f"Evidence {rec.get('record_id')} contradicts the charge."
                    det_evidence_ids.append(rec.get("record_id"))
                    break
                elif v == "PASS":
                    det_verdict = "SUPPORTS"
                    det_reason = f"Evidence {rec.get('record_id')} supports the charge."
                    det_evidence_ids.append(rec.get("record_id"))
                
    inv.deterministic_verdict = det_verdict
    inv.deterministic_reason = det_reason
    inv.deterministic_evidence_ids = det_evidence_ids
    
    # 6. Final Decision (AI constrained by Deterministic)
    if ai_output and ai_output.verdict == "CONTRADICTS" and det_verdict == "CONTRADICTS":
        # AI correctly identified a valid claim
        inv.final_verdict = "CONTRADICTS"
        inv.final_confidence = ai_output.confidence
        inv.final_reason = ai_output.reasoning_summary
        inv.decision = "CLAIM"
    elif det_verdict == "CONTRADICTS":
        # AI missed it, but deterministic says claim (fallback)
        inv.final_verdict = "CONTRADICTS"
        inv.final_confidence = 1.0
        inv.final_reason = det_reason
        inv.decision = "CLAIM"
    elif ai_output and ai_output.verdict == "CONTRADICTS" and det_verdict != "CONTRADICTS":
        # AI hallucinated a claim - override it
        inv.final_verdict = "SILENT" if det_verdict == "SILENT" else "SUPPORTS"
        inv.final_confidence = 1.0
        inv.final_reason = "AI claim rejected by deterministic validation: " + det_reason
        inv.decision = "REVIEW" if det_verdict == "SILENT" else "NO_CLAIM"
    else:
        # Agreement or no claim
        inv.final_verdict = det_verdict
        inv.final_confidence = 1.0
        inv.final_reason = det_reason
        inv.decision = "NO_CLAIM"
        if inv.evidence_health.status == "CONFLICTING":
            inv.decision = "REVIEW"
            
    # Zero dollar claims are SILENT
    if inv.decision == "CLAIM" and inv.amount_usd <= 0:
        inv.final_verdict = "SILENT"
        inv.final_reason = "Amount is 0.00: nothing to claim."
        inv.decision = "NO_CLAIM"
        
    return inv


def run_full_investigation(
    workflow_id: str,
    subject_id: str,
    org_id: str,
    charges: list[dict],
    evidence_records: list[dict],
    workflow_transitions: list[dict] | None = None,
) -> InvestigationResult:
    """Run investigation over all charges in a workflow."""
    result = InvestigationResult(
        workflow_id=workflow_id,
        subject_id=subject_id,
        org_id=org_id,
    )
    
    ai_used_any = False
    ai_failed_any = False
    
    # 1. Investigate each charge
    for charge in charges:
        ci = investigate_charge(charge, subject_id, org_id, workflow_id, evidence_records)
        result.charge_investigations.append(ci)
        if ci.ai_reasoning:
            ai_used_any = True
        else:
            ai_failed_any = True
            
        result.evidence_gaps.extend(ci.gaps)
        
    # 2. Build Claim Dossiers
    from .claim_dossier import build_claim_dossier
    for ci in result.charge_investigations:
        if ci.decision == "CLAIM":
            dossier = build_claim_dossier(ci)
            result.claim_dossiers.append(dossier)
            result.total_claimable_usd += ci.amount_usd
            
    # 3. Overall Decision
    if result.claim_dossiers:
        result.overall_decision = "CLAIM"
    elif any(ci.decision == "REVIEW" for ci in result.charge_investigations):
        result.overall_decision = "REVIEW"
    else:
        result.overall_decision = "NO_CLAIM"
        
    # 4. Graph & Timeline
    result.investigation_graph = build_investigation_graph(
        workflow_id, subject_id, org_id, charges, evidence_records, result.charge_investigations
    )
    result.investigation_timeline = build_investigation_timeline(
        workflow_id, subject_id, charges, evidence_records, workflow_transitions, result.charge_investigations
    )
    
    # 5. Metadata
    result.ai_used = ai_used_any
    if ai_used_any and not ai_failed_any:
        result.ai_status = "AVAILABLE"
    elif ai_used_any:
        result.ai_status = "DEGRADED"
    else:
        result.ai_status = "UNAVAILABLE"
        result.deterministic_fallback_used = True
        
    from .evidence_health import overall_evidence_health_status
    result.overall_evidence_health = overall_evidence_health_status([ci.evidence_health for ci in result.charge_investigations if ci.evidence_health])
    
    return result
