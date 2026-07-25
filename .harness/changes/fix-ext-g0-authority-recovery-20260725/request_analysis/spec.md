# Request Analysis: EXT-G0 Authority Recovery

## Confirmed facts

| Fact | Evidence | Required behavior |
| --- | --- | --- |
| Exact EXT recovery base | `8feae838f09ad5202b21332d4280b989ab776bd7`, tree `9d63f98041e5e13174dbba4c0b9d27eef1471bf9` | Candidate ancestry must include exact EXT |
| v1 is permanently inactive | `.harness/manifest/execution-authority.v1.json` and v1 schema | `status=AMENDMENT_REQUIRED`, `canonicalPlan.state=INACTIVE`, every activation field `null` |
| v2 is quiescent after W05 | `.harness/manifest/execution-authority.v2.json` | `activeWorkPackage=null`; W06 returns `STOP / NO_ACTIVE_WORK_PACKAGE` |
| Root entry wording is stale | `AGENTS.md`, project owner, workflow | v1 must be integrity-only; v2 is sole scoped product decision |

## Contract

1. Workers run `node scripts/execution-authority.mjs --check` before product work only to verify
   v1 guard integrity.
2. Workers then run `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>`.
   Only `GO / APPROVED_WORK_PACKAGE` from that command authorizes the requested scope.
3. This candidate must not make W06 active, create a GO result, or infer W06 approval from W01–W05.
4. The v1 manifest repins exactly the three changed root governed documents and no activation or
   product-authority digest.

## Owner and approval boundary

The recorded product owner is `lyt`; the implementation actor is the EXT-G0 governance implementer.
This record is a review candidate, not an owner approval of W06 implementation. The required
independent W06 review and atomic v2 activation belong to Task 2.

## Rollback and deployment

Rollback is a future approved revert of the focused governance commit. The candidate is
`NOT_DEPLOYED`; no deployment, migration, remote update, or listener operation is in scope.
