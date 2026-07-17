# 决策 0014：分层回奏与丞相三项建议

## Status

Accepted — 2026-07-17

## Context

ADR 0013 已把六部 39 司建成数据驱动的通用司级 Agent，并确定选司、逐司同步调用和失败关闭，
但其局部兼容结论仍把 `invoke_ministry_agent` 定义为扁平字符串返回，把逐司文本直接汇总成既有
部级 `opinion`，并明确不扩展成功 HTTP 字段。这样无法区分司级证据与部级判断，也无法表达
“多部办理完成后由军机处会审、最后再由丞相统一给出三策”的真实回奏层级。

本轮必须在保留 39 司全部开放、首次 single/multi 分流、既有 HTTP 路径与请求体、原成功字段、
错误分类和 `GET /health` 的前提下，对成功契约做增量升级。链路继续同步串行，不引入并发、
异步任务、缓存、checkpointer 或持久化。

## Decision

### 结构化保存司议与部议

`invoke_ministry_agent(...)` 的参数不变，返回值升级为结构化 `MinistryOpinion`：非空
`department`、按选择顺序排列且非空的 `bureau_opinions[{bureau, opinion}]`，以及一次独立模型
调用生成的非空部级 `opinion`。每个部先严格选择本部一个或多个司，逐司同步获取独立意见，
再把全部有序司级意见交给本部补充和综合；部级意见不是司级文本的机械拼接。未知司、跨部司、
重复司、非法结构或任一步失败均立即失败关闭，不返回半成品。

ADR 0013 关于 39 司不可变复合注册、礼部六司全部开放、通用司级 Agent、严格选司与逐司串行
的决定继续有效；其“`invoke_ministry_agent` 返回扁平字符串”和“不扩展成功字段”的局部结论
由本 ADR 覆盖。

### single 与 multi 共用丞相 finalizer

LangGraph 拓扑升级为 `decide_route → single 部办理 / multi 军机处会审 →
finalize_chancellor → END`：

- single 严格按“丞相首次分流 → 目标部选司并逐司咨询 → 该部补充意见 → 丞相最终汇总”执行，
  不调用军机处；
- multi 按丞相给定部门顺序串行完成各部的“司级意见 → 部级补充”，再由军机处读取全部分层
  部门结果形成一次非空 `council_verdict`，最后才调用丞相；
- 两条路径共用同一个丞相 finalizer，模型只能返回严格 JSON
  `{"summary": "...", "recommendations": ["...", "...", "..."]}`。`summary` 必须非空，
  `recommendations` 必须恰好三项、逐项非空且去除首尾空白后互不重复。

`processing_path` 按真实执行顺序逐步构造并以“丞相（最终汇总）”结束，不把未发生的现实任免、
付款、签约、发布、销售承诺或生产部署写成已完成。

### 增量升级成功契约并保留错误边界

`POST /api/v1/decrees/chancellor` 的路径、请求体以及既有 `route_type`、`rationale`、
`processing_path`、`departments`、`ministry_opinions`、`final_verdict` 字段继续保留；
`ministry_opinions[]` 增加有序 `bureau_opinions`，新增 `council_verdict` 和
`recommendations`。`final_verdict` 明确映射丞相 finalizer 的 `summary`；single 的
`council_verdict` 为 `null`，multi 必须为非空字符串。FastAPI、Next.js BFF 与 UI 同批升级并
严格校验嵌套结构、条件字段、非空总结和恰好三项建议。

模型调用、JSON/schema 校验或成功响应构造任一步失败，沿既有脱敏异常链失败关闭；模型/结果
失败保持映射为 502，不泄露提示词、模型原文、密钥或内部异常。既有 422/502/503/network/
unknown 分类、`GET /health` 和本地 `127.0.0.1` 边界不变。

### 保持同步串行执行

本轮不并发、不异步、不持久化任何中间意见。最坏 single 路径为 11 次同步模型调用：丞相首次
分流 1 次、部内选司 1 次、最多 7 司各 1 次、部级补充 1 次、丞相最终汇总 1 次。全六部 multi
最坏为 54 次：丞相首次分流 1 次、六部选司 6 次、39 司 39 次、六部补充 6 次、军机处会审
1 次、丞相最终汇总 1 次。现有前端 120 秒超时可能不足；本轮只记录风险，不据此引入并发、
异步或扩大超时。

## Consequences

- 收益：司级证据、部级补充、军机处会审和丞相总结均有稳定层级，页面能够审计每层依据；
  single 与 multi 最终都得到同一格式的总结和恰好三项建议。
- 收益：新增字段采用增量契约，原 HTTP 路径、请求、成功字段、错误分类和健康检查保持兼容；
  `processing_path` 不再只是角色清单，而是实际调用顺序的可验证记录。
- 代价：部级补充和丞相 finalizer 增加同步模型调用；最坏 11/54 次调用很可能超过 120 秒，且
  任一步失败都会丢弃本次未完成的整份回奏。
- 限制：系统仍没有并发、任务队列、流式输出、恢复、缓存、持久化或中间意见查询能力；模型
  语义质量与真实端到端延迟仍需在用户知情产生费用时另行验证。

## Verification

- `backend/.venv/Scripts/python.exe -m ruff check .`
- `backend/.venv/Scripts/python.exe -m pytest -q`
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`（在 `frontend/`）
- `node scripts/check_harness.mjs`
- `node scripts/check_harness.mjs --self-test`
- `node .agents/hooks/check-harness.mjs --self-test`
- `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`
- `git diff --check`
