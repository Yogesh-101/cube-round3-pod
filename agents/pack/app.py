"""Pack Manager — Round 3 agent entry point.

Maps Agent Input → Round 2 Pack Manager pipeline → Agent Output.
Run:  uvicorn agents.pack.app:app --port 8103
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from shared.utils import sample_data
from shared.utils.records import build_output, build_record, check, pending_output, utcnow
from shared.utils.server import make_app
from shared.utils.stubs import photos

STAGE = "pack"
AGENT_ID = "pack-manager@1"
RUNTIME = Path(__file__).resolve().parent / "runtime"
if str(RUNTIME) not in sys.path:
    sys.path.insert(0, str(RUNTIME))

# Round-2 check_key → Round-3 recommended key
CHECK_KEY_MAP = {
    "items_present": "items_present",
    "quantity_match": "quantities_correct",
    "no_extra_items": "no_extra_items",
    "no_wrong_items": "no_wrong_items",
    "image_quality": "image_quality",
}
VERDICT_MAP = {"pass": "PASS", "fail": "FAIL", "uncertain": "UNCERTAIN"}


def _parse_lines(text: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for part in filter(None, text.split(";")):
        sku, _, qty = part.partition(":")
        out[sku] = out.get(sku, 0) + int(qty or 1)
    return out


def _safe_record_id(request_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "-", request_id)
    return f"PCK-{safe}"


def _resolve_image_paths(request: dict) -> list[str]:
    """Resolve capture refs from Agent Input to local files when present."""
    root = Path(__file__).resolve().parents[2]
    paths: list[str] = []
    for item in request.get("inputs") or []:
        ref = item.get("ref") or item.get("path") or ""
        if not ref:
            continue
        candidates = [
            Path(ref),
            root / ref,
            root / "data" / "input" / ref,
            RUNTIME / ref,
        ]
        for cand in candidates:
            if cand.is_file():
                paths.append(str(cand.resolve()))
                break
    return paths


def _verdict_r3(v: str) -> str:
    return VERDICT_MAP.get(str(v).lower(), str(v).upper())


def _checks_from_decision(decision_checks, evidence_refs: list[str]) -> list[dict]:
    out = []
    for c in decision_checks:
        key = getattr(c.check_key, "value", str(c.check_key))
        mapped = CHECK_KEY_MAP.get(key, key)
        verdict = _verdict_r3(getattr(c.verdict, "value", str(c.verdict)))
        conf = float(c.confidence) if c.confidence is not None else None
        uncertain_reason = None
        if verdict == "UNCERTAIN":
            uncertain_reason = "insufficient_evidence"
            if c.uncertainty and getattr(c.uncertainty, "reason_code", None):
                uncertain_reason = getattr(c.uncertainty.reason_code, "value", str(c.uncertainty.reason_code))
        out.append(
            check(
                mapped,
                verdict,
                conf,
                detail=c.detail or "",
                evidence_refs=evidence_refs or None,
                uncertain_reason=uncertain_reason,
            )
        )
    return out


def _run_decision_on_sample(row: dict, evidence_refs: list[str]):
    """Deterministic path: labelled sample observations → Round 2 decision engine (no VLM)."""
    from app.decision.engine import run_decision_engine
    from app.domain.schemas import ObservedItem, OrderLine

    want = _parse_lines(row["order_lines"])
    got = _parse_lines(row["observed_in_box"])
    expected = [OrderLine(sku=sku, quantity=qty) for sku, qty in want.items()]
    observed = [
        ObservedItem(sku=sku, name=sku, observed_quantity=qty, confidence=1.0, observation_text="sample observation")
        for sku, qty in got.items()
    ]
    result = run_decision_engine(
        expected_lines=expected,
        observed_items=observed,
        image_quality_ok=True,
        model_version="decision-engine@1",
    )
    return result, evidence_refs


def _run_vlm_pipeline(request: dict, row: dict, image_paths: list[str]):
    from app.domain.schemas import Channel, Order, OrderLine
    from app.pipeline import run_inspection

    want = _parse_lines(row["order_lines"])
    channel_raw = (row.get("channel") or "shopify").lower()
    try:
        channel = Channel(channel_raw)
    except ValueError:
        channel = Channel.SHOPIFY

    order = Order(
        order_id=row.get("order_id") or request["subject"]["subject_id"],
        unit_id=request["subject"]["subject_id"],
        org_id=request["subject"]["org_id"],
        channel=channel,
        lines=[OrderLine(sku=sku, quantity=qty) for sku, qty in want.items()],
    )
    inspection = run_inspection(order, image_paths)
    refs = [p for p in image_paths]
    return inspection, refs


def handle(request: dict) -> dict:
    s = request["subject"]
    # Tenant isolation: subject must exist under this org in the pack sample (or raise).
    row = sample_data.row("pack", s["subject_id"], s["org_id"])

    image_paths = _resolve_image_paths(request)
    evidence_refs = [p["ref"] for p in photos(row)]
    model = {
        "name": "gemini+decision-engine",
        "version": "1",
        "provider": "google",
        "calls": 0,
        "cost_usd": 0,
    }

    try:
        if image_paths:
            inspection, refs = _run_vlm_pipeline(request, row, image_paths)
            evidence_refs = refs or evidence_refs
            status = getattr(inspection.status, "value", str(inspection.status))
            if status in ("pending", "pending_review") and not inspection.outcome:
                return pending_output(
                    request,
                    code="vlm_unavailable",
                    message=(inspection.checks[0].detail if inspection.checks else "VLM unavailable"),
                    agent_id=AGENT_ID,
                )
            decision_checks = inspection.checks
            outcome_decision = inspection.outcome.decision.value if inspection.outcome else "stop_and_fix"
            model = {
                "name": "gemini+decision-engine",
                "version": "1",
                "provider": "google",
                "calls": 1,
                "cost_usd": 0,
            }
            confidences = [c.confidence for c in decision_checks if c.confidence is not None]
            confidence = sum(confidences) / len(confidences) if confidences else None
        else:
            # No captures in this request: run the same decision engine on labelled sample observations.
            result, evidence_refs = _run_decision_on_sample(row, evidence_refs)
            decision_checks = result.checks
            outcome_decision = result.decision.value
            model = {
                "name": "decision-engine",
                "version": "1",
                "provider": None,
                "calls": 0,
                "cost_usd": 0,
            }
            confidence = None
    except Exception as exc:  # fail open — never block the line
        return pending_output(request, code="agent_exception", message=str(exc), agent_id=AGENT_ID)

    checks = _checks_from_decision(decision_checks, evidence_refs)
    pack_out = "seal" if outcome_decision == "seal" else "stop_and_fix"
    if any(c["verdict"] == "UNCERTAIN" for c in checks) and all(c["verdict"] != "FAIL" for c in checks):
        pack_out = "pending_review"

    observed = _parse_lines(row["observed_in_box"])
    record = build_record(
        request,
        agent_id=AGENT_ID,
        record_id=_safe_record_id(request["request_id"]),
        captured_at=row.get("captured_at") or utcnow(),
        operator_id=row.get("operator_id"),
        unit_scope="order",
        refs={"order_id": row.get("order_id")},
        checks=checks,
        outcome=pack_out,
        model=model,
        inputs=photos(row) if not image_paths else [{"ref": p, "sha256": None, "kind": "image"} for p in image_paths],
        reason=f"pack-manager {pack_out}; checks={len(checks)}",
        confidence=confidence,
        payload={
            "channel": row.get("channel"),
            "observed_in_box": observed,
            "order_lines": _parse_lines(row["order_lines"]),
            "implementation": "round2-pack-manager",
        },
    )
    return build_output(record)


app = make_app(STAGE, handle, version="1.0.0")
