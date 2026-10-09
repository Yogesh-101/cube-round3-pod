from sqlalchemy import Column, String, JSON, DateTime, ForeignKey, Float, Boolean, Text
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from shared.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class WorkflowModel(Base):
    __tablename__ = "workflows"
    
    workflow_id = Column(String, primary_key=True, index=True)
    schema_version = Column(String, default="1.0")
    flow_id = Column(String)
    org_id = Column(String, index=True)
    subject_id = Column(String, index=True)
    context = Column(JSON) # Store full case context
    status = Column(String)
    status_reason = Column(String)
    current_stage = Column(String, nullable=True)
    previous_stage = Column(String, nullable=True)
    stage_results = Column(JSON)
    evidence_references = Column(JSON)
    timestamps = Column(JSON)
    errors = Column(JSON)
    overrides = Column(JSON)
    halted = Column(JSON, nullable=True)
    final_outcome = Column(JSON, nullable=True)
    transitions = Column(JSON)
    
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

class EvidenceModel(Base):
    __tablename__ = "evidence"
    
    record_id = Column(String, primary_key=True, index=True)
    schema_version = Column(String, default="1.0")
    workflow_id = Column(String, index=True)
    stage = Column(String, index=True)
    agent_id = Column(String)
    subject = Column(JSON)
    inputs = Column(JSON)
    checks = Column(JSON)
    decision = Column(JSON)
    model = Column(JSON, nullable=True)
    status = Column(String)
    error = Column(JSON, nullable=True)
    payload = Column(JSON, nullable=True)
    timestamps = Column(JSON)
    
    created_at = Column(DateTime, default=utcnow)
    
class InvestigationModel(Base):
    __tablename__ = "investigations"
    
    investigation_id = Column(String, primary_key=True, default=lambda: f"INV-{uuid.uuid4().hex[:8]}")
    charge_id = Column(String, index=True)
    workflow_id = Column(String, index=True)
    org_id = Column(String)
    unit_id = Column(String)
    charge_type = Column(String)
    amount_usd = Column(Float)
    
    # JSON encoded lists/dicts
    evidence_health = Column(JSON)
    det_verdict = Column(String, nullable=True)
    det_reason = Column(String, nullable=True)
    det_evidence_used = Column(JSON, nullable=True)
    ai_verdict = Column(String, nullable=True)
    ai_reason = Column(String, nullable=True)
    ai_evidence_used = Column(JSON, nullable=True)
    
    final_verdict = Column(String)
    final_reason = Column(String)
    decision = Column(String)
    
    created_at = Column(DateTime, default=utcnow)

class InvestigationGapModel(Base):
    __tablename__ = "investigation_gaps"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    charge_id = Column(String, index=True)
    subject_id = Column(String, index=True)
    order_id = Column(String, nullable=True)
    shipment_id = Column(String, nullable=True)
    sku = Column(String, nullable=True)
    missing_stage = Column(String)
    missing_check_keys = Column(JSON)
    responsible_agent = Column(String)
    status = Column(String)
    correlation_id = Column(String, index=True)
    created_at = Column(DateTime, default=utcnow)
