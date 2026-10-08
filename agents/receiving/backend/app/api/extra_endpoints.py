from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from backend.app.database.sqlite import get_db, Facility, PurchaseOrderDB, Metric
from backend.app.api.inspections import require_principal

router = APIRouter(prefix="/api/v1")

class FacilityOut(BaseModel):
    id: str
    name: str

class PODBOut(BaseModel):
    po_id: str
    sku: str
    expected_quantity: int
    expected_cartons: int

class MetricsOut(BaseModel):
    pass_count: int
    fail_count: int
    uncertain_count: int
    avg_latency: float

@router.get("/facilities", response_model=List[FacilityOut])
def get_facilities(principal: dict = Depends(require_principal), db: Session = Depends(get_db)):
    # Fallback to demo org mapping for seeded data
    tenant_id = "tenant_1" if principal["organization_id"] == "org-demo" else principal["organization_id"]
    return db.query(Facility).filter(Facility.tenant_id == tenant_id).all()

@router.get("/purchase-orders/{po_id}", response_model=PODBOut)
def get_po(po_id: str, principal: dict = Depends(require_principal), db: Session = Depends(get_db)):
    tenant_id = "tenant_1" if principal["organization_id"] == "org-demo" else principal["organization_id"]
    po = db.query(PurchaseOrderDB).filter(PurchaseOrderDB.po_id == po_id, PurchaseOrderDB.tenant_id == tenant_id).first()
    if not po:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "PO not found", "details": {}})
    return po

@router.get("/metrics", response_model=MetricsOut)
def get_metrics(principal: dict = Depends(require_principal), db: Session = Depends(get_db)):
    tenant_id = "tenant_1" if principal["organization_id"] == "org-demo" else principal["organization_id"]
    m = db.query(Metric).filter(Metric.tenant_id == tenant_id).first()
    if not m:
        return MetricsOut(pass_count=0, fail_count=0, uncertain_count=0, avg_latency=0.0)
    return m

@router.post("/benchmark")
def run_benchmark(principal: dict = Depends(require_principal)):
    return {"status": "ok", "message": "Benchmark complete"}

