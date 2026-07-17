# 决策 0012：下旨到六部/军机处会审的 HTTP 契约与上书房展示

## Status

Accepted — 2026-07-17

## Context

`docs/decisions/0010-shangshufang-chancellor-agent.md` 交付了第一个业务闭环，但丞相
Agent 当时只生成一段回奏（`memorial_text`），既不区分单部门/多部门，也不体现六部办理或
军机处会审。产品任务 `docs/product/tasks/2026-07-17-decree-six-ministries-joint-review.md`
（用户于 2026-07-17 通过"自动交付：我下旨后，丞相判断是否是单部门处理还是需要多部门处理，
如果是单部门就继续往下走到六部的其中一个部，如果是多部门的话需要走军机处，然后军机处拉
六部其中相关的部门，进行会审"委托自动确认与交付）要求：丞相判断 `single`/`multi` 路由，
单部门旨意进入六部之一形成办理意见，多部门旨意进入军机处并召集至少两个相关部门会审后
形成结论；上书房页面清晰展示完整流转路径、丞相判断、参与部门及最终结果。

该任务分三个模块顺序交付：模块 1（丞相分流与六部办理 Agent）、模块 2（军机处会审编排）、
模块 3（本决策记录的下旨 HTTP 契约与上书房展示）。模块 1/2 已经把
`backend/app/agents/chancellor/graph.py::build_chancellor_graph()` 的图状态形状稳定为：

```
ChancellorGraphState = {
  decree_text, chancellor_rationale, route_type ("single"|"multi"),
  departments: list[str], processing_path: list[str],
  ministry_opinions: list[{"department": str, "opinion": str}],
  final_verdict: str,
}
```

`.invoke({"decree_text": "..."})` 对 single 和 multi 两种路由都会返回上述完整状态
（multi 路由的 `processing_path` 含 `"军机处"` + 全部被召集部门，`final_verdict` 来自
军机处汇总而非某个部门意见）。本决策记录模块 3 如何把这个稳定的图状态形状对齐到 HTTP
契约与前端展示，替代旧的单段 `memorial_text` 形状。

## Decision

### HTTP 响应契约：新字段整体替代 `memorial_text`

`backend/app/api/decrees.py::ChancellorDecreeResponse` 删除旧的单段 `memorial_text`
字段，新增：`route_type`（`"single"` 或 `"multi"`）、`rationale`（丞相判断说明）、
`processing_path`（有序流转路径）、`departments`（参与部门列表）、`ministry_opinions`
（`[{department, opinion}]`，保序）、`final_verdict`（最终结论）。`status`、`chancellor`
两个既有字段保留（满足"丞相身份"验收点）。

`route_type` 与 `MinistryOpinionResponse.department` 都用 `str` 而不是
`Literal["single", "multi"]`/`Enum`：六部名录与路由合法性已经在图层（`_decide_route`）
做过一次严格校验（非法 JSON/route_type/六部范围外/重复/计数不符全部失败关闭），响应模型
如果对这些理论上不可能出现的值再套一层 `Literal`/`Enum` 强校验，反而会把业务层已经处理
过的失败变成一个未被 `register_chancellor_exception_handlers` 捕获的 Pydantic 校验
异常（未捕获 500），这与 ADR 0010 已经确立的"响应模型字段保持宽松 `str`，强校验只在
图层做一次"原则一致，这次只是把同一原则应用到新增的这批字段上。

`submit_decree` 端点函数体的改动只是把 `graph.invoke({"decree_text": ...})` 返回的
dict 按新字段名重新组装成 `ChancellorDecreeResponse`（`chancellor_rationale` ->
`rationale`，其余字段同名直传），并把"哪个字段确实不能是空的"这条既有语义从
`memorial_text.strip()` 非空迁移到 `final_verdict.strip()` 非空 + 其余四个字段
（`rationale`/`route_type`/`processing_path`/`departments`/`ministry_opinions`）非空
的组合校验上；任一缺失都复用既有 `ChancellorGraphInvocationError`（映射 502），不新增
异常类型。`get_chancellor_graph()` 仍然在函数体内显式调用（不用 `Depends()`），ADR 0010
记录过的"校验失败零调用 Agent"这条硬约束原样成立，本次只补充了新契约下的回归测试。

### 前端契约驼峰化：一一对应，`route.ts` 原样透传

`frontend/src/lib/backendClient.ts` 的 `SubmitDecreeData` 驼峰化为
`routeType/rationale/processingPath/departments/ministryOpinions/finalVerdict`（新增
`MinistryOpinion { department, opinion }` 接口）；`submitDecree()` 内部新增
`parseSubmitDecreeData()`/`parseMinistryOpinions()`/`parseNonEmptyStringArray()` 三个
纯函数做字段级校验，任一必需字段缺失/空/形状不符（含误把旧的 `memorial_text` 单段字形状
发回来的情况）都回退到既有的 `kind: "unknown"` 分支，不新增错误分类。
`frontend/src/app/api/decrees/chancellor/route.ts` 只做原样透传映射（成功响应体的六个
新字段全部转发到最终 HTTP JSON），不新增字段、不做二次转换，五种既有错误 `kind`
（`validation|config|model|network|unknown`）→ HTTP 状态码映射不变。
`frontend/src/app/study/decreeStatus.ts` 的 `success` 状态分支同步扩展这六个字段；
`frontend/src/app/study/page.tsx` 渲染丞相判断说明（`rationale`）、
`processingPath.join(" → ")`、各部门意见列表（`ministryOpinions`，逐条展示部门名 +
意见）、最终结论（`finalVerdict`）。

