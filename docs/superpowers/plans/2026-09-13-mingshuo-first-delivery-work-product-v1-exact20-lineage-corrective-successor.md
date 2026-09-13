# Mingshuo First Delivery Work Product V1 exact20 Lineage Corrective Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-LINEAGE-CORRECTIVE-SUCCESSOR-20260913`

Base: `52e289c74000866b8aca8d147386ce499b8a38a9 / 43f0114f989b49b3abb0cfc92d6143bf5529bffa`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

Replace the abandoned exact19 authority with one forward-only, dependency-closed exact20 successor. Preserve the existing Mingshuo producer/saga/runtime-registry design, add only the current trusted backup verifier that must follow the modified RC1 runner identity, and correct two test defects without weakening any gate.

## Lineage And Donor Boundary

The exact19 one-child authority is `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR`. Its uncommitted nineteen paths are `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`. The new candidate must be a direct child of a future approval commit whose direct parent is the frozen base. Donor bytes may be copied by exact path, but all RED/GREEN, full-matrix, review and machine-candidate evidence must be regenerated.

The old scope omitted a hard trust dependency. The modified `scripts/run_rc1_release_acceptance.mjs` raw SHA is `sha256:938beaa21a86f69e9449276fb2bd9d4eddf91de76e4b954d8a78c024800e0c2a`; `backend/app/operations/sqlite_backup.py` currently trusts `sha256:98cdd5e95b0dce4621d578a6a5f1f95885ef4afbdda90122465b1ce642b05d1d`. The twentieth path updates that one existing constant. There is no second hash in `runtime_lock.py`, and the Fact Pack provenance script already contains both relevant paths, so exact20 is the closed scope.

## Frozen Scope

Exactly twenty product paths: two additions and eighteen modifications, all `100644`. The original nineteen paths remain unchanged in ownership; the sole addition to scope is `backend/app/operations/sqlite_backup.py`. No frontend, V4, Shiguan, report-artifact API, Fact Pack evaluator/schema, WorkProduct schema, Harness, authority or twenty-first path may change.

## Product Semantics To Preserve

- A currently revalidated PASS Fact Pack plus matching owner/tenant/project/draft request yields one deterministic five-sheet non-binding XLSX and one existing PENDING WorkProductEnvelope.
- Facts, assumptions, recommendations, evidence, missing inputs and risks remain distinct. Price, MOQ, delivery, warranty, certification and commercial approval remain blank or explicitly human-required.
- Private tenant/owner binding remains in the durable Mingshuo intent; generic WorkProduct and workbook views expose only irreversible safe anchors.
- Durable recovery remains a compare-and-set `PREPARED → ARTIFACT_PENDING → WORK_PRODUCT_BOUND` saga with deterministic IDs and create-or-verify replay across every filesystem and database boundary.
- OOXML, path, symlink, formula, external relationship, resource-limit, authentication, tenant and error-sanitization controls remain fail-closed.
- Existing generic confirmation may record a decision, but this package does not make the artifact downloadable, published or archived.

## RED And GREEN

1. RED: the candidate RC1 runner hash differs from the trusted backup verifier hash. GREEN: update only `_TRUSTED_RUNNER_SHA256`, then prove old/tampered identities are rejected and the exact new identity is accepted.
2. RED: a migrated Mingshuo database test expects stale `user_version=1`. GREEN: assert the exact current v2 contract without weakening table/trigger/digest checks.
3. RED: the new backup test inserts an orphan delivery intent and trips the real FK contract before backup. GREEN: create a valid project/draft/intention lineage and continue to assert backup/restore preservation and corruption rejection.
4. Re-run all exact19 safety, tenant, formula, OOXML, idempotency, crash, registry, release and API negative tests on the exact20 candidate.

## Verification

The uncommitted candidate first runs v01–v15. Focused tests cover Mingshuo delivery/vertical, ArtifactStorage binding, report-artifact regressions, readiness and backup. Backend full and Ruff cover every Python path including the new twentieth path. Offline build, verifier and RC1 test suites must bind the same runtime registry digest `sha256:7caed69599c964b7fc908229d86795008a0956fdae90628a904f8e4ec87dcabe` and the same trusted runner identity. Root Harness, self-test, doctor, hook, authority regression under process-scoped POSIX temp variables, V2 and diff check are mandatory. After independent reviews and byte freeze, a separately authorized direct-child local candidate commit runs v16 exact20 preimage and machine verify-candidate; v16 must never run against the approval HEAD.

Governance Review confirms lineage, non-authorizing status and exact scope. Python Review checks XLSX/digest/saga/schema/test correctness. Security Review checks principal binding, formula/OOXML containment, fail-closed trust identity, recovery windows and sanitized responses/logs. Any P0–P2, path 21, remote drift, machine STOP or critical gate failure is NO-GO.

## Execution Order

1. Freeze and validate these three proposed governance files.
2. Wait for Owner confirmation of the exact RFC 8785 canonical digest.
3. Materialize one formal three-file approval commit as a direct child of the frozen base; ordinary fast-forward only.
4. Run product authority once. On GO, create one clean isolated writer candidate and rematerialize donor bytes without identity inheritance.
5. Produce RED for the three known defects, apply the minimal exact20 corrections, run v01–v15, complete three independent reviews, and freeze candidate identity.
6. Under separate valid authorization, create one local candidate commit that is the approval commit's direct child; run v16 exact20 preimage and machine verify-candidate against that committed identity.
7. Only after machine PASS and a still-exact remote approval identity may the candidate receive an ordinary fast-forward authorization. Never force-push or deploy production.

## Next Milestone

After exact20 lands, use one separate successor for the remaining user-visible milestone: confirmed WorkProduct to owner-scoped download, idempotent Shiguan archive, and V4 task-detail retrieval. Keep the existing confirmation, ArtifactStorage and Shiguan facts as the only sources; do not create another orchestration or archive system.

## Rollback

Rollback is a forward-only inverse of the exact twenty product paths after revalidation. It must preserve donor worktrees and history, never force-push, and never delete persisted evidence as a shortcut.
