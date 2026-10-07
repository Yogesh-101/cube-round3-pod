from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# --- Charge Schemas ---
class ChargeBase(BaseModel):
    charge_id: str = Field(..., description="Unique identifier for the charge")
    shipment_id: Optional[str] = None
    order_id: Optional[str] = None
    sku: Optional[str] = None
    unit_id: Optional[str] = None
    source_dataset: Optional[str] = "internal"
    reason: str = Field(..., description="Reason for the charge (e.g. Packaging Defect, Shortage)")
    amount: float = Field(..., description="Charge monetary amount")
    currency: str = Field("USD", description="Currency ISO code")
    charge_date: Optional[Union[datetime, str]] = None
    status: Optional[str] = "PENDING"

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v):
        if v < 0:
            raise ValueError("Amount cannot be negative")
        return round(float(v), 2)

class ChargeCreate(ChargeBase):
    pass

class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    assessment_id: str
    charge_id: str
    verdict: str  # SUPPORTED, CONTRADICTED, SILENT
    reason: str
    claim_amount: float
    evidence_ids: List[str]
    created_at: datetime

class ChargeResponse(ChargeBase):
    model_config = ConfigDict(from_attributes=True)

    charge_date: datetime
    status: str
    assessment: Optional[AssessmentResponse] = None

# --- Order Schemas ---
class OrderBase(BaseModel):
    order_id: str
    sku: str
    quantity: int = Field(default=1, ge=1)

class OrderCreate(OrderBase):
    pass

class OrderResponse(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

# --- Shipment Schemas ---
class ShipmentBase(BaseModel):
    shipment_id: str
    order_id: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    shipment_date: Optional[Union[datetime, str]] = None

class ShipmentCreate(ShipmentBase):
    pass

class ShipmentResponse(ShipmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shipment_date: datetime

# --- Evidence Schemas ---
class EvidenceBase(BaseModel):
    evidence_id: str
    evidence_type: str = Field(..., description="receiving, prep, packing, returns")
    shipment_id: Optional[str] = None
    order_id: Optional[str] = None
    sku: Optional[str] = None
    unit_id: Optional[str] = None
    source_dataset: Optional[str] = "internal"
    result: str = Field(..., description="PASS, FAIL, VERIFIED, DISCREPANCY, DAMAGED, etc.")
    description: str
    timestamp: Optional[Union[datetime, str]] = None
    source: str = Field(..., description="System or device recording evidence")
    reference_data: Optional[Dict[str, Any]] = None

    @field_validator("evidence_type")
    @classmethod
    def validate_type(cls, v):
        allowed = {"receiving", "prep", "packing", "returns"}
        v_clean = v.strip().lower()
        if v_clean not in allowed:
            raise ValueError(f"evidence_type must be one of {allowed}")
        return v_clean

class EvidenceCreate(EvidenceBase):
    pass

class EvidenceResponse(EvidenceBase):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime

# --- Assessment Schemas ---
class AssessChargeResponse(BaseModel):
    assessment_id: str
    charge_id: str
    verdict: str  # SUPPORTED, CONTRADICTED, SILENT
    claim_amount: float
    reason: str
    evidence_ids: List[str]
    evidence_count: int
    created_at: datetime

# --- Ingestion Schemas ---
class IngestPayload(BaseModel):
    charges: Optional[List[Dict[str, Any]]] = None
    orders: Optional[List[Dict[str, Any]]] = None
    shipments: Optional[List[Dict[str, Any]]] = None
    evidence: Optional[List[Dict[str, Any]]] = None

class IngestRecordError(BaseModel):
    record_type: str
    identifier: Optional[str] = None
    error: str
    raw_data: Optional[Dict[str, Any]] = None

class IngestResult(BaseModel):
    success: bool
    charges_ingested: int
    orders_ingested: int
    shipments_ingested: int
    evidence_ingested: int
    errors: List[IngestRecordError] = []

# --- Resolution & Detailed Charge Schema ---
class EntityResolutionInfo(BaseModel):
    charge_id: str
    shipment_id: Optional[str] = None
    order_id: Optional[str] = None
    sku: Optional[str] = None
    unit_id: Optional[str] = None
    resolution_status: str  # RESOLVED, PARTIALLY_RESOLVED, UNRESOLVED
    resolution_path: str
    notes: List[str] = []

class ChargeDetailResponse(ChargeResponse):
    resolution: Optional[EntityResolutionInfo] = None
    relevant_evidence: List[EvidenceResponse] = []

# --- Dashboard Schemas ---
class DashboardSummary(BaseModel):
    total_charges: int
    total_charge_amount: float
    supported_count: int
    contradicted_count: int
    silent_count: int
    pending_count: int
    potential_claim_amount: float
    currency: str = "USD"
    verdict_breakdown: Dict[str, int]
    evidence_type_counts: Dict[str, int]
