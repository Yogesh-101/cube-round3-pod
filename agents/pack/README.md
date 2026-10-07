# agents/pack/ · Pack Manager

**Owner:** @Yogesh-101 · **Agent:** `pack-manager@1` · **Status:** Round-3 integration ready

Merchant-fulfilled / 3PL pack verification: from an open-box photo and the order lines, decide **seal**, **stop_and_fix**, or **pending_review**. Amazon FBA is out of scope (`route == "mfn"` only).

| | |
|---|---|
| **Reads (inputs)** | Open-box photo(s), order lines |
| **Reads (previous evidence)** | Receiving (cited in `upstream_refs` / `evidence_refs`) |
| **Produces** | `items_present`, `quantities_correct`, `no_extra_items` (+ `no_wrong_items`, `image_quality`) |
| **`decision.outcome`** | `seal`, `stop_and_fix`, `pending_review` |
| **Held-out photo eval** | 38/38 complete · **0 false SEAL** · 76.3% decision accuracy |

## Layout

```text
agents/pack/
├── app.py                 ← handle(agent_input) → Agent Output
├── agent.json
├── PROVENANCE.md
├── requirements.txt       ← google-genai / Pillow for live VLM
├── tests/test_pack_handle.py
└── runtime/               ← full Round 2 Pack Manager
```

## Integration behaviour

1. **Captures present** (`request.inputs` or `data/input/<subject_id>/pack/`) → order-blind Gemini + quality gate + decision engine.
2. **No captures** (contract/demo) → decision engine on labelled sample observations (no invented VLM evidence).
3. **Wrong tenant** → `LookupError` (HTTP 404).
4. **FBA route** → fail-open `pending_output` (`wrong_route`), never seal.
5. **VLM/API failure** → `pending_output` (`vlm_unavailable` / `agent_exception`).
6. **UNCERTAIN checks** → outcome `pending_review`; never auto-seal.

See Pod decision **D-007** in [`docs/decisions.md`](../../docs/decisions.md).

## Run

```sh
# from repo root
pip install -r requirements.txt -r agents/pack/requirements.txt
uvicorn agents.pack.app:app --port 8103
curl localhost:8103/health
```

Live photo mode needs `GEMINI_API_KEY` (see `runtime/.env.example`). Prefer `GEMINI_MODEL=gemini-flash-lite-latest` on free tier.

## Tests

```sh
pytest tests/integration/test_agent_contracts.py -q
pytest agents/pack/tests -q
# Round 2 unit suite:
cd agents/pack/runtime && pytest tests/unit -q
```

## Limits (honest)

- Needs clear open-box photos; opaque packaging → UNCERTAIN
- Free-tier Gemini quotas can force pending
- Held-out fixtures are Unsplash composites, not live warehouse phone captures
- Observation exact-match on held-out photos is ~37%; safety metric is **0 false SEAL**
