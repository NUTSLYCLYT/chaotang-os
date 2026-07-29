# EXT-A9 Full Asset Reconciliation Ledger

This ledger is the control surface for making `feature-chaotang-ext` reach
100% asset disposition coverage. It does not mean every historical branch or
worktree is merged. It means every asset receives a final disposition:

- `ABSORB`: integrate into EXT through a scoped Packet and verification.
- `REBUILD`: preserve the product idea, but reimplement on current EXT.
- `SUPERSEDED`: already covered by current EXT.
- `ARCHIVE`: keep as historical evidence, not product inventory.
- `REJECT`: explicitly discard.
- `CONFLICT_DECISION`: conflict exists; one option must be selected and the
  rejected option must be documented.

## Snapshot

| Inventory | Count | Source command |
| --- | ---: | --- |
| Git refs | 206 | `git for-each-ref refs/heads refs/remotes` |
| Worktree porcelain lines | 585 | `git worktree list --porcelain` |
| Change summaries | 238 | `find .harness/changes backend/harness/changes frontend/.harness/changes -maxdepth 2 -name summary.md` |

## Non-Negotiable Rules

- EXT remains the only integration target.
- Do not merge historical branches wholesale.
- Do not cherry-pick large commit sets.
- Do not copy dirty worktrees.
- Do not claim production deployment.
- Do not activate W09 while W08 is blocked.
- Every absorption requires owner, scope, files, verification, QA review, and
  Codex acceptance.

## Disposition Taxonomy

| Disposition | Meaning | Allowed next action |
| --- | --- | --- |
| `ABSORB` | Asset is compatible, valuable, and testable. | Create isolated Packet, implement hunk-level changes, verify, review, integrate. |
| `REBUILD` | Idea is valuable but implementation shape conflicts with EXT. | Write current-EXT design and rebuild from current architecture. |
| `SUPERSEDED` | Current EXT already provides the capability. | Record evidence and close asset. |
| `ARCHIVE` | Useful history or evidence only. | Preserve references; do not expose as product capability. |
| `REJECT` | Unsafe, obsolete, misleading, or outside product scope. | Record reason; no integration. |
| `CONFLICT_DECISION` | Two or more assets propose incompatible product or architecture choices. | Pick one SSOT; mark losers `REJECT` or `ARCHIVE`. |

## Priority Lanes

| Lane | Purpose | Initial target |
| --- | --- | --- |
| A | Product spine | Ensure all assets align to "one assistant, dynamic court, deliverable pack". |
| B | Department capability | Six ministries, Jinyiwei, Hanlin, Qintian, Yushi, Menxia, Shiguan. |
| C | Creative and UX | Court-world visual/interaction ideas, pages, modules, copy. |
| D | Governance/settings | Authority, harness, skills/hooks, production identity, 3050 boundary. |
| E | Data/source adapters | finance data, open-source intelligence, Jinyiwei fetch, RAG/source labels. |
| F | Test/acceptance | golden cases, browser flows, user acceptance, release candidate checks. |

## First High-Value Asset Batch

| Asset | Source | Lane | Initial disposition | Reason |
| --- | --- | --- | --- | --- |
| Department runtime wiring R1 | `task/backend-runtime-wiring-r1` / worktree `backend-runtime-wiring-r1` | B | `REBUILD` | Valuable runtime wiring, but likely stale versus W07/W08 contract spine. |
| Dev EXT test domain switch | `dev-ext-test` | B/C | `CONFLICT_DECISION` | Contains sports/viewing domain and demo switches; product direction is manufacturing/B2B contract first. Need choose reusable capability gate only. |
| Harness-only worktree | `codex/harness-only-worktree` | D | `ABSORB_OR_REBUILD_AFTER_REVIEW` | Currently related to 3050/harness-only operation and Hubu accounting plan; must not overwrite EXT. |
| Jinyiwei real fetch | `task/pkt-a1-jinyiwei-real-fetch`, `origin/task/pkt-a1-jinyiwei-real-fetch` | E | `ABSORB_AFTER_SECURITY_REVIEW` | Real source fetching is high value, but requires source-label and SSRF/security review. |
| Temporal decision intelligence | `docs/temporal-decision-intelligence-design-20260727` | A/B/C | `REBUILD` | Product idea valuable for Chancellor/Qintian; needs current EXT typed read model integration. |
| Deep module projection | `docs/deep-module-projection-design-20260726` | A/B | `REBUILD` | Useful conceptual mapping; must not create a second task/status system. |
| Menxia veto assets | P16 worktrees/branches | D/B | `SUPERSEDED_VERIFY` | Current EXT already has Menxia veto tests and gates; verify no stronger branch remains. |
| Gongbu safety assets | P17/P18 worktrees/branches | B/D | `SUPERSEDED_VERIFY` | Current EXT has Gongbu safety changes; verify no missing fail-closed cases. |
| Guoli/Hanlin remnants | P8/P9 branches/worktrees | B/C | `ABSORB_OR_ARCHIVE` | Hanlin exists in EXT; Guoli may be superseded or out of current product spine. |
| R0 W08 batch branches | `task/r0-w08-*`, `feat/r0-w08-*`, `fix/r0-w08-*` | F | `SUPERSEDED_VERIFY` | Most already landed into current EXT; verify exact coverage and close. |

## Conflict Policy

When assets disagree:

1. Prefer current product spine over historical demos.
2. Prefer typed read model and backend fact source over frontend-only state.
3. Prefer harness evidence over screenshots.
4. Prefer minimal activated department set over "all agents speak".
5. Prefer rebuild over direct copy when architecture has drifted.
6. Archive attractive ideas that lack testable product value.

## Exit Criteria

EXT-A9 is complete when:

- Every ref/worktree/change-record family is grouped into an asset family.
- Every family has a disposition.
- Every `ABSORB` item has either an integrated commit or a blocked reason.
- Every `REBUILD` item has a current-EXT task contract.
- Every `CONFLICT_DECISION` has one selected SSOT.
- W09 remains inactive until W08 closeout is complete.
