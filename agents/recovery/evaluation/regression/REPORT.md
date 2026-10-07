# Internal Regression Suite Evaluation Report

**Suite:** RecoveryOS Internal Development & Regression Suite (30 Cases)  
**Purpose:** Developer testing, edge case verification, and regression prevention  
**Dataset Type:** Synthetic curated test cases covering known logistical and dispute permutations  

> [!IMPORTANT]
> This suite represents **internal regression testing** and is **NOT** the official Cube benchmark.  
> For the functional evaluation on the real Cube dataset, see [`evaluation/official/REPORT.md`](../official/REPORT.md).

---

## Performance Summary

| Metric | Measured Value | Standard | Status |
| :--- | :--- | :--- | :--- |
| **Total Test Cases** | **30** | 30 Permutations | - |
| **Verdict Accuracy** | **96.7%** | Ground Truth Match | PASSED |
| **Claim Correctness** | **100.0%** | Exact Dollar Calculation | PASSED |
| **Evidence Precision** | **96.3%** | Exact Evidence Retrieval | PASSED |
| **Evidence Recall** | **100.0%** | 100% Relevant Logs Found | PASSED |
| **Unsupported Claim Rate** | **0.0%** | 0.0% Hallucination Standard | PASSED |
| **Evidence Traceability** | **100.0%** | All Evidence in Database | PASSED |
| **AI / Deterministic Agreement** | **100.0%** | Consensus Standard | PASSED |

---

## Test Category Coverage

The 30 regression test cases cover:
1. **Cases 1-4 (Supported):** Valid dispute confirmation via dock damage, count discrepancy, and unscannable barcode.
2. **Cases 5-8 (Contradicted):** Compliant packaging and weight verified prior to carrier handoff; valid recovery claim.
3. **Cases 9-12 (Silent - Missing Evidence):** Safe default to SILENT with zero claims when evidence is missing.
4. **Cases 13-16 (Silent - Conflicting Evidence):** Ambiguity resolution when inspection logs contradict each other.
5. **Cases 17-20 (Silent - Temporal Invalidity):** Out-of-order evidence timestamped after charge date rejected.
6. **Cases 21-24 (Entity Resolution Edge Cases):** Partial, missing, and ambiguous shipment/order resolution.
7. **Cases 25-27 (Multi-Item SKU Filtering):** Strict SKU isolation preventing cross-SKU evidence bleeding.
8. **Cases 28-30 (AI Robustness & Safety Fallback):** Anti-hallucination and consensus overrides.

---
