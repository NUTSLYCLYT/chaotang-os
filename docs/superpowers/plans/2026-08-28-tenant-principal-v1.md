# Tenant Principal V1 Implementation Plan

任务：`TENANT-PRINCIPAL-V1-20260828`

基线：`f00a0d925e7df48b12cdcb57a03a3b915ebe0f3c` / tree `5b9d8dcbfb9dc319ab0c16418d340c9dfb9bec5e`

状态：`PLAN_ONLY / OWNER_DIGEST_CONFIRMATION_PENDING / PRODUCT_STOP`

## Goal

在不改变三字段 `AuthenticatedUser` 和现有公开认证 JSON、不引入前端和团队能力的前提下，新增 required-only `AuthenticatedPrincipal`，让每个 session 固定绑定由服务端证明的 personal tenant + active OWNER membership，并让 runtime schema registry、readiness 与 backup/restore 共同承认同一个 schema v6。

## Facts, Assumptions, Recommendations

### Confirmed facts

- 当前 `AuthenticatedUser` 是被多处直接构造的三字段公共身份，不能直接增加 required tenant 字段。
- auth users/sessions 与史馆共享 schema-v5 SQLite；`get_connection()` 对非 v5 运行库失败关闭。
- 注册已经使用 `BEGIN IMMEDIATE`，可把 tenant/membership 创建纳入同一事务。
- 当前 API 从 bearer session 派生 owner，不接受 owner ID；公开认证响应没有 tenant 字段。
- `runtime_data_registry.py` 是 readiness、统一 backup/restore 与 release evidence 的唯一 schema 事实源，当前精确冻结 Shiguan v5。
- Reward、Share、Qualified Use 领域尚不存在。
- 最新基线新增的 P10-A claim-evidence pure kernel 位于 `backend/app/agents/runtime_skills/` 及其测试，不触碰本任务 exact14、认证、租户或 SQLite schema 契约。

### Frozen assumptions for V1

- Beta 阶段每个 user 只有一个 personal tenant。
- V1 只有一条不可替换的 personal OWNER membership，不提供团队协作或 membership replacement/reactivation。
- tenant identity 只供服务端后续 API 使用，暂不公开给浏览器。
- migration 是 offline-only 运维动作；服务必须停止，且 maintenance 在一致 snapshot 到 commit 前持有 SQLite 写入保留锁。

### Recommendations deliberately deferred

- 团队 tenant、邀请、角色权限矩阵和 tenant switching 单独立项。
- 既有业务表的 tenant 回填按领域逐个迁移，不在 T0 批量改写。
- R0 奖励账本使用通用 `asset_code + amount`，不把功勋/经略/威望/算筹硬编码成列。

## Implementation Order

### Step 1 — RED: freeze principal domain and storage invariants

Paths:

- `backend/tests/test_auth_storage.py`
- `backend/tests/test_auth_api.py`

Add failing tests for:

- atomic registration of user + personal tenant + active OWNER membership + membership-bound session;
- no orphan records after injected user/tenant/membership/session insert failure;
- three-field `AuthenticatedUser` remains constructible while `AuthenticatedPrincipal` requires tenant/membership/role;
- session resolution returns the exact issuance-time principal;
- missing, revoked, replaced, duplicate, invalid or mismatched membership fails closed and cannot resurrect an old session;
- register/login request smuggling of tenant/owner/membership fields returns 422;
- public response fields remain exact and unchanged.

Run focused tests and record the expected RED reason. A missing contract is RED; environment/import failure is not acceptable RED.

### Step 2 — RED: freeze schema-v6 and explicit migration

Paths:

- `backend/tests/test_shiguan_migrations.py`
- `backend/tests/test_shiguan_adopted_evidence.py`
- `backend/tests/test_daily_memorial_scheduler.py`
- `backend/tests/test_readiness.py`
- `backend/tests/test_sqlite_backup.py`

Add failing tests for:

- new database creates exact v6 tenant tables, membership-bound session column, indexes, triggers and constraints;
- v5 runtime remains rejected until explicit migration;
- v5→v6 preserves users, sessions, archives, decisions and adopted evidence, and binds every old session to its user's one membership;
- one immutable personal OWNER membership, initially active, per migrated existing user;
- forced mid-migration failure restores exact v5 schema/data/version;
- full v1→v6 migration chain remains explicit;
- registry/readiness accept only the exact v6 current schema;
- scheduler creates v6 rather than silently asserting v5;
- unified runtime backup/verify/restore/rehearsal preserves synthetic user/tenant/membership/session rows;
- offline maintenance holds a write reservation, uses SQLite backup API, verifies exact v5 predecessor schema/integrity/FKs/content before mutation, rejects concurrent writers/WAL ambiguity, duplicate or corrupt backup, and validates exact v6 before commit.

### Step 3 — GREEN: add closed internal principal

Paths:

- `backend/app/auth/models.py`
- `backend/app/auth/storage.py`
- `backend/app/api/auth.py`

Implement the minimum behavior:

