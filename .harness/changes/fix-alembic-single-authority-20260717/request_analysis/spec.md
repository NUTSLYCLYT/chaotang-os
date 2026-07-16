# 规格说明：fix-alembic-single-authority-20260717

## 背景

生产主库同时由 Alembic、`Base.metadata.create_all()`、六个运行时 `ensure_*` 和
`src/tenant.py` 原生 DDL 管理。真实 SQLite 库没有 `alembic_version`，但已包含
大量由运行时创建的表。P4.5 更新 ORM 与 worker 后，常驻旧进程未重启，形成
“新版懒加载 worker + 旧 ORM 类 + 未迁移数据库”的进程内分裂，正式下旨被静默卡死。

本变更把 P5 的第一个检查点定义为 P5-R0：先让未登记旧库可验证地进入 Alembic，
再让生产启动只接受 migration head，最后恢复真实服务与卡单。它不允许以手工补列、
盲 stamp 或继续运行时自愈代替正式迁移。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 真实库没有 `alembic_version`，八张 P4.5 核心表没有 013 `tenant_id`；在线进程从 2026-07-14 起未重启 | `PRAGMA table_info`、systemd PID 962、journal 2026-07-17 01:28:25 | Project Agent，真实运行证据 | 是 |
| 已确认事实 | worker 主异常和异常处理均访问旧 ORM 不存在的 `event.tenant_id`，outbox 留在 `processing/attempts=0` | `backend/src/execution/outbox_worker.py:352,406`；真实 outbox 查询 | Project Agent，真实运行证据 | 是 |
| 已确认事实 | 生产可达 schema 旁路为 1 个 `create_all`、6 个 `ensure_*`、tenant 原生 DDL；专项库另有显式 DDL | `p5-review-baseline.md` v2；调用点 `rg` 盘点 | Project Agent，静态+调用审查 | 是 |
| 已确认事实 | 未登记真实库严格匹配 010 接管契约，唯一缺失的 011 事实表为 `archive_outcome_events` | 接管 CLI `--check` 与两次一致性副本演练 | Project Agent，副本迁移 | 否 |
| 已确认事实 | 真实库满足 011–014 前置条件，迁移后完整性 `ok` 且关键行数保持 17/12/14/32 | 真实停服迁移与迁移后 SQL 核对 | Project Agent，真实运行证据 | 否 |

## 数据流与调用链

`systemd chaotang-api → web.main lifespan → schema authority gate → auth bootstrap → API`

`confirm-edict → transaction(outbox pending) → dispatch_after_commit → worker claim →
swarm/quality/final memorial → status projection`

恢复链：`停服 → SQLite consistent backup/fingerprint → 副本 legacy contract 校验 →
显式 stamp 到已证明 revision → alembic upgrade head → schema head/assertions →
重启 → 审计恢复 processing outbox → 三案 canary`。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| Alembic current/head | `alembic_version` + version scripts | 生产启动门、恢复 CLI、健康诊断 | current 必须唯一且等于唯一 head |
| Legacy adoption contract | P5 代码中的 revision/表列/索引约束 | 未登记旧库接管 CLI | 不满足即 STOP，禁止自动 stamp |
| Schema mode | `FENGQUN_SCHEMA_MODE` | `web.main` lifespan | 默认 strict；仅显式测试模式允许 `create_all` |
| Outbox failure state | `outbox_events.status/attempts/last_error` | 状态读模型、恢复运行器 | 捕获异常后必须提交 failed/dead_letter，不得二次抛错 |

## 范围

- 将 tenant 身份表纳入正式 Alembic 历史。
- 提供未登记旧库的只读检查与显式接管工具。
- 生产启动在 schema 非 head、无版本或多 head 时 fail-fast。
- 测试数据库保留显式隔离 bootstrap，不得被生产配置启用。
- 清除生产启动和业务请求内主库 schema 自愈旁路。
- worker 异常路径即使遇到旧对象/缺列也必须留下失败证据。
- 真实库经备份和副本演练后迁移、重启并恢复卡单。

## 非目标

- 不把专项 memory/RAG/KPI SQLite 合并进主库 Alembic；只登记豁免。
- 不修改前端页面或恢复已退役的前端决策引擎。
- 不改变六部业务判断、模型 prompt 或质量门语义。
- 不盲目回填历史 tenant；013 继续保持 nullable quarantine。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 空数据库 | 从 base 到 head，自包含创建全部主库表 | `.venv-alembic` 集成测试 |
| 已登记旧版本数据库 | `upgrade head` 幂等且数据保留 | 旧 revision fixture |
| 未登记兼容旧库 | 严格 fingerprint 后才允许 stamp+upgrade | 接管集成测试 |
| 未登记不兼容库 | 无写入、明确列出差异并 STOP | 负例测试+文件 hash 不变 |
| strict 启动遇到非 head/无版本 | 进程启动失败，不创建/修改 schema | lifespan/纯函数测试 |
| test bootstrap | 仅隔离内存/测试路径允许 `create_all` | 负例防生产误用 |
| worker 主异常 | attempts+1，记录 last_error，状态 failed/dead_letter | 回归测试 |
| worker 异常记录器也失败 | 最小 outbox failure 仍提交，线程不把事件留在 processing | 回归测试 |

## 风险与回滚边界

- 真实 SQLite 操作前必须停止 API 并生成包含 WAL 的一致备份，记录 SHA-256。
- 接管工具默认 `--check` 只读；写入必须显式 `--apply --backup PATH`，备份文件拒绝覆盖。
- 副本演练失败时不触碰真实库。
- 迁移或重启失败时停止服务，恢复备份及 WAL/SHM 边界，禁止继续接单。
- 代码回滚不得在已升级数据库上直接降级运行；先演练 Alembic downgrade 或 forward-fix。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-17
- 批准范围：用户在收到真实卡单根因、备份/副本演练/迁移/重启/三案方案后明确要求“系统的解决”；纳入现有 P5 单线执行。
- 明确未批准：删除真实数据、默认 tenant 历史回填、修改前端、大殿冻结边界、跳过备份或独立审查。

## 验收标准

1. 生产主库 schema 写权只属于 Alembic；主库运行时 DDL 旁路为零。
2. 未登记旧库接管有严格正反例，失败零写入。
3. strict 启动只接受唯一 Alembic head，并在日志/健康证据中报告 revision。
4. worker 任意异常都不再把事件永久留在 `processing/attempts=0`。
5. 空库、已登记旧库、未登记真实库副本三条 upgrade 路径通过。
6. 真实库有迁移前备份/hash、迁移后 head、服务新 PID 和卡单恢复证据。
7. 低风险、缺证、高风险三案分别满足正式奏折、补证阻断、人工确认预期。

## 验证计划

RED→GREEN 定向测试；Alembic 双/三起点集成；后端正式下旨代表套件；后端、前端、
根 doctor；Python 编译/静态检查；真实库副本 hash/row-count/schema diff；迁移后 HTTP
健康、运行身份和三案 trace。全量基线只允许既有失败，任何新增失败阻断收口。
