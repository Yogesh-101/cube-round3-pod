# Architecture

This document describes the **starter**. At the bottom is a section for **your Pod's architecture**, which you must fill in and which is part of the submission. A submission whose `ARCHITECTURE.md` still only describes the starter has not documented its system.

## 1. The system

```text
                POD
                 │
       ┌─────────▼─────────┐      owns workflow state; derives status and final outcome from the evidence chain
       │    Orchestrator   │      routes · validates · records evidence · retries · handles failures and UNCERTAIN
       └─────────┬─────────┘
                 │  Agent Input ▼          ▲ Agent Output (evidence)
       ┌─────────▼─────────┐
       │     Receiving     │
       └─────────┬─────────┘
                 ↓
       ┌───────────────────┐
       │       Prep        │   (FBA units)
       └─────────┬─────────┘
                 ↓
       ┌───────────────────┐
       │       Pack        │   (merchant-fulfilled / 3PL units)
       └─────────┬─────────┘
                 ↓
       ┌───────────────────┐
       │      Returns      │   (if a return happened)
       └─────────┬─────────┘
                 ↓
       ┌───────────────────┐
       │     Recovery      │   reads ALL accumulated evidence
       └─────────┬─────────┘
                 ↓
          Final Outcome        derived by the orchestrator, not copied from any agent

  shared/schemas · shared/contracts · shared/utils      data/input · data/sample · data/expected      examples/
```

The arrows show the *expected commerce journey*. Physically, every hand-off goes through the orchestrator ([`INTEGRATION-GUIDE.md`](INTEGRATION-GUIDE.md) section 1).

## 2. Responsibilities

| Component | Responsible for | Not responsible for |
|---|---|---|
| **Agent** (`agents/<stage>/`) | One stage's judgment, returned as an Agent Output with an Evidence Record. Failing open. Refusing other tenants. | Calling other agents. Setting workflow state. Rewriting earlier evidence. |
| **Orchestrator** (`orchestration/`) | Starting workflows; identifying the current stage; invoking agents with context; validating and recording evidence; updating state; routing; retries; failures; UNCERTAIN; the final outcome. | Making stage judgments. Fabricating or deleting evidence. Turning UNCERTAIN into PASS/FAIL without an explicit rule. |
| **Contract** (`shared/schemas/`) | One strict set of data shapes. | Agent-specific logic (that goes in `payload`). |
| **Stubs** (`agents/*/app.py` as shipped) | Replaying Round 2 CSV rows as valid evidence, so the plumbing can be tested. | Pretending to be agents. |

## 3. Shared data

| Object | Owner | Lives in |
|---|---|---|
| Evidence Record | the agent that produced it (immutable) | the evidence store |
| Workflow State | **the orchestrator** | the workflow store |
| Overrides | the orchestrator records them; a person makes them | Workflow State (`overrides[]`), referencing evidence |
| Final Outcome | **the orchestrator**, derived | Workflow State (`final_outcome`) |
| Captures | the Pod | `data/input/<subject>/<stage>/`, referenced by `sha256` |

## 4. Evidence flow and workflow state

```text
Agent Result → Evidence Record → Orchestrator state transition → Next stage → New evidence → Updated workflow state → Final Outcome
```

- Each stage's evidence is stored and passed to **every later stage** as `previous_evidence`.
- State is `PENDING → IN_PROGRESS → COMPLETED`, or `FAILED` / `BLOCKED` / `RECOVERY_REQUIRED` ([`ORCHESTRATION-GUIDE.md`](ORCHESTRATION-GUIDE.md) section 5), always derived from the evidence and overrides.
- `transitions[]` is the audit trail.
- A reviewer can walk from the Final Outcome to `contributing_records`, to checks, to `evidence_refs`, to the `sha256` of the exact bytes examined.

## 5. Error handling

Every failure is **recorded and never becomes success**: a degraded evidence record stands in (no checks, UNCERTAIN, the error), the stage is `error`, the workflow `FAILED` with outcome `INCOMPLETE`. Transient failures retry; refusals and invalid output do not; UNCERTAIN is preserved; `resume` retries. Full table: [`ORCHESTRATION-GUIDE.md`](ORCHESTRATION-GUIDE.md) section 8. Tenancy: `org_id` on every request, record and workflow; a record about another org is rejected as a security event; **your storage must enforce it too**.

## 6. Final outcome

`CLEAN`, `CLAIM_RECOMMENDED`, `EXCEPTION`, `NEEDS_REVIEW` or `INCOMPLETE`, with the reason, the contributing evidence, `needs_human`, and `provisional` (true unless the workflow is `COMPLETED`). Default rules: [`ORCHESTRATION-GUIDE.md`](ORCHESTRATION-GUIDE.md) section 6.

## 7. What is fixed and what is yours

**Fixed (the contract, strict):**

