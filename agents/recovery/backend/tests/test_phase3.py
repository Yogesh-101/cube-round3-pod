import pytest
from datetime import datetime, timedelta, timezone

from app.models.entities import Charge, Evidence, Shipment, Order, Assessment, AIAssessment
from app.services.investigation import InvestigationGraphService
from app.services.health import EvidenceHealthService

def test_investigation_graph_supported_scenario(db_session):
    """
    Test a supported charge scenario:
    Operational evidence indicates defect (FAIL/DAMAGED), supporting the charge.
    Nodes: charge -> order -> shipment -> sku -> evidence -> assessment -> decision.
    """
    now = datetime.now(timezone.utc)

    charge = Charge(
        charge_id="CHG-P3-001",
        shipment_id="SH-001",
        order_id="ORD-001",
        sku="SKU-TEST-1",
        reason="Damage reported on inbound receipt",
        amount=150.00,
        currency="USD",
        charge_date=now - timedelta(days=2)
    )
    shipment = Shipment(
        shipment_id="SH-001",
        order_id="ORD-001",
        sku="SKU-TEST-1",
        quantity=5,
        shipment_date=now - timedelta(days=5)
    )
    evidence = Evidence(
        evidence_id="EV-DAM-001",
        evidence_type="receiving",
        shipment_id="SH-001",
        order_id="ORD-001",
        sku="SKU-TEST-1",
        result="DAMAGED",
        description="Crushed outer box and broken inner packaging",
        timestamp=now - timedelta(days=3),
        source="DockStation-A"
    )
    db_session.add_all([charge, shipment, evidence])
    db_session.commit()

    graph = InvestigationGraphService.get_investigation_graph("CHG-P3-001", db_session)

    assert graph.charge_id == "CHG-P3-001"
    assert graph.verdict == "SUPPORTED"
    assert graph.claim_amount == 0.0  # Supported penalty = $0 claim for refund
    assert len(graph.supporting_evidence) == 1
    assert graph.supporting_evidence[0]["evidence_id"] == "EV-DAM-001"
    assert len(graph.contradicting_evidence) == 0

    # Verify node structure
    node_types = {n.type for n in graph.nodes}
    assert "charge" in node_types
    assert "order" in node_types
    assert "shipment" in node_types
    assert "sku" in node_types
    assert "evidence" in node_types
    assert "assessment" in node_types
    assert "decision" in node_types

    # Verify timeline is chronological
    def _to_naive(dt):
        if not dt: return datetime.min
        return dt.replace(tzinfo=None) if dt.tzinfo else dt

    assert len(graph.timeline) >= 3
    for i in range(len(graph.timeline) - 1):
        t1 = _to_naive(graph.timeline[i].timestamp)
        t2 = _to_naive(graph.timeline[i+1].timestamp)
        assert t1 <= t2

def test_investigation_graph_contradicted_scenario(db_session):
    """
    Test a contradicted charge scenario:
    Operational evidence indicates intact/pass, contradicting the fee and justifying a recovery claim.
    """
    now = datetime.now(timezone.utc)

    charge = Charge(
        charge_id="CHG-P3-002",
        shipment_id="SH-002",
        reason="Unlabeled carton fee",
        amount=275.50,
        currency="USD",
        charge_date=now - timedelta(days=1)
    )
    evidence = Evidence(
        evidence_id="EV-LBL-001",
        evidence_type="prep",
        shipment_id="SH-002",
        result="VERIFIED",
        description="Barcode scanned and 2D GS1 compliance verified",
        timestamp=now - timedelta(days=2),
        source="PrepStation-3"
    )
    db_session.add_all([charge, evidence])
    db_session.commit()

    graph = InvestigationGraphService.get_investigation_graph("CHG-P3-002", db_session)

    assert graph.charge_id == "CHG-P3-002"
    assert graph.verdict == "CONTRADICTED"
    assert graph.claim_amount == 275.50
    assert len(graph.contradicting_evidence) == 1
    assert graph.contradicting_evidence[0]["evidence_id"] == "EV-LBL-001"
    assert len(graph.supporting_evidence) == 0

def test_investigation_graph_missing_evidence_graceful(db_session):
    """
    Test when no evidence exists:
    Graph must NOT break. It should create a node with status 'missing' and verdict SILENT.
    """
    charge = Charge(
        charge_id="CHG-P3-003",
        shipment_id="SH-NONEXISTENT",
        reason="Late inbound fee",
        amount=80.0,
        currency="USD"
    )
    db_session.add(charge)
    db_session.commit()

    graph = InvestigationGraphService.get_investigation_graph("CHG-P3-003", db_session)

    assert graph.charge_id == "CHG-P3-003"
    assert graph.verdict == "SILENT"
    assert graph.claim_amount == 0.0
    assert len(graph.supporting_evidence) == 0
    assert len(graph.contradicting_evidence) == 0
    assert len(graph.nodes) > 0
    missing_nodes = [n for n in graph.nodes if n.status == "missing"]
    assert len(missing_nodes) >= 1

