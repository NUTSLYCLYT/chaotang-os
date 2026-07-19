# 规格说明：feat-menxiasheng-routing-veto-20260717

## 背景

门下省审议的是“丞相选了哪些部门”而不是重新分析原始旨意。当前实现为确定性结构化 gate，避免新增不可观测 LLM 副作用；封驳不会执行部门派单。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `ChancellorRoutingService.decide` 是正式路由事实源 | `backend/src/chancellor/routing_service.py` | service tests | 否 |
| 推测 | 职责范围证据足以拦截世界杯类误派 | `test_menxia_veto.py` | 定向测试 | 否 |
| 未知问题 | 运营指标落库字段尚未迁移 | 后续 change | 本包不阻塞 | 否 |

## 数据流与调用链

`chancellor_decide_route` → `review_route` → 封驳则 `humanSignoffRequired` + 阻断理由 → RouteDecisionV2 持久化；准奏继续原流程。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 结构化门下裁决 | `review_route` | routing service | 3 gate tests + 5 service tests |

## 范围

新增独立 veto 模块和服务接入；第三轮有限准奏；feature flag 可关闭。

## 非目标

不实现真正 LLM 门下 agent、不新增数据库字段、不处理 PKT-5 推荐层。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 世界杯误派 | 封驳，理由含职责外 | gate test |
| 合同任务 | 准奏 | gate test |
| 第三轮 | 准奏但保留 veto_reasons | gate test |

## 风险与回滚边界

环境变量 `CHAOTANG_MENXIA_VETO=0` 可回退旧路由；模块可整体删除。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

四维结构化输出、封驳/准奏、三轮边界和正式服务接入均有测试。

## 验证计划

定向 gate/service pytest；黄金路由套件需另案修复 PKT-2 基线漂移。
