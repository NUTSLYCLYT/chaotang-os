# 规格说明：feat-chancellor-llm-routing-recommendation-20260717

## 背景

PKT-5 不让 LLM 取得路由控制权。推荐层接受严格 JSON，输出仅作建议；最终等级通过确定性 `max(D2,D1,D0)` 合并。当前未配置 provider 时显式降级，不伪装已调用模型。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 入口丞相路由在 `chancellor_router.decide` | `backend/src/chancellor_router.py` | 17 tests | 否 |
| 推测 | 严格 schema 可阻止自由文本越权 | recommendation tests | 定向测试 | 否 |
| 未知问题 | 真实 provider 注入与线上预算策略未配置 | 环境/部署层 | 外部配置 | 否 |

## 数据流与调用链

任务文本 → 确定性 `chancellor_decide_route` + recommendation（可选）→ decision_level 合并 → 现有 direct/junjichu。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| recommendation | `recommend_route` | `chancellor_router.decide` 消费 | JSON/schema tests |

## 范围

新增推荐模块与返回元数据；硬门保持确定性，provider 缺失显式降级。

## 非目标

不实现 provider 配置、门下省重复逻辑、数据库推荐历史和自动执行。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| unsupported_scope | 结构化 true + 空候选部门 | recommendation test |
| 非法 JSON | status=degraded + 明确降级原因 | recommendation test |
| 硬风险 D2 | merge 后仍为 D2 | recommendation test |

## 风险与回滚边界

移除推荐调用与返回字段；确定性路由不受影响。

## 计划确认记录

- 批准人：
- 批准日期：
- 批准范围：
- 明确未批准：

## 验收标准

结构化推荐、降级路径、D 级合并公式和正式入口接入均有测试。

## 验证计划

推荐层/丞相路由定向 pytest；全量后端回归待收口。
