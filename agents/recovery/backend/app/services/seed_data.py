from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.entities import Charge, Order, Shipment, Evidence, Assessment
from app.services.ingestion import IngestionService
from app.services.assessment import AssessmentService

def get_demo_dataset() -> Dict[str, List[Dict[str, Any]]]:
    """
    Returns realistic sample dataset covering all 8 required cases:
    1. Supported charge (Packaging Defect with prep FAIL)
    2. Contradicted charge (Packaging Defect with prep PASS)
    3. No evidence -> Silent
    4. Multiple evidence records (Prep PASS + Packing VERIFIED)
    5. Multiple charges for one shipment (Packaging defect vs Quantity shortage)
    6. Duplicate / irrelevant evidence (Different SKU in same shipment ignored)
    7. Missing identifiers (Charge missing shipment_id, resolved via unique order) & (Missing all IDs)
    8. Partial evidence (Receiving dock log with result RECEIVED, missing inspection)
    Includes: receiving, prep, packing, returns records.
    """
    return {
        "orders": [
            {"order_id": "ORD-2001", "sku": "SKU-ELEC-01", "quantity": 5},
            {"order_id": "ORD-2002", "sku": "SKU-HOME-02", "quantity": 10},
            {"order_id": "ORD-2003", "sku": "SKU-TOY-03", "quantity": 2},
            {"order_id": "ORD-2004", "sku": "SKU-BEAUTY-04", "quantity": 20},
            {"order_id": "ORD-2005", "sku": "SKU-APPAREL-05", "quantity": 10},
            {"order_id": "ORD-2006", "sku": "SKU-OFFICE-06", "quantity": 15},
            {"order_id": "ORD-2007", "sku": "SKU-KITCH-07", "quantity": 4},
            {"order_id": "ORD-2008", "sku": "SKU-GARDEN-08", "quantity": 6},
            {"order_id": "ORD-2009", "sku": "SKU-SPORTS-09", "quantity": 8},
        ],
        "shipments": [
            {"shipment_id": "SH-1001", "order_id": "ORD-2001", "sku": "SKU-ELEC-01", "quantity": 5, "shipment_date": "2026-09-18T12:00:00"},
            {"shipment_id": "SH-1002", "order_id": "ORD-2002", "sku": "SKU-HOME-02", "quantity": 10, "shipment_date": "2026-09-19T16:00:00"},
            {"shipment_id": "SH-1003", "order_id": "ORD-2003", "sku": "SKU-TOY-03", "quantity": 2, "shipment_date": "2026-09-20T11:00:00"},
            {"shipment_id": "SH-1004", "order_id": "ORD-2004", "sku": "SKU-BEAUTY-04", "quantity": 20, "shipment_date": "2026-09-20T17:00:00"},
            {"shipment_id": "SH-1005", "order_id": "ORD-2005", "sku": "SKU-APPAREL-05", "quantity": 10, "shipment_date": "2026-09-21T15:30:00"},
            {"shipment_id": "SH-1006", "order_id": "ORD-2006", "sku": "SKU-OFFICE-06", "quantity": 15, "shipment_date": "2026-09-22T14:00:00"},
            {"shipment_id": "SH-1007", "order_id": "ORD-2007", "sku": "SKU-KITCH-07", "quantity": 4, "shipment_date": "2026-09-24T18:00:00"},
            {"shipment_id": "SH-1008", "order_id": "ORD-2008", "sku": "SKU-GARDEN-08", "quantity": 6, "shipment_date": "2026-09-25T10:00:00"},
            {"shipment_id": "SH-1009", "order_id": "ORD-2009", "sku": "SKU-SPORTS-09", "quantity": 8, "shipment_date": "2026-09-26T09:30:00"},
        ],
        "evidence": [
            # Case 1: Prep FAIL -> Supported
            {
                "evidence_id": "EV-101-FAIL",
                "evidence_type": "prep",
                "shipment_id": "SH-1001",
                "order_id": "ORD-2001",
                "sku": "SKU-ELEC-01",
                "result": "FAIL",
                "description": "Prep station packaging inspection failed: bubble wrap torn and anti-static seal breached",
                "timestamp": "2026-09-18T10:15:00",
                "source": "WMS-PrepStation-1",
                "reference_data": {"station_id": "P-101", "operator": "J. Doe", "test_code": "PKG-QUAL-FAIL"}
            },
            # Case 2: Prep PASS -> Contradicted ($38)
            {
                "evidence_id": "EV-102-PASS",
                "evidence_type": "prep",
                "shipment_id": "SH-1002",
                "order_id": "ORD-2002",
                "sku": "SKU-HOME-02",
                "result": "PASS",
                "description": "Prep packaging inspection: 2-mil polybag, suffocation warning present, barcode 100% compliant",
                "timestamp": "2026-09-19T14:30:00",
                "source": "WMS-PrepStation-2",
                "reference_data": {"station_id": "P-102", "polybag_mil": 2.0, "scancode": "PASS"}
            },
            # Case 4: Multiple evidence records -> Contradicted ($62.50)
            {
                "evidence_id": "EV-104A-PREP",
                "evidence_type": "prep",
                "shipment_id": "SH-1004",
                "order_id": "ORD-2004",
                "sku": "SKU-BEAUTY-04",
                "result": "PASS",
                "description": "Item prep check: liquid safety seal intact, secondary taped cap passed",
                "timestamp": "2026-09-20T09:12:00",
                "source": "WMS-PrepStation-3",
                "reference_data": {"seal_audit": "CONFIRMED"}
            },
            {
                "evidence_id": "EV-104B-PACK",
                "evidence_type": "packing",
                "shipment_id": "SH-1004",
                "order_id": "ORD-2004",
                "sku": "SKU-BEAUTY-04",
                "result": "VERIFIED",
                "description": "Pack station automated camera inspection: carton integrity verified, air pillows placed, sealed",
                "timestamp": "2026-09-20T11:45:00",
                "source": "PackScan-Camera-01",
                "reference_data": {"camera_id": "CAM-01", "dunnage": "air_pillows"}
            },
            # Case 5: Multiple charges on shipment SH-1005 (Charge A: Packaging Contradicted, Charge B: Shortage Supported)
            {
                "evidence_id": "EV-105A-PREP",
                "evidence_type": "prep",
                "shipment_id": "SH-1005",
                "order_id": "ORD-2005",
                "sku": "SKU-APPAREL-05",
                "result": "PASS",
                "description": "Apparel polybag packaging passed quality inspection",
                "timestamp": "2026-09-21T08:30:00",
                "source": "WMS-PrepStation-1",
                "reference_data": {"audit": "PASS"}
            },
            {
                "evidence_id": "EV-105B-PACK",
                "evidence_type": "packing",
                "shipment_id": "SH-1005",
                "order_id": "ORD-2005",
                "sku": "SKU-APPAREL-05",
                "result": "DISCREPANCY",
                "description": "Pack station unit count: expected 10 units, packed 8 units (shortage of 2 units)",
                "timestamp": "2026-09-21T13:10:00",
                "source": "PackScale-WeightStation-4",
                "reference_data": {"expected_weight_kg": 5.0, "actual_weight_kg": 4.0}
            },
            # Case 6: Irrelevant SKU record vs Target SKU record in SH-1006
            {
                "evidence_id": "EV-106A-IRREL",
                "evidence_type": "prep",
                "shipment_id": "SH-1006",
                "order_id": "ORD-2006",
                "sku": "SKU-DIFFERENT-99",
                "result": "FAIL",
                "description": "Prep check failed for unrelated SKU-DIFFERENT-99 in co-pack bundle",
                "timestamp": "2026-09-22T10:00:00",
                "source": "WMS-PrepStation-2",
                "reference_data": {"sku": "SKU-DIFFERENT-99"}
            },
            {
                "evidence_id": "EV-106B-PASS",
                "evidence_type": "prep",
                "shipment_id": "SH-1006",
                "order_id": "ORD-2006",
                "sku": "SKU-OFFICE-06",
                "result": "PASS",
                "description": "Prep verified for target SKU-OFFICE-06: boxed, labeled, passed barcoding scan",
                "timestamp": "2026-09-22T10:30:00",
                "source": "WMS-PrepStation-2",
                "reference_data": {"sku": "SKU-OFFICE-06"}
            },
            # Case 7: Missing identifier fallback (linked to SH-1007 via ORD-2007)
            {
                "evidence_id": "EV-107-PASS",
                "evidence_type": "prep",
                "shipment_id": "SH-1007",
                "order_id": "ORD-2007",
                "sku": "SKU-KITCH-07",
                "result": "PASS",
                "description": "Kitchen item prep packaging: double-wall box certified PASS",
                "timestamp": "2026-09-24T15:00:00",
                "source": "WMS-PrepStation-3",
                "reference_data": {"box_type": "double_wall"}
            },
            # Case 8: Partial evidence (Receiving dock log with result RECEIVED, missing inspection)
            {
                "evidence_id": "EV-108-INCOMPLETE",
                "evidence_type": "receiving",
                "shipment_id": "SH-1008",
                "order_id": "ORD-2008",
                "sku": "SKU-GARDEN-08",
                "result": "RECEIVED",
                "description": "Dock check-in scan: inbound carrier dropped trailer at door 4. No packaging/prep audit conducted.",
                "timestamp": "2026-09-25T08:00:00",
                "source": "DockScanner-Door4",
                "reference_data": {"dock_door": 4, "carrier": "FREIGHT-X"}
            },
            # Additional Returns Evidence for full type coverage
            {
                "evidence_id": "EV-109-RETURN",
                "evidence_type": "returns",
                "shipment_id": "SH-1009",
                "order_id": "ORD-2009",
                "sku": "SKU-SPORTS-09",
                "result": "VERIFIED",
                "description": "Customer return dock audit: RMA approved, goods intact in original packaging, no seller fault",
                "timestamp": "2026-09-26T16:00:00",
                "source": "Returns-Dock-1",
                "reference_data": {"rma_id": "RMA-9001", "condition": "ORIGINAL"}
            }
        ],
        "charges": [
            # 1. Supported Case
            {
                "charge_id": "CHG-001-SUPP",
                "shipment_id": "SH-1001",
                "order_id": "ORD-2001",
                "sku": "SKU-ELEC-01",
                "reason": "Packaging Defect Charge",
                "amount": 45.00,
                "currency": "USD",
                "charge_date": "2026-09-20T10:00:00",
                "status": "PENDING"
            },
            # 2. Contradicted Case (Defensible Claim)
            {
                "charge_id": "CHG-002-CONT",
                "shipment_id": "SH-1002",
                "order_id": "ORD-2002",
                "sku": "SKU-HOME-02",
                "reason": "Packaging Defect Charge",
                "amount": 38.00,
                "currency": "USD",
                "charge_date": "2026-09-21T09:00:00",
                "status": "PENDING"
            },
            # 3. No Evidence -> Silent Case
            {
                "charge_id": "CHG-003-NOEV",
                "shipment_id": "SH-1003",
                "order_id": "ORD-2003",
                "sku": "SKU-TOY-03",
                "reason": "Late Delivery Surcharge",
                "amount": 25.00,
                "currency": "USD",
                "charge_date": "2026-09-22T14:00:00",
                "status": "PENDING"
            },
            # 4. Multiple Evidence Records Case
            {
                "charge_id": "CHG-004-MULT",
                "shipment_id": "SH-1004",
                "order_id": "ORD-2004",
                "sku": "SKU-BEAUTY-04",
                "reason": "Packaging Defect & Dunnage Violation",
                "amount": 62.50,
                "currency": "USD",
                "charge_date": "2026-09-23T11:00:00",
                "status": "PENDING"
            },
            # 5. Multiple charges for one shipment (Charge A)
            {
                "charge_id": "CHG-005A-CONT",
                "shipment_id": "SH-1005",
                "order_id": "ORD-2005",
                "sku": "SKU-APPAREL-05",
                "reason": "Prep Packaging Defect",
                "amount": 30.00,
                "currency": "USD",
                "charge_date": "2026-09-24T08:00:00",
                "status": "PENDING"
            },
            # 5. Multiple charges for one shipment (Charge B)
            {
                "charge_id": "CHG-005B-SUPP",
                "shipment_id": "SH-1005",
                "order_id": "ORD-2005",
                "sku": "SKU-APPAREL-05",
                "reason": "Quantity Shortage Discrepancy",
                "amount": 55.00,
                "currency": "USD",
                "charge_date": "2026-09-24T08:30:00",
                "status": "PENDING"
            },
            # 6. Duplicate / Irrelevant Evidence Case
            {
                "charge_id": "CHG-006-IRREL",
                "shipment_id": "SH-1006",
                "order_id": "ORD-2006",
                "sku": "SKU-OFFICE-06",
                "reason": "Packaging Defect",
                "amount": 40.00,
                "currency": "USD",
                "charge_date": "2026-09-25T12:00:00",
                "status": "PENDING"
            },
            # 7A. Missing shipment_id, resolved via unique order_id
            {
                "charge_id": "CHG-007A-FALLBACK",
                "shipment_id": None,
                "order_id": "ORD-2007",
                "sku": "SKU-KITCH-07",
                "reason": "Packaging Defect",
                "amount": 50.00,
                "currency": "USD",
                "charge_date": "2026-09-26T14:00:00",
                "status": "PENDING"
            },
            # 7B. Missing all identifiers -> Safe Unresolved -> Silent
            {
                "charge_id": "CHG-007B-UNRESOLVED",
                "shipment_id": None,
                "order_id": None,
                "sku": None,
                "reason": "Unspecified Discrepancy Fee",
                "amount": 15.00,
                "currency": "USD",
                "charge_date": "2026-09-26T16:00:00",
                "status": "PENDING"
            },
            # 8. Partial Evidence -> Silent
            {
                "charge_id": "CHG-008-PARTIAL",
                "shipment_id": "SH-1008",
                "order_id": "ORD-2008",
                "sku": "SKU-GARDEN-08",
                "reason": "Packaging Defect",
                "amount": 70.00,
                "currency": "USD",
                "charge_date": "2026-09-27T09:00:00",
                "status": "PENDING"
            },
            # 9. Return Discrepancy with Returns Evidence
            {
                "charge_id": "CHG-009-RETURNS",
                "shipment_id": "SH-1009",
                "order_id": "ORD-2009",
                "sku": "SKU-SPORTS-09",
                "reason": "Unauthorized Customer Return Fee",
                "amount": 85.00,
                "currency": "USD",
                "charge_date": "2026-09-27T17:00:00",
                "status": "PENDING"
            }
        ]
    }

def seed_database(db: Session, run_assessments: bool = False) -> Dict[str, Any]:
    """
    Clears existing demo records and loads the comprehensive demo dataset.
    Optionally pre-runs assessment for all charges.
    """
    # Clean tables
    db.query(Assessment).delete()
    db.query(Charge).delete()
    db.query(Evidence).delete()
    db.query(Shipment).delete()
    db.query(Order).delete()
    db.commit()

    payload = get_demo_dataset()
    res = IngestionService.ingest_dict(db, payload)

    assessments_run = 0
    if run_assessments:
        charges = db.query(Charge).all()
        for chg in charges:
            AssessmentService.assess_charge(db, chg.charge_id)
            assessments_run += 1

    return {
        "status": "success",
        "ingest_result": res.model_dump(),
        "assessments_run": assessments_run
    }
