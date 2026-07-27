# R0-W07-A0 Authority Scope Amendment Proposal

> 状态：`PROPOSED_NOT_AUTHORITY`
>
> 本文件不修改 `.harness/manifest/execution-authority.v2.json`，不改变
> `R0-W07 = ACTIVE`，也不授权产品代码施工。

## 1. 绑定身份

| 字段 | 值 |
| --- | --- |
| Parent work package | `R0-W07` |
| Sub-slice label | `W07-A0_CONTRACT_BRIDGE_REMEDIATION` |
| Ledger entry | `NONE` |
| Design base | `b8f7b27b87a68b159e6db1b0a39a205c13126721` |
| Design base tree | `156ad59c927d9e8f47a6ab8a97642da69b97e362` |
| Integration target | local `feature-chaotang-ext` |
| Owner | Product Owner `lyt` |

W07-A0 只是 W07 内部实施顺序。禁止把它写入 v2 ledger、创建第二个
`activeWorkPackage`，或使 W08/W09 提前可执行。

## 2. 问题裁决

W07 当前缺少浏览器可消费的 canonical contract task read model。前端若根据旧 task
status、按钮词表、manifest 是否存在或 URL 参数推导完成、可裁决、可下载和已归档，
将违反 R0-REQ-021。

为了先恢复全面施工，再补强长期结构，建议采用两个强制 checkpoint。两者都属于
W07-A0；Checkpoint A 不能单独关闭 W07。

## 3. Checkpoint A：RUNNABLE_MINIMUM

后续另行获批的 implementation candidate 可以：

1. 将 `DecisionTask.id` 作为 R0 兼容 mission lineage id，并强制
   `mission_contract_id == task_id`、tenant/user 一致。
2. 使用现有 `CourtLoopRun` 保存完整 `MissionContractV1` revision snapshot；
   不再让 W07 依赖进程内 `_MISSION_DRAFT_STORE`。
3. 冲突或出现两个 current snapshot 时 fail closed；不在应用层猜测赢家。
4. 新增一个 Pydantic/OpenAPI 事实源 `ContractTaskReadModelV1`，只投影已有事实。
5. 由服务端输出 `allowed_actions` 和 `blocking_reasons`。
6. 同 lineage 投影 current `FinalMemorial`、`ContractReviewPackV1`、最新公开
   `ArtifactManifestV1` 和真实 `ArchiveReceiptV1`。
7. 生成 TypeScript contract 和 typed adapter，只挂载到现有
   `/shangshufang`、`/shiguan`。
8. 跑通一条合成数据 real-backend browser flow。

Checkpoint A 的 PARTIAL 恢复只覆盖当前持有 raw token 的浏览器会话；刷新后必须显示
明确 blocker，不能伪造可恢复、DELIVERED 或 archived。

## 4. Checkpoint B：PRE_W08_HARDENING

在允许 W08 activation candidate 前必须：

1. 将 compat snapshot 迁移为专用、版本化、tenant-scoped mission revision 存储，
   由数据库约束唯一 binding、revision 和 digest CAS。
2. 提供受认证、tenant-scoped、无需浏览器持久化 raw token 的 PARTIAL 恢复能力。
3. 让 read model 在一致事务快照内读取 mission、task、memorial、manifest、decision
   和 archive；混合版本必须 fail closed。
4. 补齐并发 confirm/resume、重启、刷新、断线、重复提交、cross-tenant 和 corrupt
   lineage 测试。
5. 将 Shiguan exact detail 改为真实 receipt/readback；无真实 receipt 不显示归档。
6. 完成独立只读审查和 exact-H 验收。

必要 Alembic 文件只能在隔离实现分支创建，并只对 disposable database 验证。执行
任何持久数据库 migration、backfill 或部署仍需新的 authority。

## 5. 文件 ownership

| Owner | 允许区域 | 说明 |
| --- | --- | --- |
| Backend Contract | `backend/src/contracts/`、`backend/web/schemas/` | Pydantic/OpenAPI SSOT |
| Canonical Runtime | `backend/src/`、`backend/web/routers/` | binding、projection、commands |
| Schema Hardening | `backend/src/db/models.py`、`backend/alembic/versions/` | 仅 Checkpoint B |
| Backend QA | `backend/tests/` | RED/GREEN、migration、API |
| Frontend Feature | `frontend/src/features/contract-review/` | generated consumer adapter/components |
| Protected Page Owner | `ShangshufangPage.tsx`、`ShiguanPage.tsx` | 仅 hunk-level，一个文件一个写者 |
| Browser QA | `frontend/e2e/` | 合成 real-backend slice |
| Governance | 本 change 与 design/plan | 不持有 runtime |

## 6. 明确禁止

- `NO_SECOND_WORK_PACKAGE`
- `NO_SECOND_TASK_OR_COMPLETION_STATE`
- `NO_BROWSER_COMPLETION_INFERENCE`
- `NO_NEW_PRODUCT_PAGE`
- `NO_BFF_OR_NEXT_ROUTE_HANDLER`
- `NO_AGENT_OR_DEPARTMENT_EXPANSION`
- `NO_DADIAN_CHANGE`
- `NO_MOCK_AS_REAL`
- `NO_W08_OR_W09_IMPLEMENTATION_IN_W07_A0`
- `NO_REAL_CUSTOMER_DATA`
- `NO_PUSH`
- `NO_DEPLOYMENT`
- `NO_PERSISTENT_DB_MIGRATION`
- `NO_LISTENER_3050_OPERATION`
- `NO_PRODUCTION_CLAIM`

## 7. Review gate

产品代码施工前必须同时满足：

1. Product Owner 明确批准本 scope、设计和 TDD 计划。
2. 从届时最新 local EXT exact H 创建新的 isolated implementation worktree。
3. 在任何实施提交前，v1 integrity check 返回 `VALID_INACTIVE_GUARD`。
4. 在 worktree HEAD 仍等于 local EXT exact H 时，v2 对 `R0-W07` 返回
   `GO / APPROVED_WORK_PACKAGE`；首个隔离提交后必须预期
   `STOP / PRE_INTEGRATION_W07`，不得移动 EXT ref 绕过。
5. implementation Packet 固定 owner、files、out-of-scope、RED 和 proof commands。
6. Checkpoint A 通过后由 Codex 只读验收，再决定是否进入 Checkpoint B。

任一 authority、production、scope、ownership 或 concurrent-writer 冲突都必须
`BLOCKED`。

## 8. W08/W09 handoff

- W08 只消费 Checkpoint B 后的稳定 read model、browser selectors、archive readback
  和 fault states，并生产 36 goldens、10/10 traces、5-user acceptance。
- W09 只在 W08 全门通过后冻结 exact source/build/database/listener identity，运行
  prod doctor 和 verification loop。
- W07-A0 的 runnable demo、local browser pass 或 isolated migration pass 都不能替代
  W08/W09 证据。
