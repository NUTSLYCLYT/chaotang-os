# 上书房页面接口对接方案

## 目标

把 `/shangshufang` 页面从“部分可用、增强能力分散”收口为一条稳定的前后端闭环：

- 页面首屏能读取真实上书房待办、待裁决、待补证任务。
- 下旨、丞相拟旨、确认会审、查看状态、皇上裁决形成完整 P0 闭环。
- 页面展示的 endpoint、source label、能力矩阵与后端真实接口一致。
- 增强能力按优先级逐步接入，不用前端 mock 冒充后端事实。

## 对接边界

本方案只做接口对接，不改 UI 层。

### 本次允许改动

- 前端 API 适配层：`frontend/src/lib/jiqun-api.ts`。
- 前端接口路径转换和契约说明：`frontend/src/lib/backend-api.ts`、`frontend/src/lib/contracts/shangshufang.ts`。
- 前端数据 hook：`frontend/src/features/shangshufang/hooks/useShangshufangBriefing.ts`。
- 页面内 endpoint 文案、source label 显示口径这类“接口事实展示”，仅在必要时校正。
- 后端上书房 API：`backend/web/routers/shangshufang.py`。
- 后端支撑逻辑、测试与契约文档。

### 本次禁止改动

- 不改 `/shangshufang` 页面布局。
- 不改视觉风格、背景图、三栏结构、弹窗样式、按钮样式。
- 不新增 UI 组件。
- 不重排页面信息架构。
- 不调整用户操作路径，除非当前按钮会触发不存在接口，此时只允许接通接口或隐藏错误态，不做视觉重设计。
- 不用前端 mock 补后端缺口。

### UI 保持原则

页面现在怎么长、按钮在哪里、弹窗怎么打开，都保持不动。对接工作只让这些已有 UI 控件背后的请求打到正确后端，并让返回数据按现有组件可消费的结构进入页面。

## 当前事实

### 页面入口

前端页面入口：

- `frontend/src/app/(dashboard)/shangshufang/page.tsx`
- 页面主体：`frontend/src/features/shangshufang/ShangshufangPage.tsx`
- 简报 hook：`frontend/src/features/shangshufang/hooks/useShangshufangBriefing.ts`
- 前端 API 适配：`frontend/src/lib/jiqun-api.ts`
- 前端路径转换：`frontend/src/lib/backend-api.ts`

当前页面实际路径是 `/shangshufang`。历史注释与部分链接仍提到 `/court-briefing`，应视为兼容/旧入口。

### 代理与路径转换

前端调用多数写成：

```text
/api/court/shangshufang/*
```

实际会在 `frontend/src/lib/backend-api.ts` 转换为：

```text
/api/shangshufang/*
```

浏览器请求再由 `frontend/next.config.ts` 的 rewrite 代理到后端：

```text
/api/:path* -> ${BACKEND_API_BASE}/api/:path*
```

因此，主链路不是没接后端，而是通过前端兼容层接到了后端 `/api/shangshufang/*`。

### 后端已实现接口

后端 router：

- `backend/web/routers/shangshufang.py`
- 已在 `backend/web/main.py` 注册。

已实现：

| 前端语义路径 | 后端真实路径 | 状态 | 用途 |
| --- | --- | --- | --- |
| `GET /api/court/shangshufang/home` | `GET /api/shangshufang/home` | 已实现 | 读取上书房首页待裁决/待补证任务 |
| `POST /api/court/shangshufang/draft-edict` | `POST /api/shangshufang/draft-edict` | 已实现 | 丞相拟旨，创建 DecisionTask |
| `POST /api/court/shangshufang/confirm-edict` | `POST /api/shangshufang/confirm-edict` | 已实现 | 皇上确认后发军机处会审 |
| `GET /api/court/shangshufang/tasks/{taskId}/status` | `GET /api/shangshufang/tasks/{taskId}/status` | 已实现 | 查看任务与 review 状态 |
| `POST /api/court/shangshufang/tasks/{taskId}/decision` | `POST /api/shangshufang/tasks/{taskId}/decision` | 部分不兼容 | 提交裁决 |
| `POST /api/shangshufang/finance-reporting-loop` | `POST /api/shangshufang/finance-reporting-loop` | 已实现 | 户部财务报表预览闭环 |

后端已有测试覆盖：

- `backend/tests/test_shangshufang_loop_api.py`
- `backend/tests/test_hubu_financial_reporting.py`

## 主要缺口

### 1. Briefing 契约名不一致

页面与能力矩阵仍展示：

