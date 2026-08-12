# R0-W08 D4A Continuation — Independent Review Pass 2 and Exact-H Final

Reviewer identity: `/root/d4a_g3_exact_pass2`

Verdict: `GO / HIGH 0 / MEDIUM 0 / LOW 0`

The reviewer independently recomputed the P3/G3 commit, tree, parent, exact
seven/eleven paths and binary diff digests. The real multipart upload test
persisted `SecureIngestAuditEvent.policy_version=docx-canonical-v1`; breaking the
router binding made that test RED. D4A final-M loader tests passed 7/7.

<!-- reviewer-successor-w08-d4a-evidence:start -->
```json
{
  "schemaVersion": "reviewer-successor.w08-d4a.evidence.v1",
  "kind": "independent-review",
  "reviewer": "Codex Independent QA",
  "identity": "/root/d4a_g3_exact_pass2",
  "pass": 2,
  "continuationId": "R0-W08-D4A-DOCX-PROVENANCE-01",
  "priorPromotionH": "df6c82cfa3f3b449da7c5a4500c643c3f45501fd",
  "priorPromotionTree": "559c0091bd60020b9c7faf936b687602970feab4",
  "productBaseH": "df6c82cfa3f3b449da7c5a4500c643c3f45501fd",
  "productCandidateH": "e25706c0c5d689354d2424f483446a1e243b58ec",
  "productTree": "1bc77790d7327b364a6e972620de456aa913f699",
  "productReviewPackagePath": ".harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/product-candidate.diff",
  "productReviewPackageSha256": "9e5ff0c70dbafc96700ea2479fec886b21e9926263f6406e435adc92b9a9002d",
  "governanceBaseH": "e25706c0c5d689354d2424f483446a1e243b58ec",
  "governanceCandidateH": "cefaf702512ed772757865180fadc12f78bfed2b",
  "governanceTree": "cc06ed4f973bd1d5a98ccc9103e16e22173f547f",
  "governanceReviewPackagePath": ".harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/reviewer-successor.diff",
  "governanceReviewPackageSha256": "f1325a5046d7be05f90178d388aa1f19322203549f9db038ff951a825cba0b90",
  "scope": ["R0-W08"],
  "verdict": "GO",
  "high": 0,
  "medium": 0,
  "writeAccess": "DENIED",
  "candidateMutation": "FORBIDDEN"
}
```
<!-- reviewer-successor-w08-d4a-evidence:end -->

<!-- execution-authority-v2-evidence:start -->
```json
{
  "evidenceVersion": "execution-authority-v2-evidence.v1",
  "kind": "independent-review",
  "verdict": "GO",
  "reviewer": "Codex Independent QA",
  "workPackage": "R0-W08",
  "effectiveBase": {
    "ref": "refs/heads/feature-chaotang-ext",
    "sha": "e25706c0c5d689354d2424f483446a1e243b58ec"
  },
  "candidateH": "e25706c0c5d689354d2424f483446a1e243b58ec",
  "tree": "1bc77790d7327b364a6e972620de456aa913f699",
  "approvedScope": ["R0-W08"],
  "ownerApprovalPath": ".harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/owner_approval/exact-h-approval.md",
  "ownerApprovalSha256": "92bbc2b81b5015fbb06e251e213f3942c33d9cb8330bf3ef8397ffcc5bf874d2",
  "activationIntentPath": ".harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/activation_intent/r0-w08-d4a-activation-intent.json",
  "activationIntentSha256": "0265ed9886498925c1fd82f11d99d2ad287cd7d525b27528e14f55cee58f2ba0",
  "reviewPackagePath": ".harness/changes/docs-r0-w08-d4a-exact-h-activation-20260812/review_inputs/product-candidate.diff",
  "diffSha256": "9e5ff0c70dbafc96700ea2479fec886b21e9926263f6406e435adc92b9a9002d",
  "changedPaths": [
    ".harness/changes/feat-ext-d4a-docx-provenance-20260812/ci_result/ci_summary.md",
    ".harness/changes/feat-ext-d4a-docx-provenance-20260812/request_analysis/spec.md",
    ".harness/changes/feat-ext-d4a-docx-provenance-20260812/request_analysis/tasks.md",
    ".harness/changes/feat-ext-d4a-docx-provenance-20260812/summary.md",
    "backend/src/secure_ingest/document_text.py",
    "backend/tests/test_secure_ingest_document_text.py",
    "backend/web/routers/secure_ingest.py"
  ],
  "commands": [
    "node --test scripts/reviewer-successor-w08.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs scripts/professional-agent-matrix.nodetest.mjs",
    "node scripts/professional-agent-matrix.mjs --check",
    "node scripts/execution-authority.mjs --check",
    "node scripts/execution-authority-v2.mjs --check",
    "node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08",
    "node scripts/harness-doctor.mjs",
    "git diff --check -- . ':(exclude).harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/review_inputs/product-candidate.diff' ':(exclude).harness/changes/docs-r0-w08-codex-reviewer-successor-20260810/review_inputs/reviewer-successor.diff'"
  ],
  "productionReady": false
}
```
<!-- execution-authority-v2-evidence:end -->

This review authorizes only the exact R0-W08 D4A P3 candidate through the
canonical nine-path activation carrier. It does not authorize production.
