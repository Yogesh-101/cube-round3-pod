import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.entities import Charge, Evidence, Order, Shipment, Assessment, AIAssessment
from app.services.official_adapter import OfficialDataAdapter
from app.services.resolution import EntityResolutionService
from app.services.evidence import EvidenceRetrievalService
from app.services.assessment import AssessmentService
from app.services.health import EvidenceHealthService
from app.services.investigation import InvestigationGraphService
from app.services.feedback import EvidenceFeedbackService
from app.services.official_evaluation import run_official_cube_evaluation
from app.services.agent import RecoveryAgent
from app.services.llm import LLMService

@pytest.fixture
def memory_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_official_adapter_ingestion_and_idempotency(memory_db):
    """
    Verifies that all 5 official Cube files are parsed, normalized,
    and ingested into the existing domain schema without errors.
    Verifies idempotency on repeated ingestion.
    """
    res1 = OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")
    assert res1.success is True
    assert res1.charges_ingested == 61
    assert res1.receiving_ingested == 100
    assert res1.prep_ingested == 62
    assert res1.pack_ingested == 29
    assert res1.returns_ingested == 24
    assert len(res1.errors) == 0

    charges_count = memory_db.query(Charge).filter(Charge.source_dataset == "cube_official").count()
    evidence_count = memory_db.query(Evidence).filter(Evidence.source_dataset == "cube_official").count()
    assert charges_count == 61
    assert evidence_count == 215

    # Run ingestion second time: must update idempotently, not create duplicates
    res2 = OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")
    assert res2.success is True
    charges_count_after = memory_db.query(Charge).filter(Charge.source_dataset == "cube_official").count()
    evidence_count_after = memory_db.query(Evidence).filter(Evidence.source_dataset == "cube_official").count()
    assert charges_count_after == 61
    assert evidence_count_after == 215

def test_official_source_traceability_metadata(memory_db):
    """
    Verifies that source metadata (source_dataset, source_file, source_record_id, unit_id)
    is preserved on all ingested official records.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    charge = memory_db.query(Charge).filter(Charge.charge_id == "FEE-0014-1").first()
    assert charge is not None
    assert charge.source_dataset == "cube_official"
    assert charge.unit_id == "UNIT-0014"
    assert charge.amount == 2.0
    assert charge.currency == "USD"
    assert charge.reason == "inbound_defect_fee"

    prep_ev = memory_db.query(Evidence).filter(Evidence.evidence_id == "PRP-0014").first()
    assert prep_ev is not None
    assert prep_ev.source_dataset == "cube_official"
    assert prep_ev.unit_id == "UNIT-0014"
    assert prep_ev.reference_data["source_dataset"] == "cube_official"
    assert prep_ev.reference_data["source_file"] == "prep_sample.csv"
    assert prep_ev.reference_data["fnsku_label_placement"] == "flat"

def test_unit_level_evidence_isolation_never_attaches_wrong_unit(memory_db):
    """
    Safety rule: If charge has unit_id 'UNIT-0014', evidence belonging to 'UNIT-0018'
    MUST NEVER be attached to it, even if they share the same shipment 'FBA-DUMMY-101'.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    charge_14 = memory_db.query(Charge).filter(Charge.charge_id == "FEE-0014-1").first()
    resolution_14 = EntityResolutionService.resolve_charge(memory_db, charge_14)
    relevant_ev, all_ev = EvidenceRetrievalService.retrieve_evidence_for_charge(memory_db, charge_14, resolution_14)

    # All retrieved evidence MUST belong to UNIT-0014 or have no conflicting unit_id
    for ev in relevant_ev:
        if ev.unit_id:
            assert ev.unit_id == "UNIT-0014", f"Evidence {ev.evidence_id} leaked from wrong unit {ev.unit_id}"

def test_official_fee_assessments_contradicted_supported_and_conflicting(memory_db):
    """
    Tests actual investigations on official charges:
    - FEE-0014-1 (UNIT-0014): Dock check and prep show perfect compliance -> CONTRADICTED -> $2.00 claim
    - FEE-0018-1 (UNIT-0018): Dock logged obvious_defect while prep logged pass -> Conflicting evidence -> SILENT
    - FEE-0064-1 (UNIT-0064): Prep logged fail and dock logged discrepancy -> SUPPORTED -> $0.00 claim
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    # 1. Contradicted case
    asm_14 = AssessmentService.assess_charge(memory_db, "FEE-0014-1")
    assert asm_14.verdict == "CONTRADICTED"
    assert asm_14.claim_amount == 2.0
    assert len(asm_14.evidence_ids) >= 1
    assert "PRP-0014" in asm_14.evidence_ids or "RCV-0014" in asm_14.evidence_ids

    # 2. Conflicting evidence case -> Safety fallback to SILENT
    asm_18 = AssessmentService.assess_charge(memory_db, "FEE-0018-1")
    assert asm_18.verdict == "SILENT"
    assert "Conflicting evidence" in asm_18.reason
    assert asm_18.claim_amount == 0.0

    # 3. Supported case
    asm_64 = AssessmentService.assess_charge(memory_db, "FEE-0064-1")
    assert asm_64.verdict == "SUPPORTED"
    assert asm_64.claim_amount == 0.0
    assert len(asm_64.evidence_ids) >= 1

def test_routine_fulfillment_fee_silent_safe_zero_claim(memory_db):
    """
    Fulfillment fees (fulfilment_fee_weight_tier) with no packing discrepancy evidence
    must safely evaluate to SILENT with 0 claim amount. Never guess or fabricate.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    asm_02 = AssessmentService.assess_charge(memory_db, "FEE-0002-1")
    assert asm_02.verdict == "SILENT"
    assert asm_02.claim_amount == 0.0

