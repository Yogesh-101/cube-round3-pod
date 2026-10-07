import csv
import io
import os
from datetime import datetime, time, timezone
from typing import Dict, Any, List, Optional, Tuple, Union
from sqlalchemy.orm import Session

from app.models.entities import Charge, Order, Shipment, Evidence
from app.schemas.entities import IngestRecordError

def parse_date_end_of_day(val: Any) -> datetime:
    """
    Parses date strings, setting time to 23:59:59 UTC so that same-day
    upstream evidence records (captured earlier in the day) are correctly recognized.
    """
    if isinstance(val, datetime):
        return val
    if not val:
        return datetime.now(timezone.utc)
    val_str = str(val).strip()
    # Try date only
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            d = datetime.strptime(val_str, fmt)
            return datetime.combine(d.date(), time(23, 59, 59))
        except ValueError:
            pass
    # Try full timestamp
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(val_str.split(".")[0].replace("Z", ""), fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(val_str)
    except Exception:
        return datetime.now(timezone.utc)

def parse_iso_datetime(val: Any) -> datetime:
    """Parses ISO timestamp strings."""
    if isinstance(val, datetime):
        return val
    if not val:
        return datetime.now(timezone.utc)
    val_str = str(val).strip()
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d"
    ):
        try:
            return datetime.strptime(val_str.split(".")[0].replace("Z", ""), fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(val_str)
    except Exception:
        return datetime.now(timezone.utc)

class OfficialAdapterResult:
    def __init__(self):
        self.success: bool = True
        self.charges_ingested: int = 0
        self.receiving_ingested: int = 0
        self.prep_ingested: int = 0
        self.pack_ingested: int = 0
        self.returns_ingested: int = 0
        self.orders_created: int = 0
        self.shipments_created: int = 0
        self.errors: List[IngestRecordError] = []
        self.warnings: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success and len(self.errors) == 0,
            "charges_ingested": self.charges_ingested,
            "receiving_ingested": self.receiving_ingested,
            "prep_ingested": self.prep_ingested,
            "pack_ingested": self.pack_ingested,
            "returns_ingested": self.returns_ingested,
            "total_evidence_ingested": (
                self.receiving_ingested + self.prep_ingested +
                self.pack_ingested + self.returns_ingested
            ),
            "orders_created": self.orders_created,
            "shipments_created": self.shipments_created,
            "errors": [e.model_dump() if hasattr(e, "model_dump") else dict(e) for e in self.errors],
            "warnings": self.warnings
        }

