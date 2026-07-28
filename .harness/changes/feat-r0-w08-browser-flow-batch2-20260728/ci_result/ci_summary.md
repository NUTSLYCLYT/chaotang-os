# CI 摘要：feat-r0-w08-browser-flow-batch2-20260728

## RED 记录

| 命令 | 退出码 | 症状 | 修复 |
| --- | ---: | --- | --- |
| `pnpm exec playwright test --config=playwright.w08-browser-batch2.config.ts` | 1 | 测试错误假设 `archive_id` 包含 task id，实际为 `archive_...` | 改为断言 `archive_id` 符合 `^archive_`，lineage 仍在 Shiguan identity 中校验 |

## GREEN 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | dependencies restored | isolated frontend test environment | isolated worktree / 20260728 |
| `pnpm exec playwright test --config=playwright.w08-browser-batch2.config.ts` | 0 | `3 passed` | W08 browser flow 2-4 | isolated worktree / 20260728 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | `decision: GO`, `activeWorkPackage: R0-W08` | W08 authority | isolated worktree / 20260728 |
| `git diff --check` | 0 | clean | whitespace/conflict marker check | isolated worktree / 20260728 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | root harness inventory | isolated worktree / 20260728 |
| `pnpm harness:doctor` | 0 | `harness-doctor: 0 errors, 0 warning(s)` | frontend harness inventory | isolated worktree / 20260728 |

## Playwright 证据

| 文件 | SHA-256 |
| --- | --- |
| `frontend/test-results/.last-run.json` | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `frontend/test-results/w08-browser-flow-batch2-W0-2155b-s-and-reopens-exact-lineage/w08-batch2-flow2-exact-lineage.png` | `ab1a59819de4e0e054f10e7ef60779d582d5f0a47b27c48295ef0a861665ade9` |
| `frontend/test-results/w08-browser-flow-batch2-W0-678a6--identity-in-Shiguan-replay/w08-batch2-flow3-tampered-archive.png` | `70320f87012fac0b5446b73ba79269f1986b9bfc98552738f55f474d3c2853db` |
| `frontend/test-results/w08-browser-flow-batch2-W0-6ab0e-non-decidable-after-refresh/w08-batch2-flow4-partial-refresh.png` | `0bbd34e4612488ff45e6c5cce7dc345e51cdce4f7a6dff553ea4223a44c8443d` |

## 结果

VERIFIED_PARTIAL。W08 browser flow 从 `1/10` 推进到 `4/10`。

## 未验证项

- 未完成剩余 `6/10` browser flow。
- 未执行 5 名非开发用户验收。
- 未验证生产；本 Packet 不部署。

## Diff 与回滚复核

- changed files：
  - `frontend/playwright.w08-browser-batch2.config.ts`
  - `frontend/e2e/w08-browser-flow-batch2.spec.ts`
  - `.harness/changes/feat-r0-w08-browser-flow-batch2-20260728/`
- diff review：只新增 test/config/evidence。
- 回滚是否演练：未演练；删除上述文件即可。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| Flow 2 full delivery/archive/reopen | Playwright assertion + screenshot | PASS |
| Flow 3 tampered archive rejection | Playwright assertion + screenshot | PASS |
| Flow 4 partial non-decidable refresh | Playwright assertion + screenshot | PASS |
| W08 authority | `decision: GO` | PASS |
| root/frontend harness doctor | root/frontend 0/0 | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
