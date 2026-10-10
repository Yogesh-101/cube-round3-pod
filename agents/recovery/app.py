"""Recovery Manager: agent entry point.

========================  REPLACE ME  ========================
ORGANISER STUB. It reads the previous evidence in `request["previous_evidence"]` plus the sample fee report, and
labels each charge CONTRADICTS / SUPPORTS / SILENT. The matching rules below are ILLUSTRATIVE ONLY, not claim
logic. In particular they ignore the open Round 2 findings (docs/decisions.md, F-07 to F-12).
Member 5: bring your Round 2 Recovery Manager here.

Check semantics for Recovery: the condition is "this charge is supported by evidence".
  PASS      evidence supports the charge     -> no claim
  FAIL      evidence contradicts the charge  -> claim
  UNCERTAIN evidence is silent / insufficient -> cannot claim; say why
A wrongly filed claim costs standing with the channel, so SILENT must never become a claim.
Recovery reads the accumulated evidence; it does not rewrite it or the workflow state.
Run:  uvicorn agents.recovery.app:app --port 8105
===============================================================
"""
from shared.utils import sample_data
from shared.utils.records import build_output, build_record, check, utcnow
from shared.utils.server import make_app
from shared.utils.stubs import STUB_MODEL, effective_verdict, previous
from shared.utils.omni_agent import evaluate_data

STAGE = "recovery"
AGENT_ID = "recovery-manager@omni"

from shared.intelligence.investigation_runner import investigate_charge
from shared.intelligence.claim_dossier import build_claim_dossier

def handle(request: dict) -> dict:
    s = request["subject"]

    # DYNAMIC DATA PATH (Hackathon feature)
    case_data = request.get("context", {}).get("case", {})
    if case_data and case_data.get("use_omni"):
        rules = "1. Reconcile evidence against fee lines. 2. Highlight contradictions as claims."
        omni_result = evaluate_data(STAGE, case_data, rules)
        
        checks = []
        for c in omni_result.get("checks", []):
            if isinstance(c, dict):
                conf = c.get("confidence")
                conf = float(conf) if conf is not None else None
                checks.append(check(str(c.get("check_key")), str(c.get("verdict")), conf, detail=str(c.get("detail", ""))))
            
        record = build_record(
            request, agent_id=AGENT_ID, record_id=f"RCY-OMNI-{s['subject_id']}", captured_at=utcnow(), operator_id="omni-agent",
            unit_scope="account", refs={"subject_id": s["subject_id"]},
            checks=checks, outcome=str(omni_result.get("outcome", "unknown")), model={"name": "omni-gemini", "version": "1.0"}, inputs=request.get("inputs", []),
            reason=str(omni_result.get("reason", "")), verdict=str(omni_result.get("verdict", "UNCERTAIN")), payload={"dynamic_data_processed": True}
        )
        return build_output(record)

    # STUB PATH (Backward compatibility)
    if not sample_data.has("receiving", s["subject_id"], s["org_id"]):
        raise LookupError(f"unknown subject {s['subject_id']} in {s['org_id']}")
    
    lines = sample_data.fee_lines(s["subject_id"], s["org_id"])
    evidence_records = request.get("previous_evidence", [])
    overrides = request.get("context", {}).get("overrides", [])
    
    checks, charges, claimable = [], [], 0.0
    workflow_id = request.get("workflow_id", f"WF-{s['org_id']}-{s['subject_id']}")
    
    for line in lines:
        # Run Phase 2 Intelligent Investigation
        inv = investigate_charge(line, s["subject_id"], s["org_id"], workflow_id, evidence_records, overrides)
        
        pos = inv.final_verdict
        why = inv.final_reason
        ids = inv.retrieved_evidence_ids
        amount = inv.amount_usd
        
        verdict = {"CONTRADICTS": "FAIL", "SUPPORTS": "PASS", "SILENT": "UNCERTAIN"}[pos]
        checks.append(check(f"charge_{line['line_id'].lower().replace('-', '_')}", verdict, inv.final_confidence,
                            expected="charge supported by evidence", observed=pos, detail=why,
                            evidence_refs=ids, uncertain_reason="insufficient_evidence"))
                            
        if inv.decision == "CLAIM":
            claimable += amount
            
        charge_data = {
            "line_id": line["line_id"],
            "charge_type": line["charge_type"],
            "amount_usd": amount,
            "position": pos,
            "reason": why,
            "evidence_record_ids": ids,
            "decision": inv.decision,
            "evidence_health": inv.evidence_health.status if inv.evidence_health else "UNKNOWN"
        }
        
        if inv.ai_reasoning:
            charge_data["ai_reasoning"] = inv.ai_reasoning.to_dict()
            
        charges.append(charge_data)
        
    claim = any(c["decision"] == "CLAIM" for c in charges)
    silent = any(c["position"] == "SILENT" for c in charges)
    needs_review = any(c["decision"] == "REVIEW" for c in charges)
    
    verdict = "FAIL" if claim else ("UNCERTAIN" if silent or needs_review else "PASS")
    outcome = "claim_recommended" if claim else ("insufficient_evidence" if silent else "no_claim")
    
    ai_calls = sum(1 for c in charges if "ai_reasoning" in c)
    model = {
        "name": "gemini-recovery-manager",
        "version": "2.0",
        "provider": "google",
        "calls": ai_calls,
        "cost_usd": 0.0
    }
    
    record = build_record(
        request, agent_id=AGENT_ID, record_id=f"RCY-{s['subject_id']}", model=model,
        captured_at=max((l["posted_date"] + "T00:00:00Z" for l in lines), default=utcnow()),
        checks=checks, outcome=outcome, verdict=verdict,
        needs_human=needs_review,
        reason=f"intelligent investigation: {len(charges)} charge(s), {sum(c['decision'] == 'CLAIM' for c in charges)} claim(s)",
        payload={"charges": charges, "claimable_usd": round(claimable, 2),
                 "unclaimable": [c for c in charges if c["decision"] != "CLAIM"]},
    )
    
    try:
        from shared.utils.breeth_memory import record_agent_memory
        record_agent_memory(
            stage=STAGE,
            org_id=s.get("org_id", "default"),
            subject_id=s.get("subject_id", "default"),
            content=f"Recovery investigation: outcome={outcome}, verdict={verdict}, claims_filed={sum(c['decision'] == 'CLAIM' for c in charges)}, total_claimable_usd={round(claimable, 2)}"
        )
    except Exception:
        pass
        
    return build_output(record, next_step="complete")


app = make_app(STAGE, handle)
