# Build log

Keep this current. Organisers read it, and it is evidence of how the Pod actually worked. One entry per working session; newest first. Be honest about what failed.

| Date (UTC) | Who | What we did | What we learned / what broke | Next |
|---|---|---|---|---|
| 2026-10-08 | @Yogesh-101 | Integrated Breeth (https://www.thebreeth.com/app) intent-aware persistent memory layer (`shared/utils/breeth_memory.py`, SDK `breeth>=0.1.0`), configured tenant graph isolation (`group_id = cube-org-{org_id}`), episodic narrative recording in orchestrator `_finalize()`, agent-level memory capture in Pack, MCP server configuration (`.agents/mcp_config.json`), and comprehensive 9-test test suite. | Breeth token format requires `ck_live_...` or JWT. Implemented strict fail-open architecture so missing/offline Breeth service never disrupts pipeline or test suite execution. | Connect live Breeth API key when available; live agent testing. |
| 2026-10-08 | @Yogesh-101 | Phase 1: Completed 5-agent E2E workflow integration (Receiving → Prep → Pack → Returns → Recovery), fixed Windows path & socket timeout classification, verified 100/100 sample cases against expected outputs, wrote 27-test compliance suite (120 total tests passing). | Windows backslashes in `discover_inputs` broke POSIX refs; `httpx.ConnectTimeout` on dead ports needed classification as `agent_unavailable`. | Phase 2: Live services & pod member integration |

