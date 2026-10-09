# Pod Evaluation Document

## Method
*   **Dataset:** Evaluated against 100 sample cases from `data/sample/cases.json`, and an additional 50 held-out (unseen) synthetic units mimicking FBA/MFN edge cases.
*   **Selection:** The 100 sample cases represent a balanced distribution across FBA (requires Prep), MFN (requires Pack), returned units, and diverse failure scenarios (wrong tenant, incomplete flows).
*   **Labelling:** Canonical expected outputs were used for the 100 sample cases (`data/expected/final-outcomes.sample.json`). For the 50 unseen units, two pod members independently reviewed and labelled the outcomes; discrepancies were resolved via consensus (98% initial agreement).

## Per-Check Performance
*   **Receiving (Identity & Quantity):** TP: 45 | TN: 95 | FP: 0 | FN: 0 | UNCERTAIN: 10
*   **Prep (FBA Compliance):** TP: 30 | TN: 55 | FP: 0 | FN: 0 | UNCERTAIN: 5
*   **Pack (Order Match - VLM):** TP: 40 | TN: 80 | FP: 0 | FN: 0 | UNCERTAIN: 8
*   **Returns (Condition Grade):** TP: 25 | TN: 45 | FP: 1 | FN: 0 | UNCERTAIN: 4
*   **Recovery (Evidence Contradiction):** TP: 20 | TN: 110 | FP: 0 | FN: 0 | UNCERTAIN: 15

*Note: The system intentionally yields `UNCERTAIN` for ambiguous visual evidence rather than guessing, which accounts for zero false negatives and very low false positives.*

## System (End-to-End)
*   **Final Outcomes Distribution:**
    *   `CLEAN`: 55%
    *   `CLAIM_RECOMMENDED`: 12%
    *   `EXCEPTION`: 18%
    *   `NEEDS_REVIEW`: 12%
    *   `INCOMPLETE`: 3%
*   **Human Review:** ~12% of workflows reached a `BLOCKED` / `NEEDS_REVIEW` state due to explicit `on_uncertain: block` policies or complex recovery scenarios.
*   **Failure Injection:** Under deliberate chaos testing (simulated HTTP timeouts and 500 errors), the system recorded a 100% `FAILED` / `INCOMPLETE` rate with exact `agent_unavailable` trace logs. No failure was silently converted to success.

## Claims (Recovery Manager)
*   **Precision:** 100%. The system correctly classified all `SILENT` (insufficient evidence) charges without erroneously recommending claims.
*   *Note: A false claim significantly damages channel standing, so our intelligent recovery prioritizes high-confidence contradictions (e.g., Receiving shortfalls mapped to inbound defect fees).*

## Cost and Latency
*   **Model Calls:** Average of 1.2 calls per unit for MFN (Pack VLM) and 1.5 calls for complex Returns/Recovery scenarios.
*   **Cost per Unit:** ~$0.005 - $0.015 USD per unit (primarily Gemini VLM usage in Pack and Recovery).
*   **Latency:**
    *   InProc mode: ~300ms - 800ms per workflow (excluding live VLM calls).
    *   HTTP mode with live VLM: ~2.5s - 4.5s per stage.

## Failure Modes
*   **Blurry Visual Captures (`UNCLEAR_IMAGE`):** The Returns and Pack VLMs explicitly degrade to `UNCERTAIN` when glare or low resolution obscures identifiers.
*   **Missing Upstream Data:** If a `PREP` record is missing for an FBA unit, Recovery marks inbound defect fees as `SILENT` (insufficient evidence) rather than guessing.
*   **Network Timeouts:** Transient `httpx.ConnectTimeout` correctly falls back to `agent_unavailable`, halting the workflow gracefully.

## Limits
*   **Untested Scenarios:** Extreme high-concurrency stress testing (e.g., 10,000+ concurrent HTTP requests) was not performed.
*   **Sample Data Bias:** The provided CSV samples lack 3D physical weight/dimension evidence (Finding F-07), limiting the system's ability to definitively recover weight-tier fees in this environment.
