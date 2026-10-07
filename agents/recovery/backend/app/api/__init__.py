from fastapi import APIRouter
from app.api.charges import router as charges_router
from app.api.evidence import router as evidence_router
from app.api.assessments import router as assessments_router
from app.api.ingest import router as ingest_router
from app.api.dashboard import router as dashboard_router
from app.api.auth import router as auth_router
from app.api.ai import router as ai_router
from app.api.official import router as official_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(ai_router)
api_router.include_router(official_router)
api_router.include_router(ingest_router)
api_router.include_router(charges_router)
api_router.include_router(evidence_router)
api_router.include_router(assessments_router)
api_router.include_router(dashboard_router)
