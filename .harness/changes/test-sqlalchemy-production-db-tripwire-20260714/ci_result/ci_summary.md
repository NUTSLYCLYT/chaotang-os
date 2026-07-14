# CI 摘要：test-sqlalchemy-production-db-tripwire-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| tripwire test（实现前，错误 import） | 1 | 无效 RED：拿到 Engine 对象 | 测试自身错误，不计行为证据 | 2026-07-14 终端 |
| tripwire test（修正 import 后） | 1 | RED：默认 SessionLocal 未阻断 | runtime factory | 2026-07-14 终端 |
| engine URL test（实现前） | 1 | RED：绑定真实 `data/fengqun.db` | collection-time alias | 2026-07-14 终端 |
| tripwire + 正式主链 | 0 | 44 passed，2 warnings | tripwire/任务/事件/outbox/奏折/裁决/归档 | 2026-07-14 终端 |
| 5 个新门命中 API test（迁移前） | 1 | 5 failed，均为 tripwire | 未声明隔离 Session | 2026-07-14 终端 |
| 同 5 项迁移后 | 0 | 5 passed | 显式 `isolated_session_local` | 2026-07-14 终端 |
| 完整 backend pytest（迁移前） | 1 | 2471 passed / 18 failed / 27 skipped / 12 xfailed | 初次全仓冲击面 | 214.50s |
| HEAD 导出非 DB 失败子集 | 1 | 12 failed / 1 passed | 基线归因 | 2026-07-14 `/tmp` archive |
| 完整 backend pytest（迁移后） | 1 | 2479 passed / 13 failed / 27 skipped / 9 xfailed；无 tripwire failure | 全仓回归 | 262.64s |
| 真实 DB 前后快照 | 0 | hash/size/mtime 完全不变 | 无生产 DB 污染 | 2026-07-14 终端 |

## 结果

- S2.3a SQLAlchemy pytest tripwire `VERIFIED_COMPLETE`：collection-time alias 最差只绑定内存 DB，runtime 默认 Session factory 连接前 fail closed。
- 新门引入的 5 个失败已全部迁移并 GREEN；最终完整失败清单无 tripwire failure。
- 真实 DB 保持 `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`、size `2121728`、mtime `1783863664`。

## 未验证项

- 最终全套仍有 13 个非 tripwire 失败：12 个在 HEAD 导出复现（sqlite_vec/缺文档/法律 RAG/persona/FakeApiOrchestrator）；钦天 1 项因本机 `.env` 返回 LIVE 而测试固定期待 FALLBACK。它们必须独立 TDD 收口。
- legacy `src.tenant` sqlite3、裸 `sqlite3.connect`、Node/E2E production path 尚未阻断。
- ruff 未安装；前端 build/type/browser 对测试基础设施变更不适用。

## Diff 与回滚复核

- changed files：backend conftest、tripwire test、5 个 API tests、root change、launch blueprint。
- diff review：只改 pytest 环境/fixture 声明；生产代码、DB 和服务均无改动；无 bypass allowlist。
- 回滚是否演练：未部署；单提交可反向回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 有效 RED | 默认 factory 未阻断；engine URL 指向真实库 | PASS |
| import-time 安全 | engine URL 固定 `sqlite:///:memory:` | PASS |
| runtime fail closed | 默认 SessionLocal 抛 tripwire | PASS |
| 显式隔离仍可用 | tripwire test + 5 migrated tests | PASS |
| 正式业务主链 | 44 passed（含 3 tripwire tests） | PASS |
| 完整套件无新增 tripwire failure | 2479 passed / 13 baseline-env failures | PASS |
| 真实 DB 不变 | hash/size/mtime 三元一致 | PASS |
| Python 全路径（含 legacy sqlite3） | 未完成 | NOT VERIFIED |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 S2.3a pytest SQLAlchemy tripwire；S2 全阶段与生产发布仍未完成。
