from typing import List, Optional
from pydantic import BaseModel, Field

class PrepInput(BaseModel):
    subject_id: str
    org_id: str
    work_order_id: str
    fba_shipment_id: str
    sku: str
    asin: str
    fnsku: str
    polybag_present_sealed: str = "not_required"
    suffocation_warning: str = "not_required"
    fnsku_label_placement: str = "not_required"
    original_barcode_covered: str = "not_required"
    expiry_date: str = "not_required"
    handling_marks: str = "not_required"
    prep_price_usd: float = 0.0
    operator_id: str
    photo_refs: List[str] = Field(default_factory=list)
    captured_at: str
    
class PrepDecision(BaseModel):
    verdict: str
    outcome: str
    checks: List[dict]
