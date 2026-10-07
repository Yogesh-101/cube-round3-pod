import pytest
from pydantic import ValidationError
from app.schemas.entities import ChargeCreate, EvidenceCreate, OrderCreate, ShipmentCreate

def test_charge_negative_amount_fails():
    with pytest.raises(ValidationError):
        ChargeCreate(
            charge_id="CHG-TEST",
            reason="Damaged item",
            amount=-10.0
        )

def test_evidence_invalid_type_fails():
    with pytest.raises(ValidationError):
        EvidenceCreate(
            evidence_id="EV-TEST",
            evidence_type="invalid_type",  # Allowed: receiving, prep, packing, returns
            result="PASS",
            description="Inspection",
            source="Camera"
        )

def test_evidence_valid_types_succeed():
    for valid_t in ["receiving", "prep", "packing", "returns"]:
        ev = EvidenceCreate(
            evidence_id=f"EV-{valid_t}",
            evidence_type=valid_t,
            result="PASS",
            description=f"Valid {valid_t}",
            source="Device"
        )
        assert ev.evidence_type == valid_t

def test_order_zero_or_negative_quantity_fails():
    with pytest.raises(ValidationError):
        OrderCreate(order_id="ORD-1", sku="SKU-1", quantity=0)

    with pytest.raises(ValidationError):
        OrderCreate(order_id="ORD-1", sku="SKU-1", quantity=-5)
