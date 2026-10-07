from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, SessionLocal
from app.api import api_router
from app.models.entities import Charge
from app.services.seed_data import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    
    # Auto-seed sample dataset if database has no charges
    db = SessionLocal()
    try:
        count = db.query(Charge).count()
        if count == 0:
            seed_database(db, run_assessments=True)
    finally:
        db.close()
        
    yield

app = FastAPI(
    title="AI Evidence-to-Recovery Agent (Phase 1)",
    description="Operational & financial charge dispute recovery engine with deterministic assessment and evidence traceability.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development & local Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

@app.get("/health")
def healthcheck():
    return {
        "status": "healthy",
        "phase": 1,
        "engine": "deterministic-decision-engine"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
