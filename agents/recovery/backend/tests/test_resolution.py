from app.models.entities import Charge, Order, Shipment
from app.services.resolution import EntityResolutionService

def test_full_resolution_with_ids(db_session):
    db_session.add(Order(order_id="ORD-100", sku="SKU-100", quantity=5))
    db_session.add(Shipment(shipment_id="SH-100", order_id="ORD-100", sku="SKU-100", quantity=5))
    charge = Charge(
        charge_id="CHG-100",
        shipment_id="SH-100",
        order_id="ORD-100",
        sku="SKU-100",
        reason="Packaging Defect",
        amount=30.0
    )
    db_session.add(charge)
    db_session.commit()

    res = EntityResolutionService.resolve_charge(db_session, charge)
    assert res.resolution_status == "RESOLVED"
    assert res.shipment_id == "SH-100"
    assert res.order_id == "ORD-100"
    assert res.sku == "SKU-100"
    assert "charge(CHG-100)" in res.resolution_path

def test_deterministic_fallback_when_shipment_missing(db_session):
    # Charge only has order_id and SKU, but exactly 1 shipment exists for that order/SKU
    db_session.add(Order(order_id="ORD-200", sku="SKU-200", quantity=2))
    db_session.add(Shipment(shipment_id="SH-200", order_id="ORD-200", sku="SKU-200", quantity=2))
    charge = Charge(
        charge_id="CHG-200",
        shipment_id=None,  # Missing shipment_id
        order_id="ORD-200",
        sku="SKU-200",
        reason="Packaging Defect",
        amount=40.0
    )
    db_session.add(charge)
    db_session.commit()

    res = EntityResolutionService.resolve_charge(db_session, charge)
    assert res.resolution_status == "RESOLVED"
    assert res.shipment_id == "SH-200"
    assert any("Deterministically resolved unique shipment_id" in note for note in res.notes)

def test_no_guessing_when_ambiguous_shipments(db_session):
    # Order has 2 distinct shipments with different IDs
    db_session.add(Shipment(shipment_id="SH-300A", order_id="ORD-300", sku="SKU-300", quantity=2))
    db_session.add(Shipment(shipment_id="SH-300B", order_id="ORD-300", sku="SKU-300", quantity=3))
    charge = Charge(
        charge_id="CHG-300",
        shipment_id=None,
        order_id="ORD-300",
        sku="SKU-300",
        reason="Packaging Defect",
        amount=25.0
    )
    db_session.add(charge)
    db_session.commit()

    res = EntityResolutionService.resolve_charge(db_session, charge)
    # Must NOT guess which shipment it was!
    assert res.shipment_id is None
    assert any("guessing forbidden" in note for note in res.notes)

def test_unresolved_when_all_ids_missing(db_session):
    charge = Charge(
        charge_id="CHG-EMPTY",
        shipment_id=None,
        order_id=None,
        sku=None,
        reason="Unspecified charge",
        amount=10.0
    )
    db_session.add(charge)
    db_session.commit()

    res = EntityResolutionService.resolve_charge(db_session, charge)
    assert res.resolution_status == "UNRESOLVED"
    assert res.shipment_id is None
    assert res.order_id is None
