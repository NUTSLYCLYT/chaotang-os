# CI 摘要：fix-decision-task-single-writer-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q ...`（9 个朝堂专项文件） | 0 | 65 passed | 创建、权限、路由、账本、奏折、Outbox | 2026-07-14 本地候选 |
| `node --test scripts/capability-entry-governance.nodetest.mjs` | 0 | 3 passed | 唯一 canonical 与清单治理 | 2026-07-14 本地候选 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根、前端、后端 Harness | 2026-07-14 本地候选 |

## 结果

结构性 RED 先发现四个旁路；迁移后结构门与行为门全绿。

## 未验证项

- 未运行全量后端 2400+ 测试、前端构建、浏览器 E2E、staging 黄金旨意。
- 当前环境未安装 Ruff；使用 Python 导入/pytest 和 `git diff --check` 代替本轮语法与差异检查。

## Diff 与回滚复核

- changed files：创建内核、上书房路由、结构测试、能力清单和本 change 记录。
- diff review：无 API/schema 变化，无环境、数据或凭据文件。
- 回滚是否演练：未执行 destructive 回滚；变更可用单提交 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 唯一运行时构造 owner | AST 结构门 | PASS |
| 既有接口不回归 | 65 项 pytest | PASS |
| 根级清单合法 | 3 项治理 + doctor | PASS |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL
