# 决策 0013：数据驱动的六部司级 Agent 层

## Status

Accepted — 2026-07-17

## Context

ADR 0012 已确定“丞相分流到单部，或经军机处召集多部会审”的同步链路，但每个六部 Agent
只生成一段部级意见，尚不能在部内按专业职责拆解。产品任务
`docs/product/tasks/2026-07-17-bureau-level-agents.md` 明确给出六部共 39 个司的企业职责，并
进一步确认礼部六司与其余各司全部开放，忽略原先“礼部 1.0 暂不开放二级模块”的限制。

司名不具备全局唯一性，例如吏部与刑部都包含“制度司”；同时，若为 39 个司分别复制 Agent
实现，会让提示、安全约束、结构化输出和错误处理快速漂移。因此需要一个能表达复合身份、由
数据决定专业职责的统一司级层，并且不能破坏 ADR 0012 已交付的丞相、军机处、HTTP 与前端
契约。

## Decision

### 39 司使用不可变的复合身份注册表

`backend/app/agents/bureaus/profiles.py` 定义冻结且使用 slots 的 `BureauProfile`，并以唯一
不可变 tuple `BUREAU_PROFILES` 保存 39 个 profile。每个 profile 包含 `department`、
`bureau` 和完整 `responsibilities`；运行时以 `(department, bureau)` 复合键解析，既允许
不同部门存在同名司，也拒绝未知司和跨部门引用。注册表不定义 `enabled`、版本或 1.0 门禁；
六部按 `6/7/6/6/7/7` 分布的全部 39 司均可路由，礼部品牌司、公关司、客户沟通司、内容司、
政企司、体验司与其他司采用完全相同的开放机制。

### 39 司共享一个数据驱动的通用 Agent

`backend/app/agents/bureaus/agent.py::invoke_bureau_agent` 是全部司共用的唯一调用实现。
它从复合注册表读取所属部、司名及完整职责来生成提示，要求模型只返回严格 JSON
`{"opinion": "..."}`，并继续遵守企业不可逆动作禁令。未知或跨部身份、模型调用、JSON
解析、schema 或空意见均失败关闭，由脱敏的司级异常向上包装；不为各司复制 Python 模块、
类或调用函数。

### 部级严格路由，逐司串行并确定性汇总

`backend/app/agents/ministries/agent.py::invoke_ministry_agent` 的公开签名和字符串返回值
保持不变。每个部级 Agent 先输出严格 JSON：非空 `rationale` 和一个或多个无重复、仅属于
本部的 `bureaus`；非法 JSON、未知司、跨部司、重复司或空选择全部失败关闭。合法选择按模型
给定顺序逐一、同步调用通用司级 Agent，不做并发；任一司失败立即短路，不返回半成品。成功
结果按同一顺序确定性汇总为逐行 `司名：意见`，作为既有部级 `opinion` 字符串继续向上游返回。

因此总体链路为：

- 单部门：上书房 → 丞相 → 一个部 → 该部一个或多个司 → 部级逐行汇总；
- 多部门：上书房 → 丞相 → 军机处 → 多个相关部 → 各部一个或多个司 → 各部逐行汇总 →
  军机处会审结论。

军机处仍按丞相给定部门顺序串行调用六部。丞相图、军机处拓扑和
`invoke_ministry_agent(department, decree_text, rationale, chat_model) -> str` 不变；
现有 `route_type`、`rationale`、`processing_path`、`departments`、
`ministry_opinions[].opinion`、`final_verdict` HTTP/前端成功契约及错误映射保持兼容，
不新增司级 HTTP 字段。

### 同步调用边界保持不变

本次不引入并发、异步任务、缓存、checkpointer 或持久化。最坏 single 路由会同步调用模型
9 次：丞相 1 次、部级路由 1 次、该部最多 7 个司各 1 次。全六部 multi 路由最坏会同步调用
47 次：丞相 1 次、六个部级路由 6 次、全部 39 司各 1 次、军机处汇总 1 次。现有前端
120 秒超时可能无法覆盖该最坏延迟；本次不修改 API、前端超时或执行架构，只把它记录为明确
风险。

## Consequences

- 收益：39 司身份、所属部和职责集中在一个不可变真源；增加或审查职责时无需同步 39 套
  Agent 实现。复合键正确处理同名司，礼部也不存在隐藏的版本门禁。
- 收益：丞相与军机处契约不变，现有单部/多部流转、FastAPI、BFF 和 `/study` 无需新增字段；
  页面可通过原有 `ministry_opinions[].opinion` 看到带司名的逐行意见。
- 代价：一次旨意的模型调用数显著增加。最坏 9/47 次同步串行调用可能超过 120 秒，并占用
  FastAPI 请求处理直到整条链路完成。
- 代价：任一司失败会丢弃本部尚未返回的全部汇总结果；这是避免半成品意见的失败关闭取舍。
- 限制：司级选择与意见只存在于单次调用的局部变量和最终部级字符串中；系统没有并发、
  中间状态持久化、恢复、查询或独立司级 HTTP 契约。

## Verification

- `backend/.venv/Scripts/python.exe -m ruff check .`
- `backend/.venv/Scripts/python.exe -m pytest -q`
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `git diff --check`
