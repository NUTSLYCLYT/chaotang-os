# CI 摘要：feat-r0-w08-browser-flow-batch4-20260728

## RED 记录

| 命令 | 退出码 | 症状 | 修复 |
| --- | ---: | --- | --- |
| `pnpm exec playwright test --config=playwright.w08-browser-batch4.config.ts` | 1 | Flow 10 错误假设归档后刷新仍留在上书房合同 panel；实际归档任务从 pending 列表移除 | 改为用 archive receipt 进入 `/shiguan`，验证只读审计和旧操作关闭 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 1 | isolated worktree base 落后最新 `feature-chaotang-ext`，active packet EXT ref 不等于 pinned HEAD | fast-forward isolated worktree 到 EXT `33bf3813` 后重新验证 |

## GREEN 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | dependencies restored | isolated frontend test environment | isolated worktree / 20260728 |
| `pnpm exec playwright test --config=playwright.w08-browser-batch4.config.ts` | 0 | `3 passed` | W08 browser flow 8-10 | isolated worktree / 20260728 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08` | 0 | `decision: GO`, `activeWorkPackage: R0-W08` | W08 authority | isolated worktree / 20260728 |
| `git diff --check` | 0 | clean | whitespace/conflict marker check | isolated worktree / 20260728 |
| `node scripts/harness-doctor.mjs` | 0 | `project-harness-doctor: 0 errors, 0 warning(s)` | root harness inventory | isolated worktree / 20260728 |
| `pnpm harness:doctor` | 0 | `harness-doctor: 0 errors, 0 warning(s)` | frontend harness inventory | isolated worktree / 20260728 |

## Playwright 证据

| 文件 | SHA-256 |
| --- | --- |
| `frontend/test-results/.last-run.json` | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `frontend/test-results/w08-browser-flow-batch4-W0-c6a6c-one-command-and-stays-READY/w08-batch4-flow8-duplicate-delivery.png` | `fc165d42948752070eab15149cec8e752a8355620aff079a3f05943cfdc0fc0c` |
| `frontend/test-results/w08-browser-flow-batch4-W0-e6882-s-downloadable-after-reload/w08-batch4-flow9-ready-reload.png` | `338b596e499e30f0efceb1b8d7974a87df9401b618637dc4f9f9378cf9e5398d` |
| `frontend/test-results/w08-browser-flow-batch4-W0-91836-y-audit-without-old-actions/w08-batch4-flow10-readonly-archive.png` | `be812cfc1d24abc2077fe7583dd9e9966b1227dc0323e99a8481aa961304fa39` |

## 结果

VERIFIED_PARTIAL。W08 browser flow 从 `7/10` 推进到 `10/10`。

## 未验证项

- 未执行 5 名非开发用户验收。
- 未生成 W08 final closeout。
- 未验证生产；本 Packet 不部署。

## Diff 与回滚复核

- changed files：
  - `frontend/playwright.w08-browser-batch4.config.ts`
  - `frontend/e2e/w08-browser-flow-batch4.spec.ts`
  - `.harness/changes/feat-r0-w08-browser-flow-batch4-20260728/`
- diff review：只新增 test/config/evidence。
- 回滚是否演练：未演练；删除上述文件即可。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| Flow 8 duplicate delivery guard | one POST observed after double click | PASS |
| Flow 9 READY reload readback | enabled PDF/DOCX/JSON buttons | PASS |
| Flow 10 archived read-only replay | Shiguan read-only audit, no old actions | PASS |
| W08 authority | `decision: GO` | PASS |
| root/frontend harness doctor | root/frontend 0/0 | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
