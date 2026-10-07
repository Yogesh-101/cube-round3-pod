from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.entities import Assessment
from app.schemas.entities import AssessmentResponse

router = APIRouter(prefix="/assessments", tags=["Assessments"])

@router.get("", response_model=List[AssessmentResponse])
def get_assessments(
    verdict: Optional[str] = Query(None, description="Filter by verdict: SUPPORTED, CONTRADICTED, SILENT"),
    db: Session = Depends(get_db)
):
    query = db.query(Assessment)
    if verdict:
        query = query.filter(Assessment.verdict == verdict.strip().upper())
    
    return query.order_by(Assessment.created_at.desc()).all()
