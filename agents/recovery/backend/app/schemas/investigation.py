from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class InvestigationNode(BaseModel):
    id: str
    type: str  # "charge", "order", "shipment", "sku", "evidence", "assessment", "decision"
    label: str
    status: Optional[str] = "verified"  # "verified", "missing", "inconclusive", "contradicted", "supported", "silent"
    data: Dict[str, Any] = Field(default_factory=dict)

class InvestigationEdge(BaseModel):
    source: str
    target: str
    relation: str  # "billed_for", "fulfilled_by", "contains_item", "attested_by", "evaluated_by", "concluded_as"
    verified: bool = True

class InvestigationTimelineEvent(BaseModel):
    id: str
    event_type: str
    title: str
    description: str
    timestamp: Optional[datetime] = None
    timestamp_str: str = ""
    source: Optional[str] = None
    evidence_id: Optional[str] = None
    result: Optional[str] = None
    status_badge: Optional[str] = None

class InvestigationResponse(BaseModel):
    charge_id: str
    verdict: str
    claim_amount: float
    currency: str = "USD"
    charge_reason: str
    charge_amount: float
    charge_date: Optional[datetime] = None
    assessment_id: Optional[str] = None
    assessment_reason: str = ""
    evidence_strength: str = "INSUFFICIENT"
    is_ai_evaluated: bool = False
    nodes: List[InvestigationNode] = Field(default_factory=list)
    edges: List[InvestigationEdge] = Field(default_factory=list)
    timeline: List[InvestigationTimelineEvent] = Field(default_factory=list)
    missing_evidence_types: List[str] = Field(default_factory=list)
    supporting_evidence: List[Dict[str, Any]] = Field(default_factory=list)
    contradicting_evidence: List[Dict[str, Any]] = Field(default_factory=list)
    inconclusive_evidence: List[Dict[str, Any]] = Field(default_factory=list)
