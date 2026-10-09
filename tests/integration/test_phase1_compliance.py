"""Phase 1 Compliance Test Suite: End-to-End 5-Agent Integration.

Verifies:
A. Individual Agents (Receiving, Prep, Pack, Returns, Recovery)
B. Contract Validation (Schema compliance, invalid evidence, missing fields, identifier syntax, tampering)
C. Orchestration (Complete workflow, upstream failures, recovery failure, missing evidence, invalid handoffs)
D. Official Data (Parsing, execution of all 100 official scenarios, expected outputs validation)
E. End-to-End Traceability (Full pipeline, identity chains, Recovery consuming upstream evidence)
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from orchestration.clients import AgentRejected, AgentUnavailable, client_for
from orchestration.orchestrator import flow_stages, load_flow, run_workflow
from orchestration.store import MemoryStore
from shared.utils.hashing import verify
from shared.utils.schema import errors
from tests.conftest import AGENTS, applies, make_input
from tests.helpers import Boom, Fake, Mangle

ROOT = Path(__file__).resolve().parents[2]


# =====================================================================
# SECTION A: Individual Agents
# =====================================================================
class TestIndividualAgents:
    """Verifies that each individual agent complies with its domain responsibilities and contract."""

    def test_receiving_agent_standalone(self, cases):
        case = cases[0]
        client = client_for("receiving")
        req = make_input("receiving", case)
        out = client.run(req, 30)

        assert errors("agent-output", out) == []
        ev = out["evidence"]
        assert ev["record_id"].startswith("RCV-")
        assert ev["stage"] == "receiving"
        assert ev["subject"]["subject_id"] == case["unit_id"]
        assert ev["subject"]["org_id"] == case["org_id"]

        check_keys = {c["check_key"] for c in ev["checks"]}
        expected_keys = {"identity_match", "carton_count", "quantity", "carton_damage", "unit_damage", "quality_flags"}
        assert expected_keys <= check_keys, f"Missing receiving checks: {expected_keys - check_keys}"

        # Traceability refs
        assert "po_number" in ev["subject"]["refs"]
        assert "sku" in ev["subject"]["refs"]
        assert "qty_ordered" in ev["payload"]
        assert "qty_received" in ev["payload"]
        assert verify(ev)

    def test_prep_agent_standalone(self, cases):
        case = next(c for c in cases if c["route"] == "fba")
        client = client_for("prep")
        req = make_input("prep", case)
        out = client.run(req, 30)

        assert errors("agent-output", out) == []
        ev = out["evidence"]
        assert ev["record_id"].startswith("PRP-")
        assert ev["stage"] == "prep"
        assert ev["subject"]["subject_id"] == case["unit_id"]
        assert "prep_price_usd" in ev["payload"]
        assert verify(ev)

    def test_pack_agent_standalone(self, cases):
        case = next(c for c in cases if c["route"] == "mfn")
        client = client_for("pack")
        req = make_input("pack", case)
        out = client.run(req, 30)

        assert errors("agent-output", out) == []
        ev = out["evidence"]
        assert ev["record_id"].startswith("PCK-")
        assert ev["stage"] == "pack"
        assert ev["subject"]["subject_id"] == case["unit_id"]
        assert ev["subject"]["unit_scope"] == "order"
        assert "order_lines" in ev["payload"]
        assert "observed_in_box" in ev["payload"]
        assert verify(ev)

    def test_returns_agent_standalone(self, cases):
        case = next(c for c in cases if c["returned"])
        client = client_for("returns")
        req = make_input("returns", case)
        out = client.run(req, 30)

        assert errors("agent-output", out) == []
        ev = out["evidence"]
        assert ev["record_id"].startswith("RTN-")
        assert ev["stage"] == "returns"
        assert ev["subject"]["subject_id"] == case["unit_id"]
        assert "order_id" in ev["subject"]["refs"]
        assert verify(ev)

    def test_recovery_agent_standalone_with_upstream_evidence(self, cases):
        case = next(c for c in cases if c["unit_id"] == "UNIT-0014")
        # Generate previous evidence
        prior = []
        for stage in ("receiving", "prep", "returns"):
            if applies(stage, case):
                prior.append(client_for(stage).run(make_input(stage, case, prior), 30)["evidence"])

        client = client_for("recovery")
        req = make_input("recovery", case, previous=prior)
        out = client.run(req, 30)

        assert errors("agent-output", out) == []
        ev = out["evidence"]
        assert ev["record_id"].startswith("RCY-")
        assert ev["stage"] == "recovery"
        assert "charges" in ev["payload"]
        assert "claimable_usd" in ev["payload"]
        assert verify(ev)

    @pytest.mark.parametrize("stage", AGENTS)
    def test_all_agents_refuse_foreign_tenant(self, stage, cases):
        case = next(c for c in cases if applies(stage, c))
        other_org = "org_intruder"
        req = make_input(stage, {**case, "org_id": other_org})
        with pytest.raises((AgentRejected, LookupError)):
            client_for(stage).run(req, 30)


# =====================================================================
# SECTION B: Contract Validation
# =====================================================================
class TestContractValidation:
    """Verifies strict validation of evidence schemas, required fields, and tamper detection."""

    def test_valid_evidence_passes_schema(self, cases):
        out = client_for("receiving").run(make_input("receiving", cases[0]), 30)
        assert errors("agent-output", out) == []
        assert errors("evidence", out["evidence"]) == []

    def test_invalid_evidence_missing_required_fields(self, cases):
        out = client_for("receiving").run(make_input("receiving", cases[0]), 30)
        ev = copy.deepcopy(out["evidence"])

        # Delete required fields
        del ev["record_id"]
        del ev["content_hash"]
        problems = errors("evidence", ev)
        assert len(problems) >= 2
        assert any("record_id" in p for p in problems)
        assert any("content_hash" in p for p in problems)

    def test_invalid_record_id_pattern(self, cases):
        out = client_for("receiving").run(make_input("receiving", cases[0]), 30)
        ev = copy.deepcopy(out["evidence"])
        ev["record_id"] = "INVALID_PREFIX-1234"  # Needs RCV-, PRP-, PCK-, RTN-, or RCY-
        problems = errors("evidence", ev)
        assert any("record_id" in p for p in problems)

    def test_tampered_content_hash_fails_verification(self, cases):
        out = client_for("receiving").run(make_input("receiving", cases[0]), 30)
        ev = copy.deepcopy(out["evidence"])
        assert verify(ev) is True

        # Mutate check detail without recalculating hash
        ev["checks"][0]["detail"] = "tampered detail"
        assert verify(ev) is False


# =====================================================================
# SECTION C: Orchestration and Failure Handling
# =====================================================================
class TestOrchestrationFailureHandling:
    """Verifies that orchestrator handles each failure cleanly without state corruption."""

    def test_complete_successful_workflow(self, cases):
        case = cases[0]
        store = MemoryStore()
        wf = run_workflow(case, store=store)

        assert wf["status"] in ("COMPLETED", "BLOCKED")
        assert errors("workflow-state", wf) == []
        assert len(wf["stage_results"]) >= 2
        assert wf["final_outcome"]["outcome"] in {"CLEAN", "CLAIM_RECOMMENDED", "EXCEPTION", "NEEDS_REVIEW"}

    @pytest.mark.parametrize("failing_stage", ["receiving", "prep", "returns", "recovery"])
    def test_each_stage_failure_is_recorded_and_fails_workflow(self, failing_stage, cases):
        case = next(c for c in cases if c["route"] == "fba" and c["returned"])
        boom = Boom(AgentUnavailable(f"{failing_stage} service crashed"))

        wf = run_workflow(case, flow=load_flow(), store=MemoryStore(), clients={failing_stage: boom})

        assert wf["status"] == "FAILED"
        stage_res = next(s for s in wf["stage_results"] if s["stage"] == failing_stage)
        assert stage_res["state"] == "error"
        assert stage_res["error"]["code"] == "agent_unavailable"
        assert any(e["stage"] == failing_stage for e in wf["errors"])
        assert wf["final_outcome"]["outcome"] in ("INCOMPLETE", "EXCEPTION")
        assert wf["final_outcome"]["provisional"] is True

    def test_pack_stage_failure_on_mfn_case(self, cases):
        case = next(c for c in cases if c["route"] == "mfn")
        boom = Boom(AgentUnavailable("pack line conveyor offline"))

        wf = run_workflow(case, flow=load_flow(), store=MemoryStore(), clients={"pack": boom})

        assert wf["status"] == "FAILED"
        stage_res = next(s for s in wf["stage_results"] if s["stage"] == "pack")
        assert stage_res["state"] == "error"
        assert stage_res["error"]["code"] == "agent_unavailable"
        assert wf["final_outcome"]["outcome"] in ("INCOMPLETE", "EXCEPTION")
        assert wf["final_outcome"]["provisional"] is True

    def test_missing_upstream_evidence_recovery_fallback(self, cases):
        case = next(c for c in cases if c["unit_id"] == "UNIT-0014")
        # Run recovery with empty previous evidence
        client = client_for("recovery")
        req = make_input("recovery", case, previous=[])
        out = client.run(req, 30)

        # Recovery must handle missing upstream evidence safely: mark SILENT / insufficient_evidence, not crash
        assert errors("agent-output", out) == []
        ev = out["evidence"]
        assert ev["decision"]["outcome"] == "insufficient_evidence"
        # Must not fabricate a claim
        assert ev["payload"]["claimable_usd"] == 0.0

    def test_invalid_handoff_is_detected_and_recorded(self, cases):
        case = cases[0]
        # Agent outputs disagreeing verdict between output envelope and evidence record
        bad_agent = Mangle("receiving", "disagree")
        wf = run_workflow(case, flow=load_flow(), store=MemoryStore(), clients={"receiving": bad_agent})

        assert wf["status"] == "FAILED"
        stage_res = next(s for s in wf["stage_results"] if s["stage"] == "receiving")
        assert stage_res["state"] == "error"
        assert stage_res["error"]["code"] == "invalid_output"


# =====================================================================
# SECTION D: Official Data Scenarios & Expected Outcomes
# =====================================================================
class TestOfficialData:
    """Verifies official data parsing and validates 100% agreement against expected outcomes."""

    def test_official_sample_cases_structure(self, cases):
        assert len(cases) == 100
        for c in cases:
            assert "org_id" in c and c["org_id"].startswith("org_")
            assert "unit_id" in c and c["unit_id"].startswith("UNIT-")
            assert c["route"] in {"fba", "mfn", "unknown"}
            assert isinstance(c["returned"], bool)

    def test_all_100_cases_match_official_expected_outcomes(self, cases):
        expected_file = ROOT / "data/expected/final-outcomes.sample.json"
        assert expected_file.is_file()
        expected = json.loads(expected_file.read_text())

        store = MemoryStore()
        for case in cases:
            wf = run_workflow(case, store=store)
            fo = wf["final_outcome"]
            wid = wf["workflow_id"]
            actual_entry = {
                "status": wf["status"],
                "outcome": fo["outcome"],
                "needs_human": fo["needs_human"],
                "claimable_usd": fo["claimable_usd"],
            }
            expected_entry = expected.get(wid)
            assert expected_entry is not None, f"Missing expected entry for {wid}"
            assert actual_entry == expected_entry, (
                f"Mismatch for {wid}: expected {expected_entry}, got {actual_entry}"
            )

    def test_canonical_workflow_unit0014_stage_by_stage(self):
        canon_file = ROOT / "data/expected/canonical-workflow.json"
        assert canon_file.is_file()
        canon = json.loads(canon_file.read_text())

        wf = run_workflow(canon["case"], store=MemoryStore())
        assert wf["status"] == canon["expected_status"]

        for s in wf["stage_results"]:
            stage = s["stage"]
            assert s["state"] == canon["expected_stage_states"][stage]
            assert s.get("verdict") == canon["expected_stage_verdicts"][stage]

        fo = wf["final_outcome"]
        exp_fo = canon["expected_final_outcome"]
        assert fo["outcome"] == exp_fo["outcome"]
        assert fo["verdict"] == exp_fo["verdict"]
        assert fo["needs_human"] == exp_fo["needs_human"]
        assert fo["claimable_usd"] == exp_fo["claimable_usd"]
        assert fo["provisional"] == exp_fo["provisional"]


# =====================================================================
# SECTION E: End-to-End Traceability & Evidence Flow
# =====================================================================
class TestEndToEndTraceability:
    """Verifies end-to-end evidence chains and cross-agent traceability to Recovery."""

    def test_full_pipeline_evidence_traceability(self, cases):
        case = next(c for c in cases if c["route"] == "fba" and c["returned"])
        store = MemoryStore()
        wf = run_workflow(case, store=store)

        assert wf["status"] == "COMPLETED"
        # 1. Trace from final outcome contributing records
        fo = wf["final_outcome"]
        assert len(fo["contributing_records"]) >= 3
        for rid in fo["contributing_records"]:
            ev = store.get_evidence(rid)
            assert ev is not None
            assert verify(ev) is True
            # 2. Trace each record to its subject and workflow
            assert ev["workflow_id"] == wf["workflow_id"]
            assert ev["subject"]["subject_id"] == case["unit_id"]

    def test_recovery_consumes_and_cites_upstream_prep_evidence(self, cases):
        case = next(c for c in cases if c["unit_id"] == "UNIT-0014")
        store = MemoryStore()
        wf = run_workflow(case, store=store)

        prep_sr = next(s for s in wf["stage_results"] if s["stage"] == "prep")
        prep_id = prep_sr["record_id"]

        recovery_sr = next(s for s in wf["stage_results"] if s["stage"] == "recovery")
        rec_ev = store.get_evidence(recovery_sr["record_id"])

        # Recovery must cite the Prep evidence record in charges
        contradicted = [c for c in rec_ev["payload"]["charges"] if c["position"] == "CONTRADICTS"]
        assert len(contradicted) > 0
        claimed_charge = contradicted[0]
        assert prep_id in claimed_charge["evidence_record_ids"]
        assert prep_id in rec_ev["upstream_refs"]
