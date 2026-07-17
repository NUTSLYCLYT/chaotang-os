# 任务：feat-hanlin-min-read-model-20260717

## 任务 1：权限边界 RED→GREEN

- 目标：Hanlin API 仅允许内部 admin 身份。
- 前置条件：P7 远端头 `37542c3`；用户已确认 P9 范围。
- 输入：现有 `require_admin` 与 Hanlin router。
- 输出：router 级权限依赖及 admin/user/anonymous 测试。
- 涉及文件：`backend/web/routers/hanlin.py`、`backend/tests/test_hanlin.py`。
- 状态 / 数据变化：无持久化变化；只收紧读取与 reset-demo 访问。
- 验证命令与证据：聚焦 pytest，先 RED 后 GREEN。
- 回滚边界：只可退到逐路由认证，不可退回匿名 API。
- 完成定义：管理员 200、普通用户 403、无身份 401。
- 状态：完成（13 个 Hanlin 后端测试覆盖）。

## 任务 2：真实来源契约与只读 UI

- 目标：把 `truth_ledger` 来源与健康度投影到既有首页/实验页。
- 前置条件：后端 payload 形状固定。
- 输入：`overview.sourceLabel/truthLedger`、`experiments.source`。
- 输出：前端类型、来源徽标、空态与只读实验列表。
- 涉及文件：Hanlin types/hooks/pages 及相关 node test。
- 状态 / 数据变化：无写入；删除不存在契约的实验 POST 行为。
- 验证命令与证据：前端 node test + `tsc --noEmit` + browser。
- 回滚边界：UI 组件可回滚，但 source label 不得消失或伪装 LIVE。
- 完成定义：正常/空态可区分，真实实验无写按钮。
- 状态：完成（read-model、typecheck、browser 覆盖）。

## 任务 3：Mock 退役与 deferred

- 目标：清除零引用 mock 回流点，并登记 P9 外数据线。
- 前置条件：`rg` 确认 `hanlin-home-mock.ts` 无消费者。
- 输入：P9 残段 R1/R3。
- 输出：删除 mock 文件；change 内 deferred register。
- 涉及文件：`frontend/src/features/hanlin/lib/hanlin-home-mock.ts`、change 文档。
- 状态 / 数据变化：无运行数据变化。
- 验证命令与证据：repo grep、typecheck、doctor。
- 回滚边界：如确需演示，只能在显式 DEMO flag + source label 的新 change 恢复。
- 完成定义：生产源码无 Hanlin mock 数据集，其他线无遗漏差集。
- 状态：完成（mock 删除；默认静态示例退役；deferred register 已落盘）。

## 任务 4：跨线验证与审查交接

- 目标：给 P9 正常、空态、权限、浏览器体验和回滚留下可复核证据。
- 前置条件：任务 1–3 GREEN。
- 输入：固定 P9 diff。
- 输出：CI summary、browser evidence、review handoff。
- 涉及文件：本 change 证据文件。
- 状态 / 数据变化：仅文档证据。
- 验证命令与证据：聚焦测试、typecheck、三层 doctor、Playwright。
- 回滚边界：不合 ext、不推送；review NO_GO 在本分支修正。
- 完成定义：所有已运行命令及未验证项诚实登记。
- 状态：完成候选证据；等待独立审查，不计 Packet GO。
