
# 决策 0040：每日奏报待审草稿与调度契约

## Status

Accepted — 2026-08-05

## Context

现有 `/study` 支持咨询、拟旨和用户主动下旨。ADR 0028 要求下旨仍是唯一执行入口，下旨后自动归档的是一条 `REPLY`，不得把机器生成内容伪造成 `MEMORIAL`。史馆只有真实上奏或呈报才能创建 `MEMORIAL`。

用户希望每天得到一份覆盖 39 司、6 部和丞相总报的管理奏报，但“每天自动生成正式奏折”会把调度器行为冒充为用户上奏，也会让失败重试产生重复档案。该能力必须把自动汇总与正式业务行为分离，并明确 owner/date 幂等、时区、受控事实、失败恢复和人工确认边界。

考虑过三种路径：

1. 由部署调度器调用后端 CLI，持久化待审草稿，用户确认后才创建 `MEMORIAL`。该路径可测试、可恢复，不暴露调度 HTTP，且能把自动化与正式上奏分开。
2. 在 FastAPI 进程内运行定时器。多 worker、重启和部署生命周期会造成漏跑或重复跑，且进程存活不等于调度可靠，因此拒绝。
3. 暴露调度 HTTP 或直接自动归档正式 `MEMORIAL`。前者扩大攻击面并允许浏览器/调用方选择执行时机，后者违反真实上奏与人工确认边界，因此拒绝。

## Decision

采用“部署调度 CLI → owner/date 幂等 run → 39 司 → 6 部 → 丞相待审稿 → 上书房人工确认 → 正式 `MEMORIAL`”路径。

### 业务日期与调度

- 业务时区固定为 IANA `Asia/Shanghai`，不得使用主机本地时区或 UTC 日期替代业务日期。
- 默认在本地日期 D 的 `00:15` 处理 `report_date = D-1`，事实窗口为 `[D-1 00:00:00, D 00:00:00)`；边界转换后以带时区 RFC 3339 时间持久化。
- 仓库只提供 `python -m app.daily_memorial_drafts run-due` CLI 契约，不内置常驻定时器，也不新增调度 HTTP 端点。部署侧可以在 `00:15` 首次调用，并按固定周期再次调用以恢复到期重试；具体 cron/平台配置不写死在应用代码中。
- CLI 的 `--report-date YYYY-MM-DD` 只供受控补跑与离线验收。它不接受 owner、URL、提示词、凭据或“立即归档”参数。

### owner/date 幂等与持久化

- `daily_memorial_runs` 以 `(owner_user_id, report_date)` 唯一，run 状态仅允许 `PENDING`、`GENERATING`、`READY_FOR_REVIEW`、`SKIPPED_NO_FACTS`、`FAILED`、`CONFIRMED`。
- `daily_memorial_fact_snapshots` 保存本 run 从 owner-scoped 史馆档案冻结的事实引用、原文摘要、档案/证据 ID 与时间边界；快照形成后不得在重试中漂移。
- `daily_memorial_stage_results` 以 `(run_id, stage, unit_key)` 唯一。`stage` 只允许 `BUREAU`、`MINISTRY`、`CHANCELLOR`；39 个司、6 个部和丞相各有固定 `unit_key`，每个单元记录终态、输入指纹、输出、引用、尝试次数、稳定失败码和 `next_retry_at`。
- 上述表与史馆 `archives` 位于同一个 SQLite 事务域，并把 schema 从 v3 显式升级为 v4。运行库迁移必须先只读检查、建立备份、在一个事务中创建和验证新表/索引，最后设置 `PRAGMA user_version = 4`；失败整体回滚并保留备份。
- 同一 owner/date 的重复调度只领取未完成且 `next_retry_at <= now` 的单元。成功单元永不重复调用模型。并发领取使用 `BEGIN IMMEDIATE` 与条件更新，避免两个调度进程同时执行同一单元。

### 受控事实与 39 → 6 → 1 聚合

- 首版受控事实源只包括当前 owner 在报告窗口内可见的史馆 `MEMORIAL`、`REPLY` 及这些档案已经持久化的不可变证据引用；不触发锦衣卫调查、MCP、公开 API、网页访问或任意搜索。
- owner/date 没有受控事实时，run 直接进入 `SKIPPED_NO_FACTS`。该路径不调用任何模型，不生成待审正文，也不会生成空正式奏折。
- 有事实时，系统按权威 39 司 profile 固定顺序创建 39 个司单元。每个司只能返回 `READY` 或 `NO_MATERIAL`；`READY` 中每条事实性陈述都必须引用本 run 的事实 ID，引用不存在、跨 owner、超出窗口或未覆盖声明时输出无效并进入可重试失败。
- 39 个司全部终态后，系统按固定六部名录形成 6 个部级单元。部级输入只能是本部司级终态结果和同一事实快照，不得调用其它来源。
- 6 个部全部终态后，丞相形成唯一总报。总报至少包含报告日期、事实截止时间、六部摘要、跨部风险/依赖、待用户决定事项和事实引用。推断必须显式标记为判断，不能伪装成事实。
- 任何层级不得声称已调查、已执行、已批准、已归档或已下旨；该每日链路不是 ADR 0028 的下旨图，不产生 `REPLY`。

### 失败、重试与恢复

