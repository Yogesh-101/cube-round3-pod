"""Database configuration and models for Cube Orchestrator.

Provides user account persistence and per-user execution history tracking
using SQLAlchemy with SQLite / PostgreSQL support.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DB_PATH = (DATA_DIR / "cube_orchestrator.db").as_posix()
RAW_DB_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# Render PostgreSQL URL compatibility
if RAW_DB_URL.startswith("postgres://"):
    RAW_DB_URL = RAW_DB_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    RAW_DB_URL,
    connect_args={"check_same_thread": False} if RAW_DB_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False, default="")
    role = Column(String(64), nullable=False, default="operator")
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    executions = relationship("ExecutionRecord", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ExecutionRecord(Base):
    __tablename__ = "executions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    execution_type = Column(String(32), nullable=False)  # "workflow" | "agent"
    stage = Column(String(32), nullable=True, index=True)  # "receiving", "prep", etc.
    workflow_id = Column(String(128), nullable=False, index=True)
    unit_id = Column(String(128), nullable=False, index=True)
    org_id = Column(String(128), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="completed")
    verdict = Column(String(32), nullable=True)
    outcome = Column(String(64), nullable=True)
    record_id = Column(String(128), nullable=True)
    result_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="executions")

    def to_dict(self) -> dict:
        parsed_result = {}
        try:
            parsed_result = json.loads(self.result_json) if self.result_json else {}
        except Exception:
            pass

        return {
            "id": self.id,
            "user_id": self.user_id,
            "execution_type": self.execution_type,
            "stage": self.stage,
            "workflow_id": self.workflow_id,
            "unit_id": self.unit_id,
            "org_id": self.org_id,
            "status": self.status,
            "verdict": self.verdict,
            "outcome": self.outcome,
            "record_id": self.record_id,
            "result": parsed_result,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def init_db() -> None:
    """Initialize tables and create indices."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency for DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
