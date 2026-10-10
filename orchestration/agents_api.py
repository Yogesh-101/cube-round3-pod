"""FastAPI router for independent agent execution and inspection.

Endpoints:
- GET  /agents
- GET  /agents/{stage}/info
- GET  /agents/{stage}/dependencies
- POST /agents/{stage}/run
- GET  /agents/{stage}/history
"""
from __future__ import annotations

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from .agents_service import (
    STAGE_METADATA,
    check_agent_dependencies,
    run_agent_independently,
)
from .auth import get_current_user
from .clients import HttpClient, client_for, load_manifest
from .database import ExecutionRecord, SessionLocal, User, get_db
from .store import FileStore

router = APIRouter(prefix="/agents", tags=["agents"])


def get_store() -> FileStore:
    return FileStore()


class RunAgentRequest(BaseModel):
    unit_id: str
    org_id: str = "org_demo_alpha"
    custom_inputs: Optional[list] = None
    custom_context: Optional[dict] = None


@router.get("")
def list_agents(store: FileStore = Depends(get_store)) -> list[dict]:
    """List all five specialized agents with operational status and capabilities."""
    result = []
    for stage, meta in STAGE_METADATA.items():
        try:
            client = client_for(stage)
            agent_status = "online"
            if isinstance(client, HttpClient):
                try:
                    h = client.health()
                    agent_status = h.get("status", "online")
                except Exception:
                    agent_status = "offline"
            manifest = load_manifest(stage)
        except Exception as e:
            agent_status = "degraded"
            manifest = {"agent_id": f"{stage}-agent", "mode": "inproc"}

        result.append({
            "stage": stage,
            "title": meta["title"],
            "description": meta["description"],
            "version": meta["version"],
            "status": agent_status,
            "agent_id": manifest.get("agent_id"),
            "mode": manifest.get("mode", "inproc"),
            "prerequisites": meta["prerequisites"],
            "sample_units": meta["sample_units"],
        })
    return result


@router.get("/{stage}/info")
def get_agent_info(stage: str) -> dict:
    """Get metadata, instructions, and configuration for a single agent."""
    stage_lower = stage.lower()
    if stage_lower not in STAGE_METADATA:
        raise HTTPException(status_code=404, detail=f"Agent '{stage}' not found.")

    meta = STAGE_METADATA[stage_lower]
    manifest = load_manifest(stage_lower)
    return {
        "stage": stage_lower,
        **meta,
        "manifest": manifest,
    }


@router.get("/{stage}/dependencies")
def get_agent_dependencies(
    stage: str,
    unit_id: str = Query(..., description="Target unit identifier e.g. UNIT-0001"),
    org_id: str = Query("org_demo_alpha", description="Tenant organization ID"),
    store: FileStore = Depends(get_store),
) -> dict:
    """Inspect upstream evidence dependencies for an agent execution."""
    stage_lower = stage.lower()
    if stage_lower not in STAGE_METADATA:
        raise HTTPException(status_code=404, detail=f"Agent '{stage}' not found.")

    return check_agent_dependencies(stage_lower, unit_id, org_id, store)


@router.post("/{stage}/run")
def execute_agent(
    stage: str,
    body: RunAgentRequest,
    current_user: User = Depends(get_current_user),
    store: FileStore = Depends(get_store),
) -> dict:
    """Execute a single agent independently. Validates contracts and records evidence."""
    stage_lower = stage.lower()
    if stage_lower not in STAGE_METADATA:
        raise HTTPException(status_code=404, detail=f"Agent '{stage}' not found.")

    unit_id = (body.unit_id or "").strip()
    org_id = (body.org_id or "").strip()
    if not unit_id or not org_id:
        raise HTTPException(status_code=422, detail="unit_id and org_id are required.")

    try:
        result = run_agent_independently(
            stage=stage_lower,
            unit_id=unit_id,
            org_id=org_id,
            user_id=current_user.id,
            store=store,
            custom_inputs=body.custom_inputs,
            custom_context=body.custom_context,
        )
        return result
    except LookupError as le:
        raise HTTPException(status_code=404, detail=str(le))
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Agent execution error: {str(exc)}")


@router.get("/{stage}/history")
def get_agent_history(
    stage: str,
    current_user: User = Depends(get_current_user),
    db: SessionLocal = Depends(get_db),
) -> list[dict]:
    """Retrieve history of independent runs for this agent executed by current user."""
    stage_lower = stage.lower()
    records = (
        db.query(ExecutionRecord)
        .filter(ExecutionRecord.user_id == current_user.id, ExecutionRecord.stage == stage_lower)
        .order_by(ExecutionRecord.created_at.desc())
        .limit(25)
        .all()
    )
    return [r.to_dict() for r in records]
