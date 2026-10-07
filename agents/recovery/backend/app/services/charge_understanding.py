import re
from typing import Dict, Any, List, Optional
from app.models.entities import Charge
from app.schemas.ai import ChargeUnderstanding

CATEGORY_RULES = [
    {
        "category": "packaging",
        "keywords": ["packag", "box", "bubble", "bag", "polybag", "tape", "carton", "wrapping", "shrink", "cushion"],
        "evidence_types": ["prep", "packing", "receiving"],
        "requirements": ["Verify outbound prep packaging inspection", "Inspect packing station box verification"]
    },
    {
        "category": "labeling",
        "keywords": ["label", "barcode", "upc", "fnsku", "asin", "scannable", "unscannable", "sticker"],
        "evidence_types": ["prep", "packing"],
        "requirements": ["Inspect prep station barcode scan verification", "Check packing station label compliance"]
    },
    {
        "category": "shortage",
        "keywords": ["shortage", "missing", "quantity", "count", "unit", "unreceived", "overage", "incomplete", "lost_inbound", "lost"],
        "evidence_types": ["receiving", "prep", "packing"],
        "requirements": ["Verify packing scale weight / camera count", "Check receiving dock check-in verification"]
    },
    {
        "category": "damage",
        "keywords": ["damage", "defect", "broken", "crush", "leak", "dented", "liquid", "torn", "inbound_defect_fee", "inbound_defect", "damaged_in_warehouse"],
        "evidence_types": ["prep", "receiving", "packing", "returns"],
        "requirements": ["Verify intact condition prior to carrier handoff", "Check dock scanner physical damage logs", "Verify prep quality standards"]
    },
    {
        "category": "returns",
        "keywords": ["return", "rma", "customer return", "reversal", "refund_issued_item_not_returned", "not_returned", "refund"],
        "evidence_types": ["returns", "receiving"],
        "requirements": ["Check customer RMA inspection logs", "Cross-reference returned condition against outbound log"]
    },
    {
        "category": "fulfillment",
        "keywords": ["fulfilment_fee_weight_tier", "fulfilment", "fulfillment", "weight_tier"],
        "evidence_types": ["packing", "prep", "receiving"],
        "requirements": ["Verify outbound pack dimensions and weight tier verification", "Audit catalog SKU specifications"]
    }
]

class ChargeUnderstandingService:
    @staticmethod
    def understand_charge(
        reason: str,
        amount: float = 0.0,
        shipment_id: Optional[str] = None,
        order_id: Optional[str] = None,
        sku: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ChargeUnderstanding:
        """
        Analyzes and normalizes the charge reason into a structured domain classification,
        prioritizing relevant evidence types and establishing explicit investigation requirements.
        Never invents or fabricates relationships or identifiers.
        """
        r_lower = reason.lower().strip() if reason else ""
        
        matched_category = "general_dispute"
        matched_types = ["receiving", "prep", "packing", "returns"]
        matched_requirements = ["Audit all linked fulfillment records for discrepancy confirmation"]

        for rule in CATEGORY_RULES:
            if any(re.search(rf"\b{re.escape(kw)}", r_lower) or kw in r_lower for kw in rule["keywords"]):
                matched_category = rule["category"]
                matched_types = rule["evidence_types"]
                matched_requirements = rule["requirements"]
                break

        entities = {
            "shipment_id": shipment_id,
            "order_id": order_id,
            "sku": sku
        }

        return ChargeUnderstanding(
            category=matched_category,
            relevant_evidence_types=matched_types,
            relevant_entities=entities,
            investigation_requirements=matched_requirements
        )

    @classmethod
    def understand(cls, charge: Charge) -> ChargeUnderstanding:
        return cls.understand_charge(
            reason=charge.reason,
            amount=charge.amount,
            shipment_id=charge.shipment_id,
            order_id=charge.order_id,
            sku=charge.sku,
            metadata={"currency": charge.currency, "charge_date": str(charge.charge_date)}
        )