- 可重试失败使用稳定失败码，并按 `1 分钟 → 5 分钟 → 30 分钟` 设置最多 3 次自动尝试。调度器不在进程内长时间睡眠，而是持久化 `next_retry_at` 后退出，由后续 CLI 调用恢复。
- 校验失败、配置缺失、模型暂不可用和数据库争用分别记录稳定类别；日志不得包含 session、密码、凭据、完整模型响应或未脱敏私人内容。
- 任一必需单元在自动尝试耗尽后，run 进入 `FAILED`，保留已完成检查点。受控人工补跑可以重新开放失败单元，但不得删除成功单元、替换事实快照或创建新 run。
- 进程在模型调用后、结果提交前中断时，该单元可再次调用；提交必须以输入指纹和条件更新防止覆盖另一进程已经写入的终态。该极小重复调用窗口不允许产生业务档案副作用。

### 读取、人工确认与正式档案

- FastAPI 只新增受认证的 `GET /api/v1/daily-memorial-drafts/latest` 和 `POST /api/v1/daily-memorial-drafts/{draft_id}/confirm`。二者从 `CurrentUser` 决定 owner；请求不得携带 owner ID。
- `GET latest` 返回当前 owner 最新 run 的状态。只有 `READY_FOR_REVIEW` 或 `CONFIRMED` 返回完整草稿；`SKIPPED_NO_FACTS` 明确返回无材料状态；跨 owner ID 不可见。
- 确认请求体固定为 `{"version": <int>, "fingerprint": "<sha256>"}`。只有当前 owner 的 `READY_FOR_REVIEW` 且版本、指纹完全一致时才能确认；陈旧、失败、无事实或生成中状态返回 `409`，不产生副作用。
- 确认事务对 run 执行条件更新，并通过现有史馆验证创建一条 `type=MEMORIAL`、owner-scoped 的真实奏折。奏折正文等于用户所见待审稿快照，标题包含报告日期，`matter_type` 标记为每日奏报，部门为丞相；不得携带 `REPLY` 专属字段。
- 确认成功后 run 进入 `CONFIRMED` 并保存唯一 `confirmed_memorial_id`。相同版本/指纹的重放返回同一 `memorial_id`；不同版本/指纹返回冲突。事务失败时两者均不落盘。
- 确认只完成真实上奏/呈报及史馆 `MEMORIAL` 入档，不自动下旨、不调用六部办理图、不创建 `REPLY`。后续若要办理该奏折，仍须另行遵守 ADR 0028 和现有正式入口，不得由本 ADR 暗中扩展。
- Next.js 只提供同源、受认证 BFF：`GET /api/daily-memorial-drafts/latest` 和 `POST /api/daily-memorial-drafts/{id}/confirm`。BFF 只在服务端转发 HttpOnly session，严格解析 ID/请求/响应并返回脱敏稳定错误。
- 上书房展示生成中、无事实、失败、待确认和已确认状态；只有待确认且指纹仍为当前版本时显示确认动作。页面不得自动确认，不得在加载、刷新或重试时创建档案。

### HTTP 契约

`GET /api/v1/daily-memorial-drafts/latest` 的成功体固定为：

```json
{
  "status": "READY_FOR_REVIEW",
  "draft": {
    "id": "opaque-draft-id",
    "report_date": "2026-08-04",
    "source_window_start": "2026-08-04T00:00:00+08:00",
    "source_window_end": "2026-08-05T00:00:00+08:00",
    "version": 1,
    "fingerprint": "64-lowercase-hex",
    "bureau_result_count": 39,
    "ministry_result_count": 6,
    "content": "待审总报正文",
    "fact_refs": ["fact-id"]
  },
  "memorial_id": null,
  "failure_code": null
}
```

其它状态保持相同顶层键；没有待审稿时 `draft` 为 `null`，未确认时 `memorial_id` 为 `null`。确认成功体固定为：

```json
{
  "status": "CONFIRMED",
  "draft_id": "opaque-draft-id",
  "memorial_id": "opaque-archive-id"
}
```

## Consequences

- 收益：自动汇总与正式上奏被清晰分离；用户看到并确认的字节快照才成为 `MEMORIAL`。
- 收益：owner/date 唯一键、阶段检查点和事务确认覆盖重复调度、重启、重试与重复点击。
- 收益：事实快照和引用校验让模型只能总结受控材料；无材料时不花费模型调用且不生成空档案。
- 代价：最坏每个有材料的 owner/date 需要 46 次模型调用，运行时间和费用显著，部署侧必须显式配置调度并监控失败。
- 代价：史馆 schema 升级为 v4，需要备份、显式迁移、回滚验证与运行文档更新。
- 限制：首版只消费报告窗口内既有史馆事实，不主动获取新事实；这可能导致许多司返回 `NO_MATERIAL`，属于诚实结果而非缺陷。
- 治理：本决策补充的是正式上奏前的自动待审草稿，不修改 ADR 0028。任何自动确认、自动 `MEMORIAL`、自动 `REPLY`、自动下旨或新增事实源都需要新的用户确认与 ADR。

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m pytest -q

cd ..\frontend
npm run lint
npm run typecheck
npm test
npm run build

cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
git diff --check
```

正式验收必须在同一冻结版本上连续完整执行上述流程和每日奏报专项 CLI/跨 owner/确认恢复场景至少 10 轮；任一轮失败或版本、配置、验收流程实质变化后从第 1 轮重新计数。
