# EXT-W06R Artifact Delivery Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an immutable, tenant-scoped PDF/DOCX/JSON artifact packet with durable storage, authorized download, partial resume, retries, idempotency, duplicate protection, and append-only audit evidence.

**Architecture:** `ArtifactManifestV1` seals public packet identity while `ArtifactDeliveryItem` owns mutable per-format delivery state and `ArtifactDeliveryAuditEvent` records attempts and downloads. Bytes are atomically stored under the ignored runtime root; service functions coordinate rendering, persistence, resume, and replay, while FastAPI routes enforce tenant and expiry boundaries.

**Tech Stack:** Python 3, Pydantic v2, SQLAlchemy 2, Alembic, FastAPI, pytest, SQLite disposable migration tests, python-docx.

## Global Constraints

- Execution authority is scoped to `R0-W06`; v1 remains an inactive integrity guard.
- Base every task on local accepted EXT `64d7f9358dc8a43d886889629e1b745f491593ef`.
- Never merge or bulk cherry-pick P26 or any historical W06 source.
- Exactly PDF, DOCX, and JSON are required; no fourth format is accepted.
- A sealed manifest is immutable; resume creates the next `delivery_revision`.
- Raw storage paths, idempotency keys, and resume tokens never appear in public responses.
- Runtime bytes stay under an ignored or test-owned `var/` root.
- One file has one active writer at a time.
- No push, production deployment, persistent database migration, or listener 3050 takeover.
- Delivery expiry input is exactly `1..86400` seconds.
- Every production behavior requires a failing test observed for the intended reason first.

## File Map

| File | Responsibility |
| --- | --- |
| `backend/src/contracts/artifact_manifest.py` | Public immutable manifest and item validation |
| `backend/src/db/models.py` | Manifest identity, delivery item, and audit persistence models |
| `backend/alembic/versions/025_artifact_delivery_state.py` | Current-head schema transition from revision 024 |
| `backend/src/artifacts/storage.py` | Atomic tenant-scoped byte storage and verified reads |
| `backend/src/artifacts/delivery.py` | Deterministic single-format and three-format rendering |
| `backend/src/artifacts/service.py` | Create, replay, resume, lookup, authorization, and audit orchestration |
| `backend/web/routers/artifacts.py` | Tenant-scoped create/read/download/resume HTTP contract |
| `backend/tests/test_artifact_manifest_v1.py` | Public contract and immutable membership |
| `backend/tests/test_artifact_delivery_migration.py` | Upgrade/downgrade and database constraints |
| `backend/tests/test_artifact_storage.py` | Atomic storage, reuse, and corruption detection |
| `backend/tests/test_artifact_manifest_persistence.py` | Idempotency, revision, duplicate, and audit persistence |
| `backend/tests/test_artifact_delivery_service.py` | Ready, partial, resume, retry, and replay service flow |
| `backend/tests/test_artifact_manifest_access.py` | Tenant, expiry, and integrity authorization |
| `backend/tests/test_artifact_delivery_api.py` | Real FastAPI/DB/storage endpoint contract |
| `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/` | Root Packet scope, tasks, and verification evidence |

---

### Task 1: Freeze W06R Packet and Restore Schema Authority Baseline

**Files:**
- Create: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/summary.md`
- Create: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/spec.md`
- Create: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/tasks.md`
- Create: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/ci_result/ci_summary.md`
- Modify: `backend/tests/test_schema_authority.py`

**Interfaces:**
- Consumes: Alembic graph with exact head `024_artifact_manifest_tenant`.
- Produces: clean `22/22` W06 baseline and a root Packet with exact ownership.

- [ ] **Step 1: Preserve the observed failing baseline**

Record in `ci_summary.md`:

```text
python3 -m pytest -q tests/test_artifact_manifest_v1.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_render.py \
  tests/test_schema_authority.py

Observed before correction: 3 failed, 19 passed.
All failures expected 022_shiguan_memorial_identity while the graph returned
024_artifact_manifest_tenant.
```

- [ ] **Step 2: Make the minimum P26 hunk correction**

Use `024_artifact_manifest_tenant` in the three expected-head assertions and
the disposable database row. Do not import any other P26 diff.

- [ ] **Step 3: Verify the corrected baseline**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_schema_authority.py \
  tests/test_artifact_manifest_v1.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_render.py
