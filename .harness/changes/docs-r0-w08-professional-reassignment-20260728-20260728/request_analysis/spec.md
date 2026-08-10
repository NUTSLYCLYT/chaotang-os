# 规格说明：docs-r0-w08-professional-reassignment-20260728-20260728

## Background

R0-W08 is defined as `Product Acceptance Hardening`, but W08/W09 are protected
by the v2 `professionalReassignment` runtime gate. The gate is triggered for
`R0-W08`, `R0-W09`, or `--real-customer-data`.

Current manifest before this Packet:

```json
{
  "security": "lyt",
  "legal": "lyt",
  "release": "lyt"
}
```

Because all three roles equal `defaultOwner`, any active W08/W09 candidate would
stop with `PROFESSIONAL_REASSIGNMENT_REQUIRED`.

## Design

This Packet changes only the assignments under:

```text
.harness/manifest/execution-authority.v2.json
professionalReassignment.assignments
```

New assignments:

```json
{
  "security": "r0-security-owner",
  "legal": "r0-legal-owner",
  "release": "r0-release-owner"
}
```

The frozen boundary fields stay unchanged:

- `requiredBefore = ["REAL_CUSTOMER_DATA", "R0-W08", "R0-W09"]`
- `rolesRequired = ["security", "legal", "release"]`
- `defaultOwner = "lyt"`

## Data Flow

```text
execution-authority.v2.json
-> validateExecutionAuthorityV2Manifest
-> evaluateExecutionAuthorityV2Policy
-> professional gate no longer blocks solely because roles equal defaultOwner
```

## Acceptance Criteria

- manifest schema remains valid
- `activeWorkPackage` remains `null`
- W08 remains inactive until a later activation candidate
- focused test proves default assignment fails closed
- focused test proves reassigned W08 policy proceeds to `POLICY_ELIGIBLE`
- root doctor passes
- diff check passes

## Risks

| Risk | Mitigation |
| --- | --- |
| Treating reassignment as W08 activation | v2 W08 must remain `STOP / NO_ACTIVE_WORK_PACKAGE` |
| Reassigning only one role | test uses all three non-default roles |
| Weak evidence | owner evidence and Codex review evidence are recorded in this Packet |
| Scope creep into product code | changed paths are limited to authority governance, tests, and Packet docs |

## Verification Plan

- `node --test scripts/execution-authority-v2.nodetest.mjs`
- `node scripts/execution-authority-v2.mjs --check`
- `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
