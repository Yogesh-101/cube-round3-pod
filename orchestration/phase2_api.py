"""Phase 2 API Endpoints.

Mounts the intelligent investigation endpoints onto the orchestrator.
These endpoints use the Phase 1 store but apply Phase 2 reasoning.
"""
from __future__ import annotations

import json
from fastapi import APIRouter, HTTPException, Depends
from typing import Any

from orchestration.store import FileStore
from shared.utils import sample_data
from shared.intelligence.investigation_runner import run_full_investigation

router = APIRouter(prefix="/phase2", tags=["phase2"])

def get_store() -> FileStore:
    return FileStore()


@router.get("/health")
def health() -> dict:
    """Check Phase 2 API health."""
    return {"status": "ok", "version": "2.0"}


@router.post("/investigate/{workflow_id}")
def investigate_workflow(workflow_id: str, store: FileStore = Depends(get_store)) -> dict:
    """Run an intelligent investigation over a completed or failed workflow."""
    wf = store.load_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    subject = wf.get("subject", {})
    subject_id = subject.get("subject_id")
    org_id = subject.get("org_id")
    
    if not subject_id or not org_id:
        raise HTTPException(status_code=400, detail="Workflow missing subject/org_id")
        
    # Get all evidence for this workflow
    evidence_records = []
    for rid in wf.get("evidence_references", []):
        rec = store.get_evidence(rid)
        if rec:
            evidence_records.append(rec)
            
    # Load charges (fee lines) from sample data
    charges = sample_data.fee_lines(subject_id, org_id)
    if not charges:
        # No charges to investigate, but we can still return a result
        charges = []
        
    # Run the intelligent investigation
    result = run_full_investigation(
        workflow_id=workflow_id,
        subject_id=subject_id,
        org_id=org_id,
        charges=charges,
        evidence_records=evidence_records,
        workflow_transitions=wf.get("transitions", []),
    )
    
    return result.to_dict()


@router.get("/investigation/{workflow_id}")
def get_investigation(workflow_id: str, store: FileStore = Depends(get_store)) -> dict:
    """Get the investigation results for a workflow.
    
    In a real system, these would be cached/stored. Here we just compute on the fly.
    """
    return investigate_workflow(workflow_id, store)
