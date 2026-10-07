from typing import List, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.entities import Evidence, Charge
from app.schemas.entities import EntityResolutionInfo

class EvidenceRetrievalService:
    @staticmethod
    def get_relevant_evidence_types(reason: str) -> List[str]:
        """
        Determines evidence types relevant to the charge reason.
        Allowed types: 'receiving', 'prep', 'packing', 'returns'
        """
        r = reason.lower()
        types: List[str] = []

        # Packaging / Prep / Barcode / Labeling
        if any(kw in r for kw in ["packag", "prep", "box", "bubble", "bag", "label", "barcode", "upc", "asin"]):
            types.extend(["prep", "packing"])
        
        # Shortage / Quantity / Count / Missing item / Lost Inbound
        if any(kw in r for kw in ["shortage", "missing", "quantity", "count", "unit", "unreceived", "overage", "lost_inbound", "lost"]):
            types.extend(["receiving", "prep", "packing"])

        # Damage / Defect / Inbound Defect Fee / Damaged In Warehouse
        if any(kw in r for kw in ["damage", "defect", "broken", "crush", "leak", "inbound_defect_fee", "inbound_defect", "damaged_in_warehouse"]):
            types.extend(["prep", "receiving", "packing"])

        # Returns / Refund / Not Returned
        if any(kw in r for kw in ["return", "rma", "refund_issued_item_not_returned", "not_returned", "refund"]):
            types.extend(["returns"])

        # Fulfillment Fee Weight Tier (only packing station dimensional/weight verification applies)
        if any(kw in r for kw in ["fulfilment_fee_weight_tier", "weight_tier"]):
            types.extend(["packing"])

        # If none matched specifically, consider all operational evidence types
        if not types:
            types = ["receiving", "prep", "packing", "returns"]

        # Deduplicate preserving order
        seen = set()
        deduped = []
        for t in types:
            if t not in seen:
                seen.add(t)
                deduped.append(t)
        return deduped

    @staticmethod
    def retrieve_evidence_for_charge(
        db: Session,
        charge: Charge,
        resolution: EntityResolutionInfo
    ) -> Tuple[List[Evidence], List[Evidence]]:
        """
        Retrieves evidence linked to the charge using deterministic entity resolution.
        Returns:
            (relevant_evidence, all_linked_evidence)
            - relevant_evidence: evidence matching the charge reason's domain and SKU
            - all_linked_evidence: all operational evidence matching the shipment/order/unit
        
        Never invents or fabricates evidence.
        Never attaches evidence belonging to a different unit or SKU.
        """
        unit_id = getattr(charge, "unit_id", None) or getattr(resolution, "unit_id", None)
        shipment_id = resolution.shipment_id
        order_id = resolution.order_id
        sku = resolution.sku

        if not shipment_id and not order_id and not unit_id:
            return [], []

        # Build query for linked records
        clauses = []
        if unit_id:
            clauses.append(Evidence.unit_id == unit_id)
        if shipment_id:
            clauses.append(Evidence.shipment_id == shipment_id)
        if order_id:
            clauses.append(Evidence.order_id == order_id)

        query = db.query(Evidence).filter(or_(*clauses))
        records = query.order_by(Evidence.timestamp.asc()).all()

        # Deduplicate records by evidence_id
        seen_ids: Set[str] = set()
        deduped_records: List[Evidence] = []
        for rec in records:
            if rec.evidence_id not in seen_ids:
                seen_ids.add(rec.evidence_id)
                # If charge has a specific unit_id, do not link evidence belonging to a different unit_id
                if unit_id and rec.unit_id and rec.unit_id != unit_id:
                    continue
                deduped_records.append(rec)

        relevant_types = EvidenceRetrievalService.get_relevant_evidence_types(charge.reason)

        relevant_evidence: List[Evidence] = []
        for rec in deduped_records:
            # Type relevance check
            if rec.evidence_type.lower() not in relevant_types:
                continue

            # Unit check: if charge has unit_id and evidence has unit_id, they must match
            if unit_id and rec.unit_id and rec.unit_id != unit_id:
                continue

            # SKU check: if evidence specifies a SKU, and charge has a SKU, they must match
            if sku and rec.sku and rec.sku != sku:
                # Evidence is for a different SKU in the same shipment/order -> irrelevant
                continue

            relevant_evidence.append(rec)

        return relevant_evidence, deduped_records
