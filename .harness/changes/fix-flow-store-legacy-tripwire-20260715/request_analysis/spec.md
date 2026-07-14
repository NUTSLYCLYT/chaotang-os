# 规格说明：fix-flow-store-legacy-tripwire-20260715

## 背景

P2 关闭 Decree/Task/Memorial/Review/Retrospective 的旧写主线，并为 P3/P4 提供可观测、可撤回的迁移护栏。当前 `flow_store.py` 的 7 个写入口无调用方身份校验，`chaotang_store.py` 仍做 JSON+SQLite 双写；`governance_compat.py` 还保有进程内 `_BILLS` 与一套被真实 IMA 路由遮蔽的 `_IMA_DOCS`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 7 个 legacy SQL 写入口有路由、编排器、回填脚本调用 | `rg` 全仓调用点，2026-07-15 | P2 owner / AST 守门 | 是 |
| 已确认事实 | IMA 已有先注册的真实持久化路由，compat 的 GET/PATCH 为重复死实现 | `web/main.py:323,332`、`web/routers/ima_knowledge.py` | 路由表测试 | 否 |
| 已确认事实 | governance bills 有前端在线调用，不能直接退役 | `frontend/src/features/governance/components/bills-board.tsx` | 契约+重载测试 | 是 |
| 已确认事实 | 前端 P4 本地决策引擎仍有生产调用 | `rg ministry-review-loop... frontend/src` | 精确白名单守门 | 否，冻结新增 |

## 数据流与调用链

生产调用方显式携带 `legacy_writer_id` → tripwire 校验 writer/operation → 允许时进入旧表写入；未知、缺失或越权 operation 在任何 mutation 前抛错。每次允许/拒绝/rollback-bypass 均复用 Prometheus exporter 与 production event log。

governance bills → `DecisionTask(decision_type=governance_compat_bill)` 兼容适配器 → bill JSON 投影；IMA compat 重复路由移除，由既有 `ima_knowledge` 路由独占事实源。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| legacy writer registry | `src/legacy_write_tripwire.py` | flow_store / chaotang_store | 未注册 fail-closed；全局开关可回滚 |
| governance bill | `decision_tasks` | governance compat API / bills UI | 复用既有表，不新增存储 |
| IMA knowledge | `src/ima_knowledge_store.py` | shiguan / shangshufang UI | 删除重复 compat 路由，接口形状由真实路由保持 |
| telemetry | `metrics_exporter` + production event log | `/metrics` / 运维证据 | 不新增存储机制 |

## 范围

- runtime tripwire、调用白名单与 rollback 开关；
- governance 内存状态处置；
- canonical/legacy 计数；
- 前后端常驻依赖守门及阳性违规样例。

## 非目标

- 不吸收 P3 的旧端点，不拆 daemon/outbox 链；
- 不下沉 P4 前端状态机；
- 不修改冻结的 throne 边界；
- 不新增数据库表或迁移。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| writer id 缺失/未知/无该 operation 权限 | mutation 前抛 RuntimeError | tripwire tests |
| tripwire 开关关闭 | 临时允许并记录 bypass | rollback test |
| 模块/进程重载 | governance bill 仍可读 | isolated DB reload test |
| 新增越界 import | 架构测试失败 | 前后端负向 fixture |

## 风险与回滚边界

风险：一次性收紧会暴露漏登记调用方；通过精确白名单和 targeted/full regression 发现。回滚：仅把 `FENGQUN_LEGACY_WRITE_TRIPWIRE=0` 作为临时止血，计数仍保留；计数和架构守门可独立 revert。禁止以扩大通配白名单解决回归。

## 计划确认记录

- 批准人：用户（“继续任务”，承接 absorption P0–P9 单线裁决）
- 批准日期：2026-07-15
- 批准范围：P2 frozen plan
- 明确未批准：P3/P4 实质吸收、push、release 分支改动

## 验收标准

- 未注册 legacy writer 必须抛错且零 mutation；白名单落盘；rollback 开关有测试。
- governance `_BILLS/_IMA_DOCS` 不再是事实源。
- canonical 与 legacy 指标可从 exporter 读到非零/零证据。
- 前后端架构守门常驻，违规 fixture 必须失败。

## 验证计划

先运行新增测试取得 RED；实现后运行 P2 targeted pytest、前端 nodetest/tsc、相关既有回归、三层 doctor、diff check，并记录真实数据库 hash 前后不变。
