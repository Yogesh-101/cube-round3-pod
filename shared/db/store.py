import json
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound

from orchestration.store import Store
from shared.db.models import WorkflowModel, EvidenceModel
from shared.db.session import SessionLocal, engine, Base

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

class SqlStore(Store):
    """Database implementation of the Store interface using SQLAlchemy."""
    
    def __init__(self, session_factory=SessionLocal):
        self.session_factory = session_factory

    def save_workflow(self, wf: dict) -> None:
        with self.session_factory() as db:
            db_wf = db.query(WorkflowModel).filter(WorkflowModel.workflow_id == wf["workflow_id"]).first()
            if not db_wf:
                db_wf = WorkflowModel(
                    workflow_id=wf["workflow_id"],
                    org_id=wf["org_id"],
                    subject_id=wf["subject_id"]
                )
                db.add(db_wf)
            
            db_wf.schema_version = wf.get("schema_version", "1.0")
            db_wf.flow_id = wf.get("flow_id")
            db_wf.context = wf.get("context", {})
            db_wf.status = wf.get("status")
            db_wf.status_reason = wf.get("status_reason")
            db_wf.current_stage = wf.get("current_stage")
            db_wf.previous_stage = wf.get("previous_stage")
            db_wf.stage_results = wf.get("stage_results", [])
            db_wf.evidence_references = wf.get("evidence_references", [])
            db_wf.timestamps = wf.get("timestamps", {})
            db_wf.errors = wf.get("errors", [])
            db_wf.overrides = wf.get("overrides", [])
            db_wf.halted = wf.get("halted")
            db_wf.final_outcome = wf.get("final_outcome")
            db_wf.transitions = wf.get("transitions", [])
            
            db.commit()

    def load_workflow(self, workflow_id: str) -> Optional[dict]:
        with self.session_factory() as db:
            db_wf = db.query(WorkflowModel).filter(WorkflowModel.workflow_id == workflow_id).first()
            if not db_wf:
                return None
            return {
                "schema_version": db_wf.schema_version,
                "workflow_id": db_wf.workflow_id,
                "flow_id": db_wf.flow_id,
                "org_id": db_wf.org_id,
                "subject_id": db_wf.subject_id,
                "context": db_wf.context,
                "status": db_wf.status,
                "status_reason": db_wf.status_reason,
                "current_stage": db_wf.current_stage,
                "previous_stage": db_wf.previous_stage,
                "stage_results": db_wf.stage_results,
                "evidence_references": db_wf.evidence_references,
                "timestamps": db_wf.timestamps,
                "errors": db_wf.errors,
                "overrides": db_wf.overrides,
                "halted": db_wf.halted,
                "final_outcome": db_wf.final_outcome,
                "transitions": db_wf.transitions
            }

    def put_evidence(self, record: dict) -> None:
        with self.session_factory() as db:
            db_ev = db.query(EvidenceModel).filter(EvidenceModel.record_id == record["record_id"]).first()
            if not db_ev:
                db_ev = EvidenceModel(record_id=record["record_id"])
                db.add(db_ev)
                
            db_ev.schema_version = record.get("schema_version", "1.0")
            db_ev.workflow_id = record.get("workflow_id")
            db_ev.stage = record.get("stage")
            db_ev.agent_id = record.get("agent_id")
            db_ev.subject = record.get("subject", {})
            db_ev.inputs = record.get("inputs", [])
            db_ev.checks = record.get("checks", [])
            db_ev.decision = record.get("decision", {})
            db_ev.model = record.get("model")
            db_ev.status = record.get("status")
            db_ev.error = record.get("error")
            db_ev.payload = record.get("payload")
            db_ev.timestamps = record.get("timestamps", {})
            
            db.commit()

    def get_evidence(self, record_id: str) -> Optional[dict]:
        with self.session_factory() as db:
            db_ev = db.query(EvidenceModel).filter(EvidenceModel.record_id == record_id).first()
            if not db_ev:
                return None
            return {
                "schema_version": db_ev.schema_version,
                "record_id": db_ev.record_id,
                "workflow_id": db_ev.workflow_id,
                "stage": db_ev.stage,
                "agent_id": db_ev.agent_id,
                "subject": db_ev.subject,
                "inputs": db_ev.inputs,
                "checks": db_ev.checks,
                "decision": db_ev.decision,
                "model": db_ev.model,
                "status": db_ev.status,
                "error": db_ev.error,
                "payload": db_ev.payload,
                "timestamps": db_ev.timestamps
            }
