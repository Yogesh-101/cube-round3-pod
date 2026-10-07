from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.entities import Charge, Order, Shipment, Evidence
from app.services.claims import ClaimCalculationService

FAVORABLE_RESULTS = {"PASS", "VERIFIED", "INTACT", "COMPLIANT", "MATCH", "CONFIRMED"}
DEFECT_RESULTS = {"FAIL", "FAILED", "DAMAGED", "DISCREPANCY", "DEFECTIVE", "SHORTAGE", "SHORT", "MISSING", "NON_COMPLIANT"}

def get_charge(charge_id: str, db: Session) -> Optional[Charge]:
    """Retrieves a single Charge record by its unique charge_id."""
    return db.query(Charge).filter(Charge.charge_id == charge_id).first()

def find_order(order_id: str, db: Session) -> List[Order]:
    """Finds all Order lines matching an order_id."""
    if not order_id:
        return []
    return db.query(Order).filter(Order.order_id == order_id).all()

def find_shipment(shipment_id: str, db: Session) -> List[Shipment]:
    """Finds all Shipment lines matching a shipment_id."""
    if not shipment_id:
        return []
    return db.query(Shipment).filter(Shipment.shipment_id == shipment_id).all()

def find_sku(sku: str, db: Session) -> Dict[str, Any]:
    """Finds orders and shipments referencing a given SKU."""
    if not sku:
        return {"orders": [], "shipments": []}
    orders = db.query(Order).filter(Order.sku == sku).all()
    shipments = db.query(Shipment).filter(Shipment.sku == sku).all()
    return {"orders": orders, "shipments": shipments}

def get_evidence(evidence_id: str, db: Session) -> Optional[Evidence]:
    """Retrieves a single Evidence record by its unique evidence_id."""
    if not evidence_id:
        return None
    return db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()

def search_evidence(
    db: Session,
    query: Optional[str] = None,
    shipment_id: Optional[str] = None,
    order_id: Optional[str] = None,
    sku: Optional[str] = None,
    unit_id: Optional[str] = None,
    evidence_types: Optional[List[str]] = None
) -> List[Evidence]:
    """
    Searches evidence matching relational identifiers and optional type/keyword filters.
    Never invents or fabricates evidence.
    """
    clauses = []
    if unit_id:
        clauses.append(Evidence.unit_id == unit_id)
    if shipment_id:
        clauses.append(Evidence.shipment_id == shipment_id)
    if order_id:
        clauses.append(Evidence.order_id == order_id)

    if not clauses and not sku and not query:
        return []

    q = db.query(Evidence)
    if clauses:
        q = q.filter(or_(*clauses))
    if sku:
        q = q.filter(or_(Evidence.sku == sku, Evidence.sku.is_(None)))
    if evidence_types:
        lower_types = [t.lower() for t in evidence_types]
        q = q.filter(Evidence.evidence_type.in_(lower_types))

    records = q.order_by(Evidence.timestamp.asc()).all()

    # Deduplicate
    seen = set()
    deduped = []
    for r in records:
        if r.evidence_id not in seen:
            # If search specifies unit_id, do not attach records from another unit
            if unit_id and r.unit_id and r.unit_id != unit_id:
                continue
            seen.add(r.evidence_id)
            deduped.append(r)
    return deduped

