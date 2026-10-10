"""Receiving Manager: agent entry point.

========================  REPLACE ME  ========================
This file currently contains an ORGANISER STUB that replays the Round 2 sample CSV.
Member 1: bring your Round 2 Receiving Manager here and make `handle()` call it.
Keep the contract: take an Agent Input, return an Agent Output (EVIDENCE-CONTRACT.md).
Run:  uvicorn agents.receiving.app:app --port 8101
===============================================================
"""
from shared.utils import sample_data
from shared.utils.records import build_output, build_record, check, utcnow
from shared.utils.server import make_app
from shared.utils.stubs import STUB_MODEL, photos, verdict_from
from shared.utils.omni_agent import evaluate_data

STAGE = "receiving"
AGENT_ID = "receiving-manager@omni"
from .backend.schemas import ReceivingInput
from .backend.logic import process_receiving

def handle(request: dict) -> dict:
    s = request["subject"]
    
    # DYNAMIC DATA PATH (Hackathon feature)
    case_data = request.get("context", {}).get("case", {})
    if case_data and case_data.get("use_omni"):
        rules = "1. Ensure quantity received matches quantity ordered. 2. Ensure no damage is reported."
        omni_result = evaluate_data(STAGE, case_data, rules)
        
        checks = []
        for c in omni_result.get("checks", []):
            if isinstance(c, dict):
                conf = c.get("confidence")
                conf = float(conf) if conf is not None else None
                checks.append(check(str(c.get("check_key")), str(c.get("verdict")), conf, detail=str(c.get("detail", ""))))
            
        record = build_record(
            request, agent_id=AGENT_ID, record_id=f"RCV-OMNI-{s['subject_id']}", captured_at=utcnow(), operator_id="omni-agent",
            unit_scope="po_line", refs={"subject_id": s["subject_id"]},
            checks=checks, outcome=str(omni_result.get("outcome", "unknown")), model={"name": "omni-gemini", "version": "1.0"}, inputs=request.get("inputs", []),
            reason=str(omni_result.get("reason", "")), verdict=str(omni_result.get("verdict", "UNCERTAIN")), payload={"dynamic_data_processed": True}
        )
        return build_output(record)

    # STUB PATH (Backward compatibility for tests)
    r = sample_data.row("receiving", s["subject_id"], s["org_id"])  # LookupError -> 404 (tenancy)
    
    flags = [f for f in r["quality_flags"].split(";") if f]
    
    input_data = ReceivingInput(
        subject_id=s["subject_id"],
        org_id=s["org_id"],
        po_number=r["po_number"],
        po_line=r["po_line"],
        sku=r["sku"],
        product_title=r["product_title"],
        asin=r["asin"],
        supplier=r["supplier"],
        qty_ordered=int(r["qty_ordered"]),
        qty_received=int(r["qty_received"]),
        cartons_ordered=int(r["cartons_ordered"]),
        cartons_received=int(r["cartons_received"]),
        identity_match=r["identity_match"],
        carton_damage=r["carton_damage"],
        unit_damage=r["unit_damage"],
        quality_flags=flags,
        operator_id=r["operator_id"],
        photo_refs=[p["ref"] for p in photos(r)],
        captured_at=r["captured_at"]
    )
    
    decision = process_receiving(input_data)
    
    record = build_record(
        request, agent_id=AGENT_ID, record_id=r["record_id"], captured_at=input_data.captured_at, operator_id=input_data.operator_id,
        unit_scope="po_line", refs={"po_number": input_data.po_number, "po_line": input_data.po_line, "sku": input_data.sku, "asin": input_data.asin},
        checks=decision.checks, outcome=decision.outcome, model=STUB_MODEL, inputs=photos(r),
        reason=f"backend processed; {sum(c['verdict'] == 'FAIL' for c in decision.checks)} failed check(s)",
        payload={"supplier": input_data.supplier, "qty_ordered": input_data.qty_ordered, "qty_received": input_data.qty_received, "shortfall_units": max(input_data.qty_ordered - input_data.qty_received, 0),
                 "quality_flags": input_data.quality_flags},
    )
    
    try:
        from shared.utils.breeth_memory import record_agent_memory
        record_agent_memory(
            stage=STAGE,
            org_id=s.get("org_id", "default"),
            subject_id=s.get("subject_id", "default"),
            content=f"Receiving inspection: outcome={decision.outcome}, qty_ordered={input_data.qty_ordered}, qty_received={input_data.qty_received}, supplier={input_data.supplier}"
        )
    except Exception:
        pass
        
    return build_output(record)

app = make_app(STAGE, handle)
