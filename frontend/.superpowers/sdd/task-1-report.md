# Task 1 Report: 召回带 outcome (LEFT JOIN shiguan_archives)

**Status:** DONE

**Commit:** f17bc86

**Branch:** feat/shiguan-value

---

## Test Results

- New tests (`recall-outcome.nodetest.ts`): **2/2 PASS**
- Existing `recall-guard.nodetest.ts`: **8/8 PASS** (no regression)
- All archive nodetests combined: **21/21 PASS**

## TypeScript Result

`pnpm exec tsc --noEmit`: **0 src errors** (errors in `.next-buildcheck/types/` are pre-existing stale build artifacts unrelated to this change)

---

## JOIN Key

```sql
LEFT JOIN shiguan_archives s ON ca.task_id = s.task_id
```

Both `court_archives` (column: `task_id TEXT`) and `shiguan_archives` (column: `task_id TEXT NOT NULL`) share `task_id` as the linking key.

---

## Tenant Isolation Preserved

The JOIN is a LEFT JOIN on a non-tenant column (`task_id`), not on `user_id`. The tenant filter `WHERE ca.user_id = ?` remains intact and unchanged. The LEFT JOIN only expands the SELECT to include `s.retrospective_status`; it does not alter which rows from `court_archives` are returned. The existing security properties are preserved:

1. `WHERE ca.user_id = ?` — tenant equality filter (strong, still first arg)
2. `AND ca.synthetic = 0` — exclude synthetic/demo cases
3. `AND (ca.source_label IS NULL OR ca.source_label NOT IN (?,?))` — exclude DEMO/FALLBACK source labels
4. `AND (original_question LIKE ?)` — keyword match

All WHERE predicates remain AND-connected, so the LEFT JOIN cannot short-circuit tenant isolation.

---

## Column Ambiguity Resolution

`shiguan_archives` shares `id`, `source_label`, `created_at`, and `task_id` with `court_archives`. All ambiguous columns in SELECT and ORDER BY are prefixed with `ca.`:

- SELECT: `ca.id`, `ca.source_label`, `ca.created_at`
- ORDER BY: `ca.created_at DESC`
- WHERE: `ca.source_label NOT IN (...)`, `ca.user_id`, `ca.synthetic`

`original_question` is unambiguous (only in `court_archives`), left unqualified to preserve existing `recall-guard.nodetest.ts` regex assertions.

---

## Files Modified

- `src/core/courtos/archive/recall-guard.ts`: Added LEFT JOIN + `s.retrospective_status` in SELECT + `ca.` qualification for ambiguous columns
- `src/core/courtos/archive/archive-store.ts`: Added `retrospectiveStatus?: string` to `PriorCase` interface + row mapping `r.retrospective_status ? String(r.retrospective_status) : undefined`
- `src/core/courtos/archive/recall-outcome.nodetest.ts`: New TDD test file (2 tests)

---

## Caveats

- `findSimilarCourtArchives` uses `ensureTable()` which only creates `court_archives`. In production, `shiguan_archives` must already exist (it is created by the schema migration in `src/lib/db/schema.ts`). The LEFT JOIN returns NULL for `retrospective_status` if the table exists but has no matching row — correct behavior.
- Multiple `shiguan_archives` rows per `task_id` would cause duplicate rows in recall results. Current schema has no UNIQUE constraint on `shiguan_archives.task_id`. If this is an issue in future, add `GROUP BY ca.id` or a subquery. As of now, the flow writes at most one shiguan record per task.