```

Expected: `22 passed`.

- [ ] **Step 4: Verify governance boundaries**

Run:

```bash
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/harness-doctor.mjs
git diff --check
```

Expected: W06 `GO`, doctor `0 errors / 0 warnings`, clean diff check.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_schema_authority.py \
  .harness/changes/feat-ext-w06r-artifact-delivery-20260725
git commit -m "test(w06r): align schema authority baseline"
```

---

### Task 2: Seal the Immutable Manifest Contract

**Files:**
- Modify: `backend/tests/test_artifact_manifest_v1.py`
- Modify: `backend/src/contracts/artifact_manifest.py`
- Modify: `backend/tests/test_artifact_manifest_persistence.py`
- Modify: `backend/tests/test_artifact_manifest_access.py`
- Modify: `backend/src/artifacts/service.py`

**Interfaces:**
- Consumes: exact artifact kinds `PDF`, `DOCX`, and `JSON`.
- Produces: `ArtifactManifestV1`, `ArtifactManifestItemV1`, and
  `canonical_manifest_hash(manifest) -> str`.

- [ ] **Step 1: Write exact-membership RED tests**

Add tests that construct revision 1 with:

```python
{
    "tenant_id": 7,
    "delivery_revision": 1,
    "idempotency_key_hash": "c" * 64,
    "payload_hash": "d" * 64,
    "artifacts": [
        {
            "artifact_id": "artifact-pdf",
            "kind": "PDF",
            "mime_type": "application/pdf",
            "byte_size": 10,
            "content_hash": "e" * 64,
            "lineage_hash": "f" * 64,
            "status": "STORED",
        },
        {
            "artifact_id": "artifact-docx",
            "kind": "DOCX",
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "byte_size": 20,
            "content_hash": "1" * 64,
            "lineage_hash": "2" * 64,
            "status": "STORED",
        },
        {
            "artifact_id": "artifact-json",
            "kind": "JSON",
            "mime_type": "application/json",
            "byte_size": 30,
            "content_hash": "3" * 64,
            "lineage_hash": "4" * 64,
            "status": "STORED",
        },
    ],
    "overall_status": "READY",
}
```

Assert duplicate, missing, or extra kinds fail validation. Assert READY
requires all three items `STORED`.

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend
python3 -m pytest -q tests/test_artifact_manifest_v1.py
```

Expected: FAIL because tenant, revision, idempotency, payload, storage state,
and exact-membership rules do not exist.

- [ ] **Step 3: Add partial and immutable-identity RED tests**

Assert:

```python
partial.overall_status == "PARTIAL"
partial.artifact("PDF").incomplete_reason == "renderer_failed"
partial.resume_token_expires_at is not None
canonical_manifest_hash(partial) == canonical_manifest_hash(partial.model_copy())
```

Reject:

- `PARTIAL` without at least one STORED and one UNAVAILABLE item;
- UNAVAILABLE without `incomplete_reason`;
- READY with resume metadata;
- raw `resume_token` or `idempotency_key` as extra fields;
- non-lowercase SHA-256 digests.

- [ ] **Step 4: Implement the minimum contract**

Use these public fields:

```python
ArtifactItemStatus = Literal["PENDING", "STORED", "UNAVAILABLE"]

class ArtifactManifestItemV1(BaseModel):
    artifact_id: str
    kind: ArtifactKind
    mime_type: str
    byte_size: int
    content_hash: str
    lineage_hash: str
    status: ArtifactItemStatus
    incomplete_reason: str | None = None
    expires_at: datetime | None = None

class ArtifactManifestV1(BaseModel):
    schema_version: Literal["ArtifactManifestV1"]
    manifest_id: str
    tenant_id: int
    task_id: str
    final_memorial_id: str
    final_memorial_version: int
    delivery_formula_version: str
    delivery_revision: int
    idempotency_key_hash: str
    payload_hash: str
    artifacts: list[ArtifactManifestItemV1]
    overall_status: Literal["READY", "PARTIAL", "UNDER_REVIEW"]
    resume_token_hash: str | None = None
    resume_token_expires_at: datetime | None = None
```

`canonical_manifest_hash` serializes with
`model_dump(mode="json", exclude_none=True)`, sorted keys, UTF-8, and compact
separators before SHA-256.

- [ ] **Step 5: Run GREEN and regression tests**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_manifest_access.py
```

