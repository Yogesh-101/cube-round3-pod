import pytest
import json
from datetime import datetime, timedelta
from app.models.entities import Charge, Order, Shipment, Evidence, AIAssessment
from app.services.agent import RecoveryAgent
from app.services.llm import LLMService
from app.services.charge_understanding import ChargeUnderstandingService
from app.services.vector_retrieval import VectorRetrievalService
from app.services import tools

T0 = datetime(2026, 1, 15, 12, 0, 0)

# Fixture to ensure mock provider is cleaned up after each test
@pytest.fixture(autouse=True)
def clean_mock_provider():
    LLMService.set_mock_provider(None)
    yield
    LLMService.set_mock_provider(None)

def test_charge_understanding_service():
    cu_pack = ChargeUnderstandingService.understand_charge("Packaging Defect Charge", 50.0)
    assert cu_pack.category == "packaging"
    assert "prep" in cu_pack.relevant_evidence_types
    assert "packing" in cu_pack.relevant_evidence_types

    cu_short = ChargeUnderstandingService.understand_charge("Quantity Shortage Fee", 100.0)
    assert cu_short.category == "shortage"
    assert "packing" in cu_short.relevant_evidence_types

    cu_dmg = ChargeUnderstandingService.understand_charge("Merchandise Damage Surcharge", 80.0)
    assert cu_dmg.category == "damage"
    assert "receiving" in cu_dmg.relevant_evidence_types

def test_semantic_vector_retrieval(db_session):
    ev1 = Evidence(
        evidence_id="EV-TEST-1",
        evidence_type="prep",
        result="PASS",
        description="Polybag 4-mil sealed and intact barcode compliant",
        source="PrepStation-1",
        timestamp=T0 - timedelta(hours=2)
    )
    ev2 = Evidence(
        evidence_id="EV-TEST-2",
        evidence_type="returns",
        result="PASS",
        description="Customer RMA received unboxed",
        source="ReturnsDock",
        timestamp=T0 - timedelta(hours=2)
    )
    db_session.add_all([ev1, ev2])
    db_session.commit()

    count = VectorRetrievalService.index_evidence(db_session)
    assert count >= 2

    # Query for packaging
    ranked = VectorRetrievalService.semantic_search("Packaging defect polybag", [ev1, ev2], top_k=2)
    assert len(ranked) > 0
    # ev1 should be ranked higher due to polybag and prep matching
    assert ranked[0][0].evidence_id == "EV-TEST-1"