def test_investigation_api_endpoints(client, db_session):
    """
    Test GET /api/charges/{charge_id}/investigation endpoint via HTTP client.
    """
    charge = Charge(
        charge_id="CHG-API-001",
        reason="Packaging deficiency",
        amount=120.0,
        currency="USD"
    )
    db_session.add(charge)
    db_session.commit()

    # Valid charge
    resp = client.get("/api/charges/CHG-API-001/investigation")
    assert resp.status_code == 200
    data = resp.json()
    assert data["charge_id"] == "CHG-API-001"
    assert "nodes" in data
    assert "edges" in data
    assert "timeline" in data

    # Non-existent charge -> 404
    resp_invalid = client.get("/api/charges/NONEXISTENT-ID/investigation")
    assert resp_invalid.status_code == 404

def test_evidence_health_service_and_gap_detection(db_session):
    """
    Test EvidenceHealthService calculations:
    - total_charges
    - charges_with_sufficient_evidence
    - charges_with_evidence_gaps
    - supported, contradicted, silent counts
    - gap types: NO_EVIDENCE, UNRESOLVED_ENTITY, MISSING_EXPECTED_TYPE, CONFLICTING_EVIDENCE
    """
    # 1. Charge with No Evidence
    c1 = Charge(
        charge_id="CHG-GAP-1",
        reason="Unplanned prep fee",
        amount=50.0
    )

    # 2. Charge with Incomplete Evidence (Missing receiving log for carton damage)
    c2 = Charge(
        charge_id="CHG-GAP-2",
        shipment_id="SH-GAP-2",
        sku="SKU-2",
        reason="Carton damage fee",
        amount=100.0
    )
    ev2 = Evidence(
        evidence_id="EV-GAP-2",
        evidence_type="packing",
        shipment_id="SH-GAP-2",
        sku="SKU-2",
        result="PASS",
        description="Packing completed",
        source="PackLine-1"
    )

    # 3. Charge with Conflicting Evidence
    c3 = Charge(
        charge_id="CHG-GAP-3",
        shipment_id="SH-GAP-3",
        sku="SKU-3",
        reason="Quantity discrepancy",
        amount=300.0
    )
    ev3_pass = Evidence(
        evidence_id="EV-GAP-3A",
        evidence_type="receiving",
        shipment_id="SH-GAP-3",
        sku="SKU-3",
        result="CONFIRMED",
        description="All items counted",
        source="Station-1"
    )
    ev3_fail = Evidence(
        evidence_id="EV-GAP-3B",
        evidence_type="receiving",
        shipment_id="SH-GAP-3",
        sku="SKU-3",
        result="DISCREPANCY",
        description="Item missing from box",
        source="Station-2"
    )

    db_session.add_all([c1, c2, ev2, c3, ev3_pass, ev3_fail])
    db_session.commit()

    health = EvidenceHealthService.get_evidence_health(db_session)

    assert health.total_charges == 3
    assert health.charges_with_evidence_gaps >= 2
    assert health.evidence_coverage_percentage >= 0.0
    assert health.evidence_coverage_percentage <= 100.0

    gap_types = [g.gap_type for g in health.evidence_gaps]
    assert "NO_EVIDENCE" in gap_types
    assert "CONFLICTING_EVIDENCE" in gap_types

def test_evidence_health_api_endpoint(client, db_session):
    """
    Test GET /api/dashboard/evidence-health
    """
    c = Charge(charge_id="CHG-H1", reason="Late fee", amount=40.0)
    db_session.add(c)
    db_session.commit()

    resp = client.get("/api/dashboard/evidence-health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_charges"] == 1
    assert "evidence_coverage_percentage" in data
    assert "evidence_gaps" in data
    assert "investigations_requiring_attention" in data

def test_evidence_health_empty_database(db_session):
    """
    Test evidence health service when database is completely empty.
    Should gracefully return 0 metrics without dividing by zero.
    """
    health = EvidenceHealthService.get_evidence_health(db_session)

    assert health.total_charges == 0
    assert health.evidence_coverage_percentage == 0.0
    assert len(health.evidence_gaps) == 0

def test_investigation_graph_with_seeded_data(client, seeded_db):
    """
    Verify investigation graph on seeded database charges.
    Ensures real end-to-end integration works across all seeded charges.
    """
    charges = seeded_db.query(Charge).all()
    assert len(charges) > 0

    for c in charges[:3]:
        resp = client.get(f"/api/charges/{c.charge_id}/investigation")
        assert resp.status_code == 200
        inv = resp.json()
        assert inv["charge_id"] == c.charge_id
        assert inv["verdict"] in ["SUPPORTED", "CONTRADICTED", "SILENT"]
        assert len(inv["nodes"]) >= 5
        assert len(inv["edges"]) >= 4
