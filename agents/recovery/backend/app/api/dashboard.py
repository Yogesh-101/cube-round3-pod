from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict

from app.database import get_db
from app.models.entities import Charge, Assessment, Evidence
from app.schemas.entities import DashboardSummary
from app.schemas.health import EvidenceHealthMetrics
from app.services.health import EvidenceHealthService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    charges = db.query(Charge).all()
    assessments = db.query(Assessment).all()
    evidence_records = db.query(Evidence).all()

    total_charges = len(charges)
    total_charge_amount = sum(c.amount for c in charges)

    supported_count = 0
    contradicted_count = 0
    silent_count = 0
    potential_claim_amount = 0.0

    for asm in assessments:
        v = asm.verdict.upper()
        if v == "SUPPORTED":
            supported_count += 1
        elif v == "CONTRADICTED":
            contradicted_count += 1
            potential_claim_amount += asm.claim_amount
        elif v == "SILENT":
            silent_count += 1

    pending_count = total_charges - (supported_count + contradicted_count + silent_count)
    if pending_count < 0:
        pending_count = 0

    verdict_breakdown = {
        "SUPPORTED": supported_count,
        "CONTRADICTED": contradicted_count,
        "SILENT": silent_count,
        "PENDING": pending_count
    }

    # Evidence type counts
    evidence_type_counts: Dict[str, int] = {}
    for ev in evidence_records:
        t = ev.evidence_type.lower()
        evidence_type_counts[t] = evidence_type_counts.get(t, 0) + 1

    return DashboardSummary(
        total_charges=total_charges,
        total_charge_amount=round(total_charge_amount, 2),
        supported_count=supported_count,
        contradicted_count=contradicted_count,
        silent_count=silent_count,
        pending_count=pending_count,
        potential_claim_amount=round(potential_claim_amount, 2),
        currency="USD",
        verdict_breakdown=verdict_breakdown,
        evidence_type_counts=evidence_type_counts
    )

@router.get("/evidence-health", response_model=EvidenceHealthMetrics)
def get_evidence_health(db: Session = Depends(get_db)):
    return EvidenceHealthService.get_evidence_health(db)

