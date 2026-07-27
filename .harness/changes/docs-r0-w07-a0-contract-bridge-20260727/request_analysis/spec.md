# 规格说明：docs-r0-w07-a0-contract-bridge-20260727

## 背景

R0-W07 已在 local EXT `b8f7b27b...` 上激活。W07 要求现有
`/shangshufang` 与 `/shiguan` 只消费服务端事实，完成一旨一卡一包和同 lineage
归档回读。

启动审计确认 W02 Mission 仍是内存 stub、W05 使用 task ID 代替 mission ID、W06
交付不能从 task read model 发现、Shiguan exact detail 仍为 FALLBACK。W07 前端若
直接开工，只能在浏览器重复发明状态和 lineage。

## 产品优先级

采用“先跑通、再完善”，但两个阶段有不同完成声明：

| Checkpoint | 目标 | 可以声明 | 不可声明 |
| --- | --- | --- | --- |
| A `RUNNABLE_MINIMUM` | 一条合成合同经真实后端、现有两页完成闭环 | workspace flow runnable | W07 complete、W08 ready、production |
| B `PRE_W08_HARDENING` | 持久化、并发、恢复和异常路径满足稳定验收 | W07 closeout candidate | W08/W09 complete、deployed |

Checkpoint B 是 W08 的硬前置，不能因 A 已跑通而取消。

## 当前实现与证据

| 事实 | 证据 | 结论 |
| --- | --- | --- |
| W07 在 exact EXT 设计基线上为 GO | 开始编辑前运行 v2 authorize | 可设计；本 change 不授权产品修改 |
| 隔离候选因 HEAD 与 EXT ref 不同而 STOP | exact candidate 上 v2 authorize | 预期 `PRE_INTEGRATION_W07`；禁止移动 ref 绕过 |
| Mission draft/confirm 使用进程内 dict | `backend/web/routers/contracts.py` | A 必须消除 W07 对内存事实的依赖 |
| W05 pack 将 task id 写成 mission id | `backend/src/contract_rework.py` | A 要显式化 R0 compatibility binding |
| task status 不含 actions/manifest/receipt | `shangshufang_task_status` | A 新增 typed server projection |
| Shiguan exact detail 为 FALLBACK | `backend/web/routers/governance_compat.py` | A/B 必须只认真实 archive row |
| PARTIAL raw token 只返回一次 | W06 artifact contract/routes | A 诚实阻断刷新恢复；B 提供服务端恢复 |
| frontend focused baseline 11/11、tsc PASS | 已运行 focused node tests 与 `tsc --noEmit` | 只证明当前基线未坏 |

## 候选方案

### 方案 A：两阶段 compatibility bridge，采用

Checkpoint A 使用现有 `DecisionTask` 与 `CourtLoopRun` 保存和读取完整
`MissionContractV1` revision snapshot，不新建数据库表；Checkpoint B 再切换到专用
mission revision 表和数据库约束。

优点是能尽快形成真实纵向切片；代价是 A 的唯一性只能由事务查询和 fail-closed
冲突检测保障，所以不能直接进入 W08。

### 方案 B：前端聚合旧接口，拒绝

浏览器并行读取 task、artifact、archive 后自行计算状态最快，但会产生第二套状态和
完成判断，刷新时还会丢 PARTIAL capability，违反 W07 合同。

### 方案 C：完整 mission schema 后再开 UI，延后到 Checkpoint B

先做新表、迁移、并发和恢复最稳健，但会继续阻塞所有 W07 页面工作。保留为 B 的目标，
不作为 A 的开工前置。

## Checkpoint A 架构

```text
MissionContractV1 body
  -> compatibility repository over CourtLoopRun
     exact rule: tenant/user task ownership
                 mission_contract_id == task_id
                 revision + content_digest validated
  -> ContractTaskReadModelV1 projection
     DecisionTask
     + current FinalMemorial / ContractReviewPack
     + latest lineage ArtifactManifest
     + exact ShiguanArchive receipt
     + server allowed_actions/blocking_reasons
  -> generated TypeScript contract
  -> existing /shangshufang and /shiguan
```

Compatibility rows use a reserved `loop_id` and complete JSON snapshot. They do not change
`DecisionTask.status` and are not a second task state machine. If zero current snapshots exist,
the read model blocks mission-dependent actions. If more than one incompatible current snapshot
exists, it reports `MISSION_BINDING_CONFLICT` and returns no mutating actions.

## Checkpoint B 架构