def assess_evidence(charge: Charge, evidence_items: List[Evidence]) -> Dict[str, Any]:
    """
    Deterministic safety evaluation over candidate evidence items.
    Returns:
        {
            "verdict": "SUPPORTED" | "CONTRADICTED" | "SILENT",
            "reason": str,
            "evidence_strength": "STRONG" | "MODERATE" | "WEAK" | "INSUFFICIENT",
            "evidence_ids": List[str],
            "missing_info": List[str]
        }
    """
    if not evidence_items:
        return {
            "verdict": "SILENT",
            "reason": f"No relevant evidence found for charge '{charge.reason}'. Defaulting to SILENT.",
            "evidence_strength": "INSUFFICIENT",
            "evidence_ids": [],
            "missing_info": ["Relevant fulfillment operational evidence logs"]
        }

    valid_items = []
    for ev in evidence_items:
        if ev.timestamp and charge.charge_date:
            ev_date = ev.timestamp.date() if hasattr(ev.timestamp, "date") else ev.timestamp
            chg_date = charge.charge_date.date() if hasattr(charge.charge_date, "date") else charge.charge_date
            if ev.timestamp <= charge.charge_date or ev_date <= chg_date or ev.evidence_type == "returns":
                valid_items.append(ev)
        else:
            valid_items.append(ev)

    if not valid_items:
        return {
            "verdict": "SILENT",
            "reason": f"Found {len(evidence_items)} records but none possess valid timestamps before charge date. Cannot establish sequence.",
            "evidence_strength": "INSUFFICIENT",
            "evidence_ids": [e.evidence_id for e in evidence_items],
            "missing_info": ["Timely pre-charge operational logs"]
        }

    favorable = [e for e in valid_items if e.result.upper() in FAVORABLE_RESULTS]
    defect = [e for e in valid_items if e.result.upper() in DEFECT_RESULTS]

    if favorable and defect:
        return {
            "verdict": "SILENT",
            "reason": f"Conflicting evidence: favorable logs {[e.evidence_id for e in favorable]} conflict with defect logs {[e.evidence_id for e in defect]}. Ambiguity requires SILENT.",
            "evidence_strength": "WEAK",
            "evidence_ids": [e.evidence_id for e in favorable + defect],
            "missing_info": ["Reconciliation of conflicting inspection results"]
        }

    if favorable and not defect:
        strength = "STRONG" if len(favorable) >= 2 else "MODERATE"
        ev_refs = [f"{e.evidence_id} ({e.source}, result={e.result})" for e in favorable]
        return {
            "verdict": "CONTRADICTED",
            "reason": f"Charge '{charge.reason}' is CONTRADICTED by {len(favorable)} verified log(s): " + "; ".join(ev_refs),
            "evidence_strength": strength,
            "evidence_ids": [e.evidence_id for e in favorable],
            "missing_info": []
        }

    if defect and not favorable:
        strength = "STRONG" if len(defect) >= 2 else "MODERATE"
        ev_refs = [f"{e.evidence_id} ({e.source}, result={e.result})" for e in defect]
        return {
            "verdict": "SUPPORTED",
            "reason": f"Charge '{charge.reason}' is SUPPORTED by {len(defect)} verified defect log(s): " + "; ".join(ev_refs) + ". Charge penalty is valid.",
            "evidence_strength": strength,
            "evidence_ids": [e.evidence_id for e in defect],
            "missing_info": []
        }

    return {
        "verdict": "SILENT",
        "reason": f"Evidence items {[e.evidence_id for e in valid_items]} inconclusive. Defaulting to SILENT.",
        "evidence_strength": "INSUFFICIENT",
        "evidence_ids": [e.evidence_id for e in valid_items],
        "missing_info": ["Definitive PASS or FAIL operational result"]
    }

def calculate_claim(charge: Charge, verdict: str) -> float:
    """Calculates defensible claim amount using ClaimCalculationService."""
    return ClaimCalculationService.calculate_claim_amount(charge, verdict)

def generate_claim_explanation(
    charge: Charge,
    verdict: str,
    evidence_items: List[Evidence],
    details: Optional[Dict[str, Any]] = None
) -> str:
    """Generates an evidence-backed audit explanation referencing strictly retrieved records."""
    if verdict == "CONTRADICTED":
        refs = [f"evidence {e.evidence_id} ({e.evidence_type} verified {e.result} by {e.source} at {e.timestamp})" for e in evidence_items]
        return (
            f"Fulfillment charge '{charge.reason}' for amount ${charge.amount:.2f} is CONTRADICTED by verified fulfillment records: "
            + "; ".join(refs)
            + f". Recovery claim of ${charge.amount:.2f} {charge.currency} is substantiated."
        )
    elif verdict == "SUPPORTED":
        refs = [f"evidence {e.evidence_id} ({e.source} logged {e.result} at {e.timestamp})" for e in evidence_items]
        return (
            f"Fulfillment charge '{charge.reason}' of ${charge.amount:.2f} is SUPPORTED by warehouse inspection logs: "
            + "; ".join(refs)
            + ". Charge was appropriately assessed; no recovery claim generated."
        )
    else:
        return (
            f"Dispute assessment for '{charge.reason}' remains SILENT due to missing or insufficient evidence. "
            f"No claim can be responsibly filed without verified documentation."
        )
