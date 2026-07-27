# R0-W07-A0 Contract Bridge Design

## Status

- Design status: `CANDIDATE / NON_AUTHORIZING`.
- Parent authority: `R0-W07 = ACTIVE`.
- Design base: `b8f7b27b87a68b159e6db1b0a39a205c13126721`.
- Base tree: `156ad59c927d9e8f47a6ab8a97642da69b97e362`.
- Product code: unchanged by this Packet.
- Production state: `NOT_DEPLOYED`.

## Objective

Restore one canonical contract flow before W07 frontend work expands:

```text
upload/intake
  -> MissionContract
  -> DecisionTask
  -> EvidencePacket / RiskItem
  -> FinalMemorial / ContractReviewPack
  -> ArtifactManifest
  -> PDF/DOCX/JSON authorized download
  -> ArchiveReceipt
  -> Shiguan audit replay
```

The immediate objective is not to perfect every storage boundary. It is to make one synthetic,
real-backend vertical slice runnable through the two existing pages without browser-owned truth.
The hardening needed for repeatable W08 acceptance remains a mandatory second checkpoint.

## Fixed Product Boundary

- Only existing `/shangshufang` and `/shiguan` are UI surfaces.
- Backend owns task, mission, review, delivery, decision and archive facts.
- Frontend consumes a generated typed read model and server `allowed_actions`.
- No new page, Agent, BFF, department, task state machine or completion formula.
- W07-A0 is not a new v2 work package.
- No push, deployment, persistent migration, listener 3050 operation or production claim.

## Decision

Adopt a two-checkpoint compatibility bridge.

### Checkpoint A: RUNNABLE_MINIMUM

Use existing persistent structures to remove the in-memory and browser-truth blockers:

- `DecisionTask` remains the canonical task.
- R0 compatibility identity is explicit:
  `mission_contract_id == task_id`.
- Full `MissionContractV1` snapshots are stored in existing `CourtLoopRun` rows under a reserved
  loop id.
- A backend projection produces `ContractTaskReadModelV1`.
- Existing pages render only the projection and its actions.
- One synthetic real-backend browser flow proves workspace runnability.

Checkpoint A does not claim database-enforced mission uniqueness, cross-session PARTIAL recovery,
or W07 completion.

### Checkpoint B: PRE_W08_HARDENING

Before W08 activation:

- move mission snapshots into a dedicated revision table;
- enforce tenant/task/mission/revision uniqueness and digest CAS in the database;
- provide authenticated PARTIAL recovery across refresh/reconnect;
- read all projected facts from a consistent transaction snapshot;
- verify restart, concurrency, duplicate, fault and tenant-isolation behavior;
- complete independent review and exact-H W07 closeout.

## Rejected Alternatives

### Frontend Composition

Having the browser read task, manifest and archive endpoints independently is quicker to code but
creates another state resolver. It cannot safely determine current memorial identity, archive
lineage or PARTIAL recovery. Rejected.

### Full Schema First

Building the dedicated mission store before any UI integration gives the strongest data model but
keeps all W07 work blocked on schema and migration verification. It is retained as Checkpoint B,
not as the first runnable milestone.

## Checkpoint A Components

### Compatibility Mission Repository

The repository stores complete `MissionContractV1` JSON in `CourtLoopRun.output_json` with:

```text
loop_id = "contract-mission-v1"
task_id = MissionContractV1.task_id
status  = "draft" | "confirmed"
```

Repository rules:

1. Resolve the owned `DecisionTask` before storing or reading.
2. Require `mission_contract_id == task_id`.
3. Recompute and compare `content_digest`.
4. Require monotonically increasing revision for changed content.
5. Treat identical revision/digest replay as idempotent.
6. Reject stale or conflicting replay with 409.
7. If persisted rows imply more than one incompatible current mission, return a blocker and no
   privileged actions.

This is a compatibility repository, not a second task state system. It does not change
`DecisionTask.status`. Its lack of a database uniqueness constraint is why Checkpoint B is
mandatory.

### Canonical Read Model

Add one domain endpoint:

```http
GET /api/contracts/tasks/{task_id}/read-model
```

It returns `ContractTaskReadModelV1` directly from backend contracts. The schema contains:

```python
class ContractTaskReadModelV1(BaseModel):
    schema_version: Literal["ContractTaskReadModelV1"]
    read_revision: str
    generated_at: datetime
    source_label: Literal["LIVE", "FALLBACK", "DEMO"]
    task: ContractTaskIdentityV1
    mission: MissionContractV1 | None
    review_pack: ContractReviewPackV1 | None
    final_memorial: FinalMemorialIdentityV1 | None
    delivery: PublicArtifactDeliveryV1 | None
    archive_receipt: ArchiveReceiptV1 | None
    allowed_actions: list[ContractTaskAction]
    blocking_reasons: list[ContractTaskBlockerV1]
```

No raw resume token, idempotency key, internal path, model prompt, storage key or cross-tenant
identifier is included.

### Identity Join

The projection only emits a downstream fact when all available identities agree:

