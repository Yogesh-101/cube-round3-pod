import pytest
import json
from datetime import datetime, timedelta
from app.models.entities import Charge, Evidence, User
from app.services.agent import RecoveryAgent
from app.services.llm import LLMService

T0 = datetime(2026, 1, 15, 12, 0, 0)

@pytest.fixture(autouse=True)
def clean_mock():
    LLMService.set_mock_provider(None)
    yield
    LLMService.set_mock_provider(None)

def test_acceptance_scenario_a_supported(db_session):
    """Scenario A: SUPPORTED. Charge + supporting defect evidence -> AI = SUPPORTED, claim = 0.0"""
    charge = Charge(
        charge_id="CHG-ACC-A",
        reason="Packaging Defect Charge",
        amount=60.0,
        shipment_id="SH-ACC-A",
        sku="SKU-ACC-A",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-ACC-A",
        evidence_type="prep",
        result="FAIL",
        description="Cracked casing and polybag seal failure",
        source="PrepStation-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-ACC-A",
        sku="SKU-ACC-A"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.verdict == "SUPPORTED"
    assert res.claim_amount == 0.0
    assert "EV-ACC-A" in res.evidence_ids

def test_acceptance_scenario_b_contradicted(db_session):
    """Scenario B: CONTRADICTED. Charge + conflicting evidence -> AI = CONTRADICTED, claim = actual amount"""
    charge = Charge(
        charge_id="CHG-ACC-B",
        reason="Packaging Defect Charge",
        amount=95.0,
        shipment_id="SH-ACC-B",
        sku="SKU-ACC-B",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-ACC-B",
        evidence_type="prep",
        result="PASS",
        description="Passed 100% inspection packaging intact",
        source="PrepStation-2",
        timestamp=T0 - timedelta(hours=3),
        shipment_id="SH-ACC-B",
        sku="SKU-ACC-B"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.verdict == "CONTRADICTED"
    assert res.claim_amount == 95.0
    assert "EV-ACC-B" in res.evidence_ids

def test_acceptance_scenario_c_silent(db_session):
    """Scenario C: SILENT. Charge + insufficient evidence -> AI = SILENT, claim = 0.0, explanation states insufficient"""
    charge = Charge(
        charge_id="CHG-ACC-C",
        reason="Damage Surcharge",
        amount=50.0,
        shipment_id="SH-ACC-C",
        charge_date=T0
    )
    db_session.add(charge)
    db_session.commit()

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.verdict == "SILENT"
    assert res.claim_amount == 0.0
    assert "insufficient" in res.reason.lower() or "no relevant evidence" in res.reason.lower()

def test_acceptance_scenario_d_hallucination_safety(db_session):
    """Scenario D: HALLUCINATION SAFETY. Force invalid/nonexistent evidence ID -> system rejects it"""
    charge = Charge(
        charge_id="CHG-ACC-D",
        reason="Packaging Defect Charge",
        amount=70.0,
        shipment_id="SH-ACC-D",
        sku="SKU-ACC-D",
        charge_date=T0
    )
    ev_real = Evidence(
        evidence_id="EV-ACC-D-REAL",
        evidence_type="prep",
        result="PASS",
        description="Real prep pass",
        source="Prep-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-ACC-D",
        sku="SKU-ACC-D"
    )
    db_session.add_all([charge, ev_real])
    db_session.commit()

    # Injected hallucinating LLM
    LLMService.set_mock_provider(lambda c, e: json.dumps({
        "verdict": "CONTRADICTED",
        "reason": "Made-up evidence claim",
        "claim_amount": 70.0,
        "evidence_ids": ["EV-HALLUCINATED-777", "EV-NONEXISTENT-888"],
        "evidence_strength": "STRONG",
        "missing_information": []
    }))

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    # The hallucinated IDs must NEVER reach the UI or result evidence_ids!
    assert "EV-HALLUCINATED-777" not in res.evidence_ids
    assert "EV-NONEXISTENT-888" not in res.evidence_ids
    assert any("hallucination" in m.lower() for m in res.missing_information)

def test_acceptance_scenario_e_ai_failure_fallback(db_session):
    """Scenario E: AI FAILURE. Disable/misconfigure LLM -> deterministic assessment used with fallback note"""
    charge = Charge(
        charge_id="CHG-ACC-E",
        reason="Packaging Defect Charge",
        amount=40.0,
        shipment_id="SH-ACC-E",
        sku="SKU-ACC-E",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-ACC-E",
        evidence_type="prep",
        result="PASS",
        description="Packaging verified intact",
        source="Prep-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-ACC-E",
        sku="SKU-ACC-E"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    # Simulate LLM failure (returns None)
    LLMService.set_mock_provider(lambda c, e: None)

    res = RecoveryAgent.investigate_charge(charge.charge_id, db_session)
    assert res.is_fallback is True
    assert res.verdict == "CONTRADICTED"
    assert "unavailable" in res.reason.lower()
    assert res.claim_amount == 40.0

def test_acceptance_scenario_f_authenticated_flow(client, db_session):
    """Scenario F: AUTHENTICATED FLOW. Register -> Login -> Dashboard -> Charge -> AI Investigation -> Logout"""
    # 1. Register
    reg_res = client.post("/api/auth/register", json={
        "name": "Phase2 Auditor",
        "email": "p2auditor@recoveryos.io",
        "password": "Password123!",
        "confirm_password": "Password123!"
    })
    assert reg_res.status_code == 201

    # 2. Login
    login_res = client.post("/api/auth/login", json={
        "email": "p2auditor@recoveryos.io",
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Dashboard
    dash_res = client.get("/api/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200

    # 4. Create charge for investigation
    charge = Charge(
        charge_id="CHG-ACC-F",
        reason="Packaging Defect Charge",
        amount=85.0,
        shipment_id="SH-ACC-F",
        charge_date=T0
    )
    ev = Evidence(
        evidence_id="EV-ACC-F",
        evidence_type="prep",
        result="PASS",
        description="Pass",
        source="Prep-1",
        timestamp=T0 - timedelta(hours=2),
        shipment_id="SH-ACC-F"
    )
    db_session.add_all([charge, ev])
    db_session.commit()

    # 5. AI Investigation
    inv_res = client.post("/api/ai/charges/CHG-ACC-F/investigate", headers=headers)
    assert inv_res.status_code == 200
    assert inv_res.json()["verdict"] == "CONTRADICTED"
    assert inv_res.json()["claim_amount"] == 85.0

    # 6. Logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200

    # 7. Confirm token invalidated
    me_after = client.get("/api/auth/me", headers=headers)
    assert me_after.status_code == 401
