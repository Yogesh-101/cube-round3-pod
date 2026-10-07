from datetime import datetime, timedelta
from app.models.entities import Charge, Evidence, Shipment
from app.services.assessment import AssessmentService

def test_assessment_contradicted_case(db_session):
    # Charge: Packaging Defect $38
    # Evidence: Prep packaging = PASS before charge
    charge_date = datetime(2026, 9, 20, 12, 0, 0)
    charge = Charge(
        charge_id="CHG-TEST-CONT",
        shipment_id="SH-CONT",
        order_id="ORD-CONT",
        sku="SKU-CONT",
        reason="Packaging defect charge",
        amount=38.0,
        currency="USD",
        charge_date=charge_date
    )
    ev = Evidence(
        evidence_id="EV-001",
        evidence_type="prep",
        shipment_id="SH-CONT",
        sku="SKU-CONT",
        result="PASS",
        description="Prep packaging = PASS",
        source="WMS-Prep",
        timestamp=charge_date - timedelta(days=1)
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    assessment = AssessmentService.assess_charge(db_session, "CHG-TEST-CONT")
    assert assessment.verdict == "CONTRADICTED"
    assert assessment.claim_amount == 38.0
    assert "EV-001" in assessment.evidence_ids
    assert assessment.evidence_count == 1
    assert "CONTRADICTED" in assessment.reason

def test_assessment_supported_case(db_session):
    # Charge: Packaging Defect $50
    # Evidence: Prep packaging = FAIL
    charge_date = datetime(2026, 9, 20, 12, 0, 0)
    charge = Charge(
        charge_id="CHG-TEST-SUPP",
        shipment_id="SH-SUPP",
        sku="SKU-SUPP",
        reason="Packaging Defect",
        amount=50.0,
        currency="USD",
        charge_date=charge_date
    )
    ev = Evidence(
        evidence_id="EV-002",
        evidence_type="prep",
        shipment_id="SH-SUPP",
        sku="SKU-SUPP",
        result="FAIL",
        description="Prep packaging audit failed: broken seal",
        source="WMS-Prep",
        timestamp=charge_date - timedelta(days=2)
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    assessment = AssessmentService.assess_charge(db_session, "CHG-TEST-SUPP")
    assert assessment.verdict == "SUPPORTED"
    assert assessment.claim_amount == 0.0
    assert "EV-002" in assessment.evidence_ids

def test_assessment_silent_no_evidence(db_session):
    charge = Charge(
        charge_id="CHG-NO-EV",
        shipment_id="SH-NONE",
        reason="Shortage",
        amount=75.0,
        currency="USD",
        charge_date=datetime.utcnow()
    )
    db_session.add(charge)
    db_session.commit()

    assessment = AssessmentService.assess_charge(db_session, "CHG-NO-EV")
    assert assessment.verdict == "SILENT"
    assert assessment.claim_amount == 0.0
    assert assessment.evidence_count == 0

def test_assessment_silent_conflicting_evidence(db_session):
    # One record says PASS, another says FAIL for the same shipment/reason
    charge_date = datetime(2026, 9, 20, 12, 0, 0)
    charge = Charge(
        charge_id="CHG-CONFLICT",
        shipment_id="SH-CONF",
        sku="SKU-CONF",
        reason="Packaging Defect",
        amount=60.0,
        currency="USD",
        charge_date=charge_date
    )
    ev_pass = Evidence(
        evidence_id="EV-PASS",
        evidence_type="prep",
        shipment_id="SH-CONF",
        sku="SKU-CONF",
        result="PASS",
        description="Prep scan PASS",
        source="PrepStation-1",
        timestamp=charge_date - timedelta(days=1)
    )
    ev_fail = Evidence(
        evidence_id="EV-FAIL",
        evidence_type="packing",
        shipment_id="SH-CONF",
        sku="SKU-CONF",
        result="FAIL",
        description="Carton damaged at pack station",
        source="PackStation-1",
        timestamp=charge_date - timedelta(days=1)
    )
    db_session.add_all([charge, ev_pass, ev_fail])
    db_session.commit()

    assessment = AssessmentService.assess_charge(db_session, "CHG-CONFLICT")
    # Must prefer SILENT on conflict rather than guessing
    assert assessment.verdict == "SILENT"
    assert assessment.claim_amount == 0.0
    assert "Conflicting evidence" in assessment.reason

def test_assessment_silent_partial_evidence(db_session):
    # Only dock check-in record with neutral result 'RECEIVED'
    charge = Charge(
        charge_id="CHG-PARTIAL",
        shipment_id="SH-PART",
        sku="SKU-PART",
        reason="Packaging Defect",
        amount=40.0,
        currency="USD",
        charge_date=datetime.utcnow()
    )
    ev = Evidence(
        evidence_id="EV-PARTIAL",
        evidence_type="receiving",
        shipment_id="SH-PART",
        sku="SKU-PART",
        result="RECEIVED",
        description="Trailer dropped at door",
        source="DockDoor-1",
        timestamp=datetime.utcnow() - timedelta(days=1)
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    assessment = AssessmentService.assess_charge(db_session, "CHG-PARTIAL")
    assert assessment.verdict == "SILENT"
    assert assessment.claim_amount == 0.0