- The five required agents and their stages (Specialist Pods: four agents plus integration work, see [`FAQ.md`](FAQ.md))
- Common evidence requirements: the Agent Input/Output and Evidence Record shapes; PASS / FAIL / UNCERTAIN; the status vocabularies
- Required traceability: workflow id, agent id, hashes, `upstream_refs`, overrides that reference what they supersede
- An orchestrator that owns workflow state and produces a **Final Outcome**
- Minimum testing, and the submission and evaluation requirements ([`SUBMISSION-GUIDE.md`](SUBMISSION-GUIDE.md), [`ROUND3-RUBRIC.md`](ROUND3-RUBRIC.md))

**Participant-designed (the implementation, flexible):**

- Internal architecture, programming language, frameworks, how each agent is built
- How the orchestrator is implemented (the starter is one option; LangGraph, a queue, a state machine, your own)
- The communication mechanism (in-process, HTTP, queue) as long as the contract holds
- Database, persistence, deployment platform
- UI, review queue, dashboards
- Additional services, additional features
- The final-outcome policy, routing and `on_uncertain` / `on_error` policies (documented in `docs/decisions.md`)

## 8. Extension points

| You want to… | Change |
|---|---|
| Add or reroute a stage | `orchestration/flow.json` (and write a decision) |
| Change the final decision or status rules | `orchestration/rollup.py` (and its tests, and a decision) |
| Plug in a real agent | `agents/<stage>/app.py` + `agent.json` |
| Run an agent as a service in any language | `agent.json` `mode: "http"` + [`agent-api.md`](shared/contracts/agent-api.md) |
| Run your own subjects | `data/input/<subject>/<stage>/` + a cases file |
| Add agent-specific data to evidence | `payload` (never the envelope) |
| Persist to a database | implement the four store methods in `orchestration/store.py` |

## 9. Deployment options (yours)

- **Single process:** `uvicorn orchestration.api:app` with all agents `inproc`. Simplest.
- **Orchestrator + agent services:** each agent its own process, `mode: "http"`, `<STAGE>_URL` set; `GET /health` for readiness.
- Whatever you pick, the demo runs from the submitted commit and any URL works without your accounts. The API ships with **no authentication**: add it before exposing it.

---

## Your Pod's Architecture (Phase 1 Integrated 5-Agent Workflow)

### 1. System Architecture & Component Diagram

```text
                                  POD WORKFLOW
                                       │
                      ┌────────────────▼────────────────┐
                      │    Orchestration Engine         │  owns workflow state & audit log
                      │    (orchestration/orchestrator) │  enforces tenancy & contracts
                      └────────────────┬────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │ (Step 1: Inbound)        │                          │
   ┌────────▼────────┐                 │                          │
   │Receiving Manager│                 │                          │
   │   (RCV-*)       │                 │                          │
   └────────┬────────┘                 │                          │
            │                          │                          │
            ├───────────────┬──────────┘                          │
            │ (if FBA)      │ (if MFN)                            │
   ┌────────▼────┐ ┌────────▼────┐                                │
   │Prep Manager │ │Pack Manager │                                │
   │   (PRP-*)   │ │   (PCK-*)   │                                │
   └────────┬────┘ └────────┬────┘                                │
            │               │                                     │
            └───────┬───────┘                                     │
                    │ (if returned)                               │
           ┌────────▼──────┐                                      │
           │Returns Manager│                                      │
           │   (RTN-*)     │                                      │
           └────────┬──────┘                                      │
                    │                                             │
                    └──────────────────┬──────────────────────────┘
                                       │ (Accumulated Evidence Chain)
                              ┌────────▼─────────┐
                              │ Recovery Manager │  audits channel fee reports
                              │     (RCY-*)      │  against upstream evidence
                              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │  Final Outcome   │  CLEAN / CLAIM_RECOMMENDED /
                              │ (Derived Rollup) │  EXCEPTION / NEEDS_REVIEW / INCOMPLETE
                              └──────────────────┘
```

### 2. 5-Agent Responsibilities & Implementation

| Agent | Stage | Implementation Status | Core Responsibility | Produced Record | Key Identifiers Preserved |
|---|---|---|---|---|---|
| **Receiving** | `receiving` | Integrated Stub | Verifies supplier delivery against PO: carton count, unit count, physical damage, and quality flags. | `RCV-<record_id>` | `po_number`, `po_line`, `sku`, `asin`, `supplier` |
| **Prep** | `prep` | Integrated Stub | Verifies packaging compliance for Amazon FBA units: polybag seal, suffocation warning, FNSKU label, barcode covering, handling marks. | `PRP-<record_id>` | `work_order_id`, `fba_shipment_id`, `sku`, `asin`, `fnsku` |
| **Pack** | `pack` | **Production Pack Manager** (Round 2 → Round 3) | Order-blind VLM analysis + quality gate + deterministic decision engine verifying merchant-fulfilled box contents (items present, quantities correct, no extra/wrong items). | `PCK-<record_id>` | `order_id`, `order_lines`, `observed_in_box` |
| **Returns** | `returns` | Integrated Stub | Verifies customer return against original order: item identity match and part completeness. | `RTN-<record_id>` | `order_id`, `sku`, `asin` |
| **Recovery** | `recovery` | Integrated Stub / Audit Engine | Reconciles channel fee reports against upstream evidence chain (`previous_evidence`). Classifies each charge as `CONTRADICTS` (claimable), `SUPPORTS` (valid fee), or `SILENT` (insufficient evidence). | `RCY-<subject_id>` | `line_id`, `charge_type`, `evidence_record_ids` |