```text
GET /api/court/shangshufang/briefing
```

但实际 hook 当前调用的是：

```text
GET /api/court/shangshufang/home
```

后端没有独立实现 `/api/shangshufang/briefing`。

风险：

- 页面能力矩阵展示的 endpoint 与真实后端不一致。
- 后续排查时容易误判为后端缺 briefing。
- 契约文档、E2E fixture、真实运行口径会分叉。

### 2. 裁决 action 前后端不一致

前端 `shangshufangTaskDecision` 支持：

```text
adopt | request_evidence | recheck | reject | followup
```

后端 `DecisionRequest` 目前只接受：

```text
approve | reject | request_evidence | archive
```

风险：

- 用户点“准奏/采纳”可能发出 `adopt`，后端返回 422。
- 用户点“会审/复核/追问”可能发出 `recheck/followup`，后端返回 422。
- 页面收据、史馆归档提示与后端真实状态不同步。

### 3. 增强接口尚未完整实现

页面或适配层中还引用了这些接口：

| 接口 | 当前状态 | 建议 |
| --- | --- | --- |
| `POST /api/court/shangshufang/tasks/{taskId}/swarm-deepen` | 后端缺 | P1 接入或隐藏触发入口 |
| `POST /api/court/shangshufang/pack-swarm-loop` | 后端缺 | P1 接入 PACK 蜂群真实链路 |
| `POST /api/court/shangshufang/finance-intel-loop/complete` | 后端缺直接路由 | P2 接到现有 finance-intel contract / swarm run |
| `GET /api/court/shangshufang/finance-intel-loop/cases/{taskId}` | 后端缺 | P2 与 finance-intel case store 对齐 |
| `POST /api/court/shangshufang/briefs/{briefId}/decision` | 后端缺 | P2 明确 decision brief 数据模型后实现 |
| `POST /api/court/shangshufang/briefs/{briefId}/decision/advance` | 后端缺 | P2 同上 |
| `POST /api/court/shangshufang/polish-edict` | 后端缺 | P2 轻量实现，可标 `FALLBACK/MIXED` |
| `/api/court/shangshufang/im` | 后端缺 | P3，先定义 IM session/message contract |
| `POST /api/court/shangshufang/edict-return` | 后端缺 | P3，需和执行复命/史馆归档模型对齐 |
| `POST /api/court/shangshufang/finance-status-memorial` | 后端缺 | P3，建议归入户部 API 或上书房聚合 API |

## 推荐总体方案

采用“三段式”对接：先把主线稳定，再补增强能力，最后统一文档与验证。

## P0：修通主闭环

目标：保证 `/shangshufang` 页面核心路径可真实使用。

### P0-1. 统一首页简报契约

推荐做法：保留后端 `GET /api/shangshufang/home` 作为当前事实源，同时把前端展示和注释统一成 home。

需要调整：

- `frontend/src/features/shangshufang/hooks/useShangshufangBriefing.ts`
  - 注释从 briefing 改为 home。
  - `sourceMode` 继续按真实请求成功置为 `real`。
- `frontend/src/features/shangshufang/ShangshufangPage.tsx`
  - 能力矩阵 endpoint 从 `GET /api/court/shangshufang/briefing` 改为 `GET /api/court/shangshufang/home`。
  - 只改接口事实文案，不改页面布局、组件结构、按钮样式。
- `frontend/src/lib/contracts/shangshufang.ts`
  - 若仍有 briefing 响应注释，改为“页面简报聚合契约，由 home 适配生成”。

备选做法：后端新增 `GET /api/shangshufang/briefing`，直接返回 `ShangshufangBriefing`。

不推荐当前立刻新增 briefing，原因是已有 `home`、hook 和测试都围绕 `home` 工作；先统一口径成本更低。

### P0-2. 统一裁决 action

推荐后端兼容前端新 action，避免前端按钮语义倒退。

后端 `DecisionRequest.action` 扩展为：

```text
approve | archive | adopt | reject | request_evidence | recheck | followup
```

映射规则：

| 前端 action | 后端处理 | 任务状态 | 是否写史馆 |
| --- | --- | --- | --- |
| `adopt` | 等同终局采纳 | `archived` | 是 |
| `approve` | 等同终局采纳 | `archived` | 是 |
| `archive` | 显式归档 | `archived` | 是 |
| `request_evidence` | 要求补证 | `awaiting_evidence` | 否 |
| `followup` | 追问/补充问题 | `awaiting_evidence` | 否 |
| `recheck` | 发起复核 | `reviewing` 或 `awaiting_decision` | 否 |
| `reject` | 驳回 | `rejected` 或保持 `awaiting_decision` 加 decision 记录 | 否 |