def test_investigation_graph_with_official_data(memory_db):
    """
    Verifies that InvestigationGraphService builds complete, relational graphs
    for official Cube charges with verified node lineage:
    Charge -> Order -> Shipment -> SKU -> Operational Evidence -> Assessment -> Decision.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    graph = InvestigationGraphService.get_investigation_graph("FEE-0014-1", memory_db)
    assert graph.charge_id == "FEE-0014-1"
    assert len(graph.nodes) >= 6
    assert len(graph.edges) >= 5

    node_types = {n.type for n in graph.nodes}
    assert "charge" in node_types
    assert "shipment" in node_types
    assert "sku" in node_types
    assert "evidence" in node_types
    assert "assessment" in node_types
    assert "decision" in node_types

    # Verify official source traceability in node data
    chg_node = next(n for n in graph.nodes if n.type == "charge")
    assert chg_node.data["source_dataset"] == "cube_official"
    assert chg_node.data["unit_id"] == "UNIT-0014"

def test_evidence_health_and_gaps_on_official_data(memory_db):
    """
    Verifies evidence health calculation and gap detection on official Cube dataset.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    health = EvidenceHealthService.get_evidence_health(memory_db)
    assert health.total_charges == 61
    assert health.charges_with_evidence_gaps > 0
    assert len(health.evidence_gaps) > 0
    
    # Verify each gap has responsible stage and missing evidence description
    for gap in health.evidence_gaps:
        assert gap.responsible_stage is not None
        assert gap.missing_evidence is not None

def test_closed_loop_feedback_resolves_evidence_gap(memory_db):
    """
    Verifies that closed-loop evidence feedback simulates routing back to
    upstream stage (Receiving/Prep/Pack/Returns), adds verified evidence,
    and automatically re-investigates the charge.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    # Pick a routine charge that is currently SILENT
    target_charge_id = "FEE-0002-1"
    asm_before = AssessmentService.assess_charge(memory_db, target_charge_id)
    assert asm_before.verdict == "SILENT"

    # Simulate upstream Packing station submitting verified dimensional compliance check
    feedback_result = EvidenceFeedbackService.simulate_upstream_evidence_submission(
        db=memory_db,
        charge_id=target_charge_id,
        upstream_stage="packing",
        result="PASS",
        description="Packing station 3D dimensioning scan confirmed tier-1 standard package size."
    )

    assert feedback_result["success"] is True
    assert feedback_result["charge_id"] == target_charge_id
    assert feedback_result["upstream_stage"] == "packing"
    assert feedback_result["new_evidence_id"].startswith("FB-PCK-")
    assert feedback_result["updated_verdict"] == "CONTRADICTED"
    assert feedback_result["updated_claim_amount"] == 4.25

def test_ai_anti_hallucination_validation_on_official_data(memory_db):
    """
    Tests that if AI agent hallucinates an unretrieved evidence ID,
    the safety layer rejects it and falls back to deterministic assessment.
    """
    OfficialDataAdapter.ingest_all_official_data(memory_db, data_dir="data")

    # Mock an AI response that invents a fake evidence ID
    mock_hallucinated = lambda chg, evs: '{"verdict": "CONTRADICTED", "reason": "Hallucinated proof", "claim_amount": 2.0, "evidence_ids": ["EV-FAKE-HALLUCINATED-999"], "evidence_strength": "STRONG", "missing_information": []}'
    LLMService.set_mock_provider(mock_hallucinated)

    try:
        res = RecoveryAgent.investigate_charge("FEE-0014-1", memory_db)
        # Must detect hallucination and reject fake evidence ID
        assert "EV-FAKE-HALLUCINATED-999" not in res.evidence_ids
        assert res.is_fallback is True
    finally:
        LLMService.set_mock_provider(None)

def test_official_evaluation_runner_pipeline():
    """
    Runs the official evaluation pipeline on official data and verifies
    all empirical metrics: 100% ingestion coverage, 100% traceability, 0% unsupported claims.
    """
    eval_results = run_official_cube_evaluation(data_dir="data")
    summary = eval_results["summary"]

    assert eval_results["evaluation_type"] == "official_cube_dataset"
    assert summary["total_official_charges"] == 61
    assert summary["total_official_evidence_records"] == 215
    assert summary["ingestion_coverage_pct"] == 100.0
    assert summary["entity_resolution_success_pct"] == 100.0
    assert summary["evidence_traceability_pct"] == 100.0
    assert summary["unsupported_claim_rate_pct"] == 0.0
    assert summary["total_defensible_recovery_usd"] > 0.0
    assert len(eval_results["case_evaluations"]) == 61
