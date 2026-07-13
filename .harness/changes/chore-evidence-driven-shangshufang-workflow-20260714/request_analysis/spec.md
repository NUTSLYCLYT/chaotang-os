# 规格说明：chore-evidence-driven-shangshufang-workflow-20260714

## 背景

用户确认把《核心技巧》中适合项目的证据驱动方法纳入 harness，并要求制定“上书房到蜂群”全链路改进方案。本变更只修改工程护栏和计划记录，不修改业务运行代码。

## 当前实现与证据

- 已确认事实：正式上书房链路由 `frontend/src/features/shangshufang/ShangshufangPage.tsx` 经 `frontend/src/lib/jiqun-api.ts` 调用 `backend/web/routers/shangshufang.py`；确认会写 DecisionTask、CourtLoopRun、EmperorDecision 与 outbox。
- 已确认事实：`backend/src/execution/decree_dispatcher.py` 使用进程内线程派发；`backend/src/execution/outbox_worker.py` 有批处理与回收逻辑，但未发现生产常驻调度入口。
- 已确认事实：正式状态、圣裁、深化接口按对象 ID 查询，相关新模型缺少完整 tenant 所有权字段；这是对象级授权风险。
- 已确认事实：前端取得后端状态后仍会本地执行部院评审、御史审核与综合结论，导致 LIVE 事实源分裂。
- 推测：持久化 worker、统一状态机和前端只读投影完成后，现有蜂群引擎可以渐进加固，无需首阶段更换编排框架。
- 未知问题：生产部署拓扑、真实并发峰值、模型供应商限流、租户迁移数据量、灰度与告警平台尚无充分证据。

## 数据流与调用链

```text
ShangshufangPage
  -> jiqun-api draftEdict / confirmEdict
  -> shangshufang router
  -> Chancellor route + Decision/Court/Outbox transaction
  -> durable worker (目标态)
  -> department assignments -> swarm nodes -> Yushi quality gate
  -> status read model -> Shangshufang
  -> guarded Emperor decision -> Shiguan archive / outcome feedback
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| draft / confirm / status / decision | `backend/web/routers/shangshufang.py` 的 Pydantic/OpenAPI | `frontend/src/lib/jiqun-api.ts`、上书房页面 | OpenAPI 快照 + 前端契约测试 |
| 路由决定 | `backend/src/chancellor/routing_service.py` | 确认接口、派发器 | 黄金样例 + 幂等测试 |
| 生命周期事件 | DecisionTask + CourtLoopRun + Outbox + timeline | worker、状态投影、前端 | 状态机转移测试 + DB 断言 |
| 蜂群结果 | SwarmRun / TaskRun / DepartmentAssignment（目标态） | 质量门、状态投影、圣裁 | 重启/重试/部分失败集成测试 |

## 范围

- 将调查—计划—实施—验证—复核协议写入根级工作流。
- 增强根级 change 模板，使契约、边界、文件、验证与声明状态成为必填骨架。
- 记录可逐 PR 执行的全链路蓝图、依赖、回滚与 100% 验收矩阵。

## 非目标

- 本变更不修改前端、API、数据库模型、worker 或蜂群运行逻辑。
- 不宣称全链路已经上线；`VERIFIED_COMPLETE` 只表示本次护栏与计划闭环完成。
- 不以引入 Temporal 等新框架替代尚未加固的现有实现。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 只有后端 dry-run | 不声明浏览器链路完成 | 工作流规则与 CI 模板 |
| 只有前端 mock | 不声明蜂群真实运行完成 | 工作流规则与 CI 模板 |
| 同一验收连续修补三次失败 | 回到调查与根因更新 | 工作流规则 |
| 跨语言契约变更 | 后端事实源生成或契约验证前端类型 | 工作流规则 |
| 历史 change 缺少新增字段 | 不追溯改写；仅新 change 使用新版模板 | doctor + 新记录核对 |

## 风险与回滚边界

规则和模板是增量文档变更；若字段造成无效负担，可单独回滚对应段落，不影响运行时。业务蓝图每一步要求独立迁移、兼容窗口和回滚，不允许一次性大切换。

## 计划确认记录

- 批准人：项目用户
- 批准日期：2026-07-14
- 批准范围：根级证据驱动 harness 改进与上书房到蜂群的生产化实施方案
- 明确未批准：本次不修改任何前端、后端、API 或数据库运行代码

## 验收标准

- 新协议明确事实/推测/未知、契约先行、最小闭环、证据范围与三次失败回退。
- 新模板能记录调用链、契约、边界、文件、状态、验证、回滚和未验证项。
- 全链路蓝图包含依赖、文件、验证、回滚以及可审计的完成定义。

## 验证计划

- 运行根级 harness doctor。
- 静态检查规则和模板必需字段。
- 对蓝图进行只读对抗审查并消解高风险缺口。