建议后端响应补齐前端需要的字段：

```json
{
  "task_id": "task_xxx",
  "status": "archived",
  "decision_id": "decision_xxx",
  "archive_record": {
    "archive_id": "archive_xxx",
    "task_id": "task_xxx",
    "source_label": "FALLBACK"
  }
}
```

### P0-3. 固化主链路验收测试

后端测试增加/调整：

- `adopt` 能成功归档。
- `followup` 能进入 `awaiting_evidence`。
- `recheck` 不返回 422。
- `home` 能读到待确认/待裁决/待补证任务。

前端测试增加/调整：

- 页面能力矩阵 endpoint 显示 `home`。
- 点击“准奏/裁决”不会出现 422。
- 裁决后调用 `refreshBriefing` 能刷新当前待办。

## P1：接入真实蜂群增强能力

目标：把页面已有但后端缺失的高频按钮接到真实后端。

### P1-1. `swarm-deepen`

新增：

```text
POST /api/shangshufang/tasks/{taskId}/swarm-deepen
```

职责：

- 读取 `DecisionTask` 与最新 `CourtReview`。
- 调用现有蜂群运行能力。
- 更新 review 的 swarm trace / ministry outputs。
- 返回前端 `ShangshufangSwarmDeepenResponse` 契约。

数据原则：

- 如果没有真实 adapter，不返回假成功。
- 可返回 `source_label: FALLBACK` 或 `MIXED`，但要明确 `missing_capabilities`。

### P1-2. `pack-swarm-loop`

新增：

```text
POST /api/shangshufang/pack-swarm-loop
```

职责：

- 解析 PACK 相关 command。
- 建立上书房 task。
- 路由到 `pack_rd` 或现有 swarm run。
- 返回 `ShangshufangPackSwarmLoopResponse`。

优先返回页面已使用字段：

- `task_id`
- `mode`
- `source_label`
- `collection_checklist`
- `evidence_bound_run`
- `adapter_result`
- `swarm_trace_summary`
- `human_intervention_required`
- `final_recommendation`
- `timeline`

## P2：金融与 brief 专项闭环

目标：把 finance-intel 与 decision brief 从页面临时调用收口成后端可维护 API。

### P2-1. Finance Intel Loop

新增或对齐：

```text
POST /api/shangshufang/finance-intel-loop/complete
GET  /api/shangshufang/finance-intel-loop/cases/{taskId}
```

建议不要重新发明执行链路，优先复用：

- `backend/src/finance_intel_loop_contract.py`
- `backend/web/routers/swarm.py`
- 现有 `is_finance_intel_loop_request` 分支

### P2-2. Decision Brief

新增：

```text
POST /api/shangshufang/briefs/{briefId}/decision
POST /api/shangshufang/briefs/{briefId}/decision/advance
```

实现前需要先确定：

- `briefId` 是否等于 `CourtReview.id`、`DecisionTask.id`，还是新的 brief 表。
- brief 的状态机：`drafted -> awaiting_authorized_decision -> execution_allowed -> archived`。
- 人工授权记录字段。

## P3：IM、润色、复命

目标：补体验型能力，但不影响主业务闭环。

### P3-1. Polish Edict

新增：

```text
POST /api/shangshufang/polish-edict
```

可先轻量实现：

- 输入：`raw_text`、`mode`
- 输出：`polished`、`source_label`、`fallback_used`、`read_only_reason`

若未接 LLM，必须返回 `fallback_used: true`。

### P3-2. 上书房 IM

新增：

```text
GET  /api/shangshufang/im
POST /api/shangshufang/im
```

建议先定义最小契约：

- session id
- message id
- role
- content
- created_at
- source_label
- optional task_id

### P3-3. Edict Return

新增：

```text
POST /api/shangshufang/edict-return
```

职责：

- 汇总已执行任务的复命。
- 可选写入史馆。
- 返回页面可渲染的 `EdictView` 或后端标准复命契约。

## 接口状态机

建议上书房主任务统一使用以下状态：

```text
drafting
awaiting_emperor_confirm
reviewing
awaiting_decision
awaiting_evidence
rejected
archived
failed_with_recovery
```

主流程：

```text
draft-edict
  -> awaiting_emperor_confirm
confirm-edict
  -> reviewing / awaiting_decision
task-decision: request_evidence / followup
  -> awaiting_evidence
task-decision: recheck
  -> reviewing
task-decision: adopt / approve / archive
  -> archived
task-decision: reject
  -> rejected
```

