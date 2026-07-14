# 规格说明：test-sqlalchemy-production-db-tripwire-20260714

## 背景

历史测试曾污染 `backend/data/fengqun.db`。现有 `isolated_session_local` 是 opt-in；未声明它的 API 测试仍可调用默认 `src.db.engine.SessionLocal`。仅在测试后比较 DB hash 只能发现事故，不能在连接前阻断。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 修复前默认 `SessionLocal()` 可构造且绑定真实 `data/fengqun.db` | `test_production_db_tripwire.py` 两轮有效 RED | pytest | 是 |
| 已确认事实 | autouse 阻断后 5 个既有 API 测试明确命中新门 | full pytest + 5 项 focused RED | pytest stack | 是 |
| 已确认事实 | 5 项迁移到 `isolated_session_local` 后全绿；主链 + tripwire 44 passed | focused pytest | pytest | 否 |
| 已确认事实 | 完整套件运行后真实 DB hash/size/mtime 未变化 | `10dbcf...59e2` / `2121728` / `1783863664` | 前后快照 | 否 |
| 推测 | 无 | 不适用 | 不脑补 | 否 |
| 未知问题 | legacy sqlite3、Node/E2E 是否仍可打开真实路径 | 本轮未覆盖 | 后续 S2.3b/S2.3c | 是 |

## 数据流与调用链

`pytest bootstrap -> conftest 强制 DB_URL=:memory: -> test collection/import -> autouse blocked SessionLocal -> 显式 isolated_session_local 覆盖为 StaticPool memory factory -> API/业务测试 -> teardown drop/dispose -> 默认 factory 恢复但进程退出`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| pytest SQLAlchemy URL | `backend/tests/conftest.py` | `src.db.engine` import-time config | 强制 `sqlite:///:memory:`，不尊重外部生产 DB_URL |
| 默认 Session factory | autouse `_block_default_session_local` | 所有 pytest | 调用即 RuntimeError |
| 允许的 DB factory | `isolated_session_local` 或测试显式临时 factory | 需要数据库的测试 | 必须是内存或临时路径 |

## 范围

pytest SQLAlchemy 双层 tripwire、回归测试、5 个命中 API 测试迁移、计划与证据。

## 非目标

不覆盖 `src.tenant` sqlite3、裸 `sqlite3.connect`、Node/E2E；不修 12 个已在 HEAD 基线复现的非 DB 失败；不修改生产 DB/runtime 代码。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 默认 SessionLocal 调用 | 连接前 RuntimeError | tripwire test |
| collection-time 旧 SessionLocal alias | 只可能绑定内存 DB | engine URL test |
| 显式 isolated fixture | 可创建表、读写并在结束时销毁 | tripwire + API/mainline tests |
| 未迁移数据库测试 | 明确失败并指出隔离方法 | full suite initial evidence |
| 真实 DB | hash/size/mtime 不变 | 前后快照 |

## 风险与回滚边界

风险是全局 conftest 造成大面积误伤；通过完整套件识别命中项，只迁移明确需要 DB 的 5 项，不建立 bypass allowlist。回滚仅恢复 conftest/test/docs，不触碰数据。

## 计划确认记录

- 批准人：用户（“下一步”）
- 批准日期：2026-07-14
- 批准范围：S2.3a pytest SQLAlchemy tripwire
- 明确未批准：legacy sqlite3、Node/E2E、生产代码/数据库操作、顺手修非 DB 基线失败

## 验收标准

有效 RED；tripwire/5 个命中/正式主链 GREEN；完整套件无新增 tripwire 失败；真实 DB 三元不变；doctor/compile/diff/security 通过。

## 验证计划

tripwire focused、5 个命中项、正式主链、完整 pytest、HEAD baseline 子集、DB 前后快照、compile、doctor、scoped scan。
