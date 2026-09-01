# Packet 14 Work-Product BFF Exact2 Environment-Normalized Successor — Governed Plan

## Contract

- Task: `PACKET-14-WORK-PRODUCT-BFF-CANCEL-EXACT2-ENVIRONMENT-NORMALIZED-SUCCESSOR-20260901`
- Base: `8441b881354d2521a7e0b04e4c3bfe05295852c3`
- Base tree: `f6a827cf10b1e2a7ccf76e3598f43762c449cefe`
- Product scope: exact2, `0 ADD + 2 MODIFY`, all `100644`.
- Old approval `8441b881…`: immutable lineage base; its old one-child authority is abandoned with no retry or authority inheritance.
- Old candidate `0443a6c…`: byte donor only after two environment verification STOPs; no candidate or verification identity inheritance.
- Rollout: ordinary fast-forward only; no Pilot, Release, publication or deployment.

## Phase G — Governance

1. Confirm live `origin/ext-dev` equals `8441b881…`; drift is STOP and never re-anchor this package.
2. Freeze the old authority disposition as `ABANDONED_AFTER_ENVIRONMENT_VERIFICATION_STOP / NO_RETRY / NO_AUTHORITY_INHERITANCE`; preserve `8441b881…` as immutable ancestry and identify only `0443a6c…` as byte donor.
3. Validate strict JSON, duplicate-key rejection, Draft 2020-12 schema, `validateApprovalManifest`, `productTaskErrors=[]`, exact paths/modes and the complete Harness.
4. Compute approval RFC 8785 digest and sorted three-file bundle; obtain Governance and Security review.
5. Create and ordinary fast-forward one three-file approval commit.
6. Immediately before and after the new `--authorize`, verify the fixed Gitee URL from `/tmp`, disable global/system Git config, reject local include/includeIf, `url.*.insteadOf` and `core.sshcommand`, force `/usr/bin/ssh -F /dev/null`, and require the live remote to equal the new approval commit exactly.

## Phase E — Environment Contract

1. Create the new candidate worktree from the new approval commit.
2. With Node `v22.23.1`, npm `10.9.8`, `HOME=/nonexistent`, distinct nonexistent user/global npm config paths, fixed `/bin/sh`, and explicit local cache, run `npm ci --offline --ignore-scripts --no-audit --no-fund` inside `frontend/`.
3. Bind package-lock SHA-256 `a08cf31…`, reject project/root `.npmrc`, reject a symlinked node_modules root and every symlink escaping it, and canonicalize every directory, regular file and internal symlink with mode/content/target.
4. Require exactly 22457 records and tree digest `sha256:5622646be4a6238728aa4a45553a46b41f63ca4bebc71cc05ada902aa4386fd8` before the test matrix and again after all npm gates.
5. Run every npm script through an isolated process environment with fixed user/global config paths and script shell. Treat any runtime/config/tree drift as STOP. This is an execution-environment identity, not an independent upstream supply-chain attestation.

## Phase R — Byte Rematerialization

1. Reconfirm old candidate/donor raw, blob, mode and byte identities read-only.
2. Copy only the two frozen product files into the new candidate worktree.
3. Confirm exact `2 M`, bundle `7d6eb647…`, hermetic diff `c40b12b2…`, no untracked third path.
4. Re-run focused RED/GREEN evidence without inheriting old candidate or verification identity.

## Phase V — Verification

1. Run the offline provisioning and complete dependency-tree preflight first.
2. Run focused route tests and frontend full test/lint/typecheck; run the build wrapper with `NODE_ENV=production` so Next loads the production environment contract.
3. Run root Harness/self-test, Doctor/tests, hook, authority regression, V2 and diff check; then repeat the complete dependency-tree identity check.
4. Complete Governance, TypeScript and Security review; any P0–P2 is STOP.
5. Commit the new direct child and run the new machine `--verify-candidate` once. Only PASS permits ordinary fast-forward.

## Stop Conditions

- Remote/base/tree, lock, package versions, donor bytes, scope, modes or digests drift.
- Dependency directory is absent, symlinked, outside the candidate tree, or requires network/version mutation.
- Third product path, backend client, Harness/readiness/authority or exact30 byte appears.
- Any required command fails, machine returns STOP, or reviewer reports P0–P2.
- Any claim of complete cancellation, P14 release acceptance, Pilot or deployment.

## Follow-up

After exact2 lands, issue the P14 exact30 forward-only successor on the new base, semantically preserving accepted Tenant/P10/P04 overlap. Close candidate-external supervisor/release-execution authority separately before Gate B.

## Rollback

Before push, abandon only the isolated new candidate. After push, any removal requires another forward-only successor. Never delete donors, clean dirty historical worktrees or rewrite remote history.
