# Mingshuo First Delivery Work Product V1 exact20 Readiness Lineage Successor Plan

Task: `MINGSHUO-FIRST-DELIVERY-WORK-PRODUCT-V1-EXACT20-READINESS-LINEAGE-SUCCESSOR-20260914`

Base: `fee06f259813ee54834fdcd84702430019be61a9 / 06b174bbbcdbf884c13572fb9ef69bec26656b77`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

Reissue the dependency-closed exact20 product successor only after the readiness compatibility prerequisite has landed. Preserve the existing Mingshuo producer, durable saga, runtime registry, offline release and backup trust design. Do not change either readiness validator, widen the product scope, or inherit any abandoned authority or candidate identity.

## Frozen Lineage

The old exact20 approval `9257f45e690badd75b6decf30aa2f11c50db16be` is `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR / REISSUE_REQUIRED`. Its product worktree is `UNCOMMITTED_BYTE_EVIDENCE_ONLY / BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`.

The prerequisite governance commit `f8caf8abb60f05125c9f9fc1fa39ba0af933064b` and exact2 validator commit `fee06f259813ee54834fdcd84702430019be61a9` are direct single-parent fast-forwards. Their five changed paths have zero overlap with the exact20 product paths. The validators preserve the first eleven ordered pairs and append only the approved twelfth pair `(sha256:598dd8e...bc9f79, sha256:43cf0adb...a9fea)`.

## Donor Boundary

The donor remains `/home/ubuntu/ct-p8/mingshuo-delivery-work-product-exact20-candidate-20260913`, exactly `2 ADD + 18 MODIFY`, all `100644`. Its byte bundle is `sha256:d6a9f2008e182cefe054df4aaa8551e56797f15991403277e623ed27a8a03c83`; its combined full-index diff is `sha256:c66fea83492914c0c4bac7947f572e7de477b57f22e6e272261208f72b571959`. These are donor identities, not candidate or verification identities.

The future candidate must be a clean direct child of the new approval commit and rematerialize all twenty donor paths byte-for-byte before regenerating RED/GREEN, full-matrix, review and machine evidence. Any need for path 21 is STOP.

## Frozen Product Scope

Exactly twenty paths, two additions and eighteen modifications, all `100644`. No frontend, V4, Shiguan, report-artifact API, Fact Pack evaluator/schema, WorkProduct schema, readiness validator, Harness, authority or other path may change.

## Product Semantics

- A currently revalidated PASS Fact Pack plus matching tenant/owner/project/draft request yields one deterministic five-sheet non-binding XLSX and one existing PENDING WorkProductEnvelope.
- Facts, assumptions, recommendations, evidence, missing inputs and risks remain distinct. Price, MOQ, delivery, warranty, certification and commercial approval remain blank or explicitly human-required.
- Private principal binding stays in the durable Mingshuo intent; generic WorkProduct and workbook views expose only irreversible safe anchors.
- Recovery stays a compare-and-set `PREPARED → ARTIFACT_PENDING → WORK_PRODUCT_BOUND` saga with deterministic IDs and create-or-verify replay across filesystem and database boundaries.
- OOXML, formula, relationship, path, resource, authentication, tenant and error-sanitization controls remain fail-closed.
- Existing confirmation may record a decision; this package does not make the artifact downloadable, published, archived or commercially approved.

## RED And GREEN

1. Re-prove the trusted RC1 runner and backup verifier identity are exact, and that old or tampered identities fail closed.
2. Re-prove the migrated runtime registry is exactly v2, with its table, trigger, digest and release projections closed against drift.
3. Re-prove the backup fixture uses a valid project/draft/intention lineage and that backup/restore preserves it while rejecting corruption.
4. Re-run all tenant, owner, stale input, clock rollback, digest drift, formula injection, OOXML, symlink, path traversal, idempotency, concurrency, crash recovery, registry, release and API negatives on the fresh candidate.
5. Re-prove backend-full is green because the landed ordered pair recognizes the exact20 runtime/successor state; never edit the validators from this authority.

## Verification And Review

Run manifest v01–v15 on the uncommitted candidate. Backend-full and authority regression use process-scoped POSIX temp only. After all checks pass, independent Governance Review confirms lineage, non-authorizing state and exact scope; Python Review checks XLSX, digest, saga, migration and test correctness; Security Review checks principal binding, formula/OOXML containment, fail-closed trust identity, recovery windows and sanitized output. Any P0–P2 is NO-GO.

The proposed governance package itself has passed strict JSON and duplicate-key rejection, Draft 2020-12 schema, `validateApprovalManifest`, `productTaskErrors=[]`, lineage/scope checks, Harness, self-test, Doctor, hook, authority regression, V2 and diff check. Independent Governance, Python Design and Security reviews are all `GO / P0=0 / P1=0 / P2=0 / P3=0`. These results freeze only the non-authorizing governance proposal; they do not authorize or verify product bytes.

After a separately authorized direct-child candidate commit, run v16 exact20 preimage and machine verify-candidate. v16 must not run against the approval HEAD. Only machine PASS plus unchanged live remote and exact identity can permit an ordinary fast-forward; force-push and production deployment remain forbidden.

## Execution Order

1. Validate and independently review these three proposed governance files.
2. Wait for Owner confirmation of the exact RFC 8785 canonical digest.
3. Materialize the identical approval bytes, create one direct single-parent three-file approval commit and ordinary fast-forward it if the remote is unchanged.
4. Run product authority once. On GO, create one isolated writer candidate and rematerialize the donor without identity inheritance.
5. Regenerate RED/GREEN, run v01–v15, complete three independent reviews and freeze candidate identity.
6. Under a later exact authorization, create the direct-child candidate commit, run v16 and machine verify-candidate.
7. Ordinary fast-forward only after machine PASS; never force-push or deploy production.

## Next Milestone

After exact20 lands, use a separate successor for the remaining user-visible milestone: `CONFIRMED → owner-scoped download → idempotent Shiguan archive → V4 task-detail retrieval`. Reuse the existing confirmation, ArtifactStorage and Shiguan facts; do not create another orchestrator or archive system.

## Rollback

Rollback is a forward-only inverse of the exact twenty product paths after revalidation. Preserve donor worktrees and history, never force-push, and never delete persisted evidence as a shortcut.
