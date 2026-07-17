# 板块主线归并审查（2026-07-14，Claude Code 只读审查）

> 问题：所有板块是否需要合并成一条主线，或吸收成一条主线？
> 方法：三个并行只读侦查（后端主线/前端消费线/重复实现地图），证据 file:line 见各节。
> 本文是 FULL_COURT_V1 Wave 0 的先行证据，不替代 Codex census。

## P7 状态回填（2026-07-17）

本表只更新 Wave 0 原审查对象的处置状态。`DONE` 表示已由后续 Packet 的机器证据闭环；
`DEFERRED` 表示仍有明确 owner/Wave；`PARTIAL` 不得被解释为已完成。完整数值与未验证项见
`../docs-absorption-closeout-20260717/kpi-reconciliation.md` 和 `deferred-register.md`。

| 原审查对象 | P7 状态 | 证据 / 后续归属 |
| --- | --- | --- |
| chaotang daemon/store/flow-store legacy 链 | PARTIAL | P3 已清零默认 production writer 授权、默认关闭 daemon；10 个 rollback/test 写定义、legacy reads 和物理 daemon 仍在，且无连续流量归零窗口；Wave 5 前另立退役 change |
| 前端五个本地二级裁决引擎 | DONE（生产可达性）/ DEFERRED（物理壳） | P4 production import graph=0，正式页面只投影 court read model；5 个 test/eval-only 定义待 2026-08-16/Wave 8 复核 |
| 部级前端脑（工/御/刑/锦衣卫） | DEFERRED | P4 仅做 SHADOW/FALLBACK 与正式结论隔离；后端化归 Wave 3 |
| 旧链前端调用（庄园/御座/军机处） | PARTIAL | 军机处 task/stream 已投 canonical；庄园去留需用户裁决，冻结王座与历史 GET 仍属显式边界；Wave 6 |
| `court_state_store.py` JSON 状态 | DEFERRED | 未在 P0–P7 获得独立吸收证据；归 Wave 1/5 状态与恢复权威收敛 |
| `governance_compat.py` 内存 dict | DONE | P2 `governance_compat_store.py` 复用 `DecisionTask`，重复 IMA compat route 已退役 |
| `swarm_orchestrator.py` | DEFERRED（原“孤儿”判断被证伪） | P6 审计发现仍有 canonical/platform runtime 调用，禁止按死码删除；需先迁调用方和恢复契约 |
| 前端 governance 三省孤儿簇 | DONE | P6 归档 `court-pipeline`、`three-chamber-engine`、`deliberation-console`，production import guard 永久覆盖 |
| qintian mock router 二件 | DEFERRED | P6 capability-entry 删除门要求 14 天零调用；证据窗口未满足 |
| `flow_opc.yaml.bak` | DONE_AS_NOT_PRESENT | P6 基线确认 tracked 文件不存在，不制造删除提交 |
| `retired_standalone_swarms/*` | DONE（保持归档） | 按原裁决不恢复 production |
| 部门 ID / AgentCode 多副本 | DONE | P1 后端 `departments.yaml` + 前端 `dept.ts` 双 SSOT，双端 grep/parity 守门 |
| 迁移权威 | DONE | P5 Alembic strict-head + adoption；运行时 schema DDL 清零，后续 P5.1/P5.2 字面量守门已 GO |
| Prompt 三体系 | DEFERRED | Wave 1–2，建立版本事实源与 adapter；当前不得宣称收敛 |
| OpenAPI / TS 契约三角 | DEFERRED | Wave 1–2，live OpenAPI codegen + drift CI |
| root/frontend 双份 runner | DEFERRED | 不属 P0–P7 实施范围；Wave 8 delivery hygiene |
| `jiqun_ai` 平台、三层 harness | DONE（保持正交） | 未吸入 DecisionTask 主线，边界继续由 project/backend/frontend harness 守门 |
| 国力断头板块 | DEFERRED / P8 NOT_STARTED | P8 薄纵切尚无 change、browser 或 Claude GO |
| 翰林断头板块 | PARTIAL / P9 NOT_GO | P0 前 uplift 已挂载部分真读模型，但无 P9 顶层 change、残段核销和 Claude GO |
| 庄园产品去留 | DEFERRED | 用户裁决后归 Wave 6 |

P7 候选时 Packet 门为 7/10 GO+merged；P7 自身 GO+merge 后最多 8/10。P8/P9 与
流量/LOC 硬门未闭环，因此 campaign 终态只能是 `PARTIAL`。

## 总裁决

**不是"合并成一条"，是"一条已存在的 canonical 主线 + 吸收 + 退役 + 两块正交区"。**

canonical 决策主线已经成形且唯一候选明确：

```text
shangshufang.py（入口）
→ decision_task_kernel.create_decision_task（唯一任务工厂）
→ chancellor/routing_service（唯一路由）
→ outbox_events → outbox_worker → swarm_execution_loop → swarm_persistence
→ CourtReview → FinalMemorial → EmperorDecision → ShiguanArchive
```

问题不是缺主线，是主线旁边还挂着：一条完整 legacy 链、一套前端本地二级状态机、约 7+ 份部门注册表、三条建表路径。处置分四类：

## 一、吸收进主线（adapter 化或下沉后端）

