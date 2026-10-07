"""Pack Manager — Round 3 agent entry point.

Maps Agent Input → Round 2 Pack Manager pipeline → Agent Output.
Production rules: order-blind VLM, deterministic decide, fail-open, refuse wrong tenant.
Run:  uvicorn agents.pack.app:app --port 8103
"""
from __future__ import annotations

import hashlib
import re
import sys
import time
from pathlib import Path

from shared.utils import sample_data
from shared.utils.log import get_logger
from shared.utils.records import build_output, build_record, check, pending_output, utcnow
from shared.utils.server import make_app
from shared.utils.stubs import photos, previous

STAGE = "pack"
AGENT_ID = "pack-manager@1"
VERSION = "1.0.0"
PROMPT_VERSION = "order-blind-v1"
RUNTIME = Path(__file__).resolve().parent / "runtime"
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(RUNTIME) not in sys.path:
    sys.path.insert(0, str(RUNTIME))

logger = get_logger("pack")

CHECK_KEY_MAP = {
    "items_present": "items_present",
    "quantity_match": "quantities_correct",
    "no_extra_items": "no_extra_items",
    "no_wrong_items": "no_wrong_items",
    "image_quality": "image_quality",
}
VERDICT_MAP = {"pass": "PASS", "fail": "FAIL", "uncertain": "UNCERTAIN"}
UNCERTAIN_REASON_MAP = {
    "blur": "poor_image",
    "poor_lighting": "poor_image",
    "occlusion": "occluded",
    "partial_visibility": "occluded",
    "insufficient_views": "insufficient_evidence",
    "similar_products": "insufficient_evidence",
    "conflicting_images": "conflicting_evidence",
    "catalogue_gap": "insufficient_evidence",
    "model_uncertainty": "insufficient_evidence",
}


