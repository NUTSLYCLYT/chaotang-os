# 规格说明：feat-r0-w07-a0-runnable-minimum-20260727

## 背景

W07 authority 已在 local EXT 激活，但 W07 前端消费前置契约未闭合：
Mission 路由仍以进程内字典为事实、task status 不含 server actions/manifest/receipt、
Shiguan exact detail 仍是 FALLBACK。已验收设计候选 `ed822255...` 规定先完成
Checkpoint A，再在 W08 前执行另行授权的 Checkpoint B。

## 当前实现与证据

| 分类 | 结论 | 证据 | Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认 | integrated EXT/base H 为 `ed822255...` 且干净 | Git identity/status | Governance | 否 |
| 已确认 | 编辑前 W07 v2 authority 为 GO | v2 authorize | Governance | 否 |
| 已确认 | Mission 路由使用 `_MISSION_DRAFT_STORE` | `backend/web/routers/contracts.py` | Backend | 是 |
| 已确认 | W05 使用 task id 作为 mission id | `backend/src/contract_rework.py` | Backend | 是 |
| 已确认 | task status 无 typed aggregate | `shangshufang_task_status` | Backend | 是 |
| 已确认 | Shiguan exact detail 是 FALLBACK | governance compat router | Backend/Frontend | 是 |
| 已确认 | frontend focused baseline 需 fresh 记录 | focused node tests + tsc | Frontend | 否 |
| 未知 | 一条 real-backend browser flow 的最小 seed/认证方式 | 实施阶段调查 | QA | 是 |

## 数据流

```text
MissionContractV1
  -> DecisionTask exact compatibility binding
  -> CourtLoopRun mission snapshot
  -> current FinalMemorial / ContractReviewPack
  -> latest verified ArtifactManifest
  -> exact ShiguanArchive receipt
  -> ContractTaskReadModelV1 + allowed_actions
  -> /shangshufang
  -> /shiguan reopen
```

## 事实源

| 契约 | 生产者 / 事实源 | 消费者 | Checkpoint A 边界 |
| --- | --- | --- | --- |
| `MissionContractV1` | backend Pydantic + CourtLoopRun compat repository | projection/W05 | `mission_contract_id == task_id` |
| `DecisionTask` | existing `decision_tasks` | mission/projection | 不新增 task status |
| `ContractTaskReadModelV1` | backend projection | generated TS consumer | 纯投影 |
| `allowed_actions` | backend pure resolver | frontend | 浏览器不补 action |
| `ArtifactManifestV1` | W06 verifier/service | projection/download UI | 不泄漏 raw token/path |
| `ArchiveReceiptV1` | exact tenant-owned ShiguanArchive | Shiguan readback | 无 receipt 不称 archived |

## 文件范围

- Backend contracts/runtime/routes/tests：
  `backend/src/contracts/`、`backend/src/contract_mission_repository.py`、
  `backend/src/contract_task_projection.py`、`backend/web/routers/contracts.py`、
  `backend/web/routers/shangshufang.py`、focused `backend/tests/`。
- Frontend generated contract/feature/tests：
  existing generated OpenAPI artifacts、`frontend/src/features/contract-review/`、
  hunk-only `ShangshufangPage.tsx`、`ShiguanPage.tsx`、focused `frontend/e2e/`。
- Governance/evidence：本 root Packet；需要时建立一个 frontend child change。
- Test-only browser harness：
  `backend/harness/chaotang-true-loop/scripts/run_w07_runnable_backend.py`，仅允许临时
  runtime、真实 JWT seed 和 READY/PARTIAL 合成任务；不得挂载到产品 OpenAPI。

## 非目标

- 不创建 schema/migration，不执行 Checkpoint B。
- 不实现 W08 goldens/10-run/5-user 或 W09 identity。
- 不新增产品页面、BFF、Agent、状态机。
- 不 push、不部署、不操作 persistent DB 或 3050。

## 边界条件

| 条件 | 预期行为 | 验证 |
| --- | --- | --- |
| mission/task/tenant 不一致 | write 409 或 tenant-safe 404；read fail closed | repository/API tests |
| stale revision/digest | current snapshot 不变 | conflict tests |
| duplicate incompatible current mission | no privileged action + blocker | projection tests |
| pack/final/manifest identity 漂移 | 不投影 decision/delivery | lineage tests |
| archive final identity 不完整 | 无 receipt、无 archived label | archive tests |
| PARTIAL 刷新 | 显示 hardening blocker，不提供 resume/delivered | backend/frontend/E2E |
| FALLBACK/DEMO | 保留 source label | component/E2E |
| nested RiskItem fallback/aggregate drift | effective source class fail closed，无 `DECIDE` | projection/API tests |
| URL archiveId 与 receipt 不一致 | exact readback error，不回退 indexed detail | node/E2E |
| manifest READY 但文件不可下载 | 公开状态降为 `UNDER_REVIEW` | projection/action tests |

## 风险与回滚

- `CourtLoopRun` 没有数据库唯一约束：Checkpoint A 通过冲突检测 fail closed，不能直接
  作为 W08 稳定性证据。
- 大页面冲突：两个 protected page 仅一个写者、hunk-level 接入。
- W06 语义漂移：复用公开 verifier/service，不重写 artifact 完成公式。
- 回滚：关闭/移除新 consumer 和 projection；保留已有 task/review/artifact/archive
  数据。当前未部署。

## 批准记录

- 批准人：Product Owner `lyt`
- 批准日期：`2026-07-27`
- 批准：设计 Packet 受控 fast-forward；从 integrated exact H 创建 isolated
  Checkpoint A Packet；按 TDD 执行 `RUNNABLE_MINIMUM`。
- 独立审查 remediation 批准：修复全部 HIGH/MEDIUM；允许仅在既有 decision
  endpoint 增加 `tenant_id + user_id` 双重所有权校验，并修改
  `backend/web/routers/shangshufang.py` 与 focused tests；补 seeded PARTIAL browser
  refresh 和固定 OpenAPI baseline。
- 未批准：Checkpoint B、push、部署、数据库迁移、3050。

## 验收标准

- Mission snapshot 跨数据库 session 可回读，且唯一兼容绑定 fail closed。
- read model 的 action/blocker/pack/manifest/receipt 全由服务端产生。
- 两个现有页面消费同一 typed read model，不新增 route。
- synthetic real-backend flow 可从合同任务走到 authorized download 和 Shiguan reopen。
- PARTIAL 刷新限制诚实可见。
- focused backend/frontend tests、typecheck/build、browser flow 和 doctors 有 fresh evidence。
- 结论只写 `RUNNABLE_MINIMUM / NOT_DEPLOYED`。

## 验证计划

严格按已验收
`docs/superpowers/plans/2026-07-27-r0-w07-a0-contract-bridge.md`
Checkpoint A Task 1-8 执行 RED/GREEN。实现候选提交后 v2/root doctor 会因 isolated HEAD
与 EXT ref 不同而预期 PRE_INTEGRATION STOP；这不允许移动 EXT ref 绕过。