```text
tenant_id
+ task_id
+ mission_contract_id
+ final_memorial_id
+ final_memorial_version
+ final_memorial_content_hash
```

The exact fields required at each join are:

| Join | Required equality |
| --- | --- |
| mission -> task | tenant/user ownership, `mission.task_id == task.id`, `mission_contract_id == task.id` |
| pack -> mission/task | `pack.task_id`, `pack.mission_contract_id` |
| final -> pack | current final id/version/hash and embedded review pack |
| manifest -> final | tenant/task/final id/version and verified public manifest |
| archive -> final | tenant/task/final id/version/hash |

Missing data is represented as missing plus a blocker. Conflicting data is never combined into a
synthetic success response.

### Server Action Resolver

The resolver is a pure function over authoritative facts. Its closed action vocabulary is:

```text
EDIT_MISSION
CONFIRM_MISSION
SUBMIT_EVIDENCE
REFRESH_REVIEW
DECIDE
GENERATE_DELIVERY
RESUME_DELIVERY
DOWNLOAD_ARTIFACT
REOPEN_ARCHIVE
```

The default is no action. A later action is exposed only when all earlier identity and state gates
are satisfied. The server also returns machine-readable blockers such as:

```text
MISSION_MISSING
MISSION_BINDING_CONFLICT
EVIDENCE_INCOMPLETE
FINAL_MEMORIAL_NOT_CURRENT
LINEAGE_MISMATCH
DELIVERY_PARTIAL
PARTIAL_RECOVERY_REQUIRES_HARDENING
ARCHIVE_RECEIPT_MISSING
SOURCE_NOT_LIVE
```

### PARTIAL Delivery

Checkpoint A preserves W06 security:

- raw resume token is accepted only by the existing resume command;
- it is not written to URL, localStorage, read model or logs;
- a browser session holding the response may retry;
- after refresh, the read model shows PARTIAL and
  `PARTIAL_RECOVERY_REQUIRES_HARDENING`;
- the UI never promotes PARTIAL to delivered.

Checkpoint B introduces a server-side recovery capability bound to current user, tenant,
manifest lineage, expiry and audit. The browser still never persists the raw W06 token.

### Archive Receipt

`ArchiveReceiptV1` is produced only from a tenant-owned `ShiguanArchive` row whose final memorial
id, version and content hash match the current lineage. A FALLBACK detail payload is never
upgraded to a receipt.

The receipt gives `/shiguan` enough identity to reopen the exact read model. It does not duplicate
the review pack or create a second archive state.

## Frontend Architecture

Generated OpenAPI types are the schema source. A small feature module owns:

```text
frontend/src/features/contract-review/
  api.ts
  read-model.ts
  action-policy.ts
  ContractReviewPanel.tsx
  ContractArchiveReadback.tsx
```

`action-policy.ts` maps server action enums to existing commands and presentation labels; it does
not decide whether an action is allowed.

Protected page integration is hunk-level:

- `/shangshufang`: mount one contract panel in the current task workspace.
- `/shiguan`: replace formal FALLBACK detail with exact receipt/read-model consumption when
  available; preserve honest empty/FALLBACK states otherwise.

One file has one active writer. No page redesign is part of W07-A0.

## TDD and Verification Strategy

Every behavior change begins with a focused failing test observed for the expected reason.

Checkpoint A evidence:

- repository restart and stale/conflict tests;
- read model schema, authz, action and lineage tests;
- generated OpenAPI/type parity;
- frontend adapter/component tests;
- one synthetic real-backend browser flow including archive reopen;
- focused regression, doctor and independent read-only review.

Checkpoint B evidence:

- Alembic up/down on disposable database;
- DB uniqueness/CAS and concurrency tests;
- compat conversion tests;
- authenticated PARTIAL refresh/reconnect tests;
- consistent transaction and corrupt-lineage tests;
- browser refresh/fault flow;
- two independent Codex read-only passes on exact candidate.

## Exit Gates

### Checkpoint A Exit

All of the following are required:

- synthetic contract uses real backend and disposable/test-owned data;
- mission survives backend session restart;
- both existing pages consume the typed read model;
- delivery and archive identities match;
- no mock is represented as real;
- verdict is exactly `RUNNABLE_MINIMUM`, not W07 complete.

### Checkpoint B Exit

All of the following are required:

- mission uniqueness and revisions are database enforced;
- PARTIAL can recover after refresh without browser secret persistence;
- concurrent and fault tests pass;
- exact archive readback passes;
- affected regression, typecheck, build and browser tests pass;
- independent review has no HIGH or MEDIUM findings;
- exact-H acceptance authorizes W07 closeout.

Only then may governance prepare W08 activation.

## W08 and W09 Handoff

W08 consumes the stable W07 interface and produces:

- 36 or more golden contracts;
- 10/10 real-backend browser traces;
- five non-developer user tests with at least four successful;
- scorer, fault and evidence reports.

W09 consumes accepted W08 evidence and produces immutable source, build, database and listener
identity, a prod-doctor hard gate and the final verification loop.

Neither W07 local runnability nor W08 acceptance means production has switched.
