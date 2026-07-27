# CI 摘要：feat-r0-w07-a0-runnable-minimum-20260727

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_contract*.py tests/test_artifact_delivery*.py ... tests/test_shangshufang_loop_api.py` | 0 | latest 310 passed, 2 skipped | mission、lineage、shared decision writer、brief/legacy、authz、W05/W06 regression | 2026-07-27 |
| `ruff check <W07-A0 backend files>` | 0 | All checks passed | Python scope | 2026-07-27 |
| `pnpm exec tsx --test src/features/contract-review/*.nodetest.ts` | 0 | latest 26 passed | runtime schema、request/pack/final identity、effective source、archive identity、existing-page regression | 2026-07-27 |
| `pnpm test:node` | 1 | 1085 passed, 1 failed | canonical frontend residual scan；1 个既有、非本 diff 失败 | 2026-07-27 |
| `pnpm exec tsx --test src/app/(dashboard)/liubu/page.nodetest.tsx` | 1 | 0 passed, 1 failed | canonical glob 未覆盖的 TSX residual；非本 diff | 2026-07-27 |
| `pnpm exec tsc --noEmit` | 0 | pass | generated contract and frontend types | 2026-07-27 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | pass | real-mode production build only | 2026-07-27 |
| `node --test scripts/api-contract-stability.nodetest.mjs` | 0 | 5 passed | immutable base、repin rejection、schema content、determinism | 2026-07-27 |
| `API_CONTRACT_BASE_REF=ed822... node scripts/api-contract-stability.mjs` x2 | 0 | pass, 362 routes, 0 breaking, 9 additions | fixed OpenAPI baseline；两次 report/snapshot hash 相同 | 2026-07-27 |
| `pnpm exec playwright test --config=playwright.w07.config.ts` | 0 | latest remediation run 1 passed | delayed initial read、fresh real JWT READY flow、legacy footer suppression、exact/tampered archiveId、seeded PARTIAL refresh | 2026-07-27 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | backend harness | 2026-07-27 |
| `pnpm harness:doctor` | 0 | 0 errors, 0 warnings | frontend harness | 2026-07-27 |
| base `ed822255...`: `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | pre-edit integrated authority baseline | 2026-07-27 |
| isolated candidate: `node scripts/harness-doctor.mjs` | 1 | expected `active-packet EXT ref must equal pinned HEAD` only | PRE_INTEGRATION fail-closed；不得伪装为 root PASS | 2026-07-27 |
| `git diff --check` | 0 | pass | whitespace/diff integrity | 2026-07-27 |

## 结果

review envelope `a8e88589...` 的两路 independent review 为 `NO-GO`；主控确认的
全部适用 HIGH/MEDIUM 已完成第四轮 TDD remediation 并通过上述 fresh evidence。
implementation candidate `b12b0db4fecda88f7a5f44cc2205a8bb534cae2f`, tree
`8df6679495f46006d9d9e70ccd05d141b3f393cb` 已冻结；状态是
`INDEPENDENT_REVIEW_PENDING`，不得整合。

## 全仓既有 Residual

- `src/lib/intel/signal-dispatch.nodetest.ts`：固定日期样例在当前日期新增
  `signal_older_than_30_days`；canonical `pnpm test:node` 唯一失败，不在本
  Packet diff。
- `src/app/(dashboard)/liubu/page.nodetest.tsx`：测试期望礼部入口，但当前页面仍标
  “待建”；该 TSX 文件不在 canonical test glob 中，单独复验失败，不在本 Packet
  diff。

## 未验证项

- Checkpoint B 的数据库唯一约束、CAS 和并发 writer hardening。
- PARTIAL 跨刷新 resume；Checkpoint A 只返回 blocker，不提供 resume。
- 生产部署、持久数据库迁移、listener 3050 和真实客户数据。
- 36 黄金合同、10/10 全浏览器流程和 5 名非开发用户验收属于后续产品验收。

## Diff 与回滚复核

- changed files：只涉及 root Packet、backend contract bridge、generated OpenAPI、
  frontend child Packet、两个既有页面 hunk 和测试。
- diff review：`git diff --check` 通过；密钥模式扫描无命中。
- 回滚是否演练：未执行 destructive rollback；isolated worktree 可直接弃置，
  local EXT 尚未整合实现候选。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| server-owned read model/actions | backend tests + OpenAPI | PASS |
| exact pack/manifest/archive lineage | projection tests + browser readback | PASS |
| existing two-page consumption | focused node tests + Playwright | PASS |
| honest PARTIAL limitation | backend/frontend tests + real browser refresh | PASS |
| real backend synthetic flow | Playwright real JWT flow | PASS |
| no deployment or 3050 operation | isolated 3002/8081 config and report | PASS |
| fourth remediation | all applicable HIGH/MEDIUM locally closed | PASS |
| independent review | fresh two-pass read-only review | PENDING |
| exact implementation candidate | `b12b0db4...` / `8df66794...` | PASS |

## 声明状态

- `IMPLEMENTATION_CANDIDATE_FROZEN / INDEPENDENT_REVIEW_PENDING / NOT_DEPLOYED`
