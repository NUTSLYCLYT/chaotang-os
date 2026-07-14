# CI 摘要：fix-flow-store-legacy-tripwire-20260715

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 新增 P2 pytest（首次） | 2/1 | RED：模块不存在、行为断言失败 | tripwire、governance、metrics、架构守门 | 2026-07-15 本地 worktree |
| `python3 -m pytest -q`（20 个受影响专项） | 0 | 178 passed | writer、治理、outbox、final memorial、decree ledger、旧闭环契约 | 2026-07-15 |
| `tsc --noEmit -p tsconfig.json`（复用主仓已安装依赖） | 0 | 0 errors | 前端类型 | 2026-07-15 |
| `tsx --test src/lib/architecture-import-guard.nodetest.ts` | 0 | 5 passed | 当前白名单、attic side-effect import、跨引擎新增负例 | 2026-07-15 |
| `pnpm test:node` | 1 | 1013 pass / 7 baseline fail | 完整前端 nodetest | 2026-07-15 |
| `uvx ruff check` + `ruff format --check`（8 个新增/核心 P2 文件） | 0 | all checks passed / formatted | Python 新增代码 | 2026-07-15 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根、前端、后端三层 harness | 2026-07-15 |
| metrics 独立进程读取 | 0 | canonical 三阶段 `0.0`；未知 writer `blocked_unregistered=1.0` | 零/非零观测证据 | 2026-07-15 |
| `git diff --check` | 0 | clean | whitespace/diff | 2026-07-15 |

## 结果

P2 新增测试均按 TDD 取得有效 RED 后转绿。受影响后端专项、TypeScript、常驻架构守门、三层 doctor 与 diff 均通过。完整前端 nodetest 仅保留 campaign 基线中的同一组 7 个失败；新增 5 项架构守门均通过。

前端仓当前没有 ESLint 依赖/配置，未为单条规则引入新的依赖链；采用进入既有 `test:node` profile 的 Node 静态 import gate，实现 `no-restricted-imports` 等价行为，并额外覆盖 side-effect import 与“已允许文件新增另一引擎”负例。

## 未验证项

- 按 frozen campaign 约束未运行无选择的完整 backend pytest；改跑覆盖全部 P2 触点的 20 文件、178 项专项。
- 未跑真实 provider、浏览器或生产发布命令；P2 不改变页面交互，接口契约由 pytest 覆盖。
- 前端完整 nodetest 的 7 项既有失败未在 P2 越界修复。

## Diff 与回滚复核

- changed files：runtime registry/telemetry/governance adapter、调用点、前后端架构守门、测试与 change 证据。
- diff review：确认无 P3 端点吸收、无 P4 状态机下沉、无新表/迁移、无 release 改动；测试生成 IMA 文件已清理。
- 回滚是否演练：`FENGQUN_LEGACY_WRITE_TRIPWIRE=0` 专项通过并产生 `rollback_bypass`；未在共享生产进程切开关。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 未注册 writer mutation 前失败 | missing/unknown tests，零 DB/JSON 文件 | PASS |
| 白名单与回滚 | `legacy-writer-allowlist.md` + rollback test | PASS |
| governance 内存事实源处置 | module reload persistence、collision、IMA route retirement tests | PASS |
| canonical/legacy 指标 | commit/rollback/idempotency tests + 独立 zero/nonzero 输出 | PASS |
| 架构守门与违规 fixture | backend 3 项、frontend 5 项；完整 profiles 收录 | PASS |
| 既有契约不回归 | 178 backend + 1013 frontend pass；7 baseline retained | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_COMPLETE`
