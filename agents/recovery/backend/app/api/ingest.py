from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import json

from app.database import get_db
from app.schemas.entities import IngestPayload, IngestResult
from app.services.ingestion import IngestionService
from app.services.seed_data import seed_database

router = APIRouter(prefix="", tags=["Ingestion"])

@router.post("/ingest", response_model=IngestResult)
async def ingest_data(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Ingests operational / financial records via JSON body or multipart form (CSV/JSON file).
    Validates input using Pydantic and returns structured error reports rather than crashing.
    """
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            body = await request.json()
            payload = IngestPayload(**body)
            return IngestionService.ingest_dict(db, payload.model_dump())
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON ingestion payload: {str(e)}")

    elif "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        record_type = form.get("record_type")

        if not file or not hasattr(file, "filename"):
            raise HTTPException(status_code=400, detail="Form upload requires a 'file' field")

        filename = file.filename.lower()
        content = await file.read()

        if filename.endswith(".json"):
            try:
                data = json.loads(content.decode("utf-8"))
                return IngestionService.ingest_dict(db, data)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid JSON file format: {str(e)}")
        elif filename.endswith(".csv"):
            csv_str = content.decode("utf-8")
            rt = str(record_type or "").strip().lower()

            # Auto-detect official Cube CSV file types
            if "fee_report" in filename or rt in {"official_fees", "official_charges", "fee_report"}:
                from app.services.official_adapter import OfficialDataAdapter
                cnt, errs = OfficialDataAdapter.ingest_fee_report_csv(db, csv_str, filename)
                return IngestResult(
                    success=len(errs) == 0,
                    charges_ingested=cnt,
                    orders_ingested=0,
                    shipments_ingested=0,
                    evidence_ingested=0,
                    errors=errs
                )
            elif "receiving" in filename or rt in {"official_receiving", "receiving"}:
                from app.services.official_adapter import OfficialDataAdapter
                cnt, errs = OfficialDataAdapter.ingest_receiving_csv(db, csv_str, filename)
                return IngestResult(
                    success=len(errs) == 0,
                    charges_ingested=0,
                    orders_ingested=0,
                    shipments_ingested=0,
                    evidence_ingested=cnt,
                    errors=errs
                )
            elif "prep" in filename or rt in {"official_prep", "prep"}:
                from app.services.official_adapter import OfficialDataAdapter
                cnt, errs = OfficialDataAdapter.ingest_prep_csv(db, csv_str, filename)
                return IngestResult(
                    success=len(errs) == 0,
                    charges_ingested=0,
                    orders_ingested=0,
                    shipments_ingested=0,
                    evidence_ingested=cnt,
                    errors=errs
                )
            elif "pack" in filename or rt in {"official_pack", "pack", "packing"}:
                from app.services.official_adapter import OfficialDataAdapter
                cnt, errs = OfficialDataAdapter.ingest_pack_csv(db, csv_str, filename)
                return IngestResult(
                    success=len(errs) == 0,
                    charges_ingested=0,
                    orders_ingested=0,
                    shipments_ingested=0,
                    evidence_ingested=cnt,
                    errors=errs
                )
            elif "return" in filename or rt in {"official_returns", "returns"}:
                from app.services.official_adapter import OfficialDataAdapter
                cnt, errs = OfficialDataAdapter.ingest_returns_csv(db, csv_str, filename)
                return IngestResult(
                    success=len(errs) == 0,
                    charges_ingested=0,
                    orders_ingested=0,
                    shipments_ingested=0,
                    evidence_ingested=cnt,
                    errors=errs
                )

            # Standard synthetic/custom CSV types
            if not record_type:
                raise HTTPException(
                    status_code=400,
                    detail="record_type (charges, orders, shipments, evidence) is required when uploading custom CSV"
                )
            if rt not in {"charges", "orders", "shipments", "evidence"}:
                raise HTTPException(
                    status_code=400,
                    detail="record_type must be one of: charges, orders, shipments, evidence, or official Cube types (fee_report, receiving, prep, pack, returns)"
                )
            try:
                return IngestionService.ingest_csv_content(db, rt, csv_str)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed parsing CSV: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Uploaded file must be .json or .csv")

    else:
        raise HTTPException(
            status_code=400,
            detail="Content-Type must be 'application/json' or 'multipart/form-data'"
        )

@router.post("/demo/seed", response_model=Dict[str, Any])
def seed_demo_data(
    run_assessments: bool = True,
    db: Session = Depends(get_db)
):
    """
    Clears tables and loads the comprehensive sample dataset covering all 8 required cases.
    Optionally evaluates assessments immediately for all records.
    """
    return seed_database(db, run_assessments=run_assessments)
