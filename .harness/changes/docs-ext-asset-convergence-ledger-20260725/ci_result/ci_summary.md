# CI Summary: EXT Asset Capture

## Scope

Documentation-only evidence capture in
`governance/ext-asset-capture-20260725`, based on local accepted EXT
`c0a2c7ec2ac38ba522db3f9945bec722bd47c886`.

## Evidence Status

`IMPLEMENTER_REMEDIATED / REVIEW_PENDING`

## QA Remediation

QA returned `NO-GO` on commit `25b0b807`. This follow-up addresses all four
reported items:

1. Browser Route Repair has one implementation owner, Window 5, and one target,
   `EXT-P2`; `EXT-Q1` is only the later independent QA gate.
2. Court Writer AST Scanner implementation is owned by Window 5; Window 6 is
   read-only.
3. K2 and R1 record group dirty/untracked counts; R3 records a clean source
   with tracked=0 and untracked=0.
4. One-file/one-writer and protected hunk-level integration are explicit for
   `ShangshufangPage.tsx` and `prod-doctor.mjs`.

This section records implementer remediation only. It does not claim QA PASS.

## Verification

| Command | Result |
| --- | --- |
| `node scripts/harness-doctor.mjs` | PASS, 0 errors and 0 warnings |
| `git diff --cached --check` | PASS, no whitespace errors |
| `node scripts/execution-authority.mjs --check` | `VALID_INACTIVE_GUARD`; non-authorizing |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06` | `GO / APPROVED_WORK_PACKAGE` |
| Changed-file boundary | PASS, exactly the five declared governance files |

The first doctor run found a missing summary `Change ID`; the summary was
corrected and the complete doctor was rerun successfully. No business tests
are claimed because no business code is changed.

## Baseline Recheck

- Pre-commit HEAD:
  `c0a2c7ec2ac38ba522db3f9945bec722bd47c886`
- Pre-commit tree:
  `b0cc93c7471fdfb70b6de22cbbb232ef5ae39ec9`
- Remote EXT:
  `8feae838f09ad5202b21332d4280b989ab776bd7`
- Changed files: 5
- Independent Window 6 re-review: pending after QA `NO-GO`
- Integration into local `feature-chaotang-ext`: not performed

## Production Boundary

- Push: not performed
- Deployment: not performed
- Database migration: not performed
- Listener takeover: not performed
- Production state: `NOT_DEPLOYED`
