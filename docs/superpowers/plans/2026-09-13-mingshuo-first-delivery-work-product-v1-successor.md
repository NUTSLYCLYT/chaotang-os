# Mingshuo First Delivery Work Product V1 Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-SUCCESSOR-20260913`

Base: `3d0cbc6469162d355f3070ce1a10e03d9e4bc819 / e0c0f0158d8fa50dfd04e13aa7e13e70e07e374b`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

Create the first reusable delivery artifact in the Mingshuo vertical without inventing a second truth source. A currently verified immutable Fact Pack and draft request produce one deterministic, non-binding solution/quotation workbook and one existing WorkProductEnvelope. Human confirmation remains append-only through the existing report-artifact boundary; publication, download, Shiguan archive and V4 rendering remain a separate successor.

## Frozen Scope

The candidate is exactly nineteen paths: two additions (`backend/app/mingshuo/delivery.py`, `backend/tests/test_mingshuo_delivery.py`) and seventeen modifications in the existing Mingshuo API/service/models/storage, ArtifactStorage, runtime-data registry/readiness, backup recovery, release manifest schema, offline release build/verifier/RC1 acceptance scripts and their tests. Every path remains `100644`. No frontend, Scene Pack, Shiguan, WorkProduct contract, report-artifact API, Fact Pack evaluator, Harness or authority path may change.

## RED

1. A verified current Fact Pack and `NON_AUTHORIZING` draft request have no producer or WorkProduct/Artifact identity.
2. Existing ArtifactStorage cannot safely replay one owner-scoped run/capability binding through a public closed method, and two SQLite commits need a durable Mingshuo recovery intent.
3. A naive quote generator could invent prices, certification, terms or commercial approval.
4. Concurrent or interrupted creation can leave duplicate or orphan artifacts unless run identity, cleanup and replay are explicit.
5. Cross-owner IDs, stale versions, expired evidence and corrupted canonical bytes must fail before an artifact becomes usable.

## GREEN

1. A pure deterministic producer creates a five-sheet XLSX with traceable facts/evidence and explicit limitations; all commercial values remain blank and require human approval.
2. The current Fact Pack is revalidated at stored and current UTC dates and bound into the WorkProduct content/manifest digests.
3. The existing ArtifactStorage persists one PENDING XLSX and one PENDING-confirmation WorkProduct under `run_id=draft_request_id`, with owner-scoped deterministic replay.
4. The new closed API returns only a non-authorizing identity/status projection; it never returns private paths, principal identifiers or canonical source bytes.
5. Negative, concurrency, crash, tamper, tenant and compensation tests prove fail-closed behavior without changing accounting, confirmation, download or archive semantics.

## Exact Identity Contract

The delivery binding is the canonical object `{schemaVersion:"mingshuo.delivery-binding.v1",tenantId,ownerUserId,projectId,draftRequestId,factPackVersion,factPackDigest,evidenceDigest,factDigest,claimDigest,producerPolicyVersion:"mingshuo.delivery.producer.v1"}` serialized with the existing semantic digest contract. The full private binding exists only in the tenant+owner scoped Mingshuo durable intent. WorkProduct facts/manifest contain only the irreversible `bindingDigest`, Fact Pack version/digests and minimal public-safe anchors; they never contain tenant/owner, request key, canonical bytes or raw requirements because the existing owner-authenticated generic WorkProduct GET serializes facts and manifest. The workbook may contain project name and submitted requirements but never tenant/owner IDs, database paths, request keys or canonical source bytes.

`capability_id` is exactly `mingshuo.first-delivery.work-product.v1`; `run_id` is exactly the draft request ID; WorkProduct version is 1. Artifact and WorkProduct IDs are opaque deterministic server-derived 32-hex values derived from the binding digest with distinct fixed domain separators; caller choice or ID entropy is never an authorization boundary. Replay begins with the current principal's tenant+owner Mingshuo intent and only then accepts one owner/run/capability/version whose actual PENDING artifact state, report type, file hash, manifest, content digest, public-safe anchors and intent-held private binding all revalidate. Current authentication mechanically enforces one immutable membership per user (`user_id UNIQUE`, `tenant_id UNIQUE`); any future multi-membership contract is a hard prerequisite for a tenant-aware ArtifactStorage successor.

## Workbook Contract

The workbook has exactly five visible worksheets in this order: `封面与限制`, `事实与证据`, `方案草案`, `报价草案`, `缺失与风险`. Claims and facts sort by stable identifiers and references sort deterministically. Idempotency binds the canonical cell projection, not regenerated ZIP bytes; once the artifact commits, its raw hash is immutable and replay never regenerates it. The quotation sheet contains no numeric commercial offer and carries `NON_BINDING_DRAFT / COMMERCIAL_APPROVAL_REQUIRED` plus blank human-fill fields.

