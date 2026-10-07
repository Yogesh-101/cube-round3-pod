from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime

class AIReasoningOutput(BaseModel):
    verdict: str = Field(..., description="Decision: SUPPORTED | CONTRADICTED | SILENT")
    reason: str = Field(..., description="Evidence-backed reasoning")
    claim_amount: float = Field(0.0, description="Calculated recovery claim amount")
    evidence_ids: List[str] = Field(default_factory=list, description="List of verified evidence IDs referenced")
    evidence_strength: str = Field("MODERATE", description="STRONG | MODERATE | WEAK | INSUFFICIENT")
    missing_information: List[str] = Field(default_factory=list, description="Missing records or inconclusive items")

    @field_validator("verdict")
    @classmethod
    def validate_verdict(cls, v: str) -> str:
        clean = v.strip().upper()
        if clean not in {"SUPPORTED", "CONTRADICTED", "SILENT"}:
            raise ValueError(f"Invalid verdict '{clean}'. Must be SUPPORTED, CONTRADICTED, or SILENT.")
        return clean

    @field_validator("evidence_strength")
    @classmethod
    def validate_strength(cls, v: str) -> str:
        clean = v.strip().upper()
        if clean not in {"STRONG", "MODERATE", "WEAK", "INSUFFICIENT"}:
            return "MODERATE"
        return clean

class ChargeUnderstanding(BaseModel):
    category: str
    relevant_evidence_types: List[str]
    relevant_entities: Dict[str, Optional[str]]
    investigation_requirements: List[str]

class AIAssessmentResponse(BaseModel):
    charge_id: str
    verdict: str
    reason: str
    claim_amount: float
    evidence_ids: List[str]
    evidence_strength: str
    missing_information: List[str]
    charge_category: str
    relevant_evidence_types: List[str]
    is_fallback: bool
    agreement_with_deterministic: bool
    deterministic_verdict: Optional[str] = None
    evidence_details: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime

class AIStatusResponse(BaseModel):
    llm_configured: bool
    llm_model: str
    vector_index_status: str
    indexed_evidence_count: int
    phase: int = 2
