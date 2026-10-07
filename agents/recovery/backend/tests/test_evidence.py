from datetime import datetime
from app.models.entities import Charge, Evidence, Shipment, Order
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService

def test_evidence_retrieval_relevance_and_sku_filtering(db_session):
    charge = Charge(
        charge_id="CHG-PKG",
        shipment_id="SH-50",
        order_id="ORD-50",
        sku="SKU-TARGET",
        reason="Packaging Defect",
        amount=50.0
    )
    db_session.add(charge)

    # Relevant evidence for target SKU
    ev_rel = Evidence(
        evidence_id="EV-REL",
        evidence_type="prep",
        shipment_id="SH-50",
        order_id="ORD-50",
        sku="SKU-TARGET",
        result="PASS",
        description="Prep packaging check PASS",
        source="PrepStation-1",
        timestamp=datetime.utcnow()
    )
    # Irrelevant evidence: different SKU on same shipment
    ev_diff_sku = Evidence(
        evidence_id="EV-DIFF-SKU",
        evidence_type="prep",
        shipment_id="SH-50",
        order_id="ORD-50",
        sku="SKU-OTHER",
        result="FAIL",
        description="Prep failed for other SKU",
        source="PrepStation-1",
        timestamp=datetime.utcnow()
    )
    # Irrelevant evidence type for packaging: returns log
    ev_diff_type = Evidence(
        evidence_id="EV-RETURNS",
        evidence_type="returns",
        shipment_id="SH-50",
        order_id="ORD-50",
        sku="SKU-TARGET",
        result="VERIFIED",
        description="Customer return scan",
        source="ReturnsDock",
        timestamp=datetime.utcnow()
    )
    db_session.add_all([ev_rel, ev_diff_sku, ev_diff_type])
    db_session.commit()

    resolution = EntityResolutionService.resolve_charge(db_session, charge)
    relevant, all_linked = EvidenceRetrievalService.retrieve_evidence_for_charge(db_session, charge, resolution)

    assert len(relevant) == 1
    assert relevant[0].evidence_id == "EV-REL"
    assert len(all_linked) == 3

def test_never_fabricate_missing_evidence(db_session):
    charge = Charge(
        charge_id="CHG-NO-EVIDENCE",
        shipment_id="SH-NONEXISTENT",
        reason="Shortage",
        amount=100.0
    )
    db_session.add(charge)
    db_session.commit()

    resolution = EntityResolutionService.resolve_charge(db_session, charge)
    relevant, all_linked = EvidenceRetrievalService.retrieve_evidence_for_charge(db_session, charge, resolution)

    # Must be strictly empty - never fabricated
    assert len(relevant) == 0
    assert len(all_linked) == 0
