import pytest
from app.services.evaluation import run_evaluation_suite, EVALUATION_CASES

def test_evaluation_suite_dataset_count():
    assert len(EVALUATION_CASES) >= 30

def test_evaluation_suite_execution():
    metrics = run_evaluation_suite()

    print("\n--- PHASE 2 EVALUATION SUITE METRICS ---")
    print(f"Total Cases: {metrics['total_cases']}")
    print(f"Verdict Accuracy: {metrics['verdict_accuracy'] * 100:.2f}%")
    print(f"Claim Correctness: {metrics['claim_correctness'] * 100:.2f}%")
    print(f"Evidence Retrieval Precision: {metrics['evidence_precision'] * 100:.2f}%")
    print(f"Evidence Retrieval Recall: {metrics['evidence_recall'] * 100:.2f}%")
    print(f"Unsupported Claim Rate: {metrics['unsupported_claim_rate'] * 100:.2f}%")
    print(f"Evidence Traceability: {metrics['evidence_traceability'] * 100:.2f}%")
    print(f"AI/Deterministic Agreement: {metrics['ai_deterministic_agreement'] * 100:.2f}%")
    print("----------------------------------------\n")

    assert metrics["total_cases"] >= 30
    assert metrics["verdict_accuracy"] >= 0.90
    assert metrics["claim_correctness"] >= 0.90
    assert metrics["unsupported_claim_rate"] == 0.0  # Zero unsupported claims!
    assert metrics["evidence_traceability"] == 1.0  # 100% evidence traceability!
