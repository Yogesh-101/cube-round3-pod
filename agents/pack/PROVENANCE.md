# Provenance — Pack Manager

| | |
|---|---|
| **Round 2 repository** | https://github.com/Yogesh-101/cube26-pck-0122-yogesh-101 |
| **Commit integrated** | `ec29525ebf43185f40616b2769477759f9c97cfd` |
| **Owner** | @Yogesh-101 |
| **Stage** | `pack` |
| **Agent id** | `pack-manager@1` |

## What was brought in

The full Round 2 Pack Manager tree lives under `runtime/`:

- `runtime/app/` — FastAPI UI, Gemini client, order-blind VLM prompt, quality gate, decision engine, SQLite persistence
- `runtime/data/` — sample CSV, catalogue, held-out photo eval fixtures and results
- `runtime/tests/` — unit, integration, and evaluation tests
- `runtime/docs/`, `runtime/submissions/` — evaluation report and submission artefacts
- `runtime/requirements.txt`, Docker/Render deploy files

## Round 3 adapter

`app.py` exposes `handle(agent_input) -> agent_output` using `shared.utils.records` (`build_record` / `build_output` / `pending_output`). It:

1. Refuses cross-tenant subjects (`LookupError` → HTTP 404)
2. Runs the live VLM pipeline when image captures resolve from `request["inputs"]`
3. Otherwise runs the same decision engine on labelled sample observations (no invented VLM evidence)
4. Fails open with `pending_output` on model/agent errors