Expected: PASS. The persistence/access fixtures use the new complete sealed
shape. They do not create a permissive compatibility path for missing tenant,
revision, or hash identity. This is valid because W06R remains `NOT_DEPLOYED`
and no persistent database migration has been performed.

Add regression tests before changing the service boundary:

- `persist_manifest` rejects a sealed manifest whose `tenant_id` differs from
  its tenant argument;
- `get_manifest_for_tenant` rejects a stored manifest whose embedded tenant
  differs from the row tenant.

The minimal production change adds these two identity comparisons alongside
the existing task/memorial/formula checks. It does not add legacy coercion.

- [ ] **Step 6: Commit**

```bash
git add backend/src/contracts/artifact_manifest.py \
  backend/tests/test_artifact_manifest_v1.py \
  backend/tests/test_artifact_manifest_persistence.py \
  backend/tests/test_artifact_manifest_access.py \
  backend/src/artifacts/service.py
git commit -m "feat(w06r): seal artifact manifest contract"
```

---

### Task 3: Persist Delivery State, Revisions, and Audit Events

**Files:**
- Create: `backend/alembic/versions/025_artifact_delivery_state.py`
- Create: `backend/tests/test_artifact_delivery_migration.py`
- Modify: `backend/src/db/models.py`
- Modify: `backend/tests/test_artifact_manifest_persistence.py`
- Modify: `backend/src/artifacts/service.py`

**Interfaces:**
- Consumes: `ArtifactManifestV1` and `canonical_manifest_hash`.
- Produces: `ArtifactDeliveryItem`, `ArtifactDeliveryAuditEvent`,
  `persist_delivery_manifest`, and `append_delivery_audit_event`.

- [ ] **Step 1: Write migration RED**

The disposable migration test upgrades through revision 025 and asserts:

```python
assert head == "025_artifact_delivery_state"
assert {
    "delivery_revision",
    "idempotency_key_hash",
    "payload_hash",
}.issubset(manifest_columns)
assert "artifact_delivery_items" in table_names
assert "artifact_delivery_audit_events" in table_names
```

It also inspects unique constraints for:

```text
artifact_manifests:
  tenant_id + idempotency_key_hash
  tenant_id + task_id + final_memorial_id + final_memorial_version
  + delivery_formula_version + delivery_revision

artifact_delivery_items:
  manifest_id + kind
```

- [ ] **Step 2: Run migration RED**

Run:

```bash
cd backend
python3 -m pytest -q tests/test_artifact_delivery_migration.py
```

Expected: FAIL because revision 025 and tables do not exist.

- [ ] **Step 3: Implement model and migration**

Add:

```python
InternalDeliveryState = Literal[
    "PENDING",
    "GENERATED",
    "STORED",
    "UNAVAILABLE",
    "EXPIRED",
]

class ArtifactDeliveryItem(Base):
    __tablename__ = "artifact_delivery_items"
    id: Mapped[str]
    tenant_id: Mapped[int]
    manifest_id: Mapped[str]
    kind: Mapped[str]
    mime_type: Mapped[str]
    state: Mapped[str]
    storage_path: Mapped[str | None]
    content_hash: Mapped[str]
    byte_size: Mapped[int]
    incomplete_reason: Mapped[str | None]
    retry_count: Mapped[int]
    resume_token_hash: Mapped[str | None]
    expires_at: Mapped[str | None]
    created_at: Mapped[str]
    updated_at: Mapped[str]

class ArtifactDeliveryAuditEvent(Base):
    __tablename__ = "artifact_delivery_audit_events"
    id: Mapped[str]
    tenant_id: Mapped[int]
    manifest_id: Mapped[str]
    artifact_id: Mapped[str | None]
    event_type: Mapped[str]
    outcome: Mapped[str]
    detail_json: Mapped[str]
    created_at: Mapped[str]
```

Extend `ArtifactManifest` with delivery revision, idempotency key hash, and
payload hash. Legacy rows remain readable; all new service writes require the
new fields. `ArtifactManifestItemV1.status` is the sealed public projection
(`PENDING`, `STORED`, or `UNAVAILABLE`); `ArtifactDeliveryItem.state` is the
internal mutable operational state. These are projections of one delivery
record, not independent completion authorities. Only the manifest validation
and `DELIVERED` formula determine packet completion.

