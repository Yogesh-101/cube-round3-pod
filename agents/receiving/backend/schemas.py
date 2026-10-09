from typing import List, Optional
from pydantic import BaseModel, Field

class ReceivingInput(BaseModel):
    subject_id: str
    org_id: str
    po_number: str
    po_line: str
    sku: str
    product_title: str
    asin: str
    supplier: str
    qty_ordered: int
    qty_received: int
    cartons_ordered: int
    cartons_received: int
    identity_match: str = "yes"
    carton_damage: str = "none"
    unit_damage: str = "none"
    quality_flags: List[str] = Field(default_factory=list)
    operator_id: str
    photo_refs: List[str] = Field(default_factory=list)
    captured_at: str

class ReceivingDecision(BaseModel):
    verdict: str
    outcome: str
    checks: List[dict]
