# 规格说明：test-tenant-sqlite-production-db-tripwire-20260714

## 背景

S2.3a 只保护 SQLAlchemy `src.db.engine.SessionLocal`。认证、邀请和租户解析仍由
`src.tenant` 直接调用 `sqlite3.connect(DB_PATH)`，而 `DB_PATH` 在导入时硬编码为
`backend/data/fengqun.db`。因此 pytest 即使 SQLAlchemy 已隔离，仍可能通过 legacy
租户入口污染真实库。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 实现前 `src.tenant.DB_PATH` 与真实库路径相同 | `backend/tests/test_production_db_tripwire.py` 有效 RED | pytest / Project Agent | 是 |
| 已确认事实 | 实现前把 `DB_PATH` 指回真实库会到达 `sqlite3.connect` | 同一 RED 中连接替身被调用，未实际打开真实库 | pytest / Project Agent | 是 |
| 已确认事实 | `tenant.py` 是认证、邀请、管理员初始化和租户解析的 legacy sqlite3 入口 | `backend/src/tenant.py:112`、`:170` 及其 CRUD 调用 | 代码审查 / Project Agent | 是 |
| 已确认事实 | 部分专项测试已手动 monkeypatch `tenant.DB_PATH`，但不是全局导入时保护 | `backend/tests/test_auth_invite.py:19`、`test_register_no_enumeration.py:19`、`test_ensure_admin_no_default_password.py:17` | 代码审查 | 否 |
| 推测 | 只在 fixture setup 阶段 monkeypatch 路径仍可能漏掉 collection-time alias | 根据 Python import 绑定语义推测；未构造仓内实际 alias 事故 | 架构推理 | 否 |
| 未知问题 | 仓内其他裸 `sqlite3.connect` 是否仍会直接打开真实库 | 本轮明确不做通用 sqlite3 monkeypatch | 后续 S2.3c | 是 |
| 未知问题 | Node/E2E/脚本是否会打开真实库 | 不在 pytest `conftest.py` 边界内 | 后续 S2.3c | 是 |

## 数据流与调用链

测试进程启动 → `backend/tests/conftest.py` 在收集测试模块前创建进程唯一临时目录 →
写入 `FENGQUN_DB_PATH=<tmp>/fengqun.db` 与 `FENGQUN_TEST_DB_GUARD=1` →
首次导入 `src.tenant` 时生成 `DB_PATH` → auth/tenant 函数调用 `get_db()` → `_get_db()`
先比较 `DB_PATH.resolve()` 与 `DEFAULT_DB_PATH.resolve()` → 若测试门开启且命中真实路径，
在连接前抛 `RuntimeError`；否则才创建父目录、调用 `sqlite3.connect`、初始化 tenants/users/invites。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `FENGQUN_DB_PATH` 文件路径 | 运行环境；默认事实源为 `DEFAULT_DB_PATH` | `src.tenant` | 未设置时生产默认行为不变；pytest 在 import 前设置绝对临时路径 |
| `FENGQUN_TEST_DB_GUARD=1` | pytest 根 fixture | `src.tenant._get_db` | 仅测试安全门；命中默认真实路径时连接前 fail closed |
| tenants/users/invites SQLite schema | `src.tenant._get_db` | auth、invite、tenant CRUD | 31 项聚焦组合测试验证临时文件仍可正常初始化和使用 |

## 范围

- pytest 收集前隔离 `src.tenant` 默认数据库路径。
- 连接时拒绝测试环境回退到真实默认路径。
- 保持未设置新环境变量时的生产默认路径兼容。

## 非目标

- 不统一 SQLAlchemy 与 legacy sqlite3 数据访问层。
- 不拦截任意模块的裸 `sqlite3.connect`。
- 不修改真实数据库、不迁移 schema、不处理 Node/E2E/运维脚本。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| pytest 正常导入 `src.tenant` | 绑定进程唯一临时 sqlite 文件 | `test_tenant_db_is_bound_to_ephemeral_database` |
| 测试把 `DB_PATH` 改回真实默认路径 | 在 `sqlite3.connect` 前抛 tripwire | `test_tenant_db_guard_rejects_production_path_before_connect` |
| 专项测试自行 monkeypatch 到 `tmp_path` | 继续允许连接并完成业务断言 | 31 项租户/认证组合测试 |
| 非 pytest 且未设置两个环境变量 | 继续使用 `backend/data/fengqun.db` | 默认值代码审查；本轮未启动生产服务 |
| 路径经 `..` 或符号链接指向真实库 | `resolve()` 后仍被拒绝 | 代码审查；未增加独立符号链接测试 |

## 风险与回滚边界

风险是新的 `FENGQUN_DB_PATH` 配置可改变 legacy 租户库位置；当前 pytest 使用绝对临时路径，
生产未配置时行为不变。回滚为同时撤销 `tenant.py` 配置/门禁和 conftest/test 变更；不涉及
schema、真实数据或部署回滚。

## 计划确认记录

- 批准人：用户（连续“下一步”，并明确要求每个旧路径 RED→GREEN 与 verification-loop）
- 批准日期：2026-07-14
- 批准范围：一次只完成 S2.3b legacy tenant sqlite3 最小闭环
- 明确未批准：S2.3c 通用裸 sqlite3/Node/E2E 门、部署和真实数据库变更

## 验收标准

- 至少一条有效 RED 证明旧实现不安全，且 RED 不打开真实库。
- pytest 导入时 `tenant.DB_PATH` 不是真实默认路径。
- 测试环境即使把路径改回真实库也在连接前失败。
- 租户/认证相关测试可使用临时 sqlite 正常通过。
- 完整 backend 回归无新增 tripwire 失败，真实 DB 三元证据不变。

## 验证计划

先跑 tripwire RED/GREEN，再跑租户/认证组合测试，最后跑完整 backend pytest；测试前后记录
`backend/data/fengqun.db` 的 SHA-256、size、mtime，并运行后端与根 harness doctor。
