# Packet 14 — Exact30 Gate A Lifecycle Truth Corrective Successor

## Status

Draft

Harness document classification: `Draft`. This field is not the live product-authority state. The active lifecycle row below is selected mechanically from Git, remote HEAD, formal approval identity, machine authority result, candidate state and independent review evidence.

Task ID: `PACKET-14-EXACT30-TRUSTED-ARTIFACT-DELIVERY-GATE-A-LIFECYCLE-TRUTH-CORRECTIVE-SUCCESSOR-20260901`

## Product Definition

Forward-only correction of the lifecycle truth contradiction discovered after approval commit `3ca431bcbe9e20e4d96cab9d2cbc56ae507ca0f3` reached `origin/ext-dev` and machine authority returned `GO / APPROVED_FOR_ONE_CHILD`. That predecessor's committed Task and Plan still described a proposed, waiting-for-confirmation state, so independent Governance/TypeScript review returned `NO-GO / P1=1` before any exact30 product commit existed.

The `3ca431bc…` authority is therefore frozen as `ABANDONED_AFTER_INDEPENDENT_LIFECYCLE_TRUTH_REVIEW / NO_RETRY / NO_AUTHORITY_INHERITANCE`. Its exact30 working tree is retained as `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`. This successor does not amend or rewrite `3ca431bc…`; it binds the same exact30 bytes to current `ext-dev@3ca431bc…` and makes the lifecycle transition contract explicit and future-safe.

Lifecycle projection:

| Mechanical condition | Effective state |
| --- | --- |
| only the proposed draft path exists and no approval commit exists | `DRAFT / NON_AUTHORIZING` |
| formal approval is a local direct child of the frozen base but remote still equals the base | `FORMAL_APPROVAL_LOCAL_ONLY / NON_AUTHORIZING / DO_NOT_AUTHORIZE_OR_PUSH_PRODUCT` |
| formal approval is a direct child of the frozen base and remote equals it, before machine GO | `FORMAL_APPROVAL_PUSHED / AUTHORITY_NOT_YET_CONSUMED` |
| machine authority returns `GO / APPROVED_FOR_ONE_CHILD`, remote still equals formal approval and no product child exists | `APPROVED_FOR_ONE_CHILD` |
| approval transport verification fails, remote drifts, or machine authority returns `STOP` | `AUTHORITY_OR_TRANSPORT_STOP / ABANDONED / NO_RETRY / NO_INHERITANCE` |
| independent P0–P2, verification failure or scope drift occurs before product child | `ABANDONED_AFTER_REVIEW_OR_VERIFICATION_STOP / NO_RETRY / NO_INHERITANCE` |
| exact30 direct child exists, no post-child failure exists and gates 00–98 plus four reviews are not yet complete | `GATE_A_CHILD_CREATED / VERIFICATION_PENDING / NO_CANDIDATE_ACCEPTANCE / DO_NOT_PUSH` |
| any gate 00–98 or independent P0–P2 failure occurs after product child | `GATE_A_CHILD_FAILED / ABANDONED / DO_NOT_PUSH / NO_RETRY / NO_INHERITANCE` |
| exact30 direct child exists, gates 00–98 plus four reviews pass and gate 99 has not executed | `GATE_A_BYTE_DONOR_CHILD / NO_CANDIDATE_ACCEPTANCE / DO_NOT_PUSH` |
| gate 99 executes after gates 00–98 plus four reviews pass | mandatory `STOP / GATE_B_REQUIRED` with exit `86` |

The manifest under its `request.approvalPath` is the only machine authority source after materialization. The temporary proposed path is only a byte donor before materialization and never defines product scope after it is removed.

## Acceptance Criteria

- [ ] Approval commit is the direct single-parent child of `3ca431bc…`, changes only the new formal approval, this Task and the matching Plan, and leaves the predecessor history intact.
- [ ] Machine authority is run once; the abandoned `3ca431bc…` authority is never retried, recovered, inherited or re-anchored.
- [ ] Exact30 is re-materialized byte-for-byte from the stopped working tree and remains exactly `30 MODIFY / 0 ADD`, all `100644`, with no 31st path.
- [ ] Exact30 bundle remains `sha256:27c544f37e9549d3a99f66ace498bccd8c3a8d5e2d94ce028773fe48b4be4882` and parent-to-child full-index diff remains `sha256:6af72651a1da268e32f3c29af6642afcd496f6792eae4bb8817e787fb9da2e18`.
- [ ] Three isolated runtime-lock shards, frontend offline matrix, release regressions, Harness/Doctor, authority regression, V2 and diff check pass from the committed child.
- [ ] Governance/TypeScript, Python and Security independent reviews have no P0–P2.
- [ ] Gate A creates only a local byte-donor child; machine `--verify-candidate`, product push, Pilot, Release and deployment remain blocked until a separate Gate B successor.

