from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.entities import Charge, Assessment
from app.schemas.entities import (
    ChargeResponse, ChargeDetailResponse, AssessChargeResponse, EvidenceResponse
)
from app.schemas.investigation import InvestigationResponse
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService
from app.services.assessment import AssessmentService
from app.services.investigation import InvestigationGraphService

router = APIRouter(prefix="/charges", tags=["Charges"])

@router.get("", response_model=List[ChargeResponse])
def get_charges(
    verdict: Optional[str] = Query(None, description="Filter by verdict: SUPPORTED, CONTRADICTED, SILENT, PENDING"),
    reason: Optional[str] = Query(None, description="Filter by reason keyword"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search across IDs and SKU"),
    db: Session = Depends(get_db)
):
    query = db.query(Charge).outerjoin(Assessment)

    if verdict:
        v_upper = verdict.strip().upper()
        if v_upper == "PENDING":
            query = query.filter(Assessment.assessment_id.is_(None))
        else:
            query = query.filter(Assessment.verdict == v_upper)

    if reason:
        query = query.filter(Charge.reason.ilike(f"%{reason.strip()}%"))

    if status:
        query = query.filter(Charge.status == status.strip().upper())

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Charge.charge_id.ilike(s)) |
            (Charge.shipment_id.ilike(s)) |
            (Charge.order_id.ilike(s)) |
            (Charge.sku.ilike(s)) |
            (Charge.reason.ilike(s))
        )

    charges = query.order_by(Charge.charge_date.desc()).all()
    return charges

@router.get("/{charge_id}", response_model=ChargeDetailResponse)
def get_charge_details(charge_id: str, db: Session = Depends(get_db)):
    charge = db.query(Charge).filter(Charge.charge_id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail=f"Charge '{charge_id}' not found")

    resolution = EntityResolutionService.resolve_charge(db, charge)
    relevant_evidence, _ = EvidenceRetrievalService.retrieve_evidence_for_charge(db, charge, resolution)

    evidence_responses = [EvidenceResponse.model_validate(e) for e in relevant_evidence]

    charge_resp = ChargeDetailResponse(
        charge_id=charge.charge_id,
        shipment_id=charge.shipment_id,
        order_id=charge.order_id,
        sku=charge.sku,
        reason=charge.reason,
        amount=charge.amount,
        currency=charge.currency,
        charge_date=charge.charge_date,
        status=charge.status,
        assessment=charge.assessment,
        resolution=resolution,
        relevant_evidence=evidence_responses
    )
    return charge_resp

@router.get("/{charge_id}/investigation", response_model=InvestigationResponse)
def get_charge_investigation(charge_id: str, db: Session = Depends(get_db)):
    try:
        return InvestigationGraphService.get_investigation_graph(charge_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating investigation graph: {str(e)}")

@router.post("/{charge_id}/assess", response_model=AssessChargeResponse)
def assess_single_charge(charge_id: str, db: Session = Depends(get_db)):
    try:
        assessment = AssessmentService.assess_charge(db, charge_id)
        return assessment
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating assessment: {str(e)}")

@router.post("/assess-all", response_model=List[AssessChargeResponse])
def assess_all_charges(db: Session = Depends(get_db)):
    charges = db.query(Charge).all()
    results = []
    for c in charges:
        res = AssessmentService.assess_charge(db, c.charge_id)
        results.append(res)
    return results
