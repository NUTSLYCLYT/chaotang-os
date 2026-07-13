# CI 摘要：docs-launch-blueprint-final-product-shape-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/harness-doctor.mjs`（首次） | 1 | RED：正式奏折前端记录含 3 个非法状态 | ext 累计 harness 契约 | 2026-07-14 本地终端 |
| `node scripts/harness-doctor.mjs`（修复后） | 0 | 0 errors, 0 warnings | 根/前/后三级 harness | 2026-07-14 本地终端 |
| S1 三个 Node 契约测试 | 0 | 18 passed | deploy/service/cron/monitor 真源 | 2026-07-14 本地终端 |
| 上书房/事件账本/正式奏折后端专项 | 0 | 42 passed, 4 warnings | 正式主链累计回归 | 2026-07-14 本地终端 |
| 前端 contract baseline | 0 | 2 passed | API 路径、来源词表 | 2026-07-14 本地终端 |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 | 2026-07-14 本地终端 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | PASS | real-mode 生产构建 | 2026-07-14 本地终端 |
| 发布身份/lifecycle/wrapper tests | 0 | 29 passed | 不可变构建与进程身份回归 | 2026-07-14 本地终端 |
| `ruff check` + `compileall` | 0 | PASS | 本轮 Python 文件 | 2026-07-14 本地终端 |
| `pnpm prod:doctor -- --json` | 2 | 预期 STOP：foreign 3050 + 缺 immutable builds | 生产发布真实性 | 2026-07-14 本地终端 |
| `git diff --check`、敏感信息与冲突标记检查 | 0 | PASS | 候选差异 | 2026-07-14 本地终端 |
| 独立 adversarial blueprint review | 0 | PASS：原 1 BLOCKER + 3 HIGH 已关闭 | 产品单一性、依赖、法域与 S1 事实 | `blueprint_adversarial_review`，2026-07-14 |

## 结果

文档变更本身验证完成；它如实冻结刑部合同工作台并记录生产仍为 STOP。ext 累计业务纵切面专项、类型和构建通过，但完整公开发布仍受 S1-S10 未完成门约束。

## 未验证项

- 未执行真实浏览器合同闭环；本轮没有新增用户可见 UI 行为。
- 未配置外部 trust anchor、未接管 foreign 3050、未生成可信 immutable build。
- 后端完整套件此前仍有 14 个范围外基线失败；本轮只确认目标 42 条回归。
- Alembic CLI 升级、真实备份/恢复和回滚未演练。

## Diff 与回滚复核

- changed files：产品事实源、上线蓝图、本 change record；累计集成另含已登记的上书房事件账本/正式奏折和 harness 成果。
- diff review：空白、Ruff、TypeScript、构建、敏感信息和独立会审通过。
- 回滚是否演练：文档可 revert；数据库迁移未做破坏性降级演练。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 首发产品唯一且客户面清晰 | 产品文档 5.1.1-5.1.3；蓝图 1.4 | PASS |
| S1 状态不夸大 | 蓝图 S1 标记 PARTIAL，完成/硬门分开 | PASS |
| S6/S7/S8 在 S9 前汇合 | 蓝图依赖图与退出条件 | PASS |
| 法域/语言/合同类型 fail closed | 产品 5.1.2、蓝图 S6/S7 | PASS |
| 文档与累计候选可构建 | doctors、42+2+18+29 tests、type/build | PASS |
| 生产 READY | `prod:doctor` STOP | NOT_READY（符合当前事实） |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_COMPLETE`（仅指本产品/计划文档闭环，不代表生产 READY）