## Source Label 口径

页面必须如实展示数据来源：

| source_label | 含义 |
| --- | --- |
| `LIVE` | 后端真实数据和真实执行结果 |
| `LIVE_SWARM` | 已接真实蜂群运行 |
| `MIXED` | 用户上传/真实事实 + 部分规则或占位推理 |
| `FALLBACK` | 后端规则兜底或能力不足兜底 |
| `DEMO` | 演示数据 |
| `unavailable` | 前端未取得后端数据 |

规则：

- 后端失败不能被前端改写成 `real`。
- 前端本地空骨架只能显示 `unavailable`。
- 后端 fallback 可以显示，但必须可见。

## 文件改动清单

### P0 应改文件

前端：

- `frontend/src/features/shangshufang/hooks/useShangshufangBriefing.ts`
- `frontend/src/features/shangshufang/ShangshufangPage.tsx`
- `frontend/src/lib/contracts/shangshufang.ts`
- `frontend/src/lib/jiqun-api.ts`

后端：

- `backend/web/routers/shangshufang.py`
- `backend/tests/test_shangshufang_loop_api.py`

### P1/P2 可能新增或改动文件

后端：

- `backend/web/routers/shangshufang.py`
- `backend/src/shangshufang_loop.py`
- `backend/src/finance_intel_loop_contract.py`
- `backend/src/swarm_execution_loop.py`
- `backend/src/swarm_persistence.py`

前端：

- `frontend/src/lib/jiqun-api.ts`
- `frontend/src/lib/contracts/shangshufang.ts`
- `frontend/src/features/shangshufang/ShangshufangPage.tsx`

## 验证命令

### 后端

```powershell
cd backend
python -m pytest -q tests/test_shangshufang_loop_api.py tests/test_hubu_financial_reporting.py
```

新增 P1/P2 后补充：

```powershell
cd backend
python -m pytest -q tests/test_swarm_execution_loop_api.py
```

### 前端

```powershell
cd frontend
pnpm exec tsc --noEmit
```

页面回归：

```powershell
cd frontend
pnpm exec playwright test e2e/shangshufang-*.spec.ts
```

### 根级护栏

若本次实际修改跨前后端实现或项目级护栏：

```powershell
node scripts/harness-doctor.mjs
```

## 分阶段交付建议

### 第一阶段：1 天内

- 统一 `home/briefing` 口径。
- 修复 decision action 兼容。
- 补后端 action 测试。
- 跑后端 P0 测试与前端 TypeScript。

交付标准：

- `/shangshufang` 首屏能读取真实 `home`。
- 下旨、确认、裁决不出现 404/422。
- 页面能力矩阵不展示不存在的 briefing endpoint。
- UI 截图层面不应出现布局、样式、交互入口变化。

### 第二阶段：2-3 天

- 实现 `swarm-deepen`。
- 实现 `pack-swarm-loop`。
- 接入真实蜂群状态与 source label。
- 补 P1 API 测试和 e2e。

交付标准：

- PACK 相关指令能生成真实后端响应。
- 深挖按钮不再 404。
- 后端能力不足时返回诚实 fallback。

### 第三阶段：3-5 天

- finance-intel-loop 完整收口。
- decision brief 状态机落表或绑定现有 review。
- IM / polish / edict-return 定义最小契约并实现。

交付标准：

- 页面所有可点击后端动作都有真实 API。
- 不存在静默 mock 成功。
- 史馆归档、复命、裁决收据能相互追溯。

## 回滚方案

P0 回滚：

- 前端恢复原 `jiqun-api.ts` action 发送逻辑。
- 后端恢复 `DecisionRequest.action` 原 Literal。
- 页面 endpoint 文案恢复到旧注释。
- 不涉及 UI 回滚，因为本方案不允许改 UI 层。

P1/P2 回滚：

- 保留新增接口但返回 `501 not_implemented` 或 `success: false`，避免前端误判成功。
- 前端隐藏对应按钮或显示“能力未接入”。

## 最小结论

上书房不是从零开始接后端；主 P0 链路已经有后端实现，并通过前端路径转换接上。当前最关键的问题是契约口径和裁决 action 不一致。先修这两个点，再按优先级补 `swarm-deepen`、`pack-swarm-loop`、finance-intel 和 IM，整个页面就能从“能看、部分能用”升级为“可持续演进的真实业务入口”。
