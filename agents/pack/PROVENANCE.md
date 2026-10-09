# Provenance — Pack Manager

| | |
|---|---|
| **Round 2 repository** | https://github.com/Yogesh-101/cube26-pck-0122-yogesh-101 |
| **Commit integrated** | `19406b5` (durable SQLite + JSONL mirror; inspections survive restart/redeploy) |
| **Owner** | @Yogesh-101 |
| **Stage** | `pack` |
| **Agent id** | `pack-manager@2` |

## v2 Competitive Upgrades

Upgraded to **v2** to directly address gaps :
- **Object-level bounding boxes**: VLM now returns `[ymin, xmin, ymax, xmax]` for every detected object, grounding observations in the photos.
- **Scene Coverage Check**: Added a new check (`scene_coverage`) to assess whether the entire box interior is visible or if items might be hidden.
- **Photo Reuse Detection**: Added a new check (`photo_reuse`) that uses SHA-256 hashes to detect if a photo has already been used for another order.
- **Deterministic Decision Routing**: `UNCERTAIN` results are now correctly routed to `PENDING_REVIEW` instead of `STOP_AND_FIX`, requiring human review.
- **Substitution Detection**: The decision engine now pairs missing expected items with unexpected extra items, correctly identifying substitutions (`wrong_item`).
- **Richer Prompting**: The VLM prompt now provides per-candidate attribute descriptions and requires the VLM to state the `deciding_feature` and `alternative_skus` for each item.
- **Temperature 0**: VLM generation temperature is now strictly 0.0 with a separated `SYSTEM_INSTRUCTION` for maximum determinism.

## What was brought in

The full Round 2 Pack Manager tree lives under `runtime/`:

- `runtime/app/` — FastAPI UI, Gemini client, order-blind VLM prompt, quality gate, decision engine, durable SQLite + JSONL mirror (`storage/durable.py`)
- `runtime/data/` — sample CSV, catalogue, held-out photo eval fixtures and results (`held_out_latest.json`: 38/38, 0 false SEAL)
- `runtime/tests/` — unit, integration, and evaluation tests
- `runtime/docs/`, `runtime/submissions/` — evaluation report and submission artefacts
- `runtime/requirements.txt`, Docker/Render deploy files

## Round 3 adapter

`app.py` exposes `handle(agent_input) -> agent_output` using `shared.utils.records` (`build_record` / `build_output` / `pending_output`). It:

1. Refuses cross-tenant subjects (`LookupError` → HTTP 404)
2. Runs the live VLM pipeline when image captures resolve from `request["inputs"]`
3. Otherwise runs the same decision engine on labelled sample observations (no invented VLM evidence)
4. Fails open with `pending_output` on model/agent errors
