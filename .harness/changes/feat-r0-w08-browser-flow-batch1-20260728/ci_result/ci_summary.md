# CI 摘要：feat-r0-w08-browser-flow-batch1-20260728

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | dependencies restored | isolated frontend test environment | isolated worktree / 20260728 |
| `pnpm exec playwright test --config=playwright.w07.config.ts` | 0 | `1 passed` | real backend browser flow baseline | isolated worktree / 20260728 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | `decision: GO`, `activeWorkPackage: R0-W08` | W08 authority | isolated worktree / 20260728 |
| `git diff --check` | 0 | clean | whitespace/conflict marker check | isolated worktree / 20260728 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | root harness inventory | isolated worktree / 20260728 |
| `pnpm harness:doctor` | 0 | `harness-doctor: 0 errors, 0 warning(s)` | frontend harness inventory | isolated worktree / 20260728 |

## Playwright 证据

| 文件 | SHA-256 |
| --- | --- |
| `frontend/test-results/.last-run.json` | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `frontend/test-results/w07-contract-runnable-mini-2ac81-and-reopens-the-review-pack/w07-shiguan-exact-lineage.png` | `5831331cd503c30b3f6fa0c661ba2ef493228433c9b07f9a9ff641ca57daf233` |
| `frontend/test-results/w07-contract-runnable-mini-2ac81-and-reopens-the-review-pack/w07-partial-after-refresh.png` | `ffbbbf0172a1351308191033047c25a043d1604f81150b5e6489eceeae57f7aa` |

## 结果

VERIFIED_PARTIAL。W08 browser flow 已完成 `1/10` baseline。

## 未验证项

- 未完成剩余 `9/10` browser flow。
- 未执行 5 名非开发用户验收。
- 未验证生产；本 Packet 不部署。

## Diff 与回滚复核

- changed files：
  - `.harness/changes/feat-r0-w08-browser-flow-batch1-20260728/`
- diff review：仅证据登记。
- 回滚是否演练：未演练；删除本 Packet 目录即可。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| real backend browser flow baseline | Playwright `1 passed` | PASS |
| ContractReviewPack/JSON download | Playwright download event | PASS |
| Shiguan exact archive replay | screenshot and assertions | PASS |
| PARTIAL refresh behavior | screenshot and assertions | PASS |
| W08 authority | `decision: GO` | PASS |
| root/frontend harness doctor | root/frontend 0/0 | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
