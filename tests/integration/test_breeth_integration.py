"""Tests for Breeth Intent Memory Layer Integration."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch
import pytest

from shared.utils import breeth_memory as bm
from orchestration.orchestrator import advance, new_workflow, load_flow
from orchestration.store import MemoryStore


def test_breeth_disabled_by_default(monkeypatch):
    """When BREETH_ENABLED is not set and key is absent, Breeth is disabled and fails open."""
    monkeypatch.delenv("BREETH_ENABLED", raising=False)
    monkeypatch.delenv("BREETH_API_KEY", raising=False)

    assert bm.is_breeth_enabled() is False
    assert bm.get_breeth_client() is None

    # Operations must fail-open cleanly
    sample_wf = {"workflow_id": "WF-test-1", "org_id": "test_org", "subject_id": "unit_1"}
    assert bm.record_workflow_episode(sample_wf) is None
    assert bm.record_agent_memory("pack", "test_org", "unit_1", "Test note") is None
    assert bm.search_memory("test_org", "query") == []


def test_breeth_explicit_disabled(monkeypatch):
    """Even if a key is present, BREETH_ENABLED=false forces it disabled."""
    monkeypatch.setenv("BREETH_ENABLED", "false")
    monkeypatch.setenv("BREETH_API_KEY", "ck_live_dummy_token_12345")

    assert bm.is_breeth_enabled() is False
    assert bm.record_workflow_episode({"workflow_id": "WF-1"}) is None


def test_tenancy_group_id_isolation(monkeypatch):
    """Each organization must have an isolated namespace in Breeth to prevent leakage."""
    monkeypatch.delenv("BREETH_GROUP_PREFIX", raising=False)
    assert bm.get_group_id("org_alpha") == "cube-org-org_alpha"
    assert bm.get_group_id("org_beta") == "cube-org-org_beta"
    assert bm.get_group_id("org_alpha") != bm.get_group_id("org_beta")

    # Custom prefix test
    monkeypatch.setenv("BREETH_GROUP_PREFIX", "custom-tenant-")
    assert bm.get_group_id("org_gamma") == "custom-tenant-org_gamma"


def test_build_workflow_episode_narrative():
    """Narrative must include all essential context, stages, and verdicts for intent extraction."""
    wf = {
        "workflow_id": "WF-orgA-101",
        "org_id": "orgA",
        "subject_id": "unit_101",
        "status": "COMPLETED",
        "status_reason": "all stages processed",
        "flow_id": "flow.specialist.json",
        "final_outcome": "PASS",
        "context": {"route": "forward", "items": "SKU-A:1;SKU-B:2"},
        "stage_results": [
            {"stage": "receiving", "agent_id": "receiving-inspector@1", "state": "completed", "verdict": "PASS", "outcome": "accept", "duration_ms": 120},
            {"stage": "pack", "agent_id": "pack-manager@1", "state": "completed", "verdict": "PASS", "outcome": "seal", "duration_ms": 250},
            {"stage": "returns", "agent_id": None, "state": "skipped", "skipped_reason": "route=forward not in ['return']"},
        ],
    }
    narrative = bm.build_workflow_episode_narrative(wf)
    assert "WF-orgA-101" in narrative
    assert "Tenant / Organization: orgA" in narrative
    assert "Final Rollup Outcome: PASS" in narrative
    assert "receiving-inspector@1" in narrative
    assert "pack-manager@1" in narrative
    assert "route=forward not in ['return']" in narrative
    assert "SKU-A:1" in narrative


def test_mock_successful_workflow_episode_recording():
    """Verify write() is called with correct parameters and response is parsed."""
    mock_client = MagicMock()
    mock_extracted = MagicMock()
    mock_extracted.entities = 3
    mock_extracted.edges = 5

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.episode_name = "ep_wf_orgA_101"
    mock_resp.group_id = "cube-org-orgA"
    mock_resp.extracted = mock_extracted
    mock_resp.warning = None
    mock_client.write.return_value = mock_resp

    wf = {
        "workflow_id": "WF-orgA-101",
        "org_id": "orgA",
        "subject_id": "unit_101",
        "status": "COMPLETED",
        "stage_results": [],
    }

    res = bm.record_workflow_episode(wf, client=mock_client, extract_intent=True)

    assert res is not None
    assert res["ok"] is True
    assert res["episode_name"] == "ep_wf_orgA_101"
    assert res["group_id"] == "cube-org-orgA"
    assert res["entities"] == 3
    assert res["edges"] == 5

    mock_client.write.assert_called_once()
    _, kwargs = mock_client.write.call_args
    assert kwargs["group_id"] == "cube-org-orgA"
    assert kwargs["extract_intent"] is True
    assert "cube:orchestrator:WF-orgA-101" in kwargs["source_description"]


def test_mock_agent_memory_recording():
    """Verify stage-level agent memory recording to Breeth."""
    mock_client = MagicMock()
    mock_extracted = MagicMock()
    mock_extracted.entities = 1
    mock_extracted.edges = 2

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.episode_name = "ep_pack_anomaly"
    mock_resp.group_id = "cube-org-retail_co"
    mock_resp.extracted = mock_extracted
    mock_client.write.return_value = mock_resp

    res = bm.record_agent_memory(
        stage="pack",
        org_id="retail_co",
        subject_id="U-99",
        content="Detected damaged outer carton; repacked with dual seal.",
        client=mock_client,
    )

    assert res is not None
    assert res["ok"] is True
    assert res["episode_name"] == "ep_pack_anomaly"
    mock_client.write.assert_called_once()
    assert mock_client.write.call_args[1]["group_id"] == "cube-org-retail_co"


def test_mock_search_memory_and_formatting():
    """Verify search_memory retrieves edges and format_retrieved_context renders them."""
    mock_client = MagicMock()
    mock_edge1 = MagicMock()
    mock_edge1.source_node = "SKU-GLASS-12"
    mock_edge1.target_node = "Fragile Packaging Requirement"
    mock_edge1.fact = "SKU-GLASS-12 requires double bubble wrap and FRAGILE warning label"
    mock_edge1.tier = "fast"
    mock_edge1.edge_uuid = "uuid-1"

    mock_retrieve_resp = MagicMock()
    mock_retrieve_resp.edges = [mock_edge1]
    mock_client.retrieve.return_value = mock_retrieve_resp

    edges = bm.search_memory("orgA", "packaging fragile items", limit=3, client=mock_client)
    assert len(edges) == 1
    assert edges[0]["fact"] == "SKU-GLASS-12 requires double bubble wrap and FRAGILE warning label"
    assert edges[0]["source"] == "SKU-GLASS-12"

    md = bm.format_retrieved_context(edges)
    assert "Historical Memory Context (from Breeth Knowledge Graph):" in md
    assert "- SKU-GLASS-12 requires double bubble wrap and FRAGILE warning label" in md


def test_fail_open_on_breeth_error():
    """Network or API errors in Breeth must fail open without crashing callers."""
    mock_client = MagicMock()
    mock_client.write.side_effect = RuntimeError("Breeth API connection refused")
    mock_client.retrieve.side_effect = RuntimeError("504 Gateway Timeout")

    wf = {"workflow_id": "WF-fail", "org_id": "orgA"}
    # Must return None/empty list and not raise
    assert bm.record_workflow_episode(wf, client=mock_client) is None
    assert bm.record_agent_memory("pack", "orgA", "U1", "note", client=mock_client) is None
    assert bm.search_memory("orgA", "query", client=mock_client) == []


def test_orchestrator_integration_with_breeth(monkeypatch):
    """Test that orchestrator advance() logs Breeth recording in transitions when enabled."""
    store = MemoryStore()
    flow = load_flow()
    case = {"org_id": "org1", "unit_id": "sample-001", "route": "forward"}
    wf = new_workflow(case, flow)

    # Patch record_workflow_episode to simulate successful recording
    with patch("orchestration.orchestrator.record_workflow_episode") as mock_record:
        mock_record.return_value = {
            "ok": True,
            "episode_name": "ep_wf_test",
            "group_id": "cube-org-org1",
        }
        res = advance(wf, flow, store)
        assert res["status"] in ("COMPLETED", "HALTED", "IN_PROGRESS", "FAILED")
        mock_record.assert_called_once()
        # Verify transition was recorded
        trans_events = [t["event"] for t in res["transitions"]]
        assert "breeth_memory_recorded" in trans_events