- [ ] **Step 4: Write persistence/idempotency RED**

Tests must prove:

- same tenant + same idempotency key + same canonical input returns one row;
- same key + changed payload hash raises `DeliveryConflict`;
- concurrent identical sessions converge on one manifest;
- revision numbers are monotonic for one memorial lineage;
- audit events are append-only and tenant-scoped.

- [ ] **Step 5: Implement minimum persistence**

Use explicit exceptions:

```python
class DeliveryConflict(RuntimeError):
    pass

class DeliveryNotFound(LookupError):
    pass

class DeliveryForbidden(PermissionError):
    pass

class DeliveryExpired(RuntimeError):
    pass

class DeliveryIntegrityError(RuntimeError):
    pass
```

On `IntegrityError`, rollback and reload by tenant/idempotency hash; compare
payload hash and immutable manifest JSON before returning the winner.

- [ ] **Step 6: Run GREEN**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_artifact_delivery_migration.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_schema_authority.py
```

Expected: PASS with schema head `025_artifact_delivery_state`.

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/025_artifact_delivery_state.py \
  backend/src/db/models.py \
  backend/src/artifacts/service.py \
  backend/tests/test_artifact_delivery_migration.py \
  backend/tests/test_artifact_manifest_persistence.py \
  backend/tests/test_schema_authority.py
git commit -m "feat(w06r): persist artifact delivery state"
```

---

### Task 4: Add Atomic Verified Artifact Storage

**Files:**
- Create: `backend/src/artifacts/storage.py`
- Create: `backend/tests/test_artifact_storage.py`

**Interfaces:**
- Produces:

```python
@dataclass(frozen=True)
class StoredArtifact:
    path: Path
    content_hash: str
    byte_size: int

def store_artifact_bytes(
    root: Path,
    *,
    tenant_id: int,
    artifact_id: str,
    content: bytes,
) -> StoredArtifact:
    raise NotImplementedError

def read_verified_artifact(
    path: Path,
    *,
    expected_hash: str,
    expected_size: int,
) -> bytes:
    raise NotImplementedError
```

- [ ] **Step 1: Write storage RED**

Tests assert:

- traversal characters in identifiers cannot escape `root`;
- first write returns a verified path/hash/size;
- identical replay reuses bytes and leaves mtime unchanged;
- different bytes for the same artifact id raise `DeliveryIntegrityError`;
- truncated or replaced stored bytes fail verified read;
- no temporary file remains after success or failure.

- [ ] **Step 2: Run RED**

Run:

```bash
cd backend
python3 -m pytest -q tests/test_artifact_storage.py
```

Expected: import failure because `src.artifacts.storage` does not exist.

- [ ] **Step 3: Implement atomic storage**

Write to a sibling `temporary_path` with `open(temporary_path, "xb")`, flush and
`os.fsync`, then `os.replace`. If the final file exists, verify and reuse it;
never overwrite mismatched bytes. Hash the final reread before returning.

- [ ] **Step 4: Run GREEN**

Run:

```bash
cd backend
python3 -m pytest -q tests/test_artifact_storage.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/artifacts/storage.py backend/tests/test_artifact_storage.py
git commit -m "feat(w06r): store artifacts atomically"
```

---

### Task 5: Orchestrate Ready, Partial, Retry, Resume, and Replay

**Files:**
- Create: `backend/tests/test_artifact_delivery_service.py`
- Modify: `backend/src/artifacts/delivery.py`
- Modify: `backend/src/artifacts/service.py`
- Modify: `backend/tests/test_artifact_delivery_render.py`
- Modify: `backend/src/db/models.py`
- Modify: `backend/alembic/versions/025_artifact_delivery_state.py`
- Modify: `backend/tests/test_artifact_delivery_migration.py`

**Interfaces:**
- Consumes: manifest contract, persistence, and storage interfaces.
- Produces:

