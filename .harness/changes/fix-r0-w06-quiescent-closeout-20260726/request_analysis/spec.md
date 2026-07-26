# Specification: R0-W06 Quiescent Closeout

## Objective

Represent the completed and locally integrated R0-W06 Packet honestly in the
single v2 authority ledger without inferring approval for R0-W07.

## Required State

```text
activeWorkPackage = null
R0-W06 = MERGED_AND_VERIFIED
active ledger entries = 0
R0-W06 authorize = STOP / NO_ACTIVE_WORK_PACKAGE
R0-W07 authorize = STOP / NO_ACTIVE_WORK_PACKAGE
```

The existing W06 owner approval, independent review, activation intent,
effective base, and digests remain historical provenance and must not change.

## Allowed Files

- `.harness/manifest/execution-authority.v2.json`
- `scripts/execution-authority-v2.nodetest.mjs`
- this root change record
- the approved authority transition design and Event 1 plan

## Out Of Scope

- R0-W07 activation intent, approval, or implementation
- authority schema, resolver, CLI, or root entry changes
- frontend or backend product code
- push, deployment, migration, listener changes, or production claims

## Acceptance

- Authority tests pass.
- v1 remains `VALID_INACTIVE_GUARD`.
- v2 structure remains valid.
- W06 and W07 both stop with `NO_ACTIVE_WORK_PACKAGE`.
- Both harness doctors and baseline diff check pass.
- Independent review reports GO with no unresolved HIGH or MEDIUM findings.
