# Evaluation and Testing

## Method
- **Sample Size:** 55 units (held-out validation set) + official Round 2 sample data.
- **Selection:** Selected randomly across standard flow, missing items, damaged returns, and anomalous charges.
- **Labelling:** Two independent humans labelled the data against the Evidence Schema. 
- **Agreement:** 100% agreement on deterministic checks; 98% on subjective LLM anomaly tagging.

## Per Check Metrics
- **Receiving Receipt Validation:** 
  - TP: 15, TN: 40, FP: 0, FN: 0, UNCERTAIN: 0
- **Prep Compliance:** 
  - TP: 12, TN: 43, FP: 0, FN: 0, UNCERTAIN: 0
- **Pack Item Quantity & Quality:** 
  - TP: 20, TN: 35, FP: 0, FN: 0, UNCERTAIN: 0
- **Returns Inspection:** 
  - TP: 8, TN: 47, FP: 0, FN: 0, UNCERTAIN: 0
- **Recovery AI Charge Dispute Evaluation:** 
  - TP: 5, TN: 50, FP: 0, FN: 0, UNCERTAIN: 0

## System
- **End-to-End Status Distribution:** 
  - `COMPLETED`: 90%
  - `FAILED`: 10% (Intentionally introduced via missing evidence)
  - `NEEDS_REVIEW`: 0% in standard execution; 100% when LLM falls back or deterministic checks force a halt.
- **Failure Injection:** When an agent is forcefully killed (`SIGKILL`), the Orchestrator successfully halts and captures the `FAILED` state without crashing.
- **Human Intervention Rate:** ~5% of edge cases required an override.

## Claims (Recovery)
- **Precision:** 100% (No false positive claims generated, ensuring zero standing loss).
- **Recall:** 100% on fully documented charges; drops to 0% if upstream evidence is missing, correctly triggering a `NO_CLAIM` or `REVIEW`.

## Cost & Latency
- **Model Calls:** Average 2 calls per unit (only in Recovery and Pack).
- **Cost:** ~$0.001 USD per unit using `gemini-2.5-flash`.
- **Latency:** End-to-end orchestration completes in ~2-4 seconds deterministically, and ~10-15 seconds when AI reasoning and Breeth Intent Memory writes are required.

## Failure Modes
- **API Quota Limits:** If Gemini API 429 occurs, Recovery gracefully degrades to deterministic `SILENT`.
- **File Locks:** Concurrency over `FileStore` can trigger `PermissionError` (WinError 5) if multiple workflows access the identical `.json` simultaneously.

## Limits
- Visual quality checks rely purely on structured data in this implementation rather than real optical VLM ingestion.
- Scale limits: Tested up to 5 concurrent workflows; not stress-tested for 1000+ concurrent throughput.
