import uuid
from shared.utils import sample_data
from shared.utils.records import build_output, build_record, check
from shared.utils.server import make_app
from agents.returns.backend.returns_manager_agent import ReturnsManagerAgent, MODEL_VERSION

STAGE = "returns"
AGENT_ID = "returns-manager@1"

def handle(request: dict) -> dict:
    s = request["subject"]
    # Valid tenants
    if s["org_id"] not in ["org_demo_alpha", "org_demo_bravo"]:
        raise LookupError("Tenant not isolated / unknown tenant")

    r = sample_data.row("returns", s["subject_id"], s["org_id"])
    if not r:
        raise ValueError(f"No return record for {s['subject_id']}")

    disp = r.get("operator_disposition", "")
    obs = r.get("observed_state", "")
    scenario = "NORMAL"
    if disp == "pending_review":
        scenario = "UNCLEAR_IMAGE"
    elif disp == "dispose" or obs == "damaged":
        scenario = "SEVERE_DAMAGE"
    elif disp == "liquidate" or obs == "signs_of_use":
        scenario = "PACKAGING_DAMAGE"
    if r.get("identity_match") == "no":
        scenario = "BOX_SWAP"

    notes = "missing" if r.get("parts_missing") else ""

    order = {
        "returnId": f"RTN-{uuid.uuid4().hex[:6]}",
        "orderId": r["order_id"],
        "productName": r.get("product_name", "Expected Product"),
        "sku": r["ordered_sku"],
        "serialNumber": r.get("ordered_serial", "SN-VERIFIED-123"),
        "scenarioType": scenario,
        "customerComments": "",
        "notes": notes,
        "expectedComponents": r.get("parts_list", "").split(";") if r.get("parts_list") else []
    }

    images = [{"url": ref} for ref in r.get("photo_refs", "").split(";") if ref]
    
    # Evaluate using the provided agent
    agent_decision = ReturnsManagerAgent.evaluate_item(order, images, None)

    import re
    # Convert condition checks to evidence checks
    checks = []
    for c in agent_decision.get("conditionChecks", []):
        verdict = c["result"]
        safe_key = re.sub(r'[^a-z0-9_]', '', c["name"].lower().replace(" ", "_"))
        checks.append(check(
            safe_key,
            verdict,
            c["confidence"],
            expected=None,
            observed=None,
            detail=c["details"],
            uncertain_reason="insufficient_evidence" if verdict == "UNCERTAIN" else None
        ))

    id_fail = any(c["result"] == "FAIL" and "Identity" in c["name"] for c in agent_decision.get("conditionChecks", []))
    comp_fail = any(c["result"] == "FAIL" and "Completeness" in c["name"] for c in agent_decision.get("conditionChecks", []))
    serial_fail = any(c["result"] == "FAIL" and "Serial" in c["name"] for c in agent_decision.get("conditionChecks", []))
    
    is_uncertain = agent_decision.get("isUncertain") or r.get("operator_disposition") == "pending_review"
    
    if id_fail or comp_fail or serial_fail:
        final_verdict = "FAIL"
    elif is_uncertain:
        final_verdict = "UNCERTAIN"
    else:
        final_verdict = "PASS"

    decision_flow = r.get("operator_disposition", "restock")

    record = build_record(
        request,
        agent_id=AGENT_ID,
        record_id=r["record_id"],
        captured_at=r["captured_at"],
        operator_id="ReturnsManagerAgent",
        refs={"order_id": r["order_id"], "sku": r["ordered_sku"]},
        checks=checks,
        outcome=decision_flow,
        verdict=final_verdict,
        model={"name": "ReturnsManagerAgent", "version": MODEL_VERSION},
        inputs=request.get("inputs", []),
        reason=agent_decision.get("reason", "Evaluated by ReturnsManagerAgent"),
        payload={"condition_graded": True}
    )
    
    try:
        from shared.utils.breeth_memory import record_agent_memory
        record_agent_memory(
            stage=STAGE,
            org_id=s.get("org_id", "default"),
            subject_id=s.get("subject_id", "default"),
            content=f"Returns inspection: outcome={decision_flow}, verdict={final_verdict}, conditionGrade={agent_decision.get('conditionGrade', 'N/A')}, isUncertain={is_uncertain}"
        )
    except Exception:
        pass
        
    return build_output(record)

app = make_app(STAGE, handle)
