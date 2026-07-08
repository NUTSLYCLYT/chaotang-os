# Local AI / Shiguan Fusion

This repository is the backend mainline for CourtOS agent, flow, provider, and quality logic. The local model runtime and the Obsidian vault remain external runtime resources:

- Local model runtime: `/home/ubuntu/local-ai`
- Shiguan vault: `/home/ubuntu/CourtOS-Brain`
- Main model: `qwen3.6-35b-a3b-q4`
- OpenAI-compatible endpoint: `http://127.0.0.1:11434/v1`

Do not copy model weights, Ollama blobs, or the Obsidian vault into this repository. The integration boundary is `src/local_ai_bridge.py`.

## API

- `GET /api/local-ai/status`
- `GET /api/local-ai/audit-courtos-brain`
- `POST /api/local-ai/index-courtos-brain`
- `POST /api/local-ai/ask`
- `GET /api/preflight` includes a `localAI` section and warns when the bridge or vault is unavailable.

`index-courtos-brain` passes the vault path to `/home/ubuntu/local-ai/play.sh index`. It indexes into the local-ai SQLite knowledge DB and does not write to the vault.

`audit-courtos-brain` is read-only. It checks `_wiki/sources`, `_wiki/concepts`, and `_wiki/entities` for stale source paths, duplicate sources, orphan concepts/entities, and stub counts.

## Environment

```bash
LOCAL_AI_ROOT=/home/ubuntu/local-ai
COURTOS_BRAIN_PATH=/home/ubuntu/CourtOS-Brain
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
OPENAI_API_KEY=ollama
LOCAL_AGENT_MODEL=qwen3.6-35b-a3b-q4
LOCAL_AI_TIMEOUT_SEC=180
```

## Operator Commands

```bash
cd /home/ubuntu/fe/fengQun/jiqun_ai_fresh
python -m pytest -q tests/test_local_ai_bridge.py
```

Direct local runtime checks:

```bash
cd /home/ubuntu/local-ai
./play.sh status
./play.sh index /home/ubuntu/CourtOS-Brain
./play.sh genius "基于史馆和本地 AI 配置，给我下一步建议"
```
