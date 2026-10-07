"""Pack Manager Round-3 adapter — contract, tenancy, fail-open, idempotency."""
from __future__ import annotations

import pytest

from agents.pack.app import handle
from shared.utils.hashing import verify
from shared.utils.schema import errors


def _req(unit_id: str, org_id: str, *, route: str = "mfn", request_id: str | None = None) -> dict:
    wf = f"WF-{org_id}-{unit_id}"
    return {
        "schema_version": "1.0",
        "request_id": request_id or f"{wf}:pack",
        "workflow_id": wf,
        "stage": "pack",
        "subject": {"org_id": org_id, "subject_id": unit_id, "route": route},
        "inputs": [],
        "previous_evidence": [],
        "context": {"overrides": []},
    }


def test_seal_sample_unit_is_contract_valid():
    out = handle(_req("UNIT-0006", "org_demo_bravo"))
    assert errors("agent-output", out) == []
    assert out["agent_id"] == "pack-manager@1"
    assert out["verdict"] == "PASS"
    assert out["evidence"]["decision"]["outcome"] == "seal"
    assert verify(out["evidence"])
    assert "quantities_correct" in {c["check_key"] for c in out["evidence"]["checks"]}
    assert out["evidence"]["payload"]["observed_in_box"]


def test_extra_item_is_fail_stop_and_fix():
    out = handle(_req("UNIT-0027", "org_demo_bravo"))
    assert errors("agent-output", out) == []
    assert out["verdict"] == "FAIL"
    assert out["evidence"]["decision"]["outcome"] == "stop_and_fix"
    assert verify(out["evidence"])


def test_wrong_tenant_refused():
    with pytest.raises(LookupError):
        handle(_req("UNIT-0006", "org_demo_alpha"))  # unit belongs to bravo


def test_idempotent_record_id():
    a = handle(_req("UNIT-0008", "org_demo_alpha"))
    b = handle(_req("UNIT-0008", "org_demo_alpha"))
    assert a["evidence"]["record_id"] == b["evidence"]["record_id"]
    assert a["evidence"]["record_id"].startswith("PCK-")


def test_fba_route_fail_open_not_seal():
    out = handle(_req("UNIT-0002", "org_demo_alpha", route="fba"))
    assert errors("agent-output", out) == []
    assert out["verdict"] == "UNCERTAIN"
    assert out["evidence"]["decision"]["outcome"] == "pending_review"
    assert out["status"] in ("pending", "error")
    assert out["evidence"]["error"] is not None


def test_upstream_receiving_cited_when_present():
    prior = [{
        "schema_version": "1.0",
        "record_id": "RCV-TEST-0006",
        "workflow_id": "WF-org_demo_bravo-UNIT-0006",
        "stage": "receiving",
        "agent_id": "receiving-stub@0",
        "subject": {"org_id": "org_demo_bravo", "subject_id": "UNIT-0006", "unit_id": "UNIT-0006",
                    "unit_scope": "unit", "refs": {}},
        "status": "completed",
        "captured_at": "2026-01-01T00:00:00Z",
        "produced_at": "2026-01-01T00:00:01Z",
        "model": {"name": "stub", "version": "0", "calls": 0},
        "inputs": [],
        "checks": [{"check_key": "quantity", "verdict": "PASS", "confidence": None}],
        "decision": {"verdict": "PASS", "outcome": "accept", "confidence": None, "reason": "ok", "needs_human": False},
        "payload": {},
        "upstream_refs": [],
        "overrides": [],
        "error": None,
        "content_hash": "0" * 64,
    }]
    req = _req("UNIT-0006", "org_demo_bravo")
    req["previous_evidence"] = prior
    out = handle(req)
    assert "RCV-TEST-0006" in out["evidence"]["upstream_refs"]
    assert any("RCV-TEST-0006" in (c.get("evidence_refs") or []) for c in out["evidence"]["checks"])
