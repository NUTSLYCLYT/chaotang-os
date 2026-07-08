# Local AI Fusion Package

## Scope

This package brings the local AI runtime and Shiguan vault into the CourtOS backend mainline through a controlled bridge.

It does not vendor model files, Ollama blobs, SQLite caches, `.env` files, or Obsidian vault content.

## Backend Files To Commit

```text
src/local_ai_bridge.py
web/routers/local_ai.py
web/main.py
src/backend_preflight.py
tests/test_local_ai_bridge.py
tests/test_backend_preflight.py
docs/local_ai_fusion.md
docs/runtime_dependency_inventory.md
docs/local_ai_fusion_package.md
```

## Frontend Companion File

Commit this separately in `/home/ubuntu/workspace/frontend/chaotang-web-lyt`:

```text
docs/LOCAL_AI_FUSION.md
```

Do not include unrelated frontend working-tree changes in the same package.

## Verification

Run from `/home/ubuntu/fe/fengQun/jiqun_ai_fresh`:

```bash
.venv/bin/python -m pytest -q tests/test_local_ai_bridge.py tests/test_backend_preflight.py
.venv/bin/python -m py_compile src/local_ai_bridge.py src/backend_preflight.py web/routers/local_ai.py web/main.py
.venv/bin/python scripts/commit_closeout_check.py
```

Runtime smoke:

```bash
.venv/bin/python - <<'PY'
from src.local_ai_bridge import fusion_status
print(fusion_status())
PY
```

Expected runtime signals:

```text
enabled: True
courtos_brain_exists: True
direct_ollama_fallback: True
mode: external_runtime_readonly_vault
```

## Do Not Package

```text
/home/ubuntu/local-ai/.genius/knowledge.db
/home/ubuntu/local-ai/models/**
/home/ubuntu/CourtOS-Brain/**
/home/ubuntu/super_brain_backend/**
.env
*.db
__pycache__/
```

## Rollback

Backend rollback:

1. Remove `src/local_ai_bridge.py`.
2. Remove `web/routers/local_ai.py`.
3. Remove the `local_ai_router` import and `app.include_router(local_ai_router.router)` from `web/main.py`.
4. Remove the `localAI` block from `src/backend_preflight.py`.
5. Remove the local AI tests and docs listed above.

Frontend rollback:

1. Remove `docs/LOCAL_AI_FUSION.md`.
