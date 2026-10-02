# Current State Manifest — 2026-10-02

## Snapshot identity

- Repository: `G:\ChaotangSource\chaotang-os-ext-dev-20260925`
- Snapshot branch: `snapshot/current-state-20261002`
- Product branch left untouched: `ext-dev`
- Base HEAD before this snapshot: `3e33a846c166588b54eb002561b2f8b87adbbc7d`
- Base tree before this snapshot: `ae171f48c365797ba04a5b55f76c357ddd43aece`
- Snapshot commit: the commit containing this manifest; SHA is reported by the delivery record.
- No reset, clean, stash, restore, merge, force push, or remote history rewrite was used.

## Files included

The snapshot includes only the following current product source, test, and audit documentation changes:

- `backend/app/api/decree_jobs.py`
- `backend/app/decree_jobs/executor.py`
- `backend/app/decree_jobs/storage.py`
- `backend/app/decree_jobs/worker.py`
- `backend/app/langgraph_runtime/deepseek_client.py`
- `backend/app/langgraph_runtime/provider_budget.py`
- `backend/app/orchestration/__init__.py`
- `backend/app/orchestration/first_loop.py`
- `backend/tests/test_decree_jobs_api.py`
- `backend/tests/test_deepseek_task_token_budget.py`
- `backend/tests/test_first_loop.py`
- `frontend/scripts/git-safety-guards.test.mjs`
- `docs/release/current-state-manifest-20261002.md`

The first-loop API fix removes the FastAPI import-time response-model error, requires a terminal job, validates evidence references, and accepts only references matching persisted `adopted_evidence_ids`. The route remains owner-scoped and read-only/idempotent for the first-loop operation.

## Files excluded

These working-tree paths were observed and explicitly excluded:

- `backend/bin/**`: virtual-environment executables and activation scripts.
- `backend/lib/**`: virtual-environment site packages.
- `backend/lib64`: virtual-environment link/metadata.
- `backend/pyvenv.cfg`: virtual-environment metadata.
- `backend/uv.lock`: untracked dependency artifact; repository rules identify `backend/requirements-runtime.lock` as the project lock source and do not establish `uv.lock` as a project file.
- `backend/.venv/**`, `backend/.pytest_cache/**`, `backend/.ruff_cache/**`: local environment and tool caches.
- `frontend/node_modules/**`, `frontend/.next/**`, `dist/**`, `build/**`: generated dependencies/build output.
- Logs, databases, browser snapshots, screenshots, credentials, and temporary files: excluded wherever present; none are staged by this snapshot.

No file under `frontend/src/**` changed. The CDesktop UI is retained as-is; only the existing frontend safety test is included.

## Runtime and evidence paths

- Backend runtime environment in the repository (`backend/.venv`, `backend/bin`, `backend/lib`, `backend/lib64`) remains excluded.
- Validation used the disposable external environment at `C:\Users\Administrator\Documents\Codex\2026-10-02\task-9\backend-test-venv`.
- No real model credentials, external model call, production database, or deployment environment was used.

## Verification

- Targeted pytest: `python -m pytest tests/test_first_loop.py tests/test_deepseek_task_token_budget.py tests/test_decree_jobs_api.py -q` — exit `0`, `65 passed`.
- Targeted Ruff: `ruff check app/api/decree_jobs.py app/orchestration/first_loop.py tests/test_decree_jobs_api.py tests/test_first_loop.py` — exit `0`, all checks passed.
- Targeted format check: `ruff format --check app/api/decree_jobs.py app/orchestration/first_loop.py tests/test_decree_jobs_api.py tests/test_first_loop.py` — exit `0`, 4 files already formatted.
- Git whitespace check: `git diff --check` — exit `0`.
- Frontend direct tests: `node --test` — exit `0`, `888 passed`.
- Frontend safety test: `node --test scripts/git-safety-guards.test.mjs` — exit `0`, `9 passed`.
- `npm run lint` and `npm run typecheck` were not runnable because the local npm CLI is incomplete (`npm-cli.js` missing).
- Full backend suite and real-model/E2E execution were not run.

## Harness and authority

- `harness-doctor --check`: `PASS / BOOTSTRAP_OBSERVE`, `canExecuteProductWork=false`.
- `harness-doctor --status`: `OBSERVE / BOOTSTRAP_OBSERVE`.
- `harness-doctor --ready`: `NOT_READY / FRONTEND_ABSENT_BACKEND_PARTIAL_PRODUCT_STOP`.
- `product-authority --status`: `STOP / APPROVAL_NOT_SELECTED`.
- `check_harness` and its self-test remain failing on the repository's incomplete capability capsules/runtime evidence binding.
- Harness/product authority status does not grant product施工 authority; this snapshot is a user-authorized source-state delivery.

## Remotes

- `origin` (Gitee): `https://gitee.com/msxn/chaotang-os.git`
- `github` (GitHub): `https://github.com/pengyuan-max/chaotang-.git`
- The intended push target is the same branch name, `snapshot/current-state-20261002`, on each configured remote. Push results are reported with the commit SHA and are not represented by credentials in this file.

## Rollback

To leave the snapshot branch and return to the product branch:

```text
git switch ext-dev
```

To undo the committed snapshot without rewriting history:

```text
git revert <snapshot-commit-sha>
```

Do not use reset or force-push for rollback.