```python
@dataclass(frozen=True)
class DeliveryPacket:
    manifest: ArtifactManifestV1
    resume_token: str | None

def deliver_artifact_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    task_id: str,
    final_memorial_id: str,
    final_memorial_version: int,
    payload: dict[str, Any],
    delivery_formula_version: str,
    idempotency_key: str,
    expires_at: datetime,
    renderer: ArtifactRenderer = render_one_artifact,
) -> DeliveryPacket:
    raise NotImplementedError

def resume_artifact_packet(
    db,
    *,
    storage_root: Path,
    tenant_id: int,
    manifest_id: str,
    resume_token: str,
    idempotency_key: str,
    renderer: ArtifactRenderer = render_one_artifact,
) -> DeliveryPacket:
    raise NotImplementedError
```

- [ ] **Step 1: Write READY-path RED**

Use a real renderer and temporary storage root. Assert exactly three stored
items, verified files, deterministic hashes, READY manifest, and audit events
for generated/stored/sealed.

- [ ] **Step 2: Run READY RED**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_artifact_delivery_service.py::test_deliver_packet_stores_exact_three_formats
```

Expected: FAIL because orchestration functions do not exist.

- [ ] **Step 3: Implement minimum READY path and verify GREEN**

Render in canonical order `PDF`, `DOCX`, `JSON`; store each item; seal only
after all storage rereads verify.

- [ ] **Step 4: Write PARTIAL/resume RED**

Inject a renderer that raises only for PDF. Assert:

- DOCX and JSON remain stored;
- PDF is UNAVAILABLE with `renderer_failed`;
- one opaque resume token is returned while only its SHA-256 is persisted;
- resume with a working renderer creates revision 2;
- revision 1 remains byte-identical;
- revision 2 does not rewrite DOCX/JSON files;
- wrong or expired token fails;
- retry count increments only for PDF.
- when JSON alone is unavailable, resume still retries JSON from the canonical
  internal `source_payload_json`; it never depends on a delivery artifact as
  its render source.

- [ ] **Step 5: Implement PARTIAL/resume and verify GREEN**

All-three failure raises a delivery error after audit recording and does not
return a PARTIAL manifest. Its failed attempt, three item failures, and audit
event must be visible from a new database session after the error is raised.
Resume reads prior item rows, validates token hash with
`hmac.compare_digest`, verifies each reusable row against the immutable prior
manifest item, and renders only unavailable kinds.

Add `ArtifactManifest.source_payload_json` as an internal database column in
revision 025. Persist canonical compact/sorted JSON and verify its SHA-256
against `payload_hash` before create replay or resume. Migration tests assert
the column exists and remains absent from `ArtifactManifestV1`.

Reject `expires_at <= now_utc` before invoking any renderer or storage helper.
Delivery command services own commit for successful READY/PARTIAL results and
terminal all-format failure evidence.

- [ ] **Step 6: Write idempotent replay/concurrency RED**

Assert repeated create and repeated resume with the same idempotency key return
the same manifest id and create no duplicate item or audit-success rows.

- [ ] **Step 7: Implement replay and run full service GREEN**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_persistence.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/artifacts/delivery.py \
  backend/src/artifacts/service.py \
  backend/src/db/models.py \
  backend/alembic/versions/025_artifact_delivery_state.py \
  backend/tests/test_artifact_delivery_migration.py \
  backend/tests/test_artifact_delivery_render.py \
  backend/tests/test_artifact_delivery_service.py
git commit -m "feat(w06r): orchestrate artifact delivery"
```

---

### Task 6: Enforce Authorized Download and Resume APIs

**Files:**
- Create: `backend/tests/test_artifact_delivery_api.py`
- Modify: `backend/tests/test_artifact_manifest_access.py`
- Modify: `backend/web/routers/artifacts.py`
- Modify: `backend/src/artifacts/service.py`

**Interfaces:**
- Consumes: `deliver_artifact_packet`, `resume_artifact_packet`,
  `read_verified_artifact`, and tenant-scoped lookups.
- Produces four HTTP operations from the approved design.

- [ ] **Step 1: Write API RED**

With an isolated SQLAlchemy session and temporary runtime root, assert:

```text
POST /api/artifacts/deliveries                  -> 201
GET  /api/artifacts/manifests/{manifest_id}    -> 200
GET  /api/artifacts/{artifact_id}/download     -> 200 + exact MIME/body
POST /api/artifacts/manifests/{id}/resume      -> 200
```

