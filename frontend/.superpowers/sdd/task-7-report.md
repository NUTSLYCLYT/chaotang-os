# Task 7 Report — 户部钩子(三引擎加工)+ 极严阈值

**Date:** 2026-06-28
**Commit:** 48fa14a
**Branch:** feat/dept-flywheel-v1

## Status: COMPLETE

## Files Created

| File | Lines | Notes |
|------|-------|-------|
| `src/core/courtos/department-flywheel/hubu/config.ts` | 8 | `HUBU_FLYWHEEL_CONFIG`, `HUBU_MIN_BUDGET_YUAN=500_000`, `HUBU_KEYWORDS` |
| `src/core/courtos/department-flywheel/hubu/hooks.nodetest.ts` | 25 | 3 tests covering selectCandidates / passesThreshold / derive |
| `src/core/courtos/department-flywheel/hubu/hooks.ts` | 52 | `taskToHubuProject`, `hubuHooks: DeptHooks` |

## TDD Cycle

1. `config.ts` written first (no test needed — pure config constants)
2. `hooks.nodetest.ts` written — ran FAIL: `Cannot find module './hooks'` (expected)
3. `hooks.ts` written with plan code verbatim
4. Re-ran test: **403 pass, 0 fail** (3 new tests + 400 pre-existing)
5. `pnpm exec tsc --noEmit`: **0 errors**
6. Committed as `48fa14a`

## Dependency Verification

- `@/lib/contracts/hubu` → exports `HubuProject` ✓ and `FinanceRiskLevel` ✓
- `@/features/hubu/lib/hubu-engines` → exports `evaluateProject` ✓ and `parseWan` ✓
- `as HubuProject` cast retained as planned (only 6 fields filled, evaluateProject only reads those)

## Test Results Detail

```
test('selectCandidates 只留户部语义') → PASS (b,s included; offtopic excluded)
test('passesThreshold 金额≥50万才过') → PASS (big=80万→true; small=2000→false)
test('derive 产 real 待决项 + 带 verdict 元数据') → PASS (reality='real', command includes '户部', meta has 'verdict')
```

## Constraints Honored

- Only 3 files created, all under `hubu/`
- Code verbatim from plan
- `as HubuProject` cast preserved (not padded to full interface)
- No push, no branch switch
