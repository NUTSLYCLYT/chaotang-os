# CI 摘要：feat-r0-w08-browser-flow-batch3-20260728

## RED 记录

| 命令 | 退出码 | 症状 | 修复 |
| --- | ---: | --- | --- |
| `pnpm exec playwright test --config=playwright.w08-browser-batch3.config.ts` | 1 | 测试错误假设第二注册用户会进入不同 tenant；实际注册 API 固定 default tenant | 改为验证同租户不同用户不能回放 owner archive，并明确跨租户 proof 未覆盖 |

## GREEN 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | dependencies restored | isolated frontend test environment | isolated worktree / 20260728 |
| `pnpm exec playwright test --config=playwright.w08-browser-batch3.config.ts` | 0 | `3 passed` | W08 browser flow 5-7 | isolated worktree / 20260728 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | `decision: GO`, `activeWorkPackage: R0-W08` | W08 authority | isolated worktree / 20260728 |
| `git diff --check` | 0 | clean | whitespace/conflict marker check | isolated worktree / 20260728 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | root harness inventory | isolated worktree / 20260728 |
| `pnpm harness:doctor` | 0 | `harness-doctor: 0 errors, 0 warning(s)` | frontend harness inventory | isolated worktree / 20260728 |

## Playwright 证据

| 文件 | SHA-256 |
| --- | --- |
| `frontend/test-results/.last-run.json` | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `frontend/test-results/w08-browser-flow-batch3-W0-0ca8d-facts-from-the-review-panel/w08-batch3-flow5-all-artifacts.png` | `b6656871c21f6b50a69d7f050f074897ed8f64a58a4f61bd695e4fd258e305b2` |
| `frontend/test-results/w08-browser-flow-batch3-W0-57a06-nnot-read-the-contract-task/w08-batch3-flow6-unauthenticated.png` | `160eb89ea7c2a193ca99075561dadfb5817acbd96335031c1739a5e3be108dea` |
| `frontend/test-results/w08-browser-flow-batch3-W0-6d4a8-ot-replay-the-owner-archive/w08-batch3-flow7-cross-user-replay.png` | `01e84eee916ff18f68a3bb5f7963b1c537831f1a1d6c64333bde7a449095fb8e` |

## 结果

VERIFIED_PARTIAL。W08 browser flow 从 `4/10` 推进到 `7/10`。

## 未验证项

- 未完成剩余 `3/10` browser flow。
- 未完成跨租户 browser proof；当前完成同租户跨用户 proof。
- 未执行 5 名非开发用户验收。
- 未验证生产；本 Packet 不部署。

## Diff 与回滚复核

- changed files：
  - `frontend/playwright.w08-browser-batch3.config.ts`
  - `frontend/e2e/w08-browser-flow-batch3.spec.ts`
  - `.harness/changes/feat-r0-w08-browser-flow-batch3-20260728/`
- diff review：只新增 test/config/evidence。
- 回滚是否演练：未演练；删除上述文件即可。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| Flow 5 PDF/DOCX/JSON downloads | Playwright download events + screenshot | PASS |
| Flow 6 unauthenticated no direct task panel | Playwright assertion + screenshot | PASS |
| Flow 7 same-tenant cross-user replay denial | Playwright assertion + screenshot | PASS |
| W08 authority | `decision: GO` | PASS |
| root/frontend harness doctor | root/frontend 0/0 | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