class OfficialDataAdapter:
    """
    Clean, idempotent adapter layer that ingests official Cube Build-A-Thon CSV files:
    - fee_report_sample.csv
    - upstream/receiving_sample.csv
    - upstream/prep_sample.csv
    - upstream/pack_sample.csv
    - upstream/returns_sample.csv

    Normalizes all records directly into existing RecoveryOS domain schema:
    Charge, Evidence, Shipment, Order.
    Never fabricates missing identifiers; preserves exact source traceability.
    """

    @classmethod
    def ingest_fee_report_csv(cls, db: Session, csv_text: str, filename: str = "fee_report_sample.csv") -> Tuple[int, List[IngestRecordError]]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        ingested = 0
        errors: List[IngestRecordError] = []

        required_cols = {"line_id", "unit_id", "sku", "charge_type", "amount_usd", "posted_date"}

        for idx, row in enumerate(reader, start=1):
            line_id = row.get("line_id", "").strip()
            if not line_id:
                errors.append(IngestRecordError(
                    record_type="official_charge",
                    identifier=f"row_{idx}",
                    error="Missing required 'line_id' in fee report row",
                    raw_data=row
                ))
                continue

            try:
                unit_id = row.get("unit_id", "").strip() or None
                sku = row.get("sku", "").strip() or None
                fba_shipment_id = row.get("fba_shipment_id", "").strip() or None
                order_id = row.get("order_id", "").strip() or None
                charge_type = row.get("charge_type", "").strip()
                amount_str = row.get("amount_usd", "0").strip()
                amount = float(amount_str) if amount_str else 0.0
                posted_date = parse_date_end_of_day(row.get("posted_date"))

                # Reference metadata preserving all source fields
                ref_meta = {
                    "source_dataset": "cube_official",
                    "source_file": filename,
                    "source_row": idx,
                    "report_type": row.get("report_type"),
                    "org_id": row.get("org_id"),
                    "fnsku": row.get("fnsku"),
                    "quantity": int(row.get("quantity") or 1)
                }

                existing = db.query(Charge).filter(Charge.charge_id == line_id).first()
                if existing:
                    existing.shipment_id = fba_shipment_id
                    existing.order_id = order_id
                    existing.sku = sku
                    existing.unit_id = unit_id
                    existing.source_dataset = "cube_official"
                    existing.reason = charge_type
                    existing.amount = amount
                    existing.currency = "USD"
                    existing.charge_date = posted_date
                    existing.status = existing.status or "PENDING"
                else:
                    new_charge = Charge(
                        charge_id=line_id,
                        shipment_id=fba_shipment_id,
                        order_id=order_id,
                        sku=sku,
                        unit_id=unit_id,
                        source_dataset="cube_official",
                        reason=charge_type,
                        amount=amount,
                        currency="USD",
                        charge_date=posted_date,
                        status="PENDING"
                    )
                    db.add(new_charge)

                # Ensure associated Shipment and Order exist for relational integrity
                if fba_shipment_id and sku:
                    existing_ship = db.query(Shipment).filter(
                        Shipment.shipment_id == fba_shipment_id,
                        Shipment.sku == sku
                    ).first()
                    if not existing_ship:
                        db.add(Shipment(
                            shipment_id=fba_shipment_id,
                            order_id=order_id,
                            sku=sku,
                            quantity=int(row.get("quantity") or 1),
                            shipment_date=posted_date
                        ))

                if order_id and sku:
                    existing_ord = db.query(Order).filter(
                        Order.order_id == order_id,
                        Order.sku == sku
                    ).first()
                    if not existing_ord:
                        db.add(Order(
                            order_id=order_id,
                            sku=sku,
                            quantity=int(row.get("quantity") or 1)
                        ))

                ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="official_charge",
                    identifier=line_id,
                    error=str(e),
                    raw_data=row
                ))

        db.commit()
        return ingested, errors

    @classmethod
    def ingest_receiving_csv(cls, db: Session, csv_text: str, filename: str = "receiving_sample.csv") -> Tuple[int, List[IngestRecordError]]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        ingested = 0
        errors: List[IngestRecordError] = []

        for idx, row in enumerate(reader, start=1):
            record_id = row.get("record_id", "").strip()
            if not record_id:
                errors.append(IngestRecordError(
                    record_type="official_receiving",
                    identifier=f"row_{idx}",
                    error="Missing required 'record_id' in receiving row",
                    raw_data=row
                ))
                continue

            try:
                unit_id = row.get("unit_id", "").strip() or None
                sku = row.get("sku", "").strip() or None
                captured_at = parse_iso_datetime(row.get("captured_at"))
                operator_id = row.get("operator_id", "").strip() or "unassigned"

                qty_ordered = int(row.get("qty_ordered") or 0)
                qty_received = int(row.get("qty_received") or 0)
                identity_match = (row.get("identity_match") or "yes").strip().lower()
                carton_damage = (row.get("carton_damage") or "none").strip().lower()
                unit_damage = (row.get("unit_damage") or "none").strip().lower()
                quality_flags = (row.get("quality_flags") or "").strip()

                # Derive deterministic evidence result
                if identity_match == "no":
                    result = "FAIL"
                    desc_summary = "Identity mismatch during dock receiving check-in"
                elif quality_flags:
                    result = "DISCREPANCY"
                    desc_summary = f"Receiving quality flag logged: '{quality_flags}'"
                elif carton_damage not in ("none", "", "n/a") or unit_damage not in ("none", "", "n/a"):
                    result = "DAMAGED"
                    desc_summary = f"Physical damage observed: carton={carton_damage}, unit={unit_damage}"
                elif qty_received < qty_ordered:
                    result = "DISCREPANCY"
                    desc_summary = f"Inbound shortage: ordered {qty_ordered}, received {qty_received}"
                else:
                    result = "PASS"
                    desc_summary = f"Dock receiving verified: {qty_received}/{qty_ordered} units intact, no defects"

                description = (
                    f"Official Dock Receiving Inspection ({record_id}): {desc_summary}. "
                    f"PO: {row.get('po_number')} (Line {row.get('po_line')}), Supplier: {row.get('supplier')}, "
                    f"Operator: {operator_id}."
                )

                ref_data = {
                    "source_dataset": "cube_official",
                    "source_file": filename,
                    "source_row": idx,
                    "source_record_id": record_id,
                    "unit_id": unit_id,
                    "org_id": row.get("org_id"),
                    "po_number": row.get("po_number"),
                    "po_line": row.get("po_line"),
                    "supplier": row.get("supplier"),
                    "asin": row.get("asin"),
                    "product_title": row.get("product_title"),
                    "qty_ordered": qty_ordered,
                    "qty_received": qty_received,
                    "identity_match": identity_match,
                    "carton_damage": carton_damage,
                    "unit_damage": unit_damage,
                    "quality_flags": quality_flags,
                    "photo_refs": row.get("photo_refs", ""),
                    "operator_id": operator_id
                }

                existing = db.query(Evidence).filter(Evidence.evidence_id == record_id).first()
                if existing:
                    existing.evidence_type = "receiving"
                    existing.sku = sku
                    existing.unit_id = unit_id
                    existing.source_dataset = "cube_official"
                    existing.result = result
                    existing.description = description
                    existing.timestamp = captured_at
                    existing.source = f"DockStation-{operator_id} (Official Receiving)"
                    existing.reference_data = ref_data
                else:
                    new_ev = Evidence(
                        evidence_id=record_id,
                        evidence_type="receiving",
                        sku=sku,
                        unit_id=unit_id,
                        source_dataset="cube_official",
                        result=result,
                        description=description,
                        timestamp=captured_at,
                        source=f"DockStation-{operator_id} (Official Receiving)",
                        reference_data=ref_data
                    )
                    db.add(new_ev)

                ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="official_receiving",
                    identifier=record_id,
                    error=str(e),
                    raw_data=row
                ))

        db.commit()
        return ingested, errors

    @classmethod
    def ingest_prep_csv(cls, db: Session, csv_text: str, filename: str = "prep_sample.csv") -> Tuple[int, List[IngestRecordError]]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        ingested = 0
        errors: List[IngestRecordError] = []

        for idx, row in enumerate(reader, start=1):
            record_id = row.get("record_id", "").strip()
            if not record_id:
                errors.append(IngestRecordError(
                    record_type="official_prep",
                    identifier=f"row_{idx}",
                    error="Missing required 'record_id' in prep row",
                    raw_data=row
                ))
                continue

            try:
                unit_id = row.get("unit_id", "").strip() or None
                sku = row.get("sku", "").strip() or None
                fba_shipment_id = row.get("fba_shipment_id", "").strip() or None
                captured_at = parse_iso_datetime(row.get("captured_at"))
                operator_id = row.get("operator_id", "").strip() or "unassigned"

                polybag = (row.get("polybag_present_sealed") or "not_required").strip().lower()
                suffocation = (row.get("suffocation_warning") or "not_required").strip().lower()
                barcode_covered = (row.get("original_barcode_covered") or "yes").strip().lower()
                label_placement = (row.get("fnsku_label_placement") or "flat").strip().lower()
                handling = (row.get("handling_marks") or "not_required").strip().lower()

                # Derive prep compliance verdict
                has_defect = (
                    polybag == "not_sealed" or
                    suffocation in ("missing", "obscured_by_fold") or
                    barcode_covered == "no" or
                    label_placement in ("missing",) or
                    handling in ("some_missing",)
                )
                is_uncertain = (
                    polybag == "uncertain" or
                    suffocation == "uncertain" or
                    barcode_covered == "uncertain" or
                    handling == "uncertain"
                )

                if has_defect:
                    result = "FAIL"
                    defects = []
                    if polybag == "not_sealed": defects.append("polybag unsealed")
                    if suffocation in ("missing", "obscured_by_fold"): defects.append(f"suffocation warning {suffocation}")
                    if barcode_covered == "no": defects.append("original barcode not covered")
                    if label_placement in ("missing",): defects.append("label missing")
                    if handling in ("some_missing",): defects.append("handling marks missing")
                    desc_summary = f"Prep standard failure: {', '.join(defects)}"
                elif is_uncertain:
                    result = "INCONCLUSIVE"
                    desc_summary = "Prep inspection uncertain / inconclusive"
                else:
                    result = "PASS"
                    desc_summary = f"Outbound prep verified compliant (label={label_placement}, barcode_covered={barcode_covered}, polybag={polybag})"

                description = (
                    f"Official Prep Inspection ({record_id}): {desc_summary}. "
                    f"FBA Shipment: {fba_shipment_id}, FNSKU: {row.get('fnsku')}, Operator: {operator_id}."
                )

                ref_data = {
                    "source_dataset": "cube_official",
                    "source_file": filename,
                    "source_row": idx,
                    "source_record_id": record_id,
                    "unit_id": unit_id,
                    "org_id": row.get("org_id"),
                    "work_order_id": row.get("work_order_id"),
                    "fba_shipment_id": fba_shipment_id,
                    "fnsku": row.get("fnsku"),
                    "polybag_present_sealed": polybag,
                    "suffocation_warning": suffocation,
                    "fnsku_label_placement": label_placement,
                    "original_barcode_covered": barcode_covered,
                    "expiry_date": row.get("expiry_date"),
                    "handling_marks": handling,
                    "photo_refs": row.get("photo_refs", ""),
                    "operator_id": operator_id
                }

                existing = db.query(Evidence).filter(Evidence.evidence_id == record_id).first()
                if existing:
                    existing.evidence_type = "prep"
                    existing.shipment_id = fba_shipment_id
                    existing.sku = sku
                    existing.unit_id = unit_id
                    existing.source_dataset = "cube_official"
                    existing.result = result
                    existing.description = description
                    existing.timestamp = captured_at
                    existing.source = f"PrepStation-{operator_id} (Official Prep)"
                    existing.reference_data = ref_data
                else:
                    new_ev = Evidence(
                        evidence_id=record_id,
                        evidence_type="prep",
                        shipment_id=fba_shipment_id,
                        sku=sku,
                        unit_id=unit_id,
                        source_dataset="cube_official",
                        result=result,
                        description=description,
                        timestamp=captured_at,
                        source=f"PrepStation-{operator_id} (Official Prep)",
                        reference_data=ref_data
                    )
                    db.add(new_ev)

                # Ensure Shipment record exists
                if fba_shipment_id and sku:
                    existing_ship = db.query(Shipment).filter(
                        Shipment.shipment_id == fba_shipment_id,
                        Shipment.sku == sku
                    ).first()
                    if not existing_ship:
                        db.add(Shipment(
                            shipment_id=fba_shipment_id,
                            sku=sku,
                            quantity=1,
                            shipment_date=captured_at
                        ))

                ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="official_prep",
                    identifier=record_id,
                    error=str(e),
                    raw_data=row
                ))

        db.commit()
        return ingested, errors

    @classmethod
    def ingest_pack_csv(cls, db: Session, csv_text: str, filename: str = "pack_sample.csv") -> Tuple[int, List[IngestRecordError]]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        ingested = 0
        errors: List[IngestRecordError] = []

        for idx, row in enumerate(reader, start=1):
            record_id = row.get("record_id", "").strip()
            if not record_id:
                errors.append(IngestRecordError(
                    record_type="official_pack",
                    identifier=f"row_{idx}",
                    error="Missing required 'record_id' in pack row",
                    raw_data=row
                ))
                continue

            try:
                unit_id = row.get("unit_id", "").strip() or None
                order_id = row.get("order_id", "").strip() or None
                channel = row.get("channel", "").strip()
                order_lines = row.get("order_lines", "").strip()
                observed_in_box = row.get("observed_in_box", "").strip()
                verdict = (row.get("operator_verdict") or "seal").strip().lower()
                captured_at = parse_iso_datetime(row.get("captured_at"))
                operator_id = row.get("operator_id", "").strip() or "unassigned"

                # Extract SKU from order_lines (format: SKU-X:1;SKU-Y:1)
                skus = [line.split(":")[0].strip() for line in order_lines.split(";") if line and ":" in line]
                primary_sku = skus[0] if skus else None

                if verdict == "seal" and observed_in_box == order_lines:
                    result = "VERIFIED"
                    desc_summary = f"Pack verified: contents ({observed_in_box}) match order lines exactly, sealed"
                else:
                    result = "DISCREPANCY"
                    desc_summary = f"Pack discrepancy: operator verdict={verdict}, ordered={order_lines}, observed={observed_in_box}"

                description = (
                    f"Official Pack Station Inspection ({record_id}): {desc_summary}. "
                    f"Order: {order_id}, Channel: {channel}, Operator: {operator_id}."
                )

                ref_data = {
                    "source_dataset": "cube_official",
                    "source_file": filename,
                    "source_row": idx,
                    "source_record_id": record_id,
                    "unit_id": unit_id,
                    "org_id": row.get("org_id"),
                    "order_id": order_id,
                    "channel": channel,
                    "order_lines": order_lines,
                    "observed_in_box": observed_in_box,
                    "operator_verdict": verdict,
                    "photo_refs": row.get("photo_refs", ""),
                    "operator_id": operator_id
                }

                existing = db.query(Evidence).filter(Evidence.evidence_id == record_id).first()
                if existing:
                    existing.evidence_type = "packing"
                    existing.order_id = order_id
                    existing.sku = primary_sku
                    existing.unit_id = unit_id
                    existing.source_dataset = "cube_official"
                    existing.result = result
                    existing.description = description
                    existing.timestamp = captured_at
                    existing.source = f"PackStation-{operator_id} (Official Pack)"
                    existing.reference_data = ref_data
                else:
                    new_ev = Evidence(
                        evidence_id=record_id,
                        evidence_type="packing",
                        order_id=order_id,
                        sku=primary_sku,
                        unit_id=unit_id,
                        source_dataset="cube_official",
                        result=result,
                        description=description,
                        timestamp=captured_at,
                        source=f"PackStation-{operator_id} (Official Pack)",
                        reference_data=ref_data
                    )
                    db.add(new_ev)

                # Ensure Order record exists
                if order_id and primary_sku:
                    existing_ord = db.query(Order).filter(
                        Order.order_id == order_id,
                        Order.sku == primary_sku
                    ).first()
                    if not existing_ord:
                        db.add(Order(
                            order_id=order_id,
                            sku=primary_sku,
                            quantity=1
                        ))

                ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="official_pack",
                    identifier=record_id,
                    error=str(e),
                    raw_data=row
                ))

        db.commit()
        return ingested, errors

    @classmethod
    def ingest_returns_csv(cls, db: Session, csv_text: str, filename: str = "returns_sample.csv") -> Tuple[int, List[IngestRecordError]]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        ingested = 0
        errors: List[IngestRecordError] = []

        for idx, row in enumerate(reader, start=1):
            record_id = row.get("record_id", "").strip()
            if not record_id:
                errors.append(IngestRecordError(
                    record_type="official_returns",
                    identifier=f"row_{idx}",
                    error="Missing required 'record_id' in returns row",
                    raw_data=row
                ))
                continue

            try:
                unit_id = row.get("unit_id", "").strip() or None
                order_id = row.get("order_id", "").strip() or None
                sku = (row.get("ordered_sku") or "").strip() or None
                observed_state = (row.get("observed_state") or "").strip().lower()
                operator_disposition = (row.get("operator_disposition") or "").strip().lower()
                parts_missing = (row.get("parts_missing") or "").strip()
                identity_match = (row.get("identity_match") or "yes").strip().lower()
                captured_at = parse_iso_datetime(row.get("captured_at"))
                operator_id = row.get("operator_id", "").strip() or "unassigned"

                # Derive return disposition verdict
                if observed_state == "damaged" or operator_disposition in ("dispose", "liquidate") or parts_missing:
                    result = "DAMAGED"
                    desc_summary = (
                        f"Customer return defect: state={observed_state}, "
                        f"disposition={operator_disposition}, missing_parts='{parts_missing}'"
                    )
                elif observed_state in ("factory_sealed", "opened_unused") and operator_disposition in ("restock", "refurbish"):
                    result = "INTACT"
                    desc_summary = (
                        f"Customer return restockable: state={observed_state}, "
                        f"disposition={operator_disposition}"
                    )
                else:
                    result = "INCONCLUSIVE"
                    desc_summary = f"Customer return inspection: state={observed_state}, disposition={operator_disposition}"

                description = (
                    f"Official Returns Station Inspection ({record_id}): {desc_summary}. "
                    f"Order: {order_id}, SKU: {sku}, Operator: {operator_id}."
                )

                ref_data = {
                    "source_dataset": "cube_official",
                    "source_file": filename,
                    "source_row": idx,
                    "source_record_id": record_id,
                    "unit_id": unit_id,
                    "org_id": row.get("org_id"),
                    "order_id": order_id,
                    "ordered_sku": sku,
                    "ordered_asin": row.get("ordered_asin"),
                    "identity_match": identity_match,
                    "parts_list": row.get("parts_list"),
                    "parts_missing": parts_missing,
                    "observed_state": observed_state,
                    "amazon_condition": row.get("amazon_condition"),
                    "operator_disposition": operator_disposition,
                    "photo_refs": row.get("photo_refs", ""),
                    "operator_id": operator_id
                }

                existing = db.query(Evidence).filter(Evidence.evidence_id == record_id).first()
                if existing:
                    existing.evidence_type = "returns"
                    existing.order_id = order_id
                    existing.sku = sku
                    existing.unit_id = unit_id
                    existing.source_dataset = "cube_official"
                    existing.result = result
                    existing.description = description
                    existing.timestamp = captured_at
                    existing.source = f"ReturnsStation-{operator_id} (Official Returns)"
                    existing.reference_data = ref_data
                else:
                    new_ev = Evidence(
                        evidence_id=record_id,
                        evidence_type="returns",
                        order_id=order_id,
                        sku=sku,
                        unit_id=unit_id,
                        source_dataset="cube_official",
                        result=result,
                        description=description,
                        timestamp=captured_at,
                        source=f"ReturnsStation-{operator_id} (Official Returns)",
                        reference_data=ref_data
                    )
                    db.add(new_ev)

                # Ensure Order record exists
                if order_id and sku:
                    existing_ord = db.query(Order).filter(
                        Order.order_id == order_id,
                        Order.sku == sku
                    ).first()
                    if not existing_ord:
                        db.add(Order(
                            order_id=order_id,
                            sku=sku,
                            quantity=1
                        ))

                ingested += 1
            except Exception as e:
                errors.append(IngestRecordError(
                    record_type="official_returns",
                    identifier=record_id,
                    error=str(e),
                    raw_data=row
                ))

        db.commit()
        return ingested, errors

    @classmethod
    def ingest_all_official_data(
        cls,
        db: Session,
        data_dir: str = "data",
        clear_existing_official_only: bool = False
    ) -> OfficialAdapterResult:
        """
        Orchestrates full official data ingestion from data/ directory:
        1. Ingest upstream/receiving_sample.csv
        2. Ingest upstream/prep_sample.csv
        3. Ingest upstream/pack_sample.csv
        4. Ingest upstream/returns_sample.csv
        5. Ingest fee_report_sample.csv
        Ensures strict relational linking and source metadata preservation.
        """
        result = OfficialAdapterResult()

        if not os.path.exists(data_dir):
            alt_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", data_dir))
            if os.path.exists(alt_path):
                data_dir = alt_path

        if clear_existing_official_only:
            # Delete only previous cube_official records to preserve internal benchmark records
            db.query(Evidence).filter(Evidence.source_dataset == "cube_official").delete()
            db.query(Charge).filter(Charge.source_dataset == "cube_official").delete()
            db.commit()

        # 1. Receiving
        rec_path = os.path.join(data_dir, "upstream", "receiving_sample.csv")
        if os.path.exists(rec_path):
            with open(rec_path, "r", encoding="utf-8") as f:
                cnt, errs = cls.ingest_receiving_csv(db, f.read(), "receiving_sample.csv")
                result.receiving_ingested = cnt
                result.errors.extend(errs)
        else:
            result.warnings.append(f"Receiving sample file not found at {rec_path}")

        # 2. Prep
        prep_path = os.path.join(data_dir, "upstream", "prep_sample.csv")
        if os.path.exists(prep_path):
            with open(prep_path, "r", encoding="utf-8") as f:
                cnt, errs = cls.ingest_prep_csv(db, f.read(), "prep_sample.csv")
                result.prep_ingested = cnt
                result.errors.extend(errs)
        else:
            result.warnings.append(f"Prep sample file not found at {prep_path}")

        # 3. Pack
        pack_path = os.path.join(data_dir, "upstream", "pack_sample.csv")
        if os.path.exists(pack_path):
            with open(pack_path, "r", encoding="utf-8") as f:
                cnt, errs = cls.ingest_pack_csv(db, f.read(), "pack_sample.csv")
                result.pack_ingested = cnt
                result.errors.extend(errs)
        else:
            result.warnings.append(f"Pack sample file not found at {pack_path}")

        # 4. Returns
        ret_path = os.path.join(data_dir, "upstream", "returns_sample.csv")
        if os.path.exists(ret_path):
            with open(ret_path, "r", encoding="utf-8") as f:
                cnt, errs = cls.ingest_returns_csv(db, f.read(), "returns_sample.csv")
                result.returns_ingested = cnt
                result.errors.extend(errs)
        else:
            result.warnings.append(f"Returns sample file not found at {ret_path}")

        # 5. Fee Report
        fee_path = os.path.join(data_dir, "fee_report_sample.csv")
        if os.path.exists(fee_path):
            with open(fee_path, "r", encoding="utf-8") as f:
                cnt, errs = cls.ingest_fee_report_csv(db, f.read(), "fee_report_sample.csv")
                result.charges_ingested = cnt
                result.errors.extend(errs)
        else:
            result.warnings.append(f"Fee report sample file not found at {fee_path}")

        # Check orders and shipments count created for official dataset
        result.orders_created = db.query(Order).count()
        result.shipments_created = db.query(Shipment).count()

        result.success = len(result.errors) == 0
        return result
