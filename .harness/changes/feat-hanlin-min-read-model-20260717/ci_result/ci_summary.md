# CI 摘要：feat-hanlin-min-read-model-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `cd backend && python3 -m pytest -q tests/test_hanlin.py tests/test_hanlin_truth_source.py` | 0 | 13 passed | 权限、正常/空/损坏/非确定性账本 | 2026-07-17 19:57 CST |
| `cd frontend && pnpm test:node` | 0 | 1048 passed | 全前端 node 回归（含 P9 7 tests） | 2026-07-17 19:57 CST |
| `cd frontend && pnpm exec tsc --noEmit` | 0 | PASS | TS 契约与所有迁移调用方 | 2026-07-17 19:57 CST |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根项目结构与 change | 2026-07-17 19:54 CST |
| `cd frontend && pnpm harness:doctor` | 0 | 0 errors / 0 warnings | 前端护栏 | 2026-07-17 19:54 CST |
| `cd backend && python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端护栏 | 2026-07-17 19:54 CST |
| `git diff --check` + P9 mock/bare-fetch `rg` | 0 | PASS / zero matches | diff 卫生、mock 与认证旁路回流 | 2026-07-17 19:54 CST |
| Playwright CLI `p9hanlin-final` | 0 | PASS | 真账本、只读实验、FALLBACK、Bearer、rankings 兼容 | `e2e_test/e2e_summary.md` |

## 结果

P9 候选验证通过，状态为 `VERIFIED_COMPLETE_FOR_CANDIDATE`。独立外部审查尚未执行，
因此不声明 Packet GO，也不合入 ext。

## 未验证项

- 整个 backend pytest 未运行；改动由 Hanlin 13-test 聚焦套件覆盖。
- 浏览器 admin 使用 dependency override，未跑真实登录签发旅程；真实 user/anonymous 拒绝由 FastAPI 集成测试覆盖。
- 页面壳层 `/api/chaotang/tasks` 对夹具 token 的 401 是范围外已知噪音，见 E2E 摘要。

## Diff 与回滚复核

- changed files：P9 实现 19 个（含 3 个新前端测试/模型文件），另有本 change 证据文件。
- diff review：`233 insertions / 645 deletions`（不含未跟踪新文件和 change 文档）；`git diff --check` 通过。
- 回滚是否演练：未执行代码回滚；无 schema/data 变化，删除 mock 可从 Git 恢复。权限不得回滚为匿名。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| admin/user/anonymous 权限 | 13 backend tests | PASS |
| 正常/空/损坏/非确定性来源 | backend + frontend tests | PASS |
| 一条真源线端到端 | browser API/UI 对照 | PASS |
| mock 生产路径不可达 | 文件删除、静态样例退役、rg | PASS |
| 现有消费者不因权限收紧回归 | transport static gate + rankings browser | PASS |
| 三层护栏健康 | root/frontend/backend doctor | PASS |
| 独立审查 GO | 尚未执行 | PENDING |

## 声明状态

- `VERIFIED_COMPLETE_FOR_CANDIDATE / EXTERNAL_REVIEW_PENDING`
