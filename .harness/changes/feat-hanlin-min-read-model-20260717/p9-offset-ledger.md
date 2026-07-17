# P9 残段核销单

基点：`origin/feature-chaotang-ext@37542c3`。本表只说明 P9 候选相对既有 uplift 的差集；
在独立审查 GO 且合入 integration 前，状态不计入 Packet 完成数。

| 残段 | 基点状态 | P9 候选处置 | 证据 | 候选状态 |
| --- | --- | --- | --- | --- |
| R1 真源已在后端、用户不可见 | `overview/experiments` 部分读取 `truth_ledger`，前端丢弃来源与健康度 | 补齐类型、严格 read-model、首页与实验池只读投影 | 后端 13 tests；前端 read-model tests；browser 正常/空态 | RESOLVED_CANDIDATE |
| R2 API 无独立权限 | 页面 internal flag 不能保护透明 rewrite 后的 API | 整个 `/api/hanlin/*` router 使用 `require_admin`；admin/user/anonymous 回归 | `backend/tests/test_hanlin.py` | RESOLVED_CANDIDATE |
| R3 mock 与伪写动作可回流 | 355 行首页 mock 文件；实验页提供无后端契约的写动作；首页静态规划样例默认可见 | 删除 mock；实验页只读；首页模块区只投影后端数据，空时不填本地样例 | `rg` 零命中；typecheck；browser | RESOLVED_CANDIDATE |
| R4 权限收紧导致旧消费者 401 | 7 个 Hanlin 页面裸 `fetch`，浏览器 cookie 名与后端不兼容 | 所有 Hanlin 页面统一 `backendFetch` transport；静态守门防回退 | `api.nodetest.ts` RED 列出 7 页、GREEN 0 页；browser Bearer header | RESOLVED_CANDIDATE |
| R5 其余数据线 | 空读、404 或无写契约 | 不扩建；逐项进入 `deferred-register.md` | deferred register | DEFERRED |

## Packet 判定

- 当前：`IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING`。
- 禁止解释为：P9 GO、已合入 integration、FULL_COURT_V1 DONE。