| 对象 | 现状 | 吸收方式 |
| --- | --- | --- |
| `backend/web/routers/chaotang.py` daemon 链（:221,:1084）+ `src/chaotang_orchestrator.py` + `src/chaotang_store.py` 双写 + `src/db/flow_store.py:544-908` 五张 legacy 表 | 仍挂载、前端可调、双写 JSON+SQLite、双读（throne/scribe） | **最大未收编块。** memorial_review 已示范改写 canonical `EmperorDecision`（chaotang.py:788），其余端点同法逐个吸收；flow_store legacy 写纳入 `legacy_write_tripwire` |
| 前端本地二级状态机：`core/courtos/ministries/{ministry-review-loop,yushitai-auditor,imperial-report-synthesizer,red-blue-loop}.ts` + `unified/unified-decision-loop.ts` | **仍活跃**于上书房（ShangshufangPage.tsx:1526-1549）和军机处（junjichu/page.tsx:380-406）：读后端真状态后本地重算六部会审/御史审核/综合报告/圣裁，标 MIXED/DEMO | 违反"前端不得第二状态机"铁律。结论生成下沉后端，前端只投影；诚实标已在但不够 |
| 部级前端脑：工部（纯本地引擎、无后端投影）、御史（纯本地合成）、刑部 clause 本地扫描（lib/swarm/clause-*）、锦衣卫本地雷达（lead-radar/tender-radar/competitive-edge） | 前端合成业务结论 | 后端化为对应部门 agent 输出，前端投影 |
| 旧链前端调用：庄园 `chaotang.manor*`、御座 `/api/chaotang/throne/*`、军机处 `chaotang.taskDetail`+SSE stream | 走遗留 chaotang 路由族 | 改接 canonical（swarm-runs 事件/court 投影） |
| `src/court_state_store.py` JSON 状态 | 第三状态源 | 并入 DecisionTask.status 投影 |
| `governance_compat.py` `_BILLS/_IMA_DOCS` 内存 dict（:15-17） | 孤儿，重启即丢 | 落 canonical 或退役 |

## 二、退役 / 归档

- `src/swarm_orchestrator.py` EventBus 重型编排——无 canonical 调用方，execution_loop 已覆盖。
- 前端 governance 三省族：`lib/orchestration/court-pipeline.ts`、`features/governance/lib/three-chamber-engine.ts`、`deliberation-console.tsx`——BFF 退役后 0 运行时挂载，死码。
- `qintian_forecast.py` + `forecast_intel_taiyi.py` mock 端点——自承"后端从未实现、诚实返回空"，归档；`qintianjian.py`（真部门协议）为 canonical。
- `flow_opc.yaml.bak` 等同一 flow 四副本——删 .bak。
- `agent_design/retired_standalone_swarms/*`——保持归档。

## 三、统一事实源（不是合并主线，是合并注册表）

按伤害面排序：

1. **部门 ID（最重）**：四套命名体系（后端拼音 / 前端 unified / ministry 英文 / v1 双码）+ ≥7 份注册表 + ≥5 份部门码→AgentCode 映射副本；`dept-ssot.nodetest.ts:10-18` 自证漂移会让飞轮写孤儿边。→ canonical：后端 `harness/chaotang_department_protocol/departments.yaml` `v1_taxonomy` + 前端 `lib/contracts/dept.ts`，其余全部改派生。
2. **迁移权威**：Alembic（11 版）vs `create_all`（main.py:95 等 5+ 处）vs store 内手写 DDL 补丁三条路径。→ Alembic 唯一权威；create_all 降 dev-only。
3. **Prompt 三体系**：`prompts_*.py`（25 文件）↔ `runtime_prompts/`（72 目录）双向同步器 + `flow_*.yaml`（40+）。→ canonical：runtime_prompts + flow yaml；prompts_*.py 降 seed。
4. **契约漂移三角**：手写 `contracts/*.ts`（30+）+ 日期戳 OpenAPI 快照 + live OpenAPI。→ live OpenAPI codegen 化；已有 11 个 audit 脚本守门。
5. **scripts 双份 runner**：root 与 frontend/scripts 各一份 harness-doctor/release-commander/lease-attestation 等。→ diff 后留一份。

## 四、保持正交（不吸收进决策主线）

- **jiqun_ai 工作流平台**（runs/prompts/flows/swarm/chat/knowledge/memory 等 131 路由）——与 DecisionTask 链正交，单独治理；knowledge 写已被 tripwire fail-closed。硬塞进决策主线是错误合并。
- **harness/门禁基建**——root `.harness/` + `scripts/` 权威，业务门按端归属。

## 五、断头板块（前后端不对齐）

- **国力**：后端 `guoli.py` 已建（御史封驳率 LIVE、其余 NO_DATA，读 truth_ledger），**前端零页面**。
- **翰林**：前端页面全，后端 src 域逻辑薄，半接线。
- **庄园**：生产被 middleware redirect 到上书房（:198-201），需裁决保留或退役。

## 六、干净板块（保留，不动）

大殿、史馆、钦天监（真链）、六部总览/详情、锦衣卫信号面、grand-council（DEMO 诚实标合规）、履部。BFF 已彻底退役（`src/app/api/` 不存在、route.ts 0 命中，middleware 透明代理），无恢复风险。

## 推荐吸收顺序（对应 FULL_COURT_V1 Wave 1/2）

1. 部门 ID 双 SSOT 落地（伤害面最大、改动最机械）；
2. chaotang legacy 链吸收 + flow_store legacy 表 tripwire（关最后一条平行主线）；
3. 前端二级状态机下沉后端（消第二状态机）；
4. 迁移权威归一（Alembic）；
5. prompt/契约 codegen 收敛；
6. 死码退役（governance 族、swarm_orchestrator、mock 端点）。

> 只读审查，未改任何实现文件。实施归 Codex（唯一写入者），逐项走 change + Claude 审查。
