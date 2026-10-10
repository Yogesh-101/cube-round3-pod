"""HTTP front door for the orchestrator with real authentication, individual agent execution,
and persistent user workflows.

Endpoints:
  /auth/*                         -> Registration, Login, Logout, Profile, History
  /agents/*                       -> Individual agent execution, info, dependencies, history
  /workflows                      -> List / Run full workflows (Protected)
  /workflows/{id}                 -> Get Workflow State (Protected)
  /workflows/{id}/evidence        -> Bundle workflow plus all its evidence records (Protected)
  /workflows/{id}/resume          -> Continue after a halt / decision / failure (Protected)
  /workflows/{id}/overrides       -> Human-in-the-loop verdict overrides (Protected)
  /health                         -> Orchestrator and agent health checks (Public)
"""
from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from shared.utils import sample_data

from .agents_api import router as agents_router
from .auth import get_current_user, get_optional_user, hash_password
from .auth_api import router as auth_router
from .clients import HttpClient, client_for, load_manifest
from .database import ExecutionRecord, SessionLocal, User, get_db, init_db
from .orchestrator import (
    apply_override,
    bundle,
    default_flow_path,
    flow_stages,
    load_flow,
    resume,
    run_workflow,
)
from .phase2_api import router as phase2_router
from .store import EvidenceConflict, FileStore

STORE = FileStore()
FLOW = os.environ.get("ORCH_FLOW") or default_flow_path()


def seed_demo_user():
    """Ensure a default demo user account exists for seamless grading and demos."""
    db = SessionLocal()
    try:
        demo = db.query(User).filter(User.email == "demo@cube.build").first()
        if not demo:
            demo = User(
                email="demo@cube.build",
                password_hash=hash_password("DemoPassword123!"),
                name="Demo Operator",
                role="operator",
            )
            db.add(demo)
            db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite / PostgreSQL tables and seed demo operator
    init_db()
    seed_demo_user()
    yield


app = FastAPI(
    title="CUBE Round 3 Orchestrator",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router)
app.include_router(agents_router)
app.include_router(phase2_router)


@app.get("/")
def root() -> dict:
    return {
        "service": "CUBE Round 3 Orchestrator",
        "status": "online",
        "health": "/health",
        "docs": "/docs",
        "workflows": "/workflows",
        "agents": "/agents",
        "auth": "/auth/me",
    }


@app.get("/health")
def health() -> dict:
    agents = {}
    for stage in flow_stages(load_flow(FLOW)):
        client = client_for(stage)
        try:
            agents[stage] = client.health() if isinstance(client, HttpClient) else {"status": "ok", "mode": "inproc"}
        except Exception as exc:
            agents[stage] = {"status": "down", "error": str(exc)[:200], "owner": load_manifest(stage)["owner"]}
    ok = all(a["status"] == "ok" for a in agents.values())
    return {"status": "ok" if ok else "degraded", "flow": load_flow(FLOW)["flow_id"], "agents": agents}


@app.get("/workflows")
def list_workflows(
    org_id: str | None = None,
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    p = STORE.root / "workflows"
    if not p.exists():
        return []
    results = []
    for f in sorted(p.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)[:30]:
        try:
            wf = json.loads(f.read_text())
            if not org_id or wf.get("org_id") == org_id:
                results.append(wf)
        except Exception:
            pass
    return results


@app.post("/workflows")
def create(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    org = body.get("org_id")
    subject = body.get("subject_id") or body.get("unit_id")
    if not org or not subject:
        raise HTTPException(422, "org_id and unit_id (or subject_id) are required")

    case = {
        "org_id": org,
        "unit_id": subject,
        "route": body.get("route") or sample_data.route(subject, org),
        "returned": body.get("returned", sample_data.has("returns", subject, org)),
    }

    result = run_workflow(case, load_flow(FLOW), STORE)

    # Persist in user's private execution history
    try:
        outcome_val = None
        if isinstance(result.get("final_outcome"), dict):
            outcome_val = result["final_outcome"].get("outcome")
        elif isinstance(result.get("final_outcome"), str):
            outcome_val = result["final_outcome"]

        rec = ExecutionRecord(
            user_id=current_user.id,
            execution_type="workflow",
            workflow_id=result.get("workflow_id", f"WF-{org}-{subject}"),
            unit_id=subject,
            org_id=org,
            status=result.get("status", "COMPLETED"),
            outcome=outcome_val,
            result_json=json.dumps(result),
        )
        db.add(rec)
        db.commit()
    except Exception:
        db.rollback()

    return result


def _get(workflow_id: str) -> dict:
    wf = STORE.load_workflow(workflow_id)
    if wf is None:
        raise HTTPException(404, f"no workflow {workflow_id}")
    return wf


@app.get("/workflows/{workflow_id}")
def get(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    return _get(workflow_id)


@app.get("/workflows/{workflow_id}/evidence")
def evidence(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    return bundle(_get(workflow_id), STORE)


@app.post("/workflows/{workflow_id}/resume")
def resume_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    _get(workflow_id)
    return resume(workflow_id, load_flow(FLOW), STORE)


@app.post("/workflows/{workflow_id}/overrides")
def override(
    workflow_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
) -> dict:
    _get(workflow_id)
    try:
        return apply_override(
            workflow_id,
            STORE,
            record_id=body.get("record_id", ""),
            new_verdict=body.get("new_verdict", ""),
            actor=body.get("actor", current_user.name or current_user.email),
            reason=body.get("reason", ""),
            new_outcome=body.get("new_outcome"),
        )
    except (ValueError, EvidenceConflict) as exc:
        raise HTTPException(422, str(exc)) from exc
