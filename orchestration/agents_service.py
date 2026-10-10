"""Service layer for individual agent operations and dependency analysis.

Allows executing each of the five agents independently:
- Receiving
- Prep
- Pack
- Returns
- Recovery

Ensures upstream dependencies are inspected, evidence contracts are preserved,
and results are stored in the evidence store and private user history.
"""
from __future__ import annotations

import json
import time
from typing import Any, Optional

from shared.utils import sample_data
from shared.utils.records import utcnow

from .clients import AgentRejected, HttpClient, InProcClient, client_for, load_manifest
from .database import ExecutionRecord, SessionLocal
from .orchestrator import (
    _previous_evidence,
    _validate,
    default_flow_path,
    discover_inputs,
    load_flow,
    new_workflow,
    workflow_id_for,
)
from .rollup import derive_final_outcome, derive_status
from .store import FileStore

STAGE_METADATA = {
    "receiving": {
        "title": "Receiving Agent",
        "description": "Inspects inbound cartons, compares PO lines with received quantities, and verifies carton/unit damage and supplier quality.",
        "version": "1.0.0",
        "owner": "@team",
        "prerequisites": [],
        "sample_units": ["UNIT-0001", "UNIT-0004", "UNIT-0005"],
        "input_types": ["unit_id", "org_id", "po_details", "photos"],
    },
    "prep": {
        "title": "Prep Agent",
        "description": "Verifies FBA compliance: polybag seals, suffocation warnings, FNSKU label placement, barcode coverage, and prep fee pricing.",
        "version": "1.0.0",
        "owner": "@team",
        "prerequisites": ["receiving"],
        "sample_units": ["UNIT-0002", "UNIT-0003", "UNIT-0005"],
        "input_types": ["unit_id", "org_id", "work_order", "fba_shipment_id", "photos"],
    },
    "pack": {
        "title": "Pack Agent",
        "description": "Performs MFN/3PL order packing verification using order-blind vision and deterministic matching. Validates items present, quantities, and box completeness.",
        "version": "2.0.0",
        "owner": "@team",
        "prerequisites": ["receiving"],
        "sample_units": ["UNIT-0006", "UNIT-0007", "UNIT-0008"],
        "input_types": ["unit_id", "org_id", "order_lines", "photos"],
    },
    "returns": {
        "title": "Returns Agent",
        "description": "Evaluates customer returns, performs condition grading, checks item completeness and serial numbers, and determines disposition (restock, liquidate, dispose).",
        "version": "1.0.0",
        "owner": "@team",
        "prerequisites": [],
        "sample_units": ["UNIT-0014", "UNIT-0016", "UNIT-0023", "UNIT-0003"],
        "input_types": ["unit_id", "org_id", "return_id", "order_id", "photos"],
    },
    "recovery": {
        "title": "Recovery Agent",
        "description": "Audits Amazon fee reports (inbound defect, refund without return, weight tier, lost inbound) against upstream evidence and builds claim dossiers.",
        "version": "2.0.0",
        "owner": "@team",
        "prerequisites": ["prep", "returns"],
        "sample_units": ["UNIT-0002", "UNIT-0003", "UNIT-0004", "UNIT-0005"],
        "input_types": ["unit_id", "org_id"],
    },
}


def check_agent_dependencies(stage: str, unit_id: str, org_id: str, store: FileStore) -> dict:
    """Analyze whether required or beneficial upstream evidence exists for this agent."""
    deps = {
        "stage": stage,
        "unit_id": unit_id,
        "org_id": org_id,
        "has_prerequisites": True,
        "details": [],
        "available_upstream": [],
        "missing_upstream": [],
    }

    workflow_id = f"WF-{org_id}-{unit_id}"
    wf = store.load_workflow(workflow_id)
    available_records = {}
    if wf:
        for rid in wf.get("evidence_references", []):
            rec = store.get_evidence(rid)
            if rec:
                available_records[rec.get("stage")] = rid
                deps["available_upstream"].append({"stage": rec.get("stage"), "record_id": rid})

    if stage == "receiving":
        # Receiving has no upstream prerequisites
        deps["details"].append("Receiving is the primary entry point and has no upstream prerequisites.")

    elif stage == "prep":
        # Prep benefits from Receiving evidence
        if "receiving" in available_records:
            deps["details"].append(f"Receiving evidence found ({available_records['receiving']}). Upstream verification complete.")
        else:
            deps["details"].append("Receiving evidence not found in current store. Prep can execute, but unit lineage is unverified.")
            deps["missing_upstream"].append("receiving")

    elif stage == "pack":
        # Check if route is FBA
        route = sample_data.route(unit_id, org_id) if hasattr(sample_data, "route") else "unknown"
        if route == "fba":
            deps["has_prerequisites"] = False
            deps["details"].append("Unit route is FBA (Amazon-packed). Pack Manager is designated for MFN/3PL orders.")
        if "receiving" in available_records:
            deps["details"].append(f"Receiving evidence found ({available_records['receiving']}).")
        else:
            deps["missing_upstream"].append("receiving")
            deps["details"].append("No upstream Receiving record found. Packing list will be judged based on direct order captures.")

    elif stage == "returns":
        has_return = sample_data.has("returns", unit_id, org_id)
        if not has_return:
            deps["has_prerequisites"] = False
            deps["details"].append(f"Unit {unit_id} has no return event in the dataset. A customer return order is required.")
        else:
            deps["details"].append(f"Customer return record found for {unit_id}.")

    elif stage == "recovery":
        has_fees = bool(sample_data.fee_lines(unit_id, org_id))
        if not has_fees:
            deps["details"].append(f"No Amazon fee lines recorded for {unit_id} in {org_id}.")
        else:
            deps["details"].append(f"Fee lines found for {unit_id}.")
            
        prep_rec = available_records.get("prep")
        ret_rec = available_records.get("returns")
        
        if prep_rec:
            deps["details"].append(f"Prep evidence available ({prep_rec}). Inbound defect fee claims can be supported.")
        else:
            deps["missing_upstream"].append("prep")
            deps["details"].append("Missing Prep evidence. Inbound defect fees will be SILENT (cannot dispute without proof).")

        if ret_rec:
            deps["details"].append(f"Returns evidence available ({ret_rec}). Unreturned refund claims can be supported.")
        else:
            deps["missing_upstream"].append("returns")
            deps["details"].append("Missing Returns evidence. Refund-without-return fees will be SILENT.")

    return deps


