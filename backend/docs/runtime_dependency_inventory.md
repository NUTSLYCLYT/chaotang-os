# Runtime Dependency Inventory

This file records external runtime assets that are required by the current mainline but must not be copied into the git repository.

## Protected External Assets

| Asset | Path | Why it exists | Store in git? |
|---|---|---|---|
| Local AI runtime | `/home/ubuntu/local-ai` | Ollama helper scripts, local genius controller, model download metadata | No |
| Ollama model store | `/home/ubuntu/local-ai/models/ollama` | Large model blobs used by local inference | No |
| GGUF downloads | `/home/ubuntu/local-ai/models/downloads` | Large source model files | No |
| Shiguan vault | `/home/ubuntu/CourtOS-Brain` | Obsidian vault and long-term memory | No |
| Super Brain service | `/home/ubuntu/super_brain_backend` | Active legacy Shiguan API and Obsidian watcher | No, keep as running service until replaced |

## Mainline Code That Preserves the Integration

| File | Purpose |
|---|---|
| `src/local_ai_bridge.py` | Local AI bridge, status, safe command allowlist, direct Ollama fallback, CourtOS-Brain read-only audit |
| `web/routers/local_ai.py` | Backend API surface for local AI and Shiguan bridge |
| `docs/local_ai_fusion.md` | Operator-facing integration contract |
| `tests/test_local_ai_bridge.py` | Regression coverage for the bridge and read-only audit |

## Deletion Rule

Do not delete protected external assets unless the mainline has a replacement and the corresponding service is stopped/disabled intentionally.

Safe to delete without review:

- `__pycache__`
- temporary screenshots or `.shot-tmp.*`
- stale `.aria2` files after verified completed downloads

Do not delete without review:

- `.env` files
- SQLite databases
- model files
- Obsidian vault content
- active systemd service source directories
