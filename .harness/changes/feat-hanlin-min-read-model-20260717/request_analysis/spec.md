# 规格说明：feat-hanlin-min-read-model-20260717

## 背景

FULL_COURT_V1 P9 要把已有翰林页面的一条数据线接到真实读模型，同时保持
DEMO/FALLBACK 边界诚实。既有 uplift 已让后端 `/api/hanlin/overview` 与
`/api/hanlin/experiments` 读取 `truth_ledger`，但前端没有消费来源与健康度字段，
实验页仍展示不存在的写动作，Hanlin API 本身也没有后端权限依赖。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `overview/experiments` 已从 `truth_ledger` 读取，正常、空账本、损坏账本测试 10/10 通过 | `backend/web/routers/hanlin.py`；`python3 -m pytest -q tests/test_hanlin.py tests/test_hanlin_truth_source.py`，2026-07-17 | Backend owner / 实跑 | 否 |
| 已确认事实 | 前端 `HanlinOverview` 不含 `truthLedger/sourceLabel`，实验页丢弃响应 `source`，因此真实来源未进入用户可见闭环 | `frontend/src/features/hanlin/types/index.ts`、`pages/hanlin-home.tsx`、`pages/experiments.tsx` | Frontend owner / 静态调用链 | 是 |
| 已确认事实 | `hanlin-home-mock.ts` 无仓内消费者；实验页 POST `/api/hanlin/experiments`，但后端只有 GET；`reset-demo` 和其他 Hanlin 路由没有 `Depends` 权限门 | `rg`、`backend/web/routers/hanlin.py` | 跨线静态核对 | 是 |
| 推测 | Hanlin 的 INTERNAL 页面门足以保护 API | 已证伪：Next `/api/*` 是透明 rewrite，页面 launch whitelist 不保护后端 API | 后端权限必须独立 fail-closed | 是 |
| 未知问题 | 本机能否取得真实浏览器端口与认证会话 | 不适用 | 实施后用 Playwright/端口检查确认；失败必须记 `NOT_RUN` | 否 |

## 数据流与调用链

```text
truth_ledger.jsonl（既有、按租户）
  -> backend src.truth_ledger._load()/health()
  -> GET /api/hanlin/overview + /api/hanlin/experiments
     （backend require_admin，内部账号边界）
  -> Next 透明 /api rewrite
  -> 前端类型化 payload
  -> 翰林首页真值台账摘要 + 实验池只读投影
```

空账本或损坏账本只产生 `FALLBACK` 空态，不启用本地 mock，也不制造百分比或实验。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `HanlinSourceLabel = TRUTH_LEDGER | FALLBACK` | 后端 Hanlin router / truth_ledger | 翰林首页、实验池 | 后端契约测试 + 前端 node/type 测试 |
| `HanlinTruthLedgerHealth` | `src.truth_ledger.health()` | `HanlinOverview.truthLedger` | 正常/空态契约测试 |
| Hanlin API 内部权限 | `web.deps.require_admin` | 全 `/api/hanlin/*` 路由 | admin 正例 + user/anonymous 反例 |

## 范围

- 为 Hanlin router 加后端 admin 权限依赖，使内部页面与 API 边界一致。
- 补齐前端 source label 与 truth ledger 健康度契约，在既有首页/实验页展示。
- 将 truth-ledger 实验投影固定为只读，移除无后端契约的写动作。
- 删除零引用 `hanlin-home-mock.ts`，生产路径不保留隐式 mock 回流点。
- 建立 P9 正常、空态、权限和浏览器证据；登记其余 Hanlin 数据线 deferred。

## 非目标

- 不新增表、状态机、provider、prompt 或独立翰林后端域。
- 不实现 contributions/reviews/recommendations/incubation/export 等写路径。
- 不修改 P8 国力切片、大殿冻结边界或现有主链。
- 不合并或推送 `feature-chaotang-ext`；本轮只产出 P9 候选与审查交接。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 有确定性账本记录 | 返回 `TRUTH_LEDGER`，页面显示条目数与判定摘要 | 后端契约测试 + 前端行为测试 + browser |
| 账本不存在或为空 | 200 + `FALLBACK` + 明确空态，不显示伪数据 | 后端契约测试 + 前端行为测试 |
| 账本损坏 | 200 + `FALLBACK`，不 500 | 既有回归测试 |
| 非 admin 请求 Hanlin API | 403；无有效身份由 auth dependency 返回 401 | 后端权限反例测试 |
| 真实实验投影 | 只读，无“开始/采用/停止”写按钮与无效 POST | 前端行为测试 + browser |

## 风险与回滚边界

- 权限收紧可能暴露旧的匿名调用；这是预期 fail-closed，回滚仅允许恢复到逐路由
  `get_current_user`，不得恢复无鉴权。
- 删除 mock 文件可从 Git 历史恢复；不迁入 attic，避免保留可误接的生产源码。
- UI 只在既有 `/hanlin` 与 `/hanlin/experiments` 内增加来源/空态，不新建页面。
- P9 基于远端 P7 `37542c3` 的隔离 worktree；P8 未合入前不进入 ext。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-17
- 批准范围：继续任务 2（P9 翰林最小读模型），采用会话中给出的六步最小 TDD 切片
- 明确未批准：P8、主分支脏文件处置、ext 合并/推送、其他 Hanlin 数据线实现

## 验收标准

1. Hanlin API 对 admin 放行，对普通用户/匿名身份 fail-closed。
2. 真账本和空账本均通过契约测试；损坏账本仍诚实降级。
3. 首页与实验页明确显示 `TRUTH_LEDGER` 或 `FALLBACK`，不展示本地伪数据。
4. 实验页不再发出没有后端契约的写请求。
5. `hanlin-home-mock.ts` 不再存在，其他数据线有明确 deferred 归属。
6. 相关后端测试、前端 node/type 检查、三层 doctor 与浏览器冒烟有证据。

## 验证计划

- RED：新增后端权限反例、前端 source-label/read-only 行为测试并确认失败。
- GREEN：最小实现后跑聚焦测试。
- 回归：Hanlin 后端全集、前端相关 node test、`tsc --noEmit`。
- 结构：根/前端/后端 doctor。
- 体验：internal launch mode 下跑 `/hanlin` 与 `/hanlin/experiments` 浏览器正常、空态、权限旅程。
