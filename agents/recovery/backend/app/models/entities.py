from sqlalchemy import Column, String, Float, DateTime, Integer, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Charge(Base):
    __tablename__ = "charges"

    charge_id = Column(String(100), primary_key=True, index=True)
    shipment_id = Column(String(100), nullable=True, index=True)
    order_id = Column(String(100), nullable=True, index=True)
    sku = Column(String(100), nullable=True, index=True)
    unit_id = Column(String(100), nullable=True, index=True)  # Official Cube unit_id
    source_dataset = Column(String(50), default="internal", nullable=False, index=True)  # "cube_official" or "internal"
    reason = Column(String(255), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    charge_date = Column(DateTime, default=utc_now, nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, ASSESSED, etc.

    assessment = relationship("Assessment", back_populates="charge", uselist=False, cascade="all, delete-orphan")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(100), nullable=False, index=True)
    sku = Column(String(100), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id = Column(String(100), nullable=False, index=True)
    order_id = Column(String(100), nullable=True, index=True)
    sku = Column(String(100), nullable=True, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    shipment_date = Column(DateTime, default=utc_now, nullable=False)


class Evidence(Base):
    __tablename__ = "evidence"

    evidence_id = Column(String(100), primary_key=True, index=True)
    evidence_type = Column(String(50), nullable=False, index=True)  # receiving, prep, packing, returns
    shipment_id = Column(String(100), nullable=True, index=True)
    order_id = Column(String(100), nullable=True, index=True)
    sku = Column(String(100), nullable=True, index=True)
    unit_id = Column(String(100), nullable=True, index=True)  # Official Cube unit_id
    source_dataset = Column(String(50), default="internal", nullable=False, index=True)  # "cube_official" or "internal"
    result = Column(String(50), nullable=False)  # PASS, FAIL, VERIFIED, DISCREPANCY, DAMAGED, INTACT, etc.
    description = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utc_now, nullable=False)
    source = Column(String(100), nullable=False)  # e.g., WMS-PrepStation-1, PackScan-02, DockScanner
    reference_data = Column(JSON, nullable=True)  # metadata / reference dictionary


class Assessment(Base):
    __tablename__ = "assessments"

    assessment_id = Column(String(100), primary_key=True, index=True)
    charge_id = Column(String(100), ForeignKey("charges.charge_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    verdict = Column(String(50), nullable=False, index=True)  # SUPPORTED, CONTRADICTED, SILENT
    reason = Column(Text, nullable=False)
    claim_amount = Column(Float, nullable=False, default=0.0)
    evidence_ids = Column(JSON, nullable=False, default=list)  # List[str] of evidence_ids used
    created_at = Column(DateTime, default=utc_now, nullable=False)

    charge = relationship("Charge", back_populates="assessment")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    user = relationship("User", back_populates="sessions")


class AIAssessment(Base):
    __tablename__ = "ai_assessments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    charge_id = Column(String(100), ForeignKey("charges.charge_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    verdict = Column(String(50), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    claim_amount = Column(Float, nullable=False, default=0.0)
    evidence_ids = Column(JSON, nullable=False, default=list)
    evidence_strength = Column(String(50), nullable=False, default="MODERATE")
    missing_information = Column(JSON, nullable=False, default=list)
    charge_category = Column(String(100), nullable=True)
    model_name = Column(String(100), nullable=True)
    is_fallback = Column(Boolean, nullable=False, default=False)
    agreement_with_deterministic = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)


