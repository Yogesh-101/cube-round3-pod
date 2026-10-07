from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class EvidenceGapItem(BaseModel):
    charge_id: str
    reason: str
    amount: float
    currency: str = "USD"
    gap_type: str  # "NO_EVIDENCE", "UNRESOLVED_ENTITY", "MISSING_EXPECTED_TYPE", "CONFLICTING_EVIDENCE", "INCONCLUSIVE"
    severity: str  # "HIGH", "MEDIUM", "LOW"
    description: str
    expected_types: List[str] = Field(default_factory=list)
    responsible_stage: Optional[str] = None  # Receiving, Prep, Packing, Returns
    missing_evidence: Optional[str] = None
    shipment_id: Optional[str] = None
    order_id: Optional[str] = None
    sku: Optional[str] = None

class EvidenceHealthMetrics(BaseModel):
    total_charges: int
    charges_with_sufficient_evidence: int
    charges_with_evidence_gaps: int
    supported_count: int
    contradicted_count: int
    silent_count: int
    evidence_coverage_percentage: float
    investigations_requiring_attention: int
    evidence_type_distribution: Dict[str, int] = Field(default_factory=dict)
    gap_breakdown: Dict[str, int] = Field(default_factory=dict)
    evidence_gaps: List[EvidenceGapItem] = Field(default_factory=list)