def test_investigation_contradicted_case(db_session):
    """Scenario B: Charge + conflicting evidence -> CONTRADICTED -> claim = charge amount"""
    charge = Charge(
        charge_id="CHG-AG-CONTRADICTED",
        reason="Packaging Defect Charge",
        amount=65.0,
        shipment_id="SH-AG-1",
        order_id="ORD-AG-1",
        sku="SKU-AG-1",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-AG-1",
        evidence_type="prep",
        result="PASS",
        description="Packaging verified fully compliant prior to carrier pickup",
        source="PrepStation-1",
        timestamp=T0 - timedelta(hours=3),
        shipment_id="SH-AG-1",
        sku="SKU-AG-1"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.verdict == "CONTRADICTED"
    assert res.claim_amount == 65.0
    assert "EV-AG-1" in res.evidence_ids
    assert res.is_fallback is True or res.agreement_with_deterministic is True

def test_investigation_supported_case(db_session):
    """Scenario A: Charge + supporting evidence -> SUPPORTED -> claim = 0.0"""
    charge = Charge(
        charge_id="CHG-AG-SUPPORTED",
        reason="Packaging Defect Charge",
        amount=75.0,
        shipment_id="SH-AG-2",
        order_id="ORD-AG-2",
        sku="SKU-AG-2",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-AG-2",
        evidence_type="prep",
        result="FAIL",
        description="Polybag torn and tape damaged at prep station",
        source="PrepStation-2",
        timestamp=T0 - timedelta(hours=3),
        shipment_id="SH-AG-2",
        sku="SKU-AG-2"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.verdict == "SUPPORTED"
    assert res.claim_amount == 0.0
    assert "EV-AG-2" in res.evidence_ids

def test_investigation_silent_no_evidence_case(db_session):
    """Scenario C: Charge + insufficient/missing evidence -> SILENT -> claim = 0.0"""
    charge = Charge(
        charge_id="CHG-AG-SILENT",
        reason="Damaged Merchandise Fee",
        amount=110.0,
        shipment_id="SH-AG-3",
        order_id="ORD-AG-3",
        sku="SKU-AG-3",
        charge_date=T0
    )
    db_session.add(charge)
    db_session.commit()

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.verdict == "SILENT"
    assert res.claim_amount == 0.0
    assert len(res.evidence_ids) == 0

def test_hallucination_safety_rejection(db_session):
    """Scenario D: Force an invalid/nonexistent evidence ID in AI response -> system rejects it"""
    charge = Charge(
        charge_id="CHG-AG-HALLUCINATE",
        reason="Packaging Defect Charge",
        amount=50.0,
        shipment_id="SH-AG-4",
        order_id="ORD-AG-4",
        sku="SKU-AG-4",
        charge_date=T0
    )
    ev_real = Evidence(
        evidence_id="EV-REAL-1",
        evidence_type="prep",
        result="PASS",
        description="Valid packaging pass",
        source="Prep-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-AG-4",
        sku="SKU-AG-4"
    )
    db_session.add_all([charge, ev_real])
    db_session.commit()

    # Mock LLM returns fabricated evidence ID "EV-FABRICATED-999"
    def mock_hallucinating_llm(charge_info, ev_list):
        return json.dumps({
            "verdict": "CONTRADICTED",
            "reason": "Contradicted by fabricated camera log",
            "claim_amount": 50.0,
            "evidence_ids": ["EV-FABRICATED-999"],  # Nonexistent!
            "evidence_strength": "STRONG",
            "missing_information": []
        })

    LLMService.set_mock_provider(mock_hallucinating_llm)

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)

    # Hallucinated ID must be rejected!
    assert "EV-FABRICATED-999" not in res.evidence_ids
    assert res.agreement_with_deterministic is False
    assert any("hallucination" in m.lower() for m in res.missing_information)

def test_ai_unavailable_fallback(db_session):
    """Scenario E: LLM unavailable -> fallback to deterministic assessment with clear note"""
    charge = Charge(
        charge_id="CHG-AG-FALLBACK",
        reason="Packaging Defect Charge",
        amount=45.0,
        shipment_id="SH-AG-5",
        order_id="ORD-AG-5",
        sku="SKU-AG-5",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-AG-5",
        evidence_type="prep",
        result="PASS",
        description="Compliant packaging pass",
        source="Prep-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-AG-5",
        sku="SKU-AG-5"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    # Provider returns None (simulating unavailable / API error)
    LLMService.set_mock_provider(lambda c, e: None)

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.is_fallback is True
    assert res.verdict == "CONTRADICTED"
    assert "unavailable" in res.reason.lower()
    assert res.claim_amount == 45.0

def test_malformed_ai_json_output_handling(db_session):
    charge = Charge(
        charge_id="CHG-AG-MALFORMED",
        reason="Packaging Defect Charge",
        amount=50.0,
        shipment_id="SH-AG-6",
        charge_date=T0
    )
    db_session.add(charge)
    db_session.commit()

    # Mock returns bad JSON
    LLMService.set_mock_provider(lambda c, e: "Not a valid JSON response {{")

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.is_fallback is True
    assert res.verdict == "SILENT"

def test_ai_deterministic_conflict_preference(db_session):
    """When AI claims CONTRADICTED without evidence but deterministic is SILENT -> SILENT preferred"""
    charge = Charge(
        charge_id="CHG-AG-CONFLICT",
        reason="Packaging Defect Charge",
        amount=50.0,
        shipment_id="SH-AG-7",
        charge_date=T0
    )
    db_session.add(charge)
    db_session.commit()

    # Mock LLM tries to grant claim with empty evidence
    def mock_conflicting_llm(charge_info, ev_list):
        return json.dumps({
            "verdict": "CONTRADICTED",
            "reason": "I think it is contradicted anyway",
            "claim_amount": 50.0,
            "evidence_ids": [],
            "evidence_strength": "WEAK",
            "missing_information": []
        })

    LLMService.set_mock_provider(mock_conflicting_llm)

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    # Must enforce conservative safety verdict: SILENT!
    assert res.verdict == "SILENT"
    assert res.claim_amount == 0.0
    assert res.agreement_with_deterministic is False

def test_ai_api_endpoints(client, db_session):
    # Setup test charge
    charge = Charge(
        charge_id="CHG-API-TEST",
        reason="Packaging Defect Charge",
        amount=88.0,
        shipment_id="SH-API-1",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-API-1",
        evidence_type="prep",
        result="PASS",
        description="Inspection passed",
        source="Prep-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-API-1"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    # 1. GET /api/ai/status
    res_status = client.get("/api/ai/status")
    assert res_status.status_code == 200
    st_data = res_status.json()
    assert st_data["phase"] == 2
    assert "vector_index_status" in st_data

    # 2. POST /api/ai/charges/{id}/investigate
    res_inv = client.post("/api/ai/charges/CHG-API-TEST/investigate")
    assert res_inv.status_code == 200
    inv_data = res_inv.json()
    assert inv_data["charge_id"] == "CHG-API-TEST"
    assert inv_data["verdict"] == "CONTRADICTED"
    assert inv_data["claim_amount"] == 88.0
    assert "evidence_details" in inv_data

    # 3. GET /api/ai/charges/{id}
    res_get = client.get("/api/ai/charges/CHG-API-TEST")
    assert res_get.status_code == 200
    assert res_get.json()["verdict"] == "CONTRADICTED"

    # 4. GET non-existent charge -> 404
    res_404 = client.get("/api/ai/charges/NONEXISTENT-CHARGE")
    assert res_404.status_code == 404
