# Mingshuo Scene Truth and Idempotency V1 Product Successor Plan

Task: `MINGSHUO-SCENE-TRUTH-IDEMPOTENCY-V1-PRODUCT-SUCCESSOR-20260913`

Base: `0ac8fe9083913839fbeba2aec8909baa964fd3c8 / 70b7ce20283b39dda27008fd5f5534037dfb515d`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Goal

Close the first two browser-proven blockers in the Mingshuo delivery path without creating a second truth source: make the single-product scene an unscored, source-preserving precheck and make each browser input revision transactionally idempotent. The existing Mingshuo Fact Pack remains the only later business-truth evaluator.

## Frozen Scope

The candidate is exactly ten paths: one new backend truth regression file and nine modifications across the existing Scene Pack API/model/storage and frontend client/workspace contracts. All modes are `100644`. No BFF route, Mingshuo runtime, WorkProduct, download, confirmation, Shiguan, Dadian, Honglusi, Harness or authority file may change.

## RED

1. Browser and API evidence proves placeholder claims receive low-risk `CONDITIONAL_GO` and `canProceed=true`.
2. Identical browser payloads currently produce different run and mission identities.
3. A complete nonempty input currently produces a numeric score and market recommendations despite lacking independent evidence.
4. Unknown write outcomes have no request identity suitable for a safe retry.
5. Historical single-product rows with old scores can still be rendered as if current.
6. Two SQLite connections can race the same key, and a request header would be stripped by the existing BFF.
7. A response from an older input revision can overwrite the visible result after the user edits the form.

## GREEN

1. Current single-product requests become deterministic `PRECHECK_ONLY` or `BLOCKED`; never business approval. Public confidence is null while the unchanged SQLite integer column stores only the protected `-1` sentinel for this contract.
2. RFC 8785 UTF-8 source snapshot and server `sha256:<hex>` digest survive reads but never enter public JSON, details, logs or telemetry; unsupported historical rows degrade to the frozen `LEGACY_UNVERIFIED/high/blocked/null` projection without rewrite.
3. JSON body `requestKey` maps to backend `request_key`; it is a strict canonical UUID v4 with no server fallback. Same tenant/owner/operation/key/fingerprint returns the same identity; key reuse with different payload is 409 and creates no rows.
4. `BEGIN IMMEDIATE` serializes two-connection races. The same transaction validates snapshot/digest, creates run/mission/mapping, validates the public response and then commits; every failure rolls all three counts back.
5. The frontend binds display to input revision/key, retains only non-sensitive pending identity in session storage across an unknown result, drops it on principal change, never silently retries or changes key, and distinguishes 401/409/422/known 5xx/unknown network states. Public null confidence renders exactly as “未评分”.
6. S4 and all other scene behavior, including numeric confidence, remain byte-contract compatible.

## Browser Acceptance

- Synthetic registration and login.
- Submit evidence-limited Mingshuo input and observe `PRECHECK_ONLY`, no low-risk success and explicit limitations.
- Double-click and repeat-submit checks show only one mission for the same input revision.
- Simultaneous requests from two independent connections return one run, one mission and one mapping; a conflicting payload receives the same non-leaking 409 contract.
- Change input and explicitly rerun to create a second, distinct revision.
- Edit inputs while the first request is in flight and prove the stale response cannot render or enable its task link; refreshing after an unknown response surfaces the pending check without storing raw inputs.
- Unauthenticated redirect and cross-tenant mission invisibility remain intact.
- Reuse the same UUID across owner/tenant boundaries and prove all lookups remain server-principal scoped with no identity leak.
- V4 task list/detail renders the same conservative run without raw snapshot, digest or request key and without console errors.

## Verification and Review

Run the manifest matrix with POSIX process-level temporary directories where already required. `v18-exact10-preimage` mechanically proves one exact add, nine exact modifies, ten `100644` blobs and no rename/delete/re-add/mode drift. Independent reviews cover governance lineage, Python transaction/idempotency correctness, TypeScript stale-response and duplicate-click behavior, and security/tenant boundaries. Any P0–P2, machine STOP, eleventh path, S4 regression, duplicate fact source, test failure or remote drift is a hard stop.

## Frozen Truth, Storage, and Retry Contract

