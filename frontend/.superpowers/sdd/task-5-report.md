# Task 5 Report: 写待决项进主库 + ledger

## Status: DONE

**Commit:** `8c17a58`  
**Branch:** `feat/dept-flywheel-v1`

## TDD Steps

| Step | Result |
|------|--------|
| 1. 写测试 `raise.nodetest.ts` | Done |
| 2. 跑 FAIL | ✅ fail 1 — `Cannot find module './raise'` |
| 3. 写实现 `raise.ts` | Done |
| 4. 跑 PASS | ✅ pass 398 / fail 0 |
| 4. tsc --noEmit | ✅ 0 errors |
| 5. git commit | ✅ `8c17a58` |

## Files Created

- `src/core/courtos/department-flywheel/raise.nodetest.ts` — 2 tests
- `src/core/courtos/department-flywheel/raise.ts` — `buildRaiseInput` + `raiseDraft`

## Key Correctness

- taskId 前缀 `dept_raise_hubu_<hash>` — 不含 `department_learning_` (primary-store 守门拒绝后者)
- result.sourceLabel = draft.reality (honest, not hardcoded)
- result.flywheel.auto = true (可与人工任务区分)
- result.flywheel.dept + sourceTaskId (来源可区分)
- raiseDraft 同时写 upsertPrimaryTask + appendLedger (幂等: same hash → same taskId → upsert冲突静默)

## Dependencies Verified

- `upsertPrimaryTask` 从 `@/lib/db/primary-store` (已存在, 签名兼容)
- `appendLedger` 从 `./ledger` (Task 4 已完成)
- `contentHashOf` 从 `./dedupe` (Task 2 已完成)
- `getPrimaryDb` 已在 primary-store.ts:274 导出 (Task 4 前置步骤已完成)