Request input contains task, memorial identity, ContractReviewPack payload,
formula version, idempotency key, and expiry seconds.
Create/read/resume responses include download URLs only for currently stored,
unexpired items; they never include storage paths or secret hashes.

- [ ] **Step 2: Run API RED**

Run:

```bash
cd backend
python3 -m pytest -q tests/test_artifact_delivery_api.py
```

Expected: 404/405 because create/download/resume routes do not exist.

- [ ] **Step 3: Implement request/response models and route injection**

Use FastAPI dependencies for both current user and database session. Do not
instantiate `SessionLocal` inside route bodies. Map domain exceptions:

```python
DeliveryNotFound | DeliveryForbidden -> 404
DeliveryExpired -> 410
DeliveryConflict | DeliveryIntegrityError -> 409
Pydantic validation -> 422
```

- [ ] **Step 4: Add authorization and integrity RED**

Assert:

- cross-tenant manifest, item, and resume all return 404;
- missing tenant returns 403;
- expired download returns 410;
- corrupted body returns 409 and appends a failed integrity audit event;
- raw path, token hash, and idempotency hash are absent from JSON;
- download appends a successful audit event.

- [ ] **Step 5: Implement fail-closed access and verify GREEN**

Download checks tenant, state, expiry, hash, size, and manifest membership
before constructing
`Response(content=verified_bytes, media_type=item.mime_type)`.

- [ ] **Step 6: Run API and access GREEN**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_artifact_delivery_api.py \
  tests/test_artifact_manifest_access.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/web/routers/artifacts.py \
  backend/src/artifacts/service.py \
  backend/tests/test_artifact_delivery_api.py \
  backend/tests/test_artifact_manifest_access.py
git commit -m "feat(w06r): authorize artifact delivery APIs"
```

---

### Task 7: Close Verification and Independent Review

**Files:**
- Modify: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/request_analysis/tasks.md`
- Modify: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/ci_result/ci_summary.md`
- Modify only if inventory requires it: `backend/harness/manifest.json`

**Interfaces:**
- Consumes: all W06R task commits.
- Produces: one accepted candidate commit; no integration, push, or deployment.

- [ ] **Step 1: Run complete focused verification**

Run:

```bash
cd backend
python3 -m pytest -q \
  tests/test_schema_authority.py \
  tests/test_artifact_manifest_v1.py \
  tests/test_artifact_delivery_migration.py \
  tests/test_artifact_storage.py \
  tests/test_artifact_delivery_render.py \
  tests/test_artifact_manifest_persistence.py \
  tests/test_artifact_delivery_service.py \
  tests/test_artifact_manifest_access.py \
  tests/test_artifact_delivery_api.py
