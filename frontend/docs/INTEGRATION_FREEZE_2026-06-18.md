# CourtOS Integration Freeze - 2026-06-18

> Purpose: stop repo drift and concurrent feature expansion while we sort, verify, and merge the current mainline work. This applies to Claude Code, Codex, Claude Desktop, sub-agents, and scripted agents.

## 1. Active Main Repositories

Only these two repositories are active for this integration window:

| Role | Path | Remote |
|---|---|---|
| Frontend main repo | `/home/ubuntu/workspace/frontend/chaotang-web-lyt` | `git@gitee.com:msxn/chaotang-web-lyt.git` |
| Backend jiqun main repo | `/home/ubuntu/fe/fengQun/jiqun_ai_fresh` | `git@gitee.com:msxn/jiqun_ai.git` |

Historical worktrees, `chaotang-os`, `court-agent-os`, and similarly named directories are reference-only unless the user explicitly says otherwise.

## 2. Freeze Rules

- No broad `git add .`.
- No direct `pull`, `merge`, or `rebase` while either main repo has unsorted dirty work.
- No new departments, offices, schemas, loops, agents, or prompts until the current dirty set is classified and verified.
- No production process changes on port `3050`.
- No backend runtime database files in code commits.
- Every commit must have a narrow purpose and a file-level include list.

## 3. Current Frontend Dirty Set

Branch: `feat/libu-chro-cao-contract`

Current pending category: CourtOS MVP persistence and API surface.

Tracked edits:

- `package.json`: adds `test:courtos:mvp-api`.
- `src/lib/db/schema.ts`: adds decision task, draft edict, court review, department run, memorial, emperor decision, shiguan archive, and court loop run tables plus indexes/metadata.

Untracked files:

- `src/app/api/registry/departments/route.ts`
- `src/app/api/reviews/[review_id]/decision/route.ts`
- `src/app/api/reviews/[review_id]/departments/route.ts`
- `src/app/api/reviews/[review_id]/followup/route.ts`
- `src/app/api/reviews/[review_id]/memorial/route.ts`
- `src/app/api/reviews/[review_id]/progress/route.ts`
- `src/app/api/reviews/[review_id]/run/route.ts`
- `src/app/api/reviews/route.ts`
- `src/app/api/shangshufang/confirm-edict/route.ts`
- `src/app/api/shangshufang/draft-edict/route.ts`
- `src/app/api/shangshufang/home/route.ts`
- `src/app/api/shiguan/archives/[archive_id]/retrospective/route.ts`
- `src/app/api/shiguan/archives/[archive_id]/route.ts`
- `src/app/api/shiguan/archives/route.ts`
- `src/core/courtos/persistence/courtos-mvp-api.nodetest.ts`
- `src/core/courtos/persistence/decision-archive-policy.nodetest.ts`
- `src/core/courtos/persistence/decision-archive-policy.ts`
- `src/lib/db/courtos-decision-store.ts`

Decision: treat these as one candidate feature group, but verify before commit:

1. Persistence schema and store.
2. API routes for Shangshufang, reviews, registry, and Shiguan.
3. Persistence/archive policy tests.

## 4. Current Backend Dirty Set

Branch: `feat/courtos-loop-harness`

- Runtime data: `data/fengqun.db` must stay out of code commits.
- Candidate code fix: `scripts/serve-dev.sh` maps local LiteLLM health to `127.0.0.1:4444`.
- Candidate test/golden work: `harness/chaotang-true-loop/golden_cases/true_loop_cases.json`, `_patch_golden.py`.

Decision: split backend into at least three buckets:

1. Runtime data: exclude.
2. Dev health fix: commit separately after backend health check.
3. Golden case update: inspect and validate separately before commit.

## 5. Minimum Gates Before Unfreezing

Frontend:

```bash
npm run test:core
npm run test:courtos:mvp-api
npm run build
```

Backend:

```bash
.venv/bin/python -m pytest tests/test_shangshufang_loop_api.py tests/test_swarm_execution_loop_api.py tests/test_chaotang_department_submit.py tests/test_task_protocol_api.py
```

Runtime health:

```bash
curl -sS http://127.0.0.1:3002/chaotang/api/health
curl -sS http://127.0.0.1:8081/api/health
```