- The immutable source snapshot is RFC 8785 over exactly `{operation:"create_scene_run",packSlug,demo,inputs,attachments,canonicalizationVersion:"scene-request-v1"}` after existing bounded input validation and preserves submitted Unicode scalar values. `serverInputDigest` is independently computed by the server over the same closed object after recursively normalizing every string value to NFC; the digest is lowercase `sha256:<64 hex>`. `clientRevisionFingerprint` uses the same recursive NFC and RFC 8785 bytes only for pending-key UX; it is never accepted as server truth. NFC composed/decomposed pairs are canonical-equivalent; compatibility characters outside NFC and any semantic byte change are canonical-different test vectors. Placeholder comparison separately uses per-field NFKC/trim/exact match and does not mutate the snapshot.
- The private relation is exactly `scene_run_request_identities(tenant_id TEXT NOT NULL, owner_user_id TEXT NOT NULL, operation_scope TEXT NOT NULL, request_key TEXT NOT NULL, pack_slug TEXT NOT NULL, canonicalization_version TEXT NOT NULL, identity_schema_version TEXT NOT NULL, truth_contract_version TEXT NOT NULL, source_snapshot_json TEXT NOT NULL, server_input_digest TEXT NOT NULL, run_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, PRIMARY KEY(tenant_id,owner_user_id,operation_scope,request_key), FOREIGN KEY(run_id) REFERENCES scene_runs(id))`. Closed-value checks bind operation `create_scene_run`, identity `scene-request-identity.v1`, canonicalization `scene-request-v1`, and target truth contract `mingshuo.scene.precheck.v1`; other packs use `scene.legacy-compatible.v1` request identity without changing their existing numeric score or public contract. The mapping stores no mission id: existing `board_missions.run_id UNIQUE` is the sole derivation path and every read verifies matching tenant/owner/pack through the run. There are no free-standing reservations: identity rows are one-to-one with existing runs, so the feature cannot multiply storage beyond existing authenticated run creation. Missing or malformed UUIDs are rejected before opening the transaction.
- `scene_runs.confidence` remains `INTEGER NOT NULL`; this package does not rebuild or migrate the table. Only a verified `mingshuo.scene.precheck.v1` identity may interpret stored `-1` as public `null`. All other packs keep 0–100 numeric behavior. Invalid or legacy identities are never interpreted as scored current truth.
- The single-product placeholder contract is a per-field closed table with NFKC, trim and exact-match rules; it does not use substring `无`, and it produces a stable ordered list of missing labels. Phrases such as `未经核验` and `用户申报` attached to concrete values remain verbatim and add verification gaps.
- The browser pending record is session-scoped and namespaced by a stable current authenticated principal marker, contains only UUID key, `clientRevisionFingerprint`, pack slug, revision and expiry, and never raw inputs. A missing or changed principal deletes it before use. It is cleared only after a matching success or explicit discard. Expiry fails closed to task-list reconciliation; it never authorizes a new write. No request key, raw snapshot or server/client digest may appear in user-visible errors or logs.
- Legacy degradation is exact and read-only: `status=blocked`, `verdict=LEGACY_UNVERIFIED`, `confidence=null`, `riskGrade=high`, `opportunityGrade=low`, `canProceed=false`, mission `blocked`, with no low-risk, recommendation or approval language. Missing mapping, invalid snapshot, digest mismatch and missing run/mission use the same conservative family.

## Failure Injection Matrix

- mapping insert failure, mapping foreign-key failure, snapshot parse/digest mismatch, response serialization failure before commit, replay serialization failure, identical concurrent replay and conflicting concurrent fingerprint;
- malformed/noncanonical/non-v4/overlong request key, cross-pack key reuse, NFC composed/decomposed equivalence, NFKC-only compatibility-character difference, semantic payload difference, cross-owner/tenant guesses, principal switch in one tab, and raw identity leakage scans;
- double click, post-success repeat, input edit during flight, edit-back-to-original, unknown network result, refresh with pending identity, explicit discard, 401, 409, 422 and known 5xx;
- API response, BFF response, V4 list/detail, client error and console-spy assertions prove request key, source snapshot and server/client digest remain absent. Each failure asserts unchanged run/mission/mapping counts, while four non-target Scene Packs and S4 preserve their pre-existing status, score, mission and analysis contracts.

## Follow-on Boundary

After this candidate lands, a separate latest-base successor may connect the immutable input identity to the existing Mingshuo Fact Pack and then adapt the existing WorkProduct/confirmation/download/Shiguan lifecycle. The learning kernel remains a separately frozen queued package; neither package inherits the other's authority or candidate identity.

## Rollback

Rollback is a forward-only inverse of the exact ten-path candidate after revalidation. No force-push, reset, history rewrite, donor cleanup or production deployment is permitted.