def _parse_lines(text: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for part in filter(None, str(text or "").split(";")):
        sku, _, qty = part.partition(":")
        sku = sku.strip()
        if not sku:
            continue
        out[sku] = out.get(sku, 0) + int(qty or 1)
    return out


def _lines_to_text(lines: dict[str, int]) -> str:
    return ";".join(f"{sku}:{qty}" for sku, qty in sorted(lines.items()))


def _safe_record_id(request_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]", "-", request_id)
    return f"PCK-{safe}"


def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _posix_ref(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.name


def _resolve_image_paths(request: dict) -> list[tuple[str, str | None]]:
    """Return list of (absolute_path, sha256_or_None) from inputs and/or data/input/<id>/pack/."""
    s = request["subject"]
    found: list[tuple[str, str | None]] = []
    seen: set[str] = set()

    def add(path: Path, sha: str | None = None) -> None:
        key = str(path.resolve())
        if key in seen or not path.is_file():
            return
        seen.add(key)
        found.append((key, sha or _file_sha256(path)))

    for item in request.get("inputs") or []:
        ref = item.get("ref") or item.get("path") or ""
        if not ref:
            continue
        sha = item.get("sha256")
        candidates = [
            Path(ref),
            REPO_ROOT / ref,
            REPO_ROOT / "data" / "input" / ref,
            RUNTIME / ref,
        ]
        for cand in candidates:
            if cand.is_file():
                add(cand, sha)
                break

    # Orchestrator convention: data/input/<subject_id>/pack/*
    pack_dir = REPO_ROOT / "data" / "input" / s["subject_id"] / "pack"
    if pack_dir.is_dir():
        for cand in sorted(pack_dir.iterdir()):
            if cand.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                add(cand)

    return found


def _verdict_r3(v: str) -> str:
    return VERDICT_MAP.get(str(v).lower(), str(v).upper())


def _uncertain_reason_r3(code: str | None) -> str:
    if not code:
        return "insufficient_evidence"
    return UNCERTAIN_REASON_MAP.get(str(code).lower(), "insufficient_evidence")


def _checks_from_decision(decision_checks, evidence_refs: list[str]) -> list[dict]:
    out = []
    for c in decision_checks:
        key = getattr(c.check_key, "value", str(c.check_key))
        mapped = CHECK_KEY_MAP.get(key, key)
        verdict = _verdict_r3(getattr(c.verdict, "value", str(c.verdict)))
        conf = float(c.confidence) if c.confidence is not None else None
        uncertain_reason = None
        if verdict == "UNCERTAIN":
            raw = None
            if c.uncertainty and getattr(c.uncertainty, "reason_code", None):
                raw = getattr(c.uncertainty.reason_code, "value", str(c.uncertainty.reason_code))
            uncertain_reason = _uncertain_reason_r3(raw)
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


def _refuse_foreign_tenant(subject_id: str, org_id: str) -> None:
    """Raise LookupError if this unit exists only under another org."""
    for other in ("org_demo_alpha", "org_demo_bravo"):
        if other != org_id and sample_data.has("pack", subject_id, other):
            raise LookupError(f"no pack record for {subject_id} in {org_id}")


def _load_order_row(request: dict) -> dict:
    """Sample CSV row when present; otherwise synthesise from context / previous evidence."""
    s = request["subject"]
    try:
        return sample_data.row("pack", s["subject_id"], s["org_id"])
    except LookupError:
        _refuse_foreign_tenant(s["subject_id"], s["org_id"])

    ctx = request.get("context") or {}
    order_lines = ctx.get("order_lines")
    if isinstance(order_lines, dict):
        order_text = _lines_to_text({str(k): int(v) for k, v in order_lines.items()})
    elif isinstance(order_lines, list):
        order_text = _lines_to_text({str(i["sku"]): int(i["quantity"]) for i in order_lines})
    elif isinstance(order_lines, str) and order_lines.strip():
        order_text = order_lines
    else:
        case = ctx.get("case") or {}
        order_text = case.get("order_lines") or ""

    if not order_text:
        # Last resort: receiving payload may carry qty hints — still not a packing list.
        # Without explicit order lines we cannot judge; caller will pending.
        raise LookupError(f"no pack order lines for {s['subject_id']} in {s['org_id']}")

    return {
        "record_id": _safe_record_id(request["request_id"]),
        "unit_id": s["subject_id"],
        "org_id": s["org_id"],
        "order_id": ctx.get("order_id") or s["subject_id"],
        "channel": ctx.get("channel") or "shopify",
        "order_lines": order_text,
        "observed_in_box": "",
        "operator_verdict": "",
        "photo_refs": "",
        "operator_id": ctx.get("operator_id"),
        "captured_at": ctx.get("captured_at") or utcnow(),
    }


def _run_decision_on_sample(row: dict, evidence_refs: list[str]):
    from app.decision.engine import run_decision_engine
    from app.domain.schemas import ObservedItem, OrderLine

    want = _parse_lines(row["order_lines"])
    got = _parse_lines(row.get("observed_in_box") or "")
    if not got:
        # No labelled observation and no photos → cannot invent evidence
        raise RuntimeError("no captures and no labelled sample observations")
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
    return result, evidence_refs, got


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
    # Load optional catalogue from runtime eval catalogue when present
    catalogue = []
    cat_path = RUNTIME / "data" / "eval" / "catalogue.json"
    if cat_path.is_file():
        import json
        from app.domain.schemas import CatalogueProduct

        catalogue = [CatalogueProduct(**row) for row in json.loads(cat_path.read_text(encoding="utf-8"))]

    inspection = run_inspection(order, image_paths, catalogue=catalogue or None)
    observed: dict[str, int] = {}
    for item in inspection.observed_items:
        if item.sku:
            observed[item.sku] = observed.get(item.sku, 0) + int(item.observed_quantity)
    return inspection, observed


def handle(request: dict) -> dict:
    t0 = time.time()
    s = request["subject"]
    logger.info(
        "handle_start",
        extra={"ctx": {
            "workflow_id": request.get("workflow_id"), "stage": STAGE,
            "org_id": s.get("org_id"), "subject_id": s.get("subject_id"),
            "request_id": request.get("request_id"),
        }},
    )

    # FBA units are Amazon-packed — Pack must not invent a seal decision.
    if s.get("route") == "fba":
        return pending_output(
            request,
            code="wrong_route",
            message="Pack Manager is MFN/3PL only; FBA units are packed by Amazon",
            retryable=False,
            agent_id=AGENT_ID,
        )

    try:
        row = _load_order_row(request)
    except LookupError:
        raise
    except Exception as exc:
        return pending_output(request, code="agent_exception", message=str(exc), agent_id=AGENT_ID)

    image_entries = _resolve_image_paths(request)
    image_paths = [p for p, _ in image_entries]
    evidence_refs = [
        _posix_ref(Path(p), REPO_ROOT) if Path(p).is_absolute() else Path(p).as_posix()
        for p, _ in image_entries
    ]
    if not evidence_refs:
        evidence_refs = [p["ref"] for p in photos(row)]

    # Cite receiving upstream when present
    rcv = previous(request, "receiving")
    upstream_extra: list[str] = []
    if rcv:
        upstream_extra.append(rcv["record_id"])

    inputs_meta = []
    if image_entries:
        for path, sha in image_entries:
            inputs_meta.append({
                "ref": _posix_ref(Path(path), REPO_ROOT),
                "sha256": sha,
                "kind": "image",
            })
    else:
        inputs_meta = photos(row)

    observed_map: dict[str, int] = _parse_lines(row.get("observed_in_box") or "")
    decision_checks = []
    outcome_decision = "stop_and_fix"
    confidence = None
    model = {
        "name": "decision-engine",
        "version": VERSION,
        "provider": None,
        "prompt_version": PROMPT_VERSION,
        "calls": 0,
        "cost_usd": 0,
    }
    record_status = "completed"

    try:
        if image_paths:
            inspection, observed_map = _run_vlm_pipeline(request, row, image_paths)
            status = getattr(inspection.status, "value", str(inspection.status))
            if status == "pending" and not inspection.outcome:
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
                "version": VERSION,
                "provider": "google",
                "prompt_version": PROMPT_VERSION,
                "calls": 1,
                "cost_usd": 0,
            }
            confidences = [c.confidence for c in decision_checks if c.confidence is not None]
            confidence = sum(confidences) / len(confidences) if confidences else None
            if status == "pending_review":
                # Round-3 status is completed|pending|error; pending_review is an outcome.
                record_status = "completed"
        else:
            result, evidence_refs, observed_map = _run_decision_on_sample(row, evidence_refs)
            decision_checks = result.checks
            outcome_decision = result.decision.value
            if result.status.value == "pending_review":
                record_status = "completed"
    except LookupError:
        raise
    except Exception as exc:
        logger.warning("fail_open", extra={"ctx": {"error": str(exc), "workflow_id": request.get("workflow_id")}})
        return pending_output(request, code="agent_exception", message=str(exc), agent_id=AGENT_ID)

    checks = _checks_from_decision(decision_checks, evidence_refs)
    # Attach receiving record id onto checks that used upstream context
    if upstream_extra:
        for c in checks:
            refs = list(c.get("evidence_refs") or [])
            for u in upstream_extra:
                if u not in refs:
                    refs.append(u)
            if refs:
                c["evidence_refs"] = refs

    pack_out = "seal" if outcome_decision == "seal" else "stop_and_fix"
    if any(c["verdict"] == "UNCERTAIN" for c in checks) and all(c["verdict"] != "FAIL" for c in checks):
        pack_out = "pending_review"

    latency_ms = int((time.time() - t0) * 1000)
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
        inputs=inputs_meta,
        reason=f"pack-manager {pack_out}; checks={len(checks)}",
        confidence=confidence,
        status=record_status,
        latency_ms=latency_ms,
        payload={
            "channel": row.get("channel"),
            "order_lines": _parse_lines(row["order_lines"]),
            "observed_in_box": observed_map,
            "operator_verdict": row.get("operator_verdict") or None,
            "implementation": "round2-pack-manager",
            "prompt_version": PROMPT_VERSION,
        },
    )
    out = build_output(record)
    logger.info(
        "handle_done",
        extra={"ctx": {
            "workflow_id": request.get("workflow_id"), "verdict": out.get("verdict"),
            "outcome": pack_out, "latency_ms": latency_ms, "agent_id": AGENT_ID,
        }},
    )
    return out


app = make_app(STAGE, handle, version=VERSION)
