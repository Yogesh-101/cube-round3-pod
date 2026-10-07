from app.services.ingestion import IngestionService
from app.models.entities import Charge, Order, Shipment, Evidence

def test_ingest_json_payload(db_session):
    payload = {
        "orders": [{"order_id": "ORD-1", "sku": "SKU-A", "quantity": 10}],
        "shipments": [{"shipment_id": "SH-1", "order_id": "ORD-1", "sku": "SKU-A", "quantity": 10}],
        "charges": [{"charge_id": "CHG-1", "shipment_id": "SH-1", "order_id": "ORD-1", "sku": "SKU-A", "reason": "Packaging Defect", "amount": 50.0, "currency": "USD"}],
        "evidence": [{
            "evidence_id": "EV-1",
            "evidence_type": "prep",
            "shipment_id": "SH-1",
            "sku": "SKU-A",
            "result": "PASS",
            "description": "Packaging inspected PASS",
            "source": "WMS-1"
        }]
    }

    result = IngestionService.ingest_dict(db_session, payload)
    assert result.success is True
    assert result.charges_ingested == 1
    assert result.orders_ingested == 1
    assert result.shipments_ingested == 1
    assert result.evidence_ingested == 1
    assert len(result.errors) == 0

    assert db_session.query(Charge).count() == 1
    assert db_session.query(Evidence).count() == 1

def test_ingest_csv_content(db_session):
    csv_text = """charge_id,shipment_id,order_id,sku,reason,amount,currency,charge_date,status
CHG-CSV-1,SH-10,ORD-10,SKU-B,Shortage,20.0,USD,2026-09-01,PENDING
CHG-CSV-2,SH-11,ORD-11,SKU-C,Late Delivery,35.5,USD,2026-09-02,PENDING
"""
    result = IngestionService.ingest_csv_content(db_session, "charges", csv_text)
    assert result.success is True
    assert result.charges_ingested == 2
    assert db_session.query(Charge).count() == 2

def test_ingest_invalid_records_safe_error_handling(db_session):
    # Malformed charge with negative amount and missing reason
    payload = {
        "charges": [
            {"charge_id": "CHG-VALID", "reason": "Valid reason", "amount": 10.0},
            {"charge_id": "CHG-INVALID", "reason": "Negative amount", "amount": -25.0},
            {"charge_id": "CHG-NO-REASON", "amount": 50.0}
        ]
    }
    result = IngestionService.ingest_dict(db_session, payload)
    assert result.charges_ingested == 1
    assert len(result.errors) == 2
    assert result.errors[0].identifier == "CHG-INVALID"
    assert "Amount cannot be negative" in result.errors[0].error
    assert db_session.query(Charge).count() == 1