```text
mission_contract_revisions
  unique(tenant_id, task_id, revision)
  unique(tenant_id, mission_contract_id, revision)
  exact content_digest CAS
  one canonical mission lineage per task
        |
        v
consistent transaction snapshot
  -> ContractTaskReadModelV1
  -> authenticated partial-recovery capability
  -> exact archive detail/readback
```

B includes a forward-only Alembic file and disposable migration tests. It does not include
executing migration against any persistent database.

## Read Model Contract

`ContractTaskReadModelV1` is a pure projection and contains:

- `schema_version`, `read_revision`, `generated_at`, `source_label`;
- tenant-owned `task_id` and exact `mission_contract_id/revision/content_digest`;
- current `FinalMemorial` id/version/content hash and `ContractReviewPackV1`;
- latest matching public `ArtifactManifestV1` projection and downloadable items;
- `ArchiveReceiptV1` only when archive task/final id/version/hash match;
- `allowed_actions` and machine-readable `blocking_reasons`;
- explicit PARTIAL recovery state without raw token, storage path or idempotency secret.

The read model does not accept browser-supplied status, completion, manifest identity or archive
identity. Unknown, stale, cross-tenant or mixed lineage returns no privileged action.

## Server Action Rules

| Facts | Allowed action |
| --- | --- |
| mission absent/conflicting | edit/confirm only when server can identify exact draft; otherwise none |
| review incomplete or evidence missing | `submit_evidence` / `refresh` as resolved by server |
| current memorial ready and exact pack valid | `decide` |
| approved decision and no delivery | `generate_delivery` |
| PARTIAL with current-session raw token | `resume_delivery` for that command response only |
| PARTIAL after refresh at Checkpoint A | no resume action; `PARTIAL_RECOVERY_REQUIRES_HARDENING` |
| PARTIAL with authenticated recovery at Checkpoint B | `resume_delivery` |
| READY and unexpired stored item | `download` |
| exact archive receipt | `reopen_archive` |

`allowed_actions=[]` plus blockers is the default.

## Frontend Consumption

- Generated OpenAPI TypeScript remains the schema source.
- New adapter/components live under `frontend/src/features/contract-review/`.
- `ShangshufangPage.tsx` and `ShiguanPage.tsx` receive only hunk-level mounts.
- The pages render server actions and blockers; they do not infer success from HTTP 200,
  task text, URL ids or local cache.
- No new route, page, BFF, Agent or state machine.

## Boundary Conditions

| Condition | Expected behavior |
| --- | --- |
| task absent or not owned | indistinguishable 404 |
| mission task/id mismatch | 409 on write; fail-closed read |
| stale revision/digest | 409; current snapshot unchanged |
| duplicate incompatible compatibility rows | blocker; no privileged action |
| pack/final identity drift | no decision or delivery |
| manifest/final identity drift | no delivery projection or download |
| PARTIAL after refresh in A | explicit blocker; never READY |
| archive missing final id/version/hash | no receipt and no archived label |
| source is FALLBACK/DEMO | preserve label; never promote to LIVE |
| facts change during B read | retry consistent read or explicit blocker |

## Rollback

Checkpoint A is feature-flagged. Disabling the read model consumer restores current pages without
deleting task, review, artifact or archive data. Compatibility rows are retained for audit.

Checkpoint B migration is forward-add only. Code rollback preserves mission revisions; it must not
reinterpret confirmed missions as drafts. This design Packet itself changes no runtime and can be
dropped with its isolated branch.

## 非目标

- 本 Packet 不修改 product/runtime/schema/frontend code。
- 不修改 authority manifest、activation evidence 或 W07 state。
- 不新增页面、BFF、Agent、部门、任务状态、完成状态或裁决系统。
- 不实现 W08 36 goldens/scorer/10-run/5-user evidence。
- 不实现 W09 identity/prod-doctor/final verdict。
- 不 push、不部署、不迁移持久数据库、不操作 3050。

## 验收标准

- 文档只描述一个 W07 sub-slice，没有新 ledger work package。
- Checkpoint A 与 B 的声明边界清楚，B 是 W08 硬门。
- 每个 lineage identity 有服务端生产者和 fail-closed 规则。
- frontend 只消费 generated contract 与 server actions。
- 计划为每个行为要求先观察 RED，再做最小 GREEN。
- 无 placeholder、无产品代码，authority 与两层 doctor 保持通过。

## 批准记录

- 批准人：Product Owner `lyt`
- 日期：`2026-07-27`
- 已批准：创建 isolated W07-A0 remediation Packet；输出 scope、设计和 TDD 计划。
- 未批准：产品代码、push、deployment、任何数据库 migration 执行、3050、
  W08/W09 实施、真实客户数据、production claim。