def run_agent_independently(
    stage: str,
    unit_id: str,
    org_id: str,
    user_id: str,
    store: FileStore,
    custom_inputs: Optional[list] = None,
    custom_context: Optional[dict] = None,
) -> dict:
    """Execute a single agent independently without running other pipeline stages."""
    if stage not in STAGE_METADATA:
        raise ValueError(f"Unknown agent stage '{stage}'. Valid stages: {list(STAGE_METADATA.keys())}")

    manifest = load_manifest(stage)
    client = client_for(stage)
    t0 = time.monotonic()

    # Discover upstream evidence already in the store for this unit
    workflow_id = f"WF-{org_id}-{unit_id}"
    existing_wf = store.load_workflow(workflow_id)
    upstream_evidence = []
    if existing_wf:
        for rid in existing_wf.get("evidence_references", []):
            rec = store.get_evidence(rid)
            if rec and rec.get("stage") != stage:
                upstream_evidence.append(rec)

    route = sample_data.route(unit_id, org_id) if hasattr(sample_data, "route") else "unknown"
    inputs = custom_inputs if custom_inputs is not None else discover_inputs(unit_id, stage)

    # Build standardized Agent Input request
    request = {
        "schema_version": "1.0",
        "request_id": f"IND-{stage.upper()}-{org_id}-{unit_id}-{int(time.time())}",
        "workflow_id": workflow_id,
        "stage": stage,
        "subject": {
            "org_id": org_id,
            "subject_id": unit_id,
            "route": route,
        },
        "inputs": inputs,
        "previous_evidence": upstream_evidence,
        "context": {
            "overrides": existing_wf.get("overrides", []) if existing_wf else [],
            "case": {
                "route": route,
                "returned": sample_data.has("returns", unit_id, org_id),
                **(custom_context or {})
            },
        },
    }

    # Execute agent
    try:
        out = client.run(request, timeout_s=30.0)
    except AgentRejected as ar:
        raise LookupError(f"Agent {stage} rejected execution for {unit_id} in {org_id}: {ar}")

    # Validate agent output against official schema and contracts
    dummy_wf = {
        "workflow_id": workflow_id,
        "org_id": org_id,
        "subject_id": unit_id,
    }
    validation_errors = _validate(out, dummy_wf, stage)
    if validation_errors:
        raise ValueError(f"Agent {stage} returned invalid output: {'; '.join(validation_errors)}")

    evidence = out["evidence"]
    record_id = evidence["record_id"]
    latency_ms = int((time.monotonic() - t0) * 1000)

    # Check if record_id already exists with different content; version it if needed to preserve immutability
    existing_rec = store.get_evidence(record_id)
    if existing_rec and existing_rec.get("content_hash") != evidence.get("content_hash"):
        from shared.utils.hashing import seal
        new_rid = f"{record_id}-r{int(time.time())}"
        evidence["record_id"] = new_rid
        evidence = seal(evidence)
        out["evidence"] = evidence
        record_id = new_rid

    # Store evidence immutably
    store.put_evidence(evidence)

    # If workflow exists, update this stage without corrupting unrelated stages
    if existing_wf:
        if record_id not in existing_wf["evidence_references"]:
            existing_wf["evidence_references"].append(record_id)
        for sr in existing_wf.get("stage_results", []):
            if sr["stage"] == stage:
                sr["state"] = "completed" if evidence["status"] == "completed" else "error"
                sr["record_id"] = record_id
                sr["verdict"] = evidence["decision"]["verdict"]
                sr["outcome"] = evidence["decision"]["outcome"]
                sr["finished_at"] = utcnow()
                sr["duration_ms"] = latency_ms
        store.save_workflow(existing_wf)

    # Save to user's private execution history in SQLite
    db = SessionLocal()
    try:
        record = ExecutionRecord(
            user_id=user_id,
            execution_type="agent",
            stage=stage,
            workflow_id=workflow_id,
            unit_id=unit_id,
            org_id=org_id,
            status=evidence.get("status", "completed"),
            verdict=evidence["decision"].get("verdict"),
            outcome=evidence["decision"].get("outcome"),
            record_id=record_id,
            result_json=json.dumps({
                "output": out,
                "evidence": evidence,
                "latency_ms": latency_ms,
            }),
        )
        db.add(record)
        db.commit()
    finally:
        db.close()

    dep_analysis = check_agent_dependencies(stage, unit_id, org_id, store)

    return {
        "status": "completed",
        "stage": stage,
        "agent_id": evidence.get("agent_id"),
        "record_id": record_id,
        "verdict": evidence["decision"].get("verdict"),
        "outcome": evidence["decision"].get("outcome"),
        "evidence": evidence,
        "output": out,
        "latency_ms": latency_ms,
        "dependencies": dep_analysis,
    }