Every untrusted string is explicitly written as a string cell. After NFKC and removal of leading control/Unicode whitespace, a leading `=`, `+`, `-` or `@` is escaped with one fixed apostrophe rule. A post-generation bounded ZIP/OOXML validator rejects formulas, macros, external links or relationships, hyperlinks, media/images, embedded objects, connections/queries, hidden sheets, duplicate/traversal entries and any part/relationship/content type outside the frozen allowlist; entry count and per-entry/total inflated bytes are bounded. Focused adversarial tests cover formula prefixes behind tabs, CR/LF and Unicode spaces as well as injected macro/external/hidden parts.

The five manifest preimages are non-recursive: workbook raw SHA; canonical Fact Pack SHA; canonical delivery-binding semantic SHA; semantic SHA of `{confirmationStatus:"PENDING",meaning:"INTERNAL_DRAFT_REVIEW_ONLY"}`; and semantic SHA of the closed delivery projection. A full WorkProduct envelope digest is never embedded as one of its own manifest items. The envelope top-level `content_digest` is computed last through the existing self-excluding semantic digest function.

## Persistence and Failure Contract

Before filesystem work, Mingshuo storage creates a durable intent keyed by tenant+owner+project+draft and freezes the full private binding, binding digest and deterministic artifact/work-product IDs. Its state is compare-and-set only `PREPARED -> ARTIFACT_PENDING -> WORK_PRODUCT_BOUND`. ArtifactStorage create-or-verify uses the deterministic artifact ID, actual owner/run/report type/state and raw file hash. WorkProduct create-or-verify then requires the same capability/version, actual PENDING state, complete safe manifest/binding digest and exactly one bidirectional relation. The legacy accounting `publish_run` scans the run before any move/update and atomically rejects it if any row has `report_type=MINGSHUO_SOLUTION_QUOTATION_DRAFT_V1`; only a later dedicated confirmed-delivery successor may publish this type.

The Mingshuo schema advances exactly from v1 to v2 by adding the delivery-intent table and its immutable/compare-and-set triggers. The sole runtime-data registry must atomically freeze the v2 table list, trigger list, user version and schema contract digest; readiness must accept exactly the migrated/current v2 shape and reject missing/extra tables, triggers, version or digest. Existing whole-database backup/restore must preserve intent rows and validate the same registry contract. The newly calculated registry digest must be copied atomically into `deploy/release-manifest.schema.json`, offline release build/verifier and RC1 acceptance plus their corresponding tests; each consumer must reject the former digest and any cross-consumer mismatch. No second registry or historical-readiness rewrite is allowed.

The producer writes through a no-follow `0600` `O_CREAT|O_EXCL` file in ArtifactStorage's private same-filesystem directory, flushes/fsyncs and hashes the open descriptor, then uses atomic rename. No user value contributes to a filesystem path. A retry after any intent/rename/artifact/work-product commit reloads the intent and accepts only the same committed bytes and identity; it never regenerates over an existing artifact. ABORTED, PUBLISHED, unbound or ambiguous rows remain inaccessible and fail closed. Fault injection covers every write/hash/fsync/rename/DB commit/state-transition/response-serialization boundary, including symlink and pre-created-name attacks.

The service validates all Mingshuo identities before artifact creation. Project and draft IDs are exactly 32 lowercase hex; the request is exactly an `application/json` empty object `{}` and rejects zero-byte or extra-key bodies. It serializes the public response before returning and maps invalid wire/ID to 422, absent or cross-principal identity to identical 404, binding conflict to 409 and storage/file/serialization failure to 503. Response, logs and audit use a fixed allowlist and must not expose whether another owner owns a guessed identifier, raw requirements, tenant/owner, canonical bytes, paths, SQL text, headers or credentials.

## Verification and Review

Run the sixteen manifest checks. Focused tests include stored-day/current-day evaluation, HOLD/BLOCK/digest/clock failures, concurrent create, every crash boundary, happy replay, binding/hash/state tamper, formula/ZIP adversarial input, strict empty-object wire, guessed/cross-owner/cross-tenant identity, generic WorkProduct GET privacy, v1→v2 schema migration/readiness/backup preservation, and confirmation/download/legacy-publish regression proving PENDING is not downloadable or published. Backend full and Ruff cover all Python paths. The three release script test suites must prove build, verify and RC1 acceptance all bind the same new runtime registry digest and reject the old or tampered value. Root Harness, doctor, hook, authority regression with process-scoped POSIX temp variables, V2 and exact19 preimage remain mandatory. Governance Review confirms scope and lineage; Python Review confirms workbook/digest/saga/schema correctness; Security Review covers membership assumptions, formula injection, file containment, malformed OOXML, crash windows and sanitized response/logs. Any P0–P2 or failed gate is NO-GO.

## Next Successor

After this exact19 candidate lands, a latest-base successor may implement `CONFIRMED WorkProduct -> idempotent Shiguan REPLY -> ArtifactStorage PUBLISHED -> owner-scoped download`, then project the immutable artifact/workProduct/reply tuple through SceneRun/BoardMission and V4. That package must also correct the existing classic Junjichu deep-link query key mismatch (`archive` versus `replyId`) and supply real browser evidence. This plan does not authorize it.

## Rollback

Rollback is a forward-only inverse of the exact nineteen product paths after revalidation. It must not delete donor worktrees, rewrite history, force-push or deploy production.
