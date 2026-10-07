from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.schemas.ai import AIAssessmentResponse, AIStatusResponse
from app.services.agent import RecoveryAgent
from app.services.llm import LLMService
from app.services.vector_retrieval import VectorRetrievalService
from app.services import tools
from app.models.entities import AIAssessment, Charge
from app.config import settings

router = APIRouter(prefix="/ai", tags=["AI Recovery Agent"])

@router.get("/status", response_model=AIStatusResponse)
def get_ai_status(db: Session = Depends(get_db)):
    """Reports status of AI Layer and semantic vector index."""
    idx_info = VectorRetrievalService.get_index_status(db)
    return AIStatusResponse(
        llm_configured=LLMService.is_available(),
        llm_model=settings.LLM_MODEL,
        vector_index_status=idx_info["status"],
        indexed_evidence_count=idx_info["indexed_count"],
        phase=2
    )

@router.post("/charges/{charge_id}/investigate", response_model=AIAssessmentResponse)
def investigate_charge_endpoint(charge_id: str, db: Session = Depends(get_db)):
    """Runs the full AI recovery agent workflow on a specific charge."""
    try:
        return RecoveryAgent.investigate_charge(charge_id, db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"AI investigation error: {str(e)}")

@router.get("/charges/{charge_id}", response_model=AIAssessmentResponse)
def get_ai_assessment_endpoint(charge_id: str, db: Session = Depends(get_db)):
    """Retrieves an existing AI assessment for a charge, or executes investigation if none exists yet."""
    charge = tools.get_charge(charge_id, db)
    if not charge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Charge '{charge_id}' not found")

    existing_ai = db.query(AIAssessment).filter(AIAssessment.charge_id == charge_id).first()
    if existing_ai:
        # Load evidence details
        ev_details = []
        for eid in (existing_ai.evidence_ids or []):
            rec = tools.get_evidence(eid, db)
            if rec:
                ev_details.append({
                    "evidence_id": rec.evidence_id,
                    "evidence_type": rec.evidence_type,
                    "result": rec.result,
                    "source": rec.source,
                    "timestamp": str(rec.timestamp),
                    "description": rec.description
                })

        return AIAssessmentResponse(
            charge_id=existing_ai.charge_id,
            verdict=existing_ai.verdict,
            reason=existing_ai.reason,
            claim_amount=existing_ai.claim_amount,
            evidence_ids=existing_ai.evidence_ids or [],
            evidence_strength=existing_ai.evidence_strength,
            missing_information=existing_ai.missing_information or [],
            charge_category=existing_ai.charge_category or "general_dispute",
            relevant_evidence_types=[],
            is_fallback=existing_ai.is_fallback,
            agreement_with_deterministic=existing_ai.agreement_with_deterministic,
            deterministic_verdict=None,
            evidence_details=ev_details,
            created_at=existing_ai.created_at
        )

    # If not yet investigated, run investigation
    return RecoveryAgent.investigate_charge(charge_id, db)