- preserve immutable `AuthenticatedUser` unchanged and add immutable required-only `AuthenticatedPrincipal` with V1 `OWNER` role;
- add a registration primitive that creates user, tenant, membership and first session in one transaction;
- make every session persist `membership_id`, including migrated v5 sessions;
- resolve session with strict joins against its issuance-time immutable membership, PERSONAL tenant, OWNER role and revocation state;
- make membership identity/user/tenant/role immutable, revocation one-way and replacement/reactivation unavailable in V1;
- keep `_public_user()` and Pydantic response models byte-for-byte contract compatible;
- make correct-password invalid-principal login indistinguishable from unknown user/wrong password and insert no session;
- use generic authentication failure for all invalid principal shapes.

Do not add team operations, tenant input, tenant endpoints or public tenant fields.

### Step 4 — GREEN: schema-v6 and v5→v6 migration

Paths:

- `backend/app/operations/runtime_data_registry.py`
- `backend/app/operations/sqlite_backup.py`
- `backend/app/shiguan/db.py`
- `backend/app/shiguan/maintenance.py`

Implement:

- v6 schema for `tenants`, `tenant_memberships` and membership-bound `auth_sessions` with foreign keys, closed CHECK constraints, immutability/revocation triggers and unconditional uniqueness;
- direct v6 creation for new databases;
- explicit transactional `migrate_v5_to_v6(path)` with exact predecessor validation and all v6 validation before commit;
- registry update to the literal observed v6 schema digest and exact object list;
- production `probe_synthetic_retention()` creation and verification of fixed user/tenant/membership/bound-session sentinels, included in the retention digest consumed by release evidence;
- maintenance `--migrate-v5-to-v6` that is offline-only, holds a write reservation, creates and verifies a non-overwriting SQLite backup snapshot, migrates, validates integrity/FKs/version/content conservation and emits only bounded metadata;
- a persistent single-row migration verification state: new v6 databases are `VERIFIED`; migrated databases commit as `PENDING_VERIFICATION`; only successful explicit maintenance readback may transition once to `VERIFIED`; `get_connection()`, readiness and backup reject every other state across process restarts;
- post-commit readback failure therefore keeps startup and backup blocked and preserves the verified backup; it does not automatically rewrite the committed database.

No automatic v5 migration and no production database access during verification.

### Step 5 — runtime schema consumer verification

Paths:

- `backend/tests/test_daily_memorial_scheduler.py`
- `backend/tests/test_readiness.py`
- `backend/tests/test_sqlite_backup.py`

Prove that the exact v6 schema is accepted by readiness and all seven-store backup/verify/restore/rehearsal flows, while v5/future/drifted schemas remain rejected. The retention probe must include a synthetic user, tenant, membership and bound session, not only an empty Shiguan database.

### Step 6 — focused verification

Run the manifest's focused pytest and exact14 ruff commands. Then run:

- full backend pytest;
- candidate exact14 structure check;
- `git diff --check`;
- product authority regression;
- root Harness, Doctor and convergence checks.

Every command must execute on the same candidate commit/tree. Failure caused by sandbox or missing environment is reported honestly and is not converted into PASS.

### Step 7 — independent review

Require:

- Python code review: transaction safety, SQLite constraints, migration rollback, API compatibility;
- security review: client tenant injection, membership revocation, cross-tenant confusion, error disclosure, orphan and duplicate races;
- migration review: v5 backup/restore, version transitions and data conservation.

Any P0–P2 finding reopens RED/GREEN and invalidates prior candidate evidence.

### Step 8 — Owner candidate acceptance

After machine `--verify-candidate` returns PASS, present exact candidate SHA/tree/parent, changed paths, approval digest and evidence digest. Commit/push/fast-forward/release/deploy remain separately authorized operations.

## Negative Test Matrix

- request body contains `tenant_id`, `owner_id`, `membership_id`, `tenant_role` or unknown nested identity;
- active session references user with no membership;
- membership is revoked after session issuance;
- a replacement membership is injected after revocation and the old session attempts rebinding;
- duplicate membership or mutable identity is attempted and rejected by schema/trigger;
- tenant kind is not PERSONAL or role is not OWNER;
- transaction fails after user, tenant, membership or first-session insert;
- correct password with invalid membership produces the same 401 as unknown user and creates no session;
- concurrent duplicate identity registration;
- schema-v5 accessed without explicit migration;
- migration fails after one of multiple users is backfilled;
- migration sees a concurrent writer, WAL state, forged tenant table, wrong predecessor digest, integrity/FK failure or old-table content drift;
- migration backup already exists;
- backup snapshot verification fails, preflight integrity fails or post-migration content digests differ;
- post-commit readback fails and startup remains blocked without automatic database rewrite;
- a new process attempts `get_connection()`, readiness or backup while migration verification is PENDING/missing/invalid;
- production retention probe omits, substitutes or mismatches any user/tenant/membership/session sentinel;
- readiness or backup sees v5/future/drifted schema;
- public response accidentally includes tenant/membership fields;
- logs/errors include tenant ID or database path on failure.

## Evidence Boundary

Passing T0 proves only that authentication can derive a personal tenant and active OWNER membership. It does not prove existing outcomes are tenant-scoped, does not create rewards, does not make any result shareable, and does not authorize public sharing or continuous rewards.
