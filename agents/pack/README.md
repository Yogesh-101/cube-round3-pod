# agents/pack/ · Pack Manager

**Owner:** @Yogesh-101 · **Agent:** `pack-manager@1`

Merchant-fulfilled / 3PL pack verification: from an open-box photo and the order lines, decide **seal**, **stop_and_fix**, or **pending_review**. Amazon FBA is out of scope (`route == "mfn"` only).

| | |
|---|---|
| **Reads (inputs)** | Open-box photo(s), order lines |
| **Reads (previous evidence)** | Receiving (upstream refs cited) |
| **Produces** | `items_present`, `quantities_correct`, `no_extra_items` (+ `no_wrong_items`, `image_quality`) |
| **`decision.outcome`** | `seal`, `stop_and_fix`, `pending_review` |

## Layout

```text
agents/pack/
├── app.py            ← handle(agent_input) → Agent Output
├── agent.json
├── PROVENANCE.md     ← Round 2 repo + commit
├── README.md
└── runtime/          ← full Round 2 Pack Manager codebase
```

## How it works

1. **Observation (order-blind):** Gemini sees photos + catalogue only — not the expected order.
2. **Decision (deterministic):** compares observations to order lines; UNCERTAIN never auto-seals.
3. **Fail-open:** VLM errors → `pending_output` / pending review; the line is not blocked.
4. **Tenancy:** wrong `org_id` raises `LookupError` (HTTP 404).

Without resolved image files in `request["inputs"]`, the adapter still emits a contract-valid record by running the decision engine on labelled sample observations (no fabricated VLM calls).

## Run

```sh
# from repo root, with deps installed
uvicorn agents.pack.app:app --port 8103
curl localhost:8103/health
```

Live photo mode needs `GEMINI_API_KEY` (see `runtime/.env.example`).

## Tests

```sh
pytest tests/integration/test_agent_contracts.py -k pack
# Round 2 unit/eval tests (from runtime/):
cd agents/pack/runtime && pytest tests/unit -q
```

## Limits

- Needs clear open-box photos; opaque packaging → UNCERTAIN
- Free-tier Gemini quotas can force pending / incomplete live photo evals
- Held-out photo fixtures are Unsplash composites, not live warehouse phone captures
