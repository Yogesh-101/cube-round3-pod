from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database import get_db
from app.models.entities import Charge, Evidence
from app.schemas.entities import EvidenceResponse
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService

router = APIRouter(tags=["Evidence"])

@router.get("/evidence", response_model=List[EvidenceResponse])
def get_all_evidence(
    evidence_type: Optional[str] = Query(None, description="Filter by type: prep, packing, receiving, returns"),
    search: Optional[str] = Query(None, description="Search across IDs, SKU, source, description"),
    db: Session = Depends(get_db)
):
    query = db.query(Evidence)
    if evidence_type:
        query = query.filter(Evidence.evidence_type == evidence_type.strip().lower())
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Evidence.evidence_id.ilike(s)) |
            (Evidence.shipment_id.ilike(s)) |
            (Evidence.order_id.ilike(s)) |
            (Evidence.sku.ilike(s)) |
            (Evidence.source.ilike(s)) |
            (Evidence.description.ilike(s))
        )
    return query.order_by(Evidence.timestamp.desc()).all()

@router.get("/charges/{charge_id}/evidence", response_model=Dict[str, Any])
def get_charge_evidence(charge_id: str, db: Session = Depends(get_db)):
    charge = db.query(Charge).filter(Charge.charge_id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail=f"Charge '{charge_id}' not found")

    resolution = EntityResolutionService.resolve_charge(db, charge)
    relevant, all_linked = EvidenceRetrievalService.retrieve_evidence_for_charge(db, charge, resolution)

    return {
        "charge_id": charge_id,
        "relevant_evidence": [EvidenceResponse.model_validate(e) for e in relevant],
        "all_linked_evidence": [EvidenceResponse.model_validate(e) for e in all_linked],
        "relevant_count": len(relevant),
        "total_linked_count": len(all_linked),
        "resolution": resolution
    }
