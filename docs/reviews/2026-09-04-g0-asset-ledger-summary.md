# G0 Asset Ledger Summary · 2026-09-04

## Status

Review

## Baseline

- Repository: `gitee.com/msxn/chaotang-os`
- Branch: `origin/ext-dev`
- Observed HEAD: `82faca69ecaabba1cae08dc69c5306388068bcb2`
- Observation mode: read-only
- Production deployment: not authorized and not performed

This ledger is a convergence control artifact. It does not authorize merging old
branches, cleaning worktrees, deleting untracked files, inheriting donor
candidate identity, or retiring any legacy entrypoint.

## Current inventory

- Worktrees observed: `233`
- Clean worktrees: `118`
- Dirty worktrees: `84`
- Unavailable / prunable worktrees: `31`
- Detached worktrees: `152`
- Worktree status entries: `2418`
- Untracked entries: `187`
- Worktrees with staged changes: `8`
- Worktrees with untracked changes: `36`
- Local branches: `261`
- Branches already contained by current `origin/ext-dev`: `64`
- Branches not ancestors of current `origin/ext-dev`: `197`
- Small ahead branches with `1..10` commits over current ext-dev: `18`
- Large or diverged branches: `179`

## Interpretation

The repository is not one broken mainline; it is one usable `ext-dev` mainline
surrounded by many historical donors, experiments, stale worktrees, and
duplicated candidate lineages.

The risk is not “too few features”. The risk is accidental bulk absorption:
copying or merging old branches would reintroduce obsolete authority,
duplicate runtimes, stale approvals, generated artifacts, and unverified dirty
worktree bytes.

## Highest-risk dirty asset groups

These locations must not be cleaned, bulk committed, or uploaded without a
separate donor review:

| Group | Path / pattern | Current observation |
| --- | --- | --- |
| Root mixed worktree | `/home/ubuntu/Projects/chaotang-os` | `1585` status entries; mixed historical/backend/frontend/governance assets |
| P14 exact30 family | `.worktrees/p14-*` | Multiple 30/32-path dirty descendants; must be lineage-reviewed, not bulk merged |
| RC/offline release family | `.worktrees/rc1-*` | Exact release evidence/offline wheelhouse candidates; several staged worktrees |
| R0/W06 governance family | `/home/ubuntu/worktrees/chaotang-os-r0-w06-*` | Staged governance preseal artifacts; historical evidence only until reviewed |
| EXT P0C family | `.worktrees/ext-p0c-*`, `.worktrees/p0c-*` | Untracked and mixed legacy contract/evidence assets |

## Small ahead branches needing semantic decision

These are small enough to review selectively. Their commits must still be
classified before any replay:

| Branch | Tip | Ahead |
| --- | --- | ---: |
| `ext-dev` | `0cfc865ceb0c02973113671e6290155ea2cda6d3` | 1 |
| `codex/packet-14-trusted-artifact-delivery-contract-20260822` | `746c12817c0b5b7f1864481720dc91f4ef720867` | 1 |
| `codex/harness-only-worktree` | `c5d5bd429d4398391edf3d44741faf1a9d387c3f` | 7 |
| `codex/ext-dev-legacy-92007a-20260825` | `92007a2d9a7895d5b1418a603da5fb46746cf8cb` | 2 |
| `codex/tenant-principal-v1-governance-20260828` | `c471b034353440401b18995ac13fbfdbe5cbc966` | 1 |
| `codex/packet01-battery-safety-e67beabc-20260825` | `e67beabc50ccb338e851053577f963516b9834f7` | 1 |
| `codex/rc1-release-blocker-remediation-approval-20260817` | `dd28a1c133f0c0327086ded8006998d22163f1bd` | 1 |
| `codex/rc1-release-verification-sandbox-corrective-v2-20260819` | `4c0b10630859eb143a6a63c2ed2332352f6d50ec` | 1 |
| `codex/readiness-fingerprint-repair-v2-20260816` | `2fac9ffc825893559885f9331712e9784d85c9d7` | 1 |
| `feature-chaotang-release` | `44aa7f0674c1304f85afcd31d7b1e5087ee5e74e` | 2 |

## Already superseded donor classes

These should not be replayed as-is:

- Old Battery P01 branches: superseded by P01 exact10 on the mainline.
- Old Tenant Principal exact14 branches: superseded by exact15 and subsequent
  authority-lineage corrections.
- Old dual orchestration branches: superseded by the strict boundary lineage.
- Old readiness/product-authority repair branches: superseded by the current
  readiness validator and credential executor lineages.
- Old RC/offline recovery branches: only exact source evidence should be
  distilled; do not merge old runtime stacks wholesale.

## Convergence queue

The next safe sequence is:

1. Preserve current roadshow RC and do not destabilize `/dadian`,
   Scene Pack V1, Junjichu, or Honglusi before the demo.
2. Finish the credential-separated verifier installed-acceptance boundary in a
   non-production root/systemd environment, with units stopped and disabled
   after the run.
3. Review the 18 small ahead branches and classify each as `REPLAY`,
   `SUPERSEDED`, `DOC_ARCHIVE`, or `REJECT`.
4. Hash and group the dirty donor worktrees by head, path set, and content
   digest, selecting at most one byte donor per semantic lineage.
5. Calibrate the capability inventory and remove obsolete file facts without
   creating a second capability registry.
6. Continue business-entry convergence in small, verifiable batches:
   governance/Shiguan writers → direct/swarm sessions → flywheel/knowledge
   writers → adapters and specialized loops → telemetry observation.
7. Integrate the Mingshuo solution-hub vertical as one vertical slice on top of
   existing requirements, IMA, KnowledgeRouter, battery/PACK, quotation, OPC,
   customer-success, Yushi, and Shiguan facts. LangGraph remains isolated PoC
   unless separately promoted through authority.

## Decision

`G0_ASSETS_FROZEN_FOR_REVIEW / BULK_MERGE_FORBIDDEN`

The correct acceleration strategy is not deleting constraints. It is reducing
coordination drag: one writer, clean worktrees, tiny batches, explicit donor
classification, and full automated gates. This keeps tonight's roadshow stable
while still moving toward full convergence.
