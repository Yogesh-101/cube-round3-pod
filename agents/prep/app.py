"""Prep Manager: agent entry point.

========================  REPLACE ME  ========================
ORGANISER STUB replaying the Round 2 sample CSV.
Member 2: bring your Round 2 Prep Manager here and make `handle()` call it.
Recovery has asked Prep for measured weight and dimensions (payload.measurements);
69% of sample fee lines are weight-tier fees with no upstream evidence (docs/decisions.md, finding F-07).
Run:  uvicorn agents.prep.app:app --port 8102
===============================================================
"""
from shared.utils import sample_data
from shared.utils.records import build_output, build_record, check, utcnow
from shared.utils.server import make_app
from shared.utils.stubs import STUB_MODEL, photos, verdict_from
from shared.utils.omni_agent import evaluate_data

STAGE = "prep"
AGENT_ID = "prep-manager@omni"
from .backend.schemas import PrepInput
from .backend.logic import process_prep

def handle(request: dict) -> dict:
    s = request["subject"]
    
    # DYNAMIC DATA PATH (Hackathon feature)
    case_data = request.get("context", {}).get("case", {})
    if case_data and case_data.get("use_omni"):
        rules = "1. Ensure item is safely packed. 2. Verify prep requirements are met."
        omni_result = evaluate_data(STAGE, case_data, rules)
        
        checks = []
        for c in omni_result.get("checks", []):
            if isinstance(c, dict):
                conf = c.get("confidence")
                conf = float(conf) if conf is not None else None
                checks.append(check(str(c.get("check_key")), str(c.get("verdict")), conf, detail=str(c.get("detail", ""))))
            
        record = build_record(
            request, agent_id=AGENT_ID, record_id=f"PRP-OMNI-{s['subject_id']}", captured_at=utcnow(), operator_id="omni-agent",
            unit_scope="unit", refs={"subject_id": s["subject_id"]},
            checks=checks, outcome=str(omni_result.get("outcome", "unknown")), model={"name": "omni-gemini", "version": "1.0"}, inputs=request.get("inputs", []),
            reason=str(omni_result.get("reason", "")), verdict=str(omni_result.get("verdict", "UNCERTAIN")), payload={"dynamic_data_processed": True}
        )
        return build_output(record)

    # STUB PATH (Backward compatibility)
    r = sample_data.row("prep", s["subject_id"], s["org_id"])
    
    input_data = PrepInput(
        subject_id=s["subject_id"],
        org_id=s["org_id"],
        work_order_id=r["work_order_id"],
        fba_shipment_id=r["fba_shipment_id"],
        sku=r["sku"],
        asin=r["asin"],
        fnsku=r["fnsku"],
        polybag_present_sealed=r["polybag_present_sealed"],
        suffocation_warning=r["suffocation_warning"],
        fnsku_label_placement=r["fnsku_label_placement"],
        original_barcode_covered=r["original_barcode_covered"],
        expiry_date=r["expiry_date"],
        handling_marks=r["handling_marks"],
        prep_price_usd=float(r["prep_price_usd"]),
        operator_id=r["operator_id"],
        photo_refs=[p["ref"] for p in photos(r)],
        captured_at=r["captured_at"]
    )
    
    decision = process_prep(input_data)
    
    record = build_record(
        request, agent_id=AGENT_ID, record_id=r["record_id"], captured_at=input_data.captured_at, operator_id=input_data.operator_id,
        refs={"work_order_id": input_data.work_order_id, "fba_shipment_id": input_data.fba_shipment_id, "sku": input_data.sku,
              "asin": input_data.asin, "fnsku": input_data.fnsku},
        checks=decision.checks, outcome=decision.outcome, model=STUB_MODEL, inputs=photos(r),
        reason=f"backend processed; {sum(c['verdict'] == 'FAIL' for c in decision.checks)} failed check(s)",
        payload={"prep_price_usd": input_data.prep_price_usd, "measurements": None},
    )
    
    try:
        from shared.utils.breeth_memory import record_agent_memory
        record_agent_memory(
            stage=STAGE,
            org_id=s.get("org_id", "default"),
            subject_id=s.get("subject_id", "default"),
            content=f"Prep inspection: outcome={decision.outcome}, fba_shipment_id={input_data.fba_shipment_id}, fnsku={input_data.fnsku}"
        )
    except Exception:
        pass
        
    return build_output(record)


app = make_app(STAGE, handle)