### `DECREE_TIMEOUT_MS`：45000ms → 120000ms

`backend/app/api/decrees.py::submit_decree` 一次请求的最坏情况会触发 8 次串行 DeepSeek
调用：1 次丞相路由 + 最多 6 次六部会审（军机处召集全部六部时）+ 1 次军机处汇总，全部由
`app.agents.junjichu.agent.run_junjichu_council` 用纯 Python `for` 循环严格串行执行
（不并发、不用 LangGraph `Send`/fan-out）。旧的单次丞相回奏场景下 45000ms 的前端超时
（`frontend/src/lib/backendClient.ts` 的 `DECREE_TIMEOUT_MS`）已经不足以覆盖这个最坏
延迟叠加，会把"模型仍在处理"误判为网络错误。因此本次把该常量上调到 **120000ms**——
按单次 DeepSeek 调用观测到的典型延迟（数秒到十余秒量级）乘以 8 次串行调用并留出余量估算
得到，是一个经验上限而非精确测算值。

已知限制（如实记录，不在本次范围内解决）：`app/langgraph_runtime/` 不在本任务允许修改
范围内，后端目前无法为图内部的单次模型调用设置独立超时——如果某一次 DeepSeek 调用异常
挂起，`submit_decree` 会一直阻塞到前端的 120000ms 超时才让浏览器收到"网络错误"反馈，
用户看到的不是真正的"模型超时"原因。这与 ADR 0010 记录的"同步阻塞设计没有取消/重试机制"
代价是同一类风险的延续，只是把可接受的等待上限从 45s 放宽到 120s。

### 后端/前端契约仍是两处独立真源

延续 ADR 0010 已经记录的取舍：`docs/contracts/**` 之外维护的下旨契约不新增共享 schema
文件，后端 Pydantic 模型（`ChancellorDecreeResponse`/`MinistryOpinionResponse`）+
`backend/tests/test_decrees_api.py` 是一处真源，前端 TypeScript 类型
（`SubmitDecreeData`/`MinistryOpinion`）+ `backendClient.test.ts`/`route.test.ts`/
`decreeStatus.test.ts` 是另一处真源，双侧各自用测试锁定字段名/形状，作为唯一的机械
校验手段；未来任一侧修改字段名，仍然只能靠人工审查或集成测试发现漂移。

## Consequences

- 收益：上书房页面第一次能完整展示"丞相判断 -> 六部办理 或 军机处会审 -> 最终结论"这条
  完整业务链路，而不再是一段不透明的回奏文本；响应模型的 `str` 而非 `Literal`/`Enum`
  取舍延续了 ADR 0010 已验证的"图层强校验一次、响应层保持宽松"原则，避免同一类值在两层
  重复校验、其中一层校验失败又没有专门的异常处理器时产生未捕获 500。
- 代价：
  - `DECREE_TIMEOUT_MS` 上调到 120000ms 意味着一次真正卡住的请求会让用户多等接近两分钟
    才收到"网络错误"反馈；这是"多次串行模型调用没有独立超时机制"这一后端已知限制换来的
    前端体验代价，解决方案（例如给图内部单次调用加超时）需要新的产品任务允许修改
    `app/langgraph_runtime/`。
  - 后端/前端契约仍是两处独立定义，字段集合比 ADR 0010 时更大（六个新字段 + 嵌套的
    `ministry_opinions` 数组），漂移风险随字段数量增加而增加，仍然完全依赖双侧测试
    而非共享 schema 文件机械校验。
  - 前端 `parseSubmitDecreeData()` 系列校验函数对任何一个新字段缺失/空/形状不对都统一
    回退为 `kind: "unknown"`，不区分"后端契约版本落后"和"响应体偶然损坏"两种原因，用户
    只会看到"发生未知错误"的通用文案，不利于快速定位契约漂移问题（只能靠开发者读日志/
    看响应体本身排查）。

## Verification

- `backend/.venv/Scripts/python.exe -m ruff check .`：通过。
- `backend/.venv/Scripts/python.exe -m pytest -q`：`172 passed`，覆盖单/多部门路由完整
  响应字段、图层失败 502 脱敏、既有配置失败 503 脱敏、输入校验零调用、`GET /health`
  回归、新增的"关键字段缺失"参数化回归。
- `frontend`：`npm run lint`、`npm run typecheck`、`npm test`（41 个测试，含新增的
  single/multi 路由成功解析、字段缺失回退 `unknown`、自定义短 `timeoutMs` 覆盖默认值的
  真实超时分支验证、`route.ts` 新契约透传、`decreeStatus.ts` success 状态新字段映射）、
  `npm run build` 全部通过。
- `npm run start` 一次性 smoke：`curl http://localhost:3000/study` 返回 200，页面包含
  更新后的费用提示文案（"多次模型调用"字样）；验证过程未点击"下旨"、未触发真实 DeepSeek
  调用；验证完成后已关闭该进程。
