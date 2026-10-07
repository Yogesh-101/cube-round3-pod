from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import os

from app.database import get_db
from app.services.official_adapter import OfficialDataAdapter
from app.services.official_evaluation import run_official_cube_evaluation
from app.services.feedback import EvidenceFeedbackService
from app.models.entities import Charge, Evidence

router = APIRouter(prefix="", tags=["Official Data & Evaluation"])

@router.post("/official/ingest")
def ingest_official_data(
    clear_existing: bool = Query(False, description="Clear existing official records before ingestion"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Ingests the official Cube Build-A-Thon dataset:
    - fee_report_sample.csv
    - upstream/receiving_sample.csv
    - upstream/prep_sample.csv
    - upstream/pack_sample.csv
    - upstream/returns_sample.csv
    Normalizes all records into the existing RecoveryOS database.
    """
    try:
        # Locate data/ directory relative to workspace root
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        data_dir = os.path.join(base_dir, "data")
        if not os.path.exists(data_dir):
            raise HTTPException(status_code=404, detail=f"Official data directory not found at {data_dir}")

        result = OfficialDataAdapter.ingest_all_official_data(
            db=db,
            data_dir=data_dir,
            clear_existing_official_only=clear_existing
        )
        return result.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Official data ingestion failed: {str(e)}")

@router.get("/official/status")
def get_official_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns current counts and status of official Cube records in database.
    """
    official_charges = db.query(Charge).filter(Charge.source_dataset == "cube_official").count()
    internal_charges = db.query(Charge).filter(Charge.source_dataset != "cube_official").count()
    
    official_evidence = db.query(Evidence).filter(Evidence.source_dataset == "cube_official").all()
    evidence_by_type = {}
    for ev in official_evidence:
        etype = ev.evidence_type.lower()
        evidence_by_type[etype] = evidence_by_type.get(etype, 0) + 1

    return {
        "has_official_data": official_charges > 0,
        "official_charges_count": official_charges,
        "internal_charges_count": internal_charges,
        "total_charges_count": official_charges + internal_charges,
        "official_evidence_count": len(official_evidence),
        "official_evidence_by_type": evidence_by_type
    }

@router.get("/official/evaluation")
def get_official_evaluation(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Runs functional evaluation on the official Cube dataset and returns full metrics.
    """
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        data_dir = os.path.join(base_dir, "data")
        results = run_official_cube_evaluation(data_dir=data_dir)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Official evaluation failed: {str(e)}")

@router.post("/feedback/simulate")
def simulate_evidence_feedback(
    charge_id: str = Query(..., description="Target charge identifier"),
    upstream_stage: str = Query(..., description="Responsible stage: receiving, prep, packing, returns"),
    result: str = Query("PASS", description="Inspection verdict: PASS, VERIFIED, DAMAGED, DISCREPANCY"),
    description: Optional[str] = Query(None, description="Optional custom audit description"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Simulates closed-loop upstream evidence resolution:
    Routes request to responsible upstream stage, records verified inspection log,
    and re-triggers investigation for the charge.
    """
    try:
        res = EvidenceFeedbackService.simulate_upstream_evidence_submission(
            db=db,
            charge_id=charge_id,
            upstream_stage=upstream_stage,
            result=result,
            description=description
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feedback simulation failed: {str(e)}")