## Delivery Constraints

- Base commit/tree: `3ca431bcbe9e20e4d96cab9d2cbc56ae507ca0f3 / deb5d7131e2a51577eef79e15538699a1ab01fff`.
- Predecessor approval: `.harness/approvals/PACKET-14-EXACT30-TRUSTED-ARTIFACT-DELIVERY-GATE-A-VERIFICATION-ENVIRONMENT-CORRECTIVE-SUCCESSOR-20260901.json`; historical evidence only after abandonment.
- Byte donor: `/home/ubuntu/Projects/chaotang-os/.worktrees/p14-exact30-gate-a-verification-environment-corrective-successor-candidate-20260901`; preserve untouched, uncommitted and unpushed.
- Product scope is exactly the 30 ordered paths in this successor manifest's `request.productPaths`.
- Do not modify runtime-lock, locks, wheelhouse, Harness, authority, readiness validators, CI, protected exact2, system/user Python, Git/npm/pip configuration or real data.
- No merge, cherry-pick, rebase, force-push, product push, Pilot, Release, publication or deployment.

## Affected Modules

- 模块：P14 trusted-artifact exact30 Gate A lifecycle truth and the unchanged exact30 product scope.
- 允许路径：this successor manifest's exact 30 ordered `request.productPaths`; no 31st product path.

## Technical Plan

1. Freeze `3ca431bc…` machine GO as abandoned after independent lifecycle review; preserve its formal governance bytes and current exact30 donor.
2. Create this forward-only three-file successor from `3ca431bc…`, carrying the identical product paths, bundle, diff and verification matrix while replacing stale live-state prose with the mechanical lifecycle table.
3. Complete strict JSON, duplicate-key rejection, Draft 2020-12 schema, manifest validation, productTaskErrors, exact path/mode checks, canonical/raw/bundle identities and Harness/Doctor.
4. After Owner confirms the new exact canonical digest, materialize the formal approval and create one direct child. While it is local-only, the lifecycle is non-authorizing; only after an exact ordinary fast-forward and post-push remote check may authority run.
5. Before and after the single machine-authority run, use the gate 00/98 fixed transport contract: reject local `include/includeIf`, `core.sshCommand` and `url.*.insteadOf`; disable global/system config; from `/tmp` read the fixed `git@gitee.com:msxn/chaotang-os.git` URL with `/usr/bin/ssh -F /dev/null`. Any transport/remote failure or machine `STOP` abandons this successor with no retry or inheritance. Only on GO may a fresh isolated product worktree byte-for-byte re-materialize the 30 donor files.
6. Run working-tree contracts and independent reviews, then create one local direct child. On that clean child run manifest 00–98; gate 99 must exit 86. Do not run machine `--verify-candidate` and do not push the Gate A child.
7. Only after Gate A evidence freezes may a separate Gate B successor bind supervisor, browser/Pilot, release identity and reversible RC acceptance.

## Implementation Report

Predecessor approval `3ca431bc…` was validly materialized and fast-forwarded; its machine authority returned GO with canonical digest `sha256:7a82b895f6fefa3151a72aafdd8e86031750e79b854d6a2ed9afd834fba15eb1`. Exact30 was re-materialized with the expected bundle/diff and no extra path. Frontend 726/726, lint, typecheck and production build passed; required Python/runner contracts passed. Three runtime-lock shards correctly refused the uncommitted tree as dirty. A manual release-regression run that inherited Windows TEMP/TMP failed on staging-root safety; the machine verification environment removes those inherited variables and therefore uses POSIX `/tmp`. No product byte was changed in response.

Independent Security review returned GO for Gate A byte-donor-only. Independent Governance/TypeScript review returned `NO-GO / P1=1` solely because the predecessor's committed Task/Plan still described the earlier draft/proposed lifecycle. No exact30 product commit, push, Pilot, Release or deployment occurred.

## Acceptance Review

This section records the drafting checkpoint only and is not a live authority declaration. Before formal materialization the first lifecycle row applies: `DRAFT / NON_AUTHORIZING`. After any local commit, push, transport check or machine transition, reviewers and operators must select the matching row in `Product Definition`; they must not continue treating this drafting checkpoint as current state. A local-only approval never authorizes product work. Any authority/transport `STOP`, P0–P2, remote/base drift, lifecycle ambiguity, 31st path or verification failure abandons the successor with no retry or inheritance.

## Rollback

Before approval push, abandon only this isolated three-file draft. Never delete or clean either exact30 donor. After an approval fast-forward, all corrections are new forward-only successors; never amend, rebase, force-push or rewrite historical governance. Gate A product child remains local and unpushable.
