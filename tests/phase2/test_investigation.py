"""Tests for Phase 2 Intelligent Investigation Layer."""
import pytest

from shared.intelligence.evidence_health import assess_charge_evidence_health
from shared.intelligence.investigation_runner import investigate_charge
from shared.intelligence.schemas import ChargeInvestigation


def test_evidence_health_deterministic():
    # Test inbound defect fee requirement
    evidence_records = [
        {
            "record_id": "PRP-1",
            "stage": "prep",
            "status": "completed",
            "decision": {"verdict": "FAIL", "outcome": "non_compliant"},
            "checks": [
                {"check_key": "polybag_sealed", "verdict": "PASS"},
                {"check_key": "suffocation_warning", "verdict": "FAIL"},
                {"check_key": "fnsku_label_placement", "verdict": "PASS"},
                {"check_key": "original_barcode_covered", "verdict": "PASS"},
                {"check_key": "handling_marks", "verdict": "PASS"}
            ]
        }
    ]
    
    health = assess_charge_evidence_health(
        charge_id="FEE-1",
        charge_type="inbound_defect_fee",
        evidence_records=evidence_records
    )
    
    assert health.status == "SUFFICIENT"
    assert health.coverage_ratio == 1.0
    assert "prep_evidence" in health.available_evidence


def test_investigate_charge_deterministic_fallback():
    # Setup charge that contradicts evidence
    charge = {
        "line_id": "FEE-1",
        "charge_type": "inbound_defect_fee",
        "amount_usd": 1.50
    }
    
    evidence_records = [
        {
            "record_id": "PRP-1",
            "stage": "prep",
            "status": "completed",
            "subject": {"org_id": "ORG-1", "subject_id": "UNIT-1"},
            "decision": {"verdict": "PASS", "outcome": "compliant"},
            "checks": [
                {"check_key": "polybag_sealed", "verdict": "PASS"},
                {"check_key": "suffocation_warning", "verdict": "PASS"},
                {"check_key": "fnsku_label_placement", "verdict": "PASS"},
                {"check_key": "original_barcode_covered", "verdict": "PASS"},
                {"check_key": "handling_marks", "verdict": "PASS"}
            ]
        }
    ]
    
    # Run without LLM available (fallback mode)
    inv = investigate_charge(
        charge=charge,
        subject_id="UNIT-1",
        org_id="ORG-1",
        workflow_id="WF-1",
        all_evidence_records=evidence_records
    )
    
    assert isinstance(inv, ChargeInvestigation)
    assert inv.evidence_health.status == "SUFFICIENT"
    # Prep PASS means compliant. The charge is inbound defect. Thus it contradicts.
    assert inv.deterministic_verdict == "CONTRADICTS"
    assert inv.decision == "CLAIM"
