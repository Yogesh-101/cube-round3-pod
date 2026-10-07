from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.entities import Charge, Order, Shipment, Evidence
from app.services.agent import RecoveryAgent
from app.services.vector_retrieval import VectorRetrievalService

T0 = datetime(2026, 1, 15, 12, 0, 0)

EVALUATION_CASES: List[Dict[str, Any]] = [
    # 1-4: SUPPORTED cases
    {
        "case_id": "CASE-01",
        "category": "supported",
        "description": "Packaging defect verified by prep failure log",
        "charge": {"charge_id": "CHG-EV-01", "reason": "Packaging Defect Charge", "amount": 45.0, "shipment_id": "SH-EV-01", "order_id": "ORD-EV-01", "sku": "SKU-A", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-01-A", "evidence_type": "prep", "result": "FAIL", "description": "Torn polybag carton seal defect", "source": "Prep-01", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-01", "sku": "SKU-A"}],
        "expected_verdict": "SUPPORTED",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-01-A"]
    },
    {
        "case_id": "CASE-02",
        "category": "supported",
        "description": "Shortage confirmed by dock receiving discrepancy count",
        "charge": {"charge_id": "CHG-EV-02", "reason": "Fulfillment Quantity Shortage", "amount": 120.0, "shipment_id": "SH-EV-02", "order_id": "ORD-EV-02", "sku": "SKU-B", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-02-A", "evidence_type": "receiving", "result": "DISCREPANCY", "description": "Received 8 units instead of 10", "source": "DockScanner-1", "timestamp": T0 - timedelta(hours=3), "shipment_id": "SH-EV-02", "sku": "SKU-B"}],
        "expected_verdict": "SUPPORTED",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-02-A"]
    },
    {
        "case_id": "CASE-03",
        "category": "supported",
        "description": "Damaged goods confirmed by inbound receiver",
        "charge": {"charge_id": "CHG-EV-03", "reason": "Damaged Merchandise Fee", "amount": 80.0, "shipment_id": "SH-EV-03", "order_id": "ORD-EV-03", "sku": "SKU-C", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-03-A", "evidence_type": "receiving", "result": "DAMAGED", "description": "Liquid spill and crushed box", "source": "Dock-2", "timestamp": T0 - timedelta(hours=4), "shipment_id": "SH-EV-03", "sku": "SKU-C"}],
        "expected_verdict": "SUPPORTED",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-03-A"]
    },
    {
        "case_id": "CASE-04",
        "category": "supported",
        "description": "Barcode unscannable confirmed by prep scan fail",
        "charge": {"charge_id": "CHG-EV-04", "reason": "Unscannable Barcode Label", "amount": 35.0, "shipment_id": "SH-EV-04", "order_id": "ORD-EV-04", "sku": "SKU-D", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-04-A", "evidence_type": "prep", "result": "FAIL", "description": "UPC barcode blurred and unscannable", "source": "PrepScan-4", "timestamp": T0 - timedelta(hours=1), "shipment_id": "SH-EV-04", "sku": "SKU-D"}],
        "expected_verdict": "SUPPORTED",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-04-A"]
    },

    # 5-8: CONTRADICTED cases
    {
        "case_id": "CASE-05",
        "category": "contradicted",
        "description": "Packaging fee contradicted by certified prep pass",
        "charge": {"charge_id": "CHG-EV-05", "reason": "Packaging Defect Charge", "amount": 55.0, "shipment_id": "SH-EV-05", "order_id": "ORD-EV-05", "sku": "SKU-E", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-05-A", "evidence_type": "prep", "result": "PASS", "description": "Packaging 4-point check passed compliant", "source": "PrepStation-1", "timestamp": T0 - timedelta(hours=5), "shipment_id": "SH-EV-05", "sku": "SKU-E"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 55.0,
        "expected_evidence_ids": ["EV-05-A"]
    },
    {
        "case_id": "CASE-06",
        "category": "contradicted",
        "description": "Quantity shortage contradicted by scale and camera count verify",
        "charge": {"charge_id": "CHG-EV-06", "reason": "Item Shortage Penalty", "amount": 140.0, "shipment_id": "SH-EV-06", "order_id": "ORD-EV-06", "sku": "SKU-F", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-06-A", "evidence_type": "packing", "result": "VERIFIED", "description": "Camera and weight scale verified exact unit count 12/12", "source": "PackScan-02", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-06", "sku": "SKU-F"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 140.0,
        "expected_evidence_ids": ["EV-06-A"]
    },
    {
        "case_id": "CASE-07",
        "category": "contradicted",
        "description": "Damage claim contradicted by intact outbound handoff log",
        "charge": {"charge_id": "CHG-EV-07", "reason": "Merchandise Damage Assessment", "amount": 95.0, "shipment_id": "SH-EV-07", "order_id": "ORD-EV-07", "sku": "SKU-G", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-07-A", "evidence_type": "packing", "result": "INTACT", "description": "High-res outbound camera shows pristine packaging intact", "source": "PackCam-1", "timestamp": T0 - timedelta(hours=6), "shipment_id": "SH-EV-07", "sku": "SKU-G"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 95.0,
        "expected_evidence_ids": ["EV-07-A"]
    },
    {
        "case_id": "CASE-08",
        "category": "contradicted",
        "description": "Barcode labeling fee contradicted by verified scan pass",
        "charge": {"charge_id": "CHG-EV-08", "reason": "Barcode Label Error", "amount": 40.0, "shipment_id": "SH-EV-08", "order_id": "ORD-EV-08", "sku": "SKU-H", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-08-A", "evidence_type": "prep", "result": "PASS", "description": "FNSKU barcode 100% verified scannable grade A", "source": "PrepStation-3", "timestamp": T0 - timedelta(hours=3), "shipment_id": "SH-EV-08", "sku": "SKU-H"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 40.0,
        "expected_evidence_ids": ["EV-08-A"]
    },

    # 9-12: SILENT (No Evidence)
    {
        "case_id": "CASE-09",
        "category": "silent",
        "description": "No evidence records exist for charge",
        "charge": {"charge_id": "CHG-EV-09", "reason": "Packaging Defect Charge", "amount": 60.0, "shipment_id": "SH-EV-09", "order_id": "ORD-EV-09", "sku": "SKU-I", "charge_date": T0},
        "evidence": [],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },
    {
        "case_id": "CASE-10",
        "category": "silent",
        "description": "No operational evidence for shortage fee",
        "charge": {"charge_id": "CHG-EV-10", "reason": "Shortage Penalty", "amount": 110.0, "shipment_id": "SH-EV-10", "order_id": "ORD-EV-10", "sku": "SKU-J", "charge_date": T0},
        "evidence": [],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },
    {
        "case_id": "CASE-11",
        "category": "silent",
        "description": "No evidence for damage charge",
        "charge": {"charge_id": "CHG-EV-11", "reason": "Damaged Product Surcharge", "amount": 75.0, "shipment_id": "SH-EV-11", "order_id": "ORD-EV-11", "sku": "SKU-K", "charge_date": T0},
        "evidence": [],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },
    {
        "case_id": "CASE-12",
        "category": "silent",
        "description": "Missing logs for return discrepancy",
        "charge": {"charge_id": "CHG-EV-12", "reason": "Customer Return Unprocessed", "amount": 50.0, "shipment_id": "SH-EV-12", "order_id": "ORD-EV-12", "sku": "SKU-L", "charge_date": T0},
        "evidence": [],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },

    # 13-16: PARTIAL EVIDENCE
    {
        "case_id": "CASE-13",
        "category": "partial_evidence",
        "description": "Evidence exists but has timestamp after charge date",
        "charge": {"charge_id": "CHG-EV-13", "reason": "Packaging Defect Charge", "amount": 50.0, "shipment_id": "SH-EV-13", "order_id": "ORD-EV-13", "sku": "SKU-M", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-13-A", "evidence_type": "prep", "result": "PASS", "description": "Late inspection logged 3 days after charge", "source": "Prep-2", "timestamp": T0 + timedelta(days=3), "shipment_id": "SH-EV-13", "sku": "SKU-M"}],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-13-A"]
    },
    {
        "case_id": "CASE-14",
        "category": "partial_evidence",
        "description": "Evidence log is purely informational / inconclusive",
        "charge": {"charge_id": "CHG-EV-14", "reason": "Shortage Penalty", "amount": 85.0, "shipment_id": "SH-EV-14", "order_id": "ORD-EV-14", "sku": "SKU-N", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-14-A", "evidence_type": "packing", "result": "PENDING_AUDIT", "description": "Routine station check incomplete", "source": "Pack-1", "timestamp": T0 - timedelta(hours=1), "shipment_id": "SH-EV-14", "sku": "SKU-N"}],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-14-A"]
    },
    {
        "case_id": "CASE-15",
        "category": "partial_evidence",
        "description": "Evidence records present only for receiving, but charge is prep packaging",
        "charge": {"charge_id": "CHG-EV-15", "reason": "Prep Polybag Fee", "amount": 30.0, "shipment_id": "SH-EV-15", "order_id": "ORD-EV-15", "sku": "SKU-O", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-15-A", "evidence_type": "returns", "result": "VERIFIED", "description": "RMA intake log", "source": "RMA-Desk", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-15", "sku": "SKU-O"}],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },
    {
        "case_id": "CASE-16",
        "category": "partial_evidence",
        "description": "Inconclusive scan without pass or fail status",
        "charge": {"charge_id": "CHG-EV-16", "reason": "Labeling Compliance Fee", "amount": 42.0, "shipment_id": "SH-EV-16", "order_id": "ORD-EV-16", "sku": "SKU-P", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-16-A", "evidence_type": "prep", "result": "AUDIT_LOGGED", "description": "Barcode scanned but no quality metric logged", "source": "Scan-9", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-16", "sku": "SKU-P"}],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-16-A"]
    },

    # 17-20: CONFLICTING EVIDENCE
    {
        "case_id": "CASE-17",
        "category": "conflicting_evidence",
        "description": "Prep logged PASS but packing logged FAIL on packaging",
        "charge": {"charge_id": "CHG-EV-17", "reason": "Packaging Defect Charge", "amount": 65.0, "shipment_id": "SH-EV-17", "order_id": "ORD-EV-17", "sku": "SKU-Q", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-17-A", "evidence_type": "prep", "result": "PASS", "description": "Polybag intact", "source": "Prep-1", "timestamp": T0 - timedelta(hours=4), "shipment_id": "SH-EV-17", "sku": "SKU-Q"},
            {"evidence_id": "EV-17-B", "evidence_type": "packing", "result": "FAIL", "description": "Carton tape split", "source": "Pack-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-17", "sku": "SKU-Q"}
        ],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-17-A", "EV-17-B"]
    },
    {
        "case_id": "CASE-18",
        "category": "conflicting_evidence",
        "description": "Dock verified quantity match but pack station logged missing units",
        "charge": {"charge_id": "CHG-EV-18", "reason": "Shortage Penalty", "amount": 90.0, "shipment_id": "SH-EV-18", "order_id": "ORD-EV-18", "sku": "SKU-R", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-18-A", "evidence_type": "receiving", "result": "MATCH", "description": "Dock count full ASN match", "source": "Dock-1", "timestamp": T0 - timedelta(hours=5), "shipment_id": "SH-EV-18", "sku": "SKU-R"},
            {"evidence_id": "EV-18-B", "evidence_type": "packing", "result": "SHORTAGE", "description": "Scale shows missing item", "source": "PackScale-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-18", "sku": "SKU-R"}
        ],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-18-A", "EV-18-B"]
    },
    {
        "case_id": "CASE-19",
        "category": "conflicting_evidence",
        "description": "Damage check shows both intact and crushed reports",
        "charge": {"charge_id": "CHG-EV-19", "reason": "Damage Surcharge", "amount": 70.0, "shipment_id": "SH-EV-19", "order_id": "ORD-EV-19", "sku": "SKU-S", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-19-A", "evidence_type": "prep", "result": "INTACT", "description": "Item verified intact", "source": "Prep-4", "timestamp": T0 - timedelta(hours=4), "shipment_id": "SH-EV-19", "sku": "SKU-S"},
            {"evidence_id": "EV-19-B", "evidence_type": "receiving", "result": "DAMAGED", "description": "Corner crush logged", "source": "Dock-5", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-19", "sku": "SKU-S"}
        ],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-19-A", "EV-19-B"]
    },
    {
        "case_id": "CASE-20",
        "category": "conflicting_evidence",
        "description": "Barcode scan passed initially then failed downstream",
        "charge": {"charge_id": "CHG-EV-20", "reason": "Barcode Defect Fee", "amount": 35.0, "shipment_id": "SH-EV-20", "order_id": "ORD-EV-20", "sku": "SKU-T", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-20-A", "evidence_type": "prep", "result": "PASS", "description": "FNSKU scanned OK", "source": "Prep-2", "timestamp": T0 - timedelta(hours=3), "shipment_id": "SH-EV-20", "sku": "SKU-T"},
            {"evidence_id": "EV-20-B", "evidence_type": "packing", "result": "FAIL", "description": "Unreadable barcode at pack", "source": "Pack-3", "timestamp": T0 - timedelta(hours=1), "shipment_id": "SH-EV-20", "sku": "SKU-T"}
        ],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-20-A", "EV-20-B"]
    },

    # 21-22: IRRELEVANT EVIDENCE (Different SKU in same shipment)
    {
        "case_id": "CASE-21",
        "category": "irrelevant_evidence",
        "description": "Evidence exists for different SKU in the same shipment",
        "charge": {"charge_id": "CHG-EV-21", "reason": "Packaging Defect Charge", "amount": 50.0, "shipment_id": "SH-EV-21", "order_id": "ORD-EV-21", "sku": "SKU-TARGET", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-21-IRRELEVANT", "evidence_type": "prep", "result": "PASS", "description": "Pass for completely different item", "source": "Prep-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-21", "sku": "SKU-OTHER"}
        ],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },
    {
        "case_id": "CASE-22",
        "category": "irrelevant_evidence",
        "description": "Damage log belongs to sibling SKU not disputed",
        "charge": {"charge_id": "CHG-EV-22", "reason": "Merchandise Damage Assessment", "amount": 100.0, "shipment_id": "SH-EV-22", "order_id": "ORD-EV-22", "sku": "SKU-TARGET-2", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-22-IRRELEVANT", "evidence_type": "receiving", "result": "DAMAGED", "description": "Damage for sibling sku", "source": "Dock-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-22", "sku": "SKU-DIFFERENT"}
        ],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },

    # 23-24: MULTIPLE CHARGES (Same order, independent charge reasons)
    {
        "case_id": "CASE-23",
        "category": "multiple_charges",
        "description": "First charge in multi-charge order: packaging (pass)",
        "charge": {"charge_id": "CHG-EV-23", "reason": "Packaging Defect Charge", "amount": 40.0, "shipment_id": "SH-EV-23", "order_id": "ORD-EV-23", "sku": "SKU-MULTI", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-23-A", "evidence_type": "prep", "result": "PASS", "description": "Prep packaging inspection pass", "source": "Prep-1", "timestamp": T0 - timedelta(hours=3), "shipment_id": "SH-EV-23", "sku": "SKU-MULTI"}
        ],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 40.0,
        "expected_evidence_ids": ["EV-23-A"]
    },
    {
        "case_id": "CASE-24",
        "category": "multiple_charges",
        "description": "Second charge in multi-charge order: shortage (fail)",
        "charge": {"charge_id": "CHG-EV-24", "reason": "Shortage Penalty", "amount": 60.0, "shipment_id": "SH-EV-23", "order_id": "ORD-EV-23", "sku": "SKU-MULTI", "charge_date": T0},
        "evidence": [
            {"evidence_id": "EV-24-A", "evidence_type": "receiving", "result": "FAIL", "description": "Shortage verified 1 unit missing", "source": "Dock-3", "timestamp": T0 - timedelta(hours=3), "shipment_id": "SH-EV-23", "sku": "SKU-MULTI"}
        ],
        "expected_verdict": "SUPPORTED",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-24-A"]
    },

    # 25-26: DUPLICATE CHARGES
    {
        "case_id": "CASE-25",
        "category": "duplicate_charges",
        "description": "Primary charge assessed with valid evidence",
        "charge": {"charge_id": "CHG-EV-25", "reason": "Packaging Defect Charge", "amount": 50.0, "shipment_id": "SH-EV-25", "order_id": "ORD-EV-25", "sku": "SKU-DUP", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-25-A", "evidence_type": "prep", "result": "PASS", "description": "Polybag intact", "source": "Prep-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-25", "sku": "SKU-DUP"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 50.0,
        "expected_evidence_ids": ["EV-25-A"]
    },
    {
        "case_id": "CASE-26",
        "category": "duplicate_charges",
        "description": "Duplicate charge on same shipment references same evidence",
        "charge": {"charge_id": "CHG-EV-26", "reason": "Packaging Defect Charge", "amount": 50.0, "shipment_id": "SH-EV-25", "order_id": "ORD-EV-25", "sku": "SKU-DUP", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-25-A", "evidence_type": "prep", "result": "PASS", "description": "Polybag intact", "source": "Prep-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-25", "sku": "SKU-DUP"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 50.0,
        "expected_evidence_ids": ["EV-25-A"]
    },

    # 27-28: MISSING IDENTIFIERS
    {
        "case_id": "CASE-27",
        "category": "missing_identifiers",
        "description": "Charge has missing shipment_id, resolved via order_id",
        "charge": {"charge_id": "CHG-EV-27", "reason": "Packaging Defect Charge", "amount": 50.0, "shipment_id": None, "order_id": "ORD-EV-27", "sku": "SKU-RESOLVE", "charge_date": T0},
        "shipment_link": {"shipment_id": "SH-EV-27", "order_id": "ORD-EV-27", "sku": "SKU-RESOLVE"},
        "evidence": [{"evidence_id": "EV-27-A", "evidence_type": "prep", "result": "PASS", "description": "Packaging passed compliant", "source": "Prep-1", "timestamp": T0 - timedelta(hours=3), "shipment_id": "SH-EV-27", "order_id": "ORD-EV-27", "sku": "SKU-RESOLVE"}],
        "expected_verdict": "CONTRADICTED",
        "expected_claim": 50.0,
        "expected_evidence_ids": ["EV-27-A"]
    },
    {
        "case_id": "CASE-28",
        "category": "missing_identifiers",
        "description": "Charge has neither shipment_id nor order_id (unresolvable)",
        "charge": {"charge_id": "CHG-EV-28", "reason": "Packaging Defect Charge", "amount": 50.0, "shipment_id": None, "order_id": None, "sku": None, "charge_date": T0},
        "evidence": [],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": []
    },

    # 29-30: AMBIGUOUS EVIDENCE
    {
        "case_id": "CASE-29",
        "category": "ambiguous_evidence",
        "description": "Inspection log indicates partial non-compliance but not a definitive defect",
        "charge": {"charge_id": "CHG-EV-29", "reason": "Packaging Defect Charge", "amount": 48.0, "shipment_id": "SH-EV-29", "order_id": "ORD-EV-29", "sku": "SKU-AMBIG", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-29-A", "evidence_type": "prep", "result": "BORDERLINE", "description": "Tape adhesion weak but holding", "source": "Prep-1", "timestamp": T0 - timedelta(hours=2), "shipment_id": "SH-EV-29", "sku": "SKU-AMBIG"}],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-29-A"]
    },
    {
        "case_id": "CASE-30",
        "category": "ambiguous_evidence",
        "description": "Log indicates return inspection inconclusive due to third party carrier handling",
        "charge": {"charge_id": "CHG-EV-30", "reason": "Customer Return Damage", "amount": 72.0, "shipment_id": "SH-EV-30", "order_id": "ORD-EV-30", "sku": "SKU-AMBIG-2", "charge_date": T0},
        "evidence": [{"evidence_id": "EV-30-A", "evidence_type": "returns", "result": "INDETERMINATE", "description": "Origin of damage cannot be attributed", "source": "RMA-Desk", "timestamp": T0 - timedelta(hours=1), "shipment_id": "SH-EV-30", "sku": "SKU-AMBIG-2"}],
        "expected_verdict": "SILENT",
        "expected_claim": 0.0,
        "expected_evidence_ids": ["EV-30-A"]
    }
]

def run_evaluation_suite(db_engine=None) -> Dict[str, Any]:
    """
    Executes the 30-case evaluation suite against the RecoveryAgent.
    Computes and reports purely measured ground truth comparison metrics.
    Never fabricates benchmark numbers.
    """
    if db_engine is None:
        engine = create_engine("sqlite:///:memory:", echo=False)
    else:
        engine = db_engine

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    total_cases = len(EVALUATION_CASES)
    correct_verdicts = 0
    correct_claims = 0
    unsupported_claims = 0
    traceable_cases = 0
    agreeing_cases = 0

    total_expected_evidence_items = 0
    total_retrieved_evidence_items = 0
    total_true_positives = 0

    case_results = []

    for case in EVALUATION_CASES:
        c_data = case["charge"]
        charge = Charge(
            charge_id=c_data["charge_id"],
            reason=c_data["reason"],
            amount=c_data["amount"],
            shipment_id=c_data.get("shipment_id"),
            order_id=c_data.get("order_id"),
            sku=c_data.get("sku"),
            charge_date=c_data.get("charge_date", datetime.utcnow())
        )
        session.add(charge)

        if "shipment_link" in case:
            sl = case["shipment_link"]
            session.add(Shipment(
                shipment_id=sl["shipment_id"],
                order_id=sl.get("order_id"),
                sku=sl.get("sku"),
                quantity=1
            ))

        for ev_data in case.get("evidence", []):
            existing_ev = session.query(Evidence).filter(Evidence.evidence_id == ev_data["evidence_id"]).first()
            if not existing_ev:
                ev = Evidence(
                    evidence_id=ev_data["evidence_id"],
                    evidence_type=ev_data["evidence_type"],
                    result=ev_data["result"],
                    description=ev_data["description"],
                    source=ev_data["source"],
                    timestamp=ev_data.get("timestamp", datetime.utcnow()),
                    shipment_id=ev_data.get("shipment_id"),
                    order_id=ev_data.get("order_id"),
                    sku=ev_data.get("sku")
                )
                session.add(ev)

        session.commit()

        # Prime vector index for this session
        VectorRetrievalService.index_evidence(session)

        # Run investigation
        res = RecoveryAgent.investigate_charge(charge.charge_id, session)

        # 1. Verdict check
        is_verdict_correct = (res.verdict == case["expected_verdict"])
        if is_verdict_correct:
            correct_verdicts += 1

        # 2. Claim check
        is_claim_correct = abs(res.claim_amount - case["expected_claim"]) < 0.01
        if is_claim_correct:
            correct_claims += 1

        # 3. Unsupported claim rate check
        # An unsupported claim is when claim > 0 on SUPPORTED or SILENT
        if res.claim_amount > 0 and res.verdict in {"SUPPORTED", "SILENT"}:
            unsupported_claims += 1

        # 4. Traceability check: all referenced evidence IDs must exist in DB
        db_eids = {e.evidence_id for e in session.query(Evidence).all()}
        all_traceable = all(eid in db_eids for eid in res.evidence_ids)
        if all_traceable:
            traceable_cases += 1

        # 5. AI / Deterministic agreement check
        if res.agreement_with_deterministic:
            agreeing_cases += 1

        # 6. Precision / Recall
        exp_ids = set(case.get("expected_evidence_ids", []))
        ret_ids = set(res.evidence_ids)
        tp = len(exp_ids.intersection(ret_ids))

        total_expected_evidence_items += len(exp_ids)
        total_retrieved_evidence_items += len(ret_ids)
        total_true_positives += tp

        case_results.append({
            "case_id": case["case_id"],
            "category": case["category"],
            "expected_verdict": case["expected_verdict"],
            "actual_verdict": res.verdict,
            "verdict_correct": is_verdict_correct,
            "expected_claim": case["expected_claim"],
            "actual_claim": res.claim_amount,
            "claim_correct": is_claim_correct,
            "retrieved_evidence": res.evidence_ids
        })

    session.close()

    precision = round((total_true_positives / total_retrieved_evidence_items), 4) if total_retrieved_evidence_items > 0 else 1.0
    recall = round((total_true_positives / total_expected_evidence_items), 4) if total_expected_evidence_items > 0 else 1.0
    verdict_acc = round(correct_verdicts / total_cases, 4)
    claim_acc = round(correct_claims / total_cases, 4)
    unsupported_rate = round(unsupported_claims / total_cases, 4)
    traceability_rate = round(traceable_cases / total_cases, 4)
    agreement_rate = round(agreeing_cases / total_cases, 4)

    return {
        "total_cases": total_cases,
        "verdict_accuracy": verdict_acc,
        "claim_correctness": claim_acc,
        "evidence_precision": precision,
        "evidence_recall": recall,
        "unsupported_claim_rate": unsupported_rate,
        "evidence_traceability": traceability_rate,
        "ai_deterministic_agreement": agreement_rate,
        "case_results": case_results
    }