### 3. Orchestrator, Evidence Contract & State Management
- **Workflow State Ownership**: The orchestrator (`orchestration/orchestrator.py`) exclusively owns workflow state (`Workflow State v1.0`). Agents return advice and evidence; they never alter workflow state directly.
- **Strict Evidence Contract**: Every handoff is strictly validated against `shared/schemas/agent-output.schema.json` and `shared/schemas/evidence.schema.json`. Invalid or non-conforming outputs are rejected immediately and recorded as structured errors (`invalid_output`), preventing corrupt data from propagating.
- **Evidence Immutability & Content Hashing**: Every evidence record is sealed with a SHA-256 hash of its normalized JSON payload. Any data modification breaks cryptographic verification (`shared.utils.hashing.verify()`).
- **Audit Logging**: All state transitions (`workflow_created`, `stage_started`, `stage_completed`, `stage_degraded`, `status_changed`) are appended to `transitions[]` with UTC timestamps.
- **Human Overrides**: Operator overrides do not rewrite historic evidence; they are appended to the workflow audit log with target record, actor, reason, and new verdict. Recovery respects effective verdicts when auditing charges.

### 4. Tenancy & Security
- Every request, record, and workflow is scoped to an `org_id` tenant.
- Cross-tenant requests are rejected at the agent boundary (`AgentRejected` / `LookupError` returning HTTP 404/422).
- Tenancy isolation is tested across all 5 agents and the orchestrator in the test suite.

### 5. Failure Model & Error Taxonomy
- Standardized error codes: `agent_unavailable`, `agent_timeout`, `agent_rejected`, `invalid_output`, `upstream_missing`.
- Failures are recorded and **never hidden**: a degraded evidence record is produced, the stage state is marked `error`, and workflow status becomes `FAILED` with outcome `INCOMPLETE`.
- Cross-platform socket resilience: connection timeouts on unavailable endpoints are safely categorized as `agent_unavailable`.

### 6. Official Data Usage
- Evaluated on all 100 official sample scenarios (`data/sample/cases.json`).
- Validated with 100% agreement against canonical outcomes (`data/expected/final-outcomes.sample.json`) and the canonical walkthrough case `UNIT-0014` (`data/expected/canonical-workflow.json`).

### 7. Breeth Intent Memory Layer (Persistent Memory)
- **Persistent Intent-Aware Memory**: Integrates [Breeth](https://www.thebreeth.com/app) (`shared/utils/breeth_memory.py`, SDK `breeth>=0.1.0`) across the multi-agent pipeline.
- **Tenant Isolation**: Each tenant's episodic knowledge graph is strictly partitioned via `group_id = f"cube-org-{org_id}"`. Zero cross-tenant memory leakage.
- **Episodic Knowledge Recording**: Upon workflow finalization in `_finalize()`, the orchestrator synthesizes an execution narrative capturing stage verdicts, rationales, and claim decisions, then commits it to Breeth with automatic intent extraction (`extract_intent=True`).
- **Agent Memory**: Agents (e.g. Pack Manager) can write operational notes or query historical packaging quirks and supplier dispute precedents.
- **MCP Server Support**: Workspace provides `.agents/mcp_config.json` configuring the Breeth MCP server (`https://mcp.thebreeth.com/mcp`) for tool-assisted agent memory operations.
- **Fail-Open Architecture**: All Breeth interactions are non-blocking and fail-open. When `BREETH_API_KEY` is not set or the network is unavailable, operations gracefully degrade to no-ops without impacting pipeline execution or test suite stability.

### 8. How to Run the Complete Workflow & Tests
- **Run Complete 100-Case Workflow**:
  ```bash
  python -c "from orchestration.orchestrator import run_workflow; from orchestration.store import FileStore; import json, pathlib; cases = json.loads(pathlib.Path('data/sample/cases.json').read_text()); store = FileStore('out'); [run_workflow(c, store=store) for c in cases]; print('100 workflows completed')"
  ```
- **Run All Tests (Unit, Integration, E2E, Contract Compliance)**:
  ```bash
  python -m pytest -v
  ```
- **Run Phase 1 Compliance Suite**:
  ```bash
  python -m pytest tests/integration/test_phase1_compliance.py -v
  ```
- **Run Breeth Memory Integration Tests**:
  ```bash
  python -m pytest tests/integration/test_breeth_integration.py -v
  ```

### 9. Known Limitations & Next Steps
- Production Pack Manager is fully integrated; Receiving, Prep, Returns, and Recovery are currently using contract-compliant organizer stubs pending Pod members bringing their Round 2 models.
- Live VLM execution for Pack requires `GEMINI_API_KEY` when evaluating novel captures not in the sample dataset.
- Live Breeth memory synchronization requires a valid `BREETH_API_KEY` (`ck_live_...`).

