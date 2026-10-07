import csv
import io
import json
from datetime import datetime
from typing import Dict, Any, List, Union, Tuple
from sqlalchemy.orm import Session

from app.models.entities import Charge, Order, Shipment, Evidence
from app.schemas.entities import (
    ChargeCreate, OrderCreate, ShipmentCreate, EvidenceCreate,
    IngestResult, IngestRecordError
)

def parse_datetime(val: Any) -> datetime:
    if isinstance(val, datetime):
        return val
    if not val:
        return datetime.utcnow()
    val_str = str(val).strip()
    # Try ISO or standard formats
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(val_str.split(".")[0].replace("Z", ""), fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(val_str)
    except Exception:
        return datetime.utcnow()

class IngestionService:
    @staticmethod
    def ingest_dict(db: Session, payload: Dict[str, Any]) -> IngestResult:
        charges_ingested = 0
        orders_ingested = 0
        shipments_ingested = 0
        evidence_ingested = 0
        errors: List[IngestRecordError] = []

        # 1. Orders
        raw_orders = payload.get("orders") or []
        for raw in raw_orders:
            try:
                # Handle numeric quantity
                data = dict(raw)
                if "quantity" in data:
                    data["quantity"] = int(data["quantity"])
                order_in = OrderCreate(**data)
                
                # Check existing order with same order_id and sku
                existing = db.query(Order).filter(
                    Order.order_id == order_in.order_id,
                    Order.sku == order_in.sku
                ).first()
                if existing:
                    existing.quantity = order_in.quantity
                else:
                    new_order = Order(
                        order_id=order_in.order_id,
                        sku=order_in.sku,
                        quantity=order_in.quantity
                    )
                    db.add(new_order)
                orders_ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="order",
                    identifier=str(raw.get("order_id")),
                    error=str(e),
                    raw_data=raw
                ))

        # 2. Shipments
        raw_shipments = payload.get("shipments") or []
        for raw in raw_shipments:
            try:
                data = dict(raw)
                if "quantity" in data:
                    data["quantity"] = int(data["quantity"])
                if "shipment_date" in data:
                    data["shipment_date"] = parse_datetime(data["shipment_date"])
                else:
                    data["shipment_date"] = datetime.utcnow()
                ship_in = ShipmentCreate(**data)

                existing = db.query(Shipment).filter(
                    Shipment.shipment_id == ship_in.shipment_id,
                    Shipment.sku == ship_in.sku
                ).first()
                if existing:
                    existing.order_id = ship_in.order_id
                    existing.quantity = ship_in.quantity
                    existing.shipment_date = ship_in.shipment_date
                else:
                    new_ship = Shipment(
                        shipment_id=ship_in.shipment_id,
                        order_id=ship_in.order_id,
                        sku=ship_in.sku,
                        quantity=ship_in.quantity,
                        shipment_date=ship_in.shipment_date
                    )
                    db.add(new_ship)
                shipments_ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="shipment",
                    identifier=str(raw.get("shipment_id")),
                    error=str(e),
                    raw_data=raw
                ))

        # 3. Evidence
        raw_evidence = payload.get("evidence") or []
        for raw in raw_evidence:
            try:
                data = dict(raw)
                if "timestamp" in data:
                    data["timestamp"] = parse_datetime(data["timestamp"])
                else:
                    data["timestamp"] = datetime.utcnow()
                
                # Check reference_data or metadata
                ref = data.get("reference_data") or data.get("metadata") or {}
                if isinstance(ref, str):
                    try:
                        ref = json.loads(ref)
                    except Exception:
                        ref = {"raw": ref}
                data["reference_data"] = ref

                ev_in = EvidenceCreate(**data)

                existing = db.query(Evidence).filter(
                    Evidence.evidence_id == ev_in.evidence_id
                ).first()
                if existing:
                    existing.evidence_type = ev_in.evidence_type
                    existing.shipment_id = ev_in.shipment_id
                    existing.order_id = ev_in.order_id
                    existing.sku = ev_in.sku
                    existing.result = ev_in.result
                    existing.description = ev_in.description
                    existing.timestamp = ev_in.timestamp
                    existing.source = ev_in.source
                    existing.reference_data = ev_in.reference_data
                else:
                    new_ev = Evidence(
                        evidence_id=ev_in.evidence_id,
                        evidence_type=ev_in.evidence_type,
                        shipment_id=ev_in.shipment_id,
                        order_id=ev_in.order_id,
                        sku=ev_in.sku,
                        result=ev_in.result,
                        description=ev_in.description,
                        timestamp=ev_in.timestamp,
                        source=ev_in.source,
                        reference_data=ev_in.reference_data
                    )
                    db.add(new_ev)
                evidence_ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="evidence",
                    identifier=str(raw.get("evidence_id")),
                    error=str(e),
                    raw_data=raw
                ))

        # 4. Charges
        raw_charges = payload.get("charges") or []
        for raw in raw_charges:
            try:
                data = dict(raw)
                if "amount" in data:
                    data["amount"] = float(data["amount"])
                if "charge_date" in data:
                    data["charge_date"] = parse_datetime(data["charge_date"])
                else:
                    data["charge_date"] = datetime.utcnow()
                charge_in = ChargeCreate(**data)

                existing = db.query(Charge).filter(
                    Charge.charge_id == charge_in.charge_id
                ).first()
                if existing:
                    existing.shipment_id = charge_in.shipment_id
                    existing.order_id = charge_in.order_id
                    existing.sku = charge_in.sku
                    existing.reason = charge_in.reason
                    existing.amount = charge_in.amount
                    existing.currency = charge_in.currency
                    existing.charge_date = charge_in.charge_date
                    existing.status = charge_in.status or existing.status
                else:
                    new_charge = Charge(
                        charge_id=charge_in.charge_id,
                        shipment_id=charge_in.shipment_id,
                        order_id=charge_in.order_id,
                        sku=charge_in.sku,
                        reason=charge_in.reason,
                        amount=charge_in.amount,
                        currency=charge_in.currency,
                        charge_date=charge_in.charge_date,
                        status=charge_in.status or "PENDING"
                    )
                    db.add(new_charge)
                charges_ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="charge",
                    identifier=str(raw.get("charge_id")),
                    error=str(e),
                    raw_data=raw
                ))

        db.commit()

        return IngestResult(
            success=len(errors) == 0,
            charges_ingested=charges_ingested,
            orders_ingested=orders_ingested,
            shipments_ingested=shipments_ingested,
            evidence_ingested=evidence_ingested,
            errors=errors
        )

    @staticmethod
    def ingest_csv_content(db: Session, record_type: str, csv_text: str) -> IngestResult:
        """
        Ingests CSV data for a specific record type (charges, orders, shipments, evidence)
        """
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        rows = list(reader)
        payload = {record_type: rows}
        return IngestionService.ingest_dict(db, payload)
