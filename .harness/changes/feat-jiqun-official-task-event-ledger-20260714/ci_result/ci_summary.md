# CI 摘要：feat-jiqun-official-task-event-ledger-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_decree_event_ledger.py`（首次） | 1 | RED：3 个预期失败，缺少结构化事件参数 | 事件信封、幂等、自愈 | 本地终端，2026-07-14 |
| 同命令（接入 worker 前） | 1 | RED：2 个预期失败，缺少主链质量事件 | worker 状态转换 | 本地终端，2026-07-14 |
| 同命令（接入 confirm-edict 前） | 1 | RED：1 个预期失败，缺少路由事件 | 正式路由转换 | 本地终端，2026-07-14 |
| `python3 -m pytest -q tests/test_decree_event_ledger.py`（最终） | 0 | 6 passed | 结构化事件、幂等冲突、自愈、路由、worker 质量门 | 本地终端，2026-07-14 |
| `python3 -m pytest -q`（11 个主链相关测试文件） | 0 | PASS | 丞相路由、outbox、swarm、奏折、双写回归 | 本地终端，2026-07-14 |
| `python3 -m compileall -q src web tests` | 0 | PASS | Python 语法/字节码编译 | 本地终端，2026-07-14 |
| `ruff check`（本次改动文件；尚书房忽略两个既有文件级规则） | 0 | PASS | 新增与变更代码静态检查 | 本地终端，2026-07-14 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根、前端、后端 Harness 完整性 | 本地终端，2026-07-14 |
| `git diff --check -- <本次文件>` | 0 | PASS | 空白与补丁完整性 | 本地终端，2026-07-14 |
| 后端完整 `python3 -m pytest -q` | 1 | 2453 passed, 27 skipped, 14 failed | 全量回归观察 | 本地终端，2026-07-14 |

## 结果

专项闭环为 GREEN。事件账本保持旧 timeline 字段兼容，并增加事件类型、trace、来源等级、JSON 载荷与幂等键；关键正式主链状态转换已落账。完整套件的 14 个失败不位于本次事件账本或正式主链测试，涉及 `sqlite_vec`/taxonomy 资源缺失、律师 RAG、persona、实时服务输出，以及既有 FakeApiOrchestrator 契约漂移。

## 未验证项

- 当前 Python 环境未安装可执行的 Alembic CLI，因此未实际执行 `alembic upgrade head`；迁移文件已通过编译，旧表升级由隔离 SQLite self-heal 集成测试覆盖。
- 尚未建立并运行 30 条黄金旨意发布门；本变更只完成第一纵切面。
- 未执行生产环境部署、重启、真实客户数据写入或真实模型高成本评测。
- 未单独运行类型检查器；项目当前验证矩阵以运行时契约测试和 Ruff 为本纵切面证据。

## Diff 与回滚复核

- changed files：事件模型、迁移、自愈、状态契约、confirm-edict、outbox worker、专项测试与本变更档案。
- diff review：`git diff --check`、Ruff、敏感字面量扫描均通过；保留工作树内其他用户改动。
- 回滚是否演练：未对数据库做破坏性演练。代码可逐调用点回滚；新增可空/有默认值的列可保留，不要求删列。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| RED→GREEN 可审计 | 3 轮能力缺失型 RED，最终专项 6 passed | PASS |
| 结构化事件可重放且兼容旧 timeline | 专项模型/状态与 legacy self-heal 测试 | PASS |
| 幂等重放不重复、冲突 fail closed | `test_decree_event_ledger.py` | PASS |
| 正式主链关键转换落账 | 路由与 worker 专项测试 | PASS |
| 目标回归、doctor、diff review | 目标回归 exit 0；doctor 0/0；diff check exit 0 | PASS |
| 完整发布验证 | 全量套件 14 个范围外失败；30 黄金旨意未建立 | PARTIAL |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL`
