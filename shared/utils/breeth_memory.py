"""Breeth Intent Memory Layer Integration for Cube Round 3.

Provides persistent, intent-aware episodic and relational memory across the 5-agent
autonomous commerce pipeline (Receiving -> Prep -> Pack -> Returns -> Recovery).

Tenancy & Partitioning:
    Breeth graphs are isolated per-tenant via `group_id = f"cube-org-{org_id}"`.
    Zero cross-tenant memory leakage.

Fail-Open Reliability:
    If `BREETH_API_KEY` is not set, invalid, or the Breeth service is unreachable,
    all operations gracefully degrade to no-ops or empty responses, ensuring
    orchestration and agent pipelines never fail due to memory layer issues.
"""
from __future__ import annotations

import os
from typing import Any

from shared.utils.log import get_logger

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = get_logger("breeth_memory")

try:
    from breeth import BreethClient, BreethError
    _BREETH_AVAILABLE = True
except ImportError:  # pragma: no cover
    _BREETH_AVAILABLE = False
    BreethClient = None  # type: ignore
    BreethError = Exception  # type: ignore


def is_breeth_enabled() -> bool:
    """Return True if Breeth is explicitly enabled or configured with a plausible key."""
    if not _BREETH_AVAILABLE:
        return False
    explicit = os.environ.get("BREETH_ENABLED", "").strip().lower()
    if explicit in ("false", "0", "no", "off"):
        return False
    if explicit in ("true", "1", "yes", "on"):
        return True
    # Auto-enable only if a plausible key format (ck_live_... or JWT) is present
    key = os.environ.get("BREETH_API_KEY", "").strip()
    return bool(key and (key.startswith("ck_live_") or len(key) > 64))


def get_group_id(org_id: str) -> str:
    """Map a tenant org_id to an isolated Breeth group_id namespace."""
    prefix = os.environ.get("BREETH_GROUP_PREFIX", "cube-org-").strip()
    clean_org = str(org_id or "default").strip()
    return f"{prefix}{clean_org}"


def get_breeth_client(api_key: str | None = None) -> BreethClient | None:
    """Instantiate a BreethClient with fail-open fallback if unconfigured or invalid."""
    if not _BREETH_AVAILABLE:
        logger.debug("Breeth SDK is not installed.")
        return None

    key = api_key or os.environ.get("BREETH_API_KEY", "").strip()
    if not key:
        return None

    base_url = os.environ.get("BREETH_BASE_URL", "").strip() or None
    try:
        timeout = float(os.environ.get("BREETH_TIMEOUT_S", "10.0"))
    except ValueError:
        timeout = 10.0

    try:
        client = BreethClient(api_key=key, base_url=base_url, timeout=timeout)
        return client
    except Exception as exc:
        logger.warning("Failed to initialize BreethClient: %s", exc)
        return None


def build_workflow_episode_narrative(wf: dict, store: Any = None) -> str:
    """Synthesize a complete natural language narrative of a workflow run for Breeth intent extraction."""
    wf_id = wf.get("workflow_id", "WF-unknown")
    org_id = wf.get("org_id", "unknown")
    subject_id = wf.get("subject_id", "unknown")
    status = wf.get("status", "UNKNOWN")
    reason = wf.get("status_reason", "")
    flow_id = wf.get("flow_id", "flow-v1")
    final_outcome = wf.get("final_outcome") or "NONE"

    lines = [
        f"Workflow Execution Episode: {wf_id}",
        f"Tenant / Organization: {org_id}",
        f"Subject / Unit ID: {subject_id}",
        f"Flow: {flow_id}",
        f"Final Workflow Status: {status} ({reason})",
        f"Final Rollup Outcome: {final_outcome}",
        "",
        "Stage Execution Results:",
    ]

    for sr in wf.get("stage_results", []):
        stage = sr.get("stage")
        state = sr.get("state")
        agent_id = sr.get("agent_id") or "unassigned"
        verdict = sr.get("verdict") or "N/A"
        outcome = sr.get("outcome") or "N/A"
        duration = sr.get("duration_ms")

        # Try to pull detailed rationale or evidence findings
        details = []
        if state == "skipped":
            details.append(f"Skipped reason: {sr.get('skipped_reason')}")
        else:
            if verdict != "N/A":
                details.append(f"Verdict={verdict}")
            if outcome != "N/A":
                details.append(f"Outcome={outcome}")
            if duration is not None:
                details.append(f"Duration={duration}ms")

            # Check if store has the full evidence record
            rec_id = sr.get("record_id")
            if store and rec_id and hasattr(store, "get_evidence"):
                ev = store.get_evidence(rec_id)
                if ev and isinstance(ev, dict):
                    dec = ev.get("decision", {})
                    rationale = dec.get("rationale") or dec.get("claim_rationale")
                    if rationale:
                        details.append(f"Rationale: {rationale}")
                    notes = dec.get("notes") or dec.get("customer_notes")
                    if notes:
                        details.append(f"Notes: {notes}")

            if sr.get("error"):
                details.append(f"Error: {sr['error']}")

        detail_str = "; ".join(details) if details else state
        lines.append(f"- Stage [{stage}] ({agent_id}): state={state}; {detail_str}")

    # Append context / case details
    ctx = wf.get("context", {})
    if ctx:
        route = ctx.get("route")
        items = ctx.get("items") or ctx.get("expected_items") or ctx.get("declared_items")
        lines.append("")
        lines.append("Case Context:")
        if route:
            lines.append(f"- Logistics Route: {route}")
        if items:
            lines.append(f"- Items / SKUs: {items}")

    # Append halt reason or errors if any
    halted = wf.get("halted")
    if halted:
        lines.append("")
        lines.append(f"Workflow Halted at stage {halted.get('stage')}: {halted.get('reason')}")

    return "\n".join(lines)


def record_workflow_episode(
    wf: dict,
    store: Any = None,
    client: BreethClient | None = None,
    extract_intent: bool = True,
) -> dict | None:
    """Write a finalized workflow execution episode to Breeth memory.

    Fail-open: Returns None if Breeth is disabled, unconfigured, or if any error occurs.
    """
    if "PYTEST_CURRENT_TEST" in os.environ:
        return None
        
    if not is_breeth_enabled() and client is None:
        return None

    active_client = client or get_breeth_client()
    if not active_client:
        return None

    org_id = wf.get("org_id", "default")
    group_id = get_group_id(org_id)
    wf_id = wf.get("workflow_id", "wf")
    source_desc = f"cube:orchestrator:{wf_id}"
    narrative = build_workflow_episode_narrative(wf, store)

    try:
        resp = active_client.write(
            content=narrative,
            group_id=group_id,
            source_description=source_desc,
            extract_intent=extract_intent,
        )
        logger.info(
            "Recorded Breeth workflow episode: episode=%s, group=%s, extracted=%s",
            resp.episode_name,
            resp.group_id,
            resp.extracted,
        )
        return {
            "ok": resp.ok,
            "episode_name": resp.episode_name,
            "group_id": resp.group_id,
            "entities": getattr(resp.extracted, "entities", 0),
            "edges": getattr(resp.extracted, "edges", 0),
            "warning": resp.warning,
        }
    except (BreethError, Exception) as exc:
        logger.warning("Breeth write episode failed (failing open): %s", exc)
        return None


def record_agent_memory(
    stage: str,
    org_id: str,
    subject_id: str,
    content: str,
    source: str | None = None,
    extract_intent: bool = True,
    client: BreethClient | None = None,
) -> dict | None:
    """Record an agent-specific operational memory, anomaly, or rule into Breeth.

    Fail-open: Returns None if Breeth is disabled or encounters an error.
    """
    if not is_breeth_enabled() and client is None:
        return None

    active_client = client or get_breeth_client()
    if not active_client:
        return None

    group_id = get_group_id(org_id)
    source_desc = source or f"cube:agent:{stage}:{subject_id}"
    full_content = f"Stage [{stage}] Memory for subject {subject_id} (org {org_id}):\n{content}"

    try:
        resp = active_client.write(
            content=full_content,
            group_id=group_id,
            source_description=source_desc,
            extract_intent=extract_intent,
        )
        return {
            "ok": resp.ok,
            "episode_name": resp.episode_name,
            "group_id": resp.group_id,
            "entities": getattr(resp.extracted, "entities", 0),
            "edges": getattr(resp.extracted, "edges", 0),
        }
    except (BreethError, Exception) as exc:
        logger.warning("Breeth record_agent_memory failed (failing open): %s", exc)
        return None


def search_memory(
    org_id: str,
    query: str,
    limit: int = 5,
    client: BreethClient | None = None,
) -> list[dict]:
    """Retrieve relevant memories and knowledge graph edges for a given tenant.

    Fail-open: Returns empty list if disabled or on any communication failure.
    """
    if not is_breeth_enabled() and client is None:
        return []

    active_client = client or get_breeth_client()
    if not active_client:
        return []

    group_id = get_group_id(org_id)
    try:
        resp = active_client.retrieve(query=query, group_id=group_id, limit=limit)
        results = []
        for edge in getattr(resp, "edges", []):
            results.append({
                "source": getattr(edge, "source_node", ""),
                "target": getattr(edge, "target_node", ""),
                "fact": getattr(edge, "fact", ""),
                "tier": getattr(edge, "tier", "fast"),
                "edge_uuid": getattr(edge, "edge_uuid", None),
            })
        return results
    except (BreethError, Exception) as exc:
        logger.warning("Breeth search_memory failed (failing open): %s", exc)
        return []


def format_retrieved_context(edges: list[dict]) -> str:
    """Format retrieved knowledge graph edges into markdown context for agents."""
    if not edges:
        return ""
    lines = ["Historical Memory Context (from Breeth Knowledge Graph):"]
    for e in edges:
        fact = e.get("fact")
        if fact:
            lines.append(f"- {fact}")
        elif e.get("source") and e.get("target"):
            lines.append(f"- {e['source']} -> {e['target']}")
    return "\n".join(lines)
