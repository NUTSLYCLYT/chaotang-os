# Product Owner Exact-H Approval: R0-W06 Recovery

Status: `APPROVED_FOR_R0_W06_REVIEWED_ACTIVATION_ONLY`.

The Product Owner explicitly directed execution of the EXT recovery program under its documented
gates. This approval records only the R0-W06 recovery entry point below. It does not itself change
the tracked v2 manifest or authorize implementation until an independent read-only review is stored
and the activation intent is independently reviewed and atomically applied.

## Approved scope

- One work package only: `R0-W06` Artifact Delivery Recovery.
- Recovery base: `origin/feature-chaotang-ext@8feae838f09ad5202b21332d4280b989ab776bd7`.
- Recovery tree: `9d63f98041e5e13174dbba4c0b9d27eef1471bf9`.
- W06 delivery scope only: PDF, DOCX, JSON, `ArtifactManifestV1`, artifact hash/version/authz/expiry,
  independent artifact status, local retry, and the W06 delivery completion/rollback requirements.

## Explicit exclusions

- No deployment, production claim, automatic merge, push, or production readiness assertion.
- No real customer data, database migration, or listener `3050` takeover.
- No R0-W07, R0-W08, or R0-W09 authorization.
- No W06 activation in this preparatory commit.

## Machine-readable evidence

<!-- execution-authority-v2-evidence:start -->
```json
{
  "evidenceVersion": "execution-authority-v2-evidence.v1",
  "kind": "owner-approval",
  "decision": "APPROVED",
  "approver": "lyt",
  "workPackage": "R0-W06",
  "effectiveBase": {
    "ref": "origin/feature-chaotang-ext",
    "sha": "8feae838f09ad5202b21332d4280b989ab776bd7"
  },
  "candidateH": "8feae838f09ad5202b21332d4280b989ab776bd7",
  "tree": "9d63f98041e5e13174dbba4c0b9d27eef1471bf9",
  "approvedScope": ["R0-W06"],
  "exclusions": [
    "NO_DEPLOYMENT",
    "NO_REAL_CUSTOMER_DATA",
    "NO_DB_MIGRATION",
    "NO_LISTENER_3050_TAKEOVER",
    "NO_R0_W07_TO_R0_W09",
    "NO_AUTOMATIC_MERGE",
    "NO_PRODUCTION_CLAIM"
  ],
  "activationIntentPath": ".harness/changes/fix-ext-g0-authority-recovery-20260725/activation_intent/r0-w06-activation-intent.json",
  "activationIntentSha256": "f8b09ca694ba049420ae3f7572515563e9d5410a0c78819e989b6b31711dd614"
}
```
<!-- execution-authority-v2-evidence:end -->

The parser accepts only the marked JSON evidence block above. Any prose in this file, including
this approval summary, is not a substitute for the structured decision.
