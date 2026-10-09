"""Receiving Manager: agent entry point (Round 3).

Wraps the Round 2 Receiving Manager in backend/ behind the Round 3 contract. Two paths:

  * Photos supplied (data/input/<unit>/receiving/*.jpg|png|webp) and a vision key set (AI_API_KEY / OPENAI_API_KEY):
    the order-blind vision model reads the photos (backend/app/services/vision.py), then the deterministic
    decision engine (backend/app/core/decision_engine.py) compares those readings with the PO.
  * Otherwise: the same receiving rules applied to the operator's recorded counts (backend/logic.py).
    The evidence says so honestly: model.name = "receiving-rules", calls = 0, payload.method = "operator_counts".

Fail-open: if the vision model errors, the captures are kept and a pending record goes to human review.
Run:  uvicorn agents.receiving.app:app --port 8101
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from shared.utils import sample_data
from shared.utils.log import get_logger
from shared.utils.records import build_output, build_record, check, pending_output
from shared.utils.server import make_app
from shared.utils.stubs import photos

from .backend.logic import process_receiving
from .backend.schemas import ReceivingInput

STAGE = "receiving"
AGENT_ID = "receiving-manager@2"
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
if str(HERE) not in sys.path:
    sys.path.append(str(HERE))  # the Round 2 backend imports itself as `backend.app...`

logger = get_logger("receiving")

IMAGE_MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
OUTCOME = {"PASS": "accept", "EXCEPTION": "accept_with_exceptions", "UNCERTAIN": "pending_review"}
CHECK_KEY = {"sku_check": "sku_match", "carton_check": "carton_count", "units_per_carton_check": "units_per_carton",
             "quantity_check": "quantity", "variant_check": "variant_match", "damage_check": "damage",
             "component_check": "components"}
UNCERTAIN_REASON = {"NOT_OBSERVED": "insufficient_evidence", "LOW_VISIBILITY": "poor_image",
                    "VIEWS_DISAGREE": "conflicting_evidence", "READINGS_DISAGREE": "conflicting_evidence",
                    "PO_FIELD_MISSING": "rule_unavailable", "PO_INCONSISTENT": "rule_unavailable",
                    "INVALID_READING": "insufficient_evidence"}


def _refs(r: dict) -> dict:
    return {"po_number": r["po_number"], "po_line": r["po_line"], "sku": r["sku"], "asin": r["asin"]}


def _image_inputs(request: dict) -> list[dict]:
    return [i for i in request.get("inputs", []) if Path(i["ref"]).suffix.lower() in IMAGE_MIME]


def _vision_configured() -> bool:
    return bool(os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY"))


# ---------------------------------------------------------------- path 1: photos -> vision model -> rules
def _run_vision(request: dict, r: dict, images_in: list[dict]) -> dict:
    from backend.app.core.config import get_settings
    from backend.app.models.inspection import Inspection, ReceivingImage
    from backend.app.models.po import PurchaseOrder
    from backend.app.services.vision import VisionService

    s = request["subject"]
    input_root = Path(os.environ.get("INPUT_DIR", ROOT / "data" / "input"))
    po = PurchaseOrder(
        po_id=r["po_number"], po_line=r["po_line"], sku=r["sku"], asin=r["asin"] or None, unit_id=r["unit_id"],
        product_name=r["product_title"], variant=r["spec_colour"] or r["spec_variant"] or "unspecified",
        expected_quantity=int(r["qty_ordered"]), expected_cartons=int(r["cartons_ordered"]),
        units_per_carton=max(int(r["units_per_carton_ordered"] or 1), 1),
        expected_components=[c.strip() for c in r["spec_components"].split(";") if c.strip()])
    ref_of = {}
    images = []
    for n, item in enumerate(images_in, 1):
        image_id = f"IMG-{n}"
        ref_of[image_id] = item["ref"]
        path = input_root / item["ref"]
        images.append(ReceivingImage(
            image_id=image_id, inspection_id=r["record_id"], filename=path.name, stored_filename=path.name,
            image_path=str(path), mime_type=IMAGE_MIME[path.suffix.lower()], sha256_digest=item.get("sha256") or ""))
    inspection = Inspection(inspection_id=r["record_id"], organization_id=s["org_id"], po=po, images=images)

    result = VisionService(inspection).analyze()

    image_of_evidence = {e["evidence_id"]: e["image_id"] for e in result["evidence"]}
    checks = []
    for c in result["checks"]:
        if c["status"] == "NOT_REQUIRED":
            continue
        refs = sorted({ref_of[image_of_evidence[e]] for e in c["evidence_ids"] if image_of_evidence.get(e) in ref_of})
        checks.append(check(CHECK_KEY.get(c["check_name"], c["check_name"]), c["status"], c["confidence"],
                            expected=c["expected_value"], observed=c["observed_value"], detail=c["reason"],
                            evidence_refs=refs, uncertain_reason=UNCERTAIN_REASON.get(c["reason_code"], "other")))
    settings = get_settings()
    live = result["model_version"] != "demo"  # DEMO_MODE replays canned readings: no model call happened
    return build_record(
        request, agent_id=AGENT_ID, record_id=r["record_id"], captured_at=r["captured_at"], operator_id=r["operator_id"],
        unit_scope="po_line", refs=_refs(r), checks=checks, outcome=OUTCOME[result["decision"]], inputs=images_in,
        model={"name": result["model_version"], "version": settings.ai_model, "provider": "openai" if live else None,
               "prompt_version": "order-blind-v1", "calls": 1 if live else 0, "cost_usd": None},
        reason=f"vision: {len(images_in)} photo(s) read blind, {sum(c['verdict'] == 'FAIL' for c in checks)} failed check(s)",
        payload={"method": "vision", "qty_ordered": po.expected_quantity, "supplier": r["supplier"],
                 "observations": result["observations"], "readings": result["evidence"]},
    )


# ---------------------------------------------------------------- path 2: operator counts -> rules
def _run_operator_counts(request: dict, r: dict) -> dict:
    s = request["subject"]
    data = ReceivingInput(
        subject_id=s["subject_id"], org_id=s["org_id"], po_number=r["po_number"], po_line=r["po_line"], sku=r["sku"],
        product_title=r["product_title"], asin=r["asin"], supplier=r["supplier"],
        qty_ordered=int(r["qty_ordered"]), qty_received=int(r["qty_received"]),
        cartons_ordered=int(r["cartons_ordered"]), cartons_received=int(r["cartons_received"]),
        identity_match=r["identity_match"], carton_damage=r["carton_damage"], unit_damage=r["unit_damage"],
        quality_flags=[f for f in r["quality_flags"].split(";") if f], operator_id=r["operator_id"],
        photo_refs=[p["ref"] for p in photos(r)], captured_at=r["captured_at"])
    decision = process_receiving(data)
    why = "no receiving photos supplied" if _vision_configured() else "vision model not configured"
    return build_record(
        request, agent_id=AGENT_ID, record_id=r["record_id"], captured_at=data.captured_at, operator_id=data.operator_id,
        unit_scope="po_line", refs=_refs(r), checks=decision.checks, outcome=decision.outcome, inputs=photos(r),
        model={"name": "receiving-rules", "version": "2", "provider": None, "calls": 0, "cost_usd": 0},
        reason=f"{why}; rules applied to the operator's recorded counts, "
               f"{sum(c['verdict'] == 'FAIL' for c in decision.checks)} failed check(s)",
        payload={"method": "operator_counts", "supplier": data.supplier, "qty_ordered": data.qty_ordered,
                 "qty_received": data.qty_received, "shortfall_units": max(data.qty_ordered - data.qty_received, 0),
                 "quality_flags": data.quality_flags},
    )


def handle(request: dict) -> dict:
    s = request["subject"]
    r = sample_data.row("receiving", s["subject_id"], s["org_id"])  # LookupError -> 404 (tenancy)

    images_in = _image_inputs(request)
    if images_in and _vision_configured():
        try:
            record = _run_vision(request, r, images_in)
        except Exception as exc:  # fail-open: keep the captures, send the unit to a person
            logger.warning("vision failed", extra={"ctx": {"subject_id": s["subject_id"], "error": str(exc)[:200]}})
            return pending_output(request, code="model_error", message=f"{type(exc).__name__}: {exc}"[:300],
                                  agent_id=AGENT_ID)
    else:
        record = _run_operator_counts(request, r)

    try:
        from shared.utils.breeth_memory import record_agent_memory
        record_agent_memory(
            stage=STAGE, org_id=s.get("org_id", "default"), subject_id=s.get("subject_id", "default"),
            content=f"Receiving inspection: method={record['payload']['method']}, outcome={record['decision']['outcome']}, "
                    f"verdict={record['decision']['verdict']}")
    except Exception as exc:
        logger.debug("breeth memory skipped: %s", exc)

    return build_output(record)


app = make_app(STAGE, handle)