python3 scripts/harness_doctor.py
cd ..
node scripts/harness-doctor.mjs
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
git diff --check 64d7f935..HEAD
```

Expected: all tests pass, both doctors clean, W06 GO, diff check clean.

- [ ] **Step 2: Verify disposable migration loop**

Run the migration test in isolation and record its temporary database path,
upgrade head, downgrade target, and re-upgrade head. Do not point Alembic at
`backend/var`, the main worktree, or any persistent DB.

- [ ] **Step 3: Independent requirements review**

Reviewer checks every design requirement against tests and evidence, including:
exact membership, immutable revisions, storage, authz, expiry, PARTIAL,
resume, retry, idempotency, duplicate suppression, audit, and production
boundaries.

- [ ] **Step 4: Independent quality review**

Reviewer checks transaction handling, rollback/reload behavior, path safety,
timing-safe token comparison, secret/path exposure, corrupt-byte handling,
concurrency, and migration reversibility.

- [ ] **Step 5: Remediate every finding through RED-GREEN**

Each behavior correction starts with a failing regression test. Re-run the
focused suite and both reviews until both verdicts are GO.

- [ ] **Step 6: Record Codex acceptance**

Set Packet status to:

```text
VERIFIED_COMPLETE / ACCEPTED_NOT_INTEGRATED
```

Record exact candidate HEAD/tree, test counts, reviewer verdicts, and:

```text
NOT_DEPLOYED
NO_PUSH
NO_PERSISTENT_DB_MIGRATION
NO_LISTENER_TAKEOVER
```

- [ ] **Step 7: Commit verification evidence**

```bash
git add .harness/changes/feat-ext-w06r-artifact-delivery-20260725
git commit -m "docs(w06r): record artifact delivery acceptance"
```

Stop for explicit approval before integrating the accepted Packet into local
`feature-chaotang-ext`.

---

### Task 8: Final Review Remediation

**Files:**
- Modify: `backend/src/artifacts/delivery.py`
- Modify: `backend/src/artifacts/service.py`
- Modify: `backend/src/artifacts/storage.py`
- Modify: `backend/src/db/models.py`
- Modify: `backend/alembic/versions/025_artifact_delivery_state.py`
- Modify: `backend/web/routers/artifacts.py`
- Modify: W06R artifact, migration, service, access, and API tests
- Modify: `.harness/changes/feat-ext-w06r-artifact-delivery-20260725/`

**Interfaces:**
- Consumes: the Task 7 requirements and quality review reports.
- Produces: a candidate with every load-bearing finding closed.

- [ ] **Step 1: Write RED tests for product content and source lineage**

Prove PDF/DOCX contain unique decision-summary and risk markers from the
complete `ContractReviewPackV1`. Prove create rejects missing, cross-tenant,
non-current, non-ready, hash-corrupt, and supplied-pack-mismatched
`FinalMemorial` rows before rendering.

- [ ] **Step 2: Write RED tests for canonical identity and replay**

Prove manifest ids change by canonical delivery revision rather than caller
key; reused stored artifacts retain artifact id/path/hash; artifact lineage
binds tenant and origin delivery revision; direct command replay rejects a
tampered manifest seal and mutable incomplete-reason mismatch.

- [ ] **Step 3: Write RED tests for API/status/audit closure**

Prove wrong/expired resume tokens return 409; cross-tenant and unknown download
failures create one requester-tenant failure audit; expiry transitions mutable
state to EXPIRED with `last_failure`; expiry seconds outside `1..86400` return
422.

- [ ] **Step 4: Write RED tests for migration and storage durability**

Prove downgrade refuses before DDL for any non-null revision-025 identity
field. Prove replay/resume reject storage paths outside the trusted root. Prove
tenant-directory creation and artifact publication fsync directory file
descriptors.

- [ ] **Step 5: Implement minimum GREEN**

Use the approved design additions verbatim. All persisted manifest reads share
one sealed verifier. Existing artifact rows are referenced rather than copied
when resume reuses a stored item.

- [ ] **Step 6: Synchronize the root Packet**

The Packet type, scope, fact sources, acceptance criteria, rollback, and status
must describe the actual migration/runtime/storage/API change. Preserve
`NOT_DEPLOYED`, no push, no persistent migration, and no listener takeover.

- [ ] **Step 7: Run the complete verification and both independent reviews**

Run the Task 7 command set plus new regression tests. Both requirements and
quality verdicts must be GO before Codex acceptance.

- [ ] **Step 8: Close idempotent HTTP expiry and strict-JSON findings**

Persist `requested_expiry_seconds` in revision 025. The create command computes
absolute expiry once for the winning write; same key/payload/relative expiry
replays the existing packet, while same key with changed relative expiry
conflicts. Add sequential and eight-way HTTP concurrency tests.

Reject non-finite JSON during canonicalization and normalize persisted
`NaN`/`Infinity` corruption to audited `DeliveryIntegrityError` / HTTP 409.

- [ ] **Step 9: Seal relative expiry and required source payload**

Add `requested_expiry_seconds` to sealed `ArtifactManifestV1`, bind it to the
database row in the unified verifier, and keep it out of the public HTTP
projection. Every W06R manifest read/replay/download requires non-null canonical
`source_payload_json` whose SHA-256 equals sealed `payload_hash`. Database
tampering of either field returns integrity conflict; failed downloads append
one durable failure audit.

- [ ] **Step 10: Close full-diff MIME and orphan-audit findings**

Require the canonical PDF/DOCX/JSON MIME mapping in
`ArtifactManifestItemV1`. Treat renderer kind/MIME mismatch as a per-format
render failure so it cannot be sealed as STORED or READY.

When a tenant-owned artifact row resolves to an unknown or unauthorized
manifest, preserve the indistinguishable 404 response and append exactly one
generic requester-tenant failed-download audit without artifact, manifest, or
owner identifiers. Record the observed RED failures and rerun the complete
W06R suite before independent rereview.
