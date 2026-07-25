# EXT Asset Convergence Ledger

| Field | Value |
| --- | --- |
| Change ID | docs-ext-asset-convergence-ledger-20260725 |
| Type | docs |
| Owner | Window 0 Governance |
| Created | 2026-07-25 |
| Execution authorization | `NOT_GRANTED_BY_CHANGE_RECORD` |

## Status

`QA_REVIEWED / CODEX_ACCEPTANCE_PENDING`

This change freezes selected Asset Pool identities for later packetization. It
does not integrate any asset, authorize a product change, delete a source, or
prove deployment.

## Baseline

- Local accepted EXT integration baseline:
  `feature-chaotang-ext@c0a2c7ec2ac38ba522db3f9945bec722bd47c886`
- Baseline tree:
  `b0cc93c7471fdfb70b6de22cbbb232ef5ae39ec9`
- Remote target remains:
  `origin/feature-chaotang-ext@8feae838f09ad5202b21332d4280b989ab776bd7`
- Runtime claim: `NOT_DEPLOYED`
- Database migration claim: not performed
- Listener takeover claim: not performed
- Push claim: not performed

## Decision

EXT remains the only integration target. Every branch, worktree, commit, and
uncommitted change listed in `asset-ledger.md` remains an Asset Pool source.
Source existence is not acceptance. A retained capability must be rebuilt or
extracted into its named isolated Packet, tested, independently reviewed, and
accepted before hunk-level integration.

One file has one active writer at a time. `ShangshufangPage.tsx` and
`prod-doctor.mjs` are specially protected and may be integrated only by
reviewed hunks under their assigned Packet owner.

## Snapshot

The read-only census was refreshed at `2026-07-25T05:34:43Z`
(`2026-07-25T13:34:43+08:00`):

| Measure | Observed |
| --- | ---: |
| Registered worktrees | 68 |
| Prunable worktree registrations | 1 |
| Refs not ancestors of remote EXT | 81 |
| Main worktree tracked changes | 101 |
| Main worktree untracked files | 135 |
| Main worktree status entries | 236 |

These counts replace earlier 62-worktree/75-ref observations. They are a
point-in-time census, not a cleanup authorization.

## Retained Capability Targets

| Asset group | Disposition | Target Packet | Owner |
| --- | --- | --- | --- |
| Main runtime and release identity | KEEP | `EXT-I2` | Window 4 Release Identity |
| Main UI runtime incident | KEEP | `EXT-I1` | Window 5 Product Closure |
| Main human confirmation and reports | REBUILD | `EXT-P2` | Window 5 Product Closure |
| Task8 exact memorial binding | KEEP | `EXT-P1` | Window 5 Product Closure |
| Browser route repair | REBUILD | `EXT-P2` | Window 5 Product Closure |
| P26 schema authority | KEEP | `EXT-W06R` | Window 2 W06 Backend |
| Anti-hallucination evidence gate | REBUILD | `EXT-P1` | Window 5 Product Closure |
| Court writer AST scanner | REBUILD | `EXT-Q1` | Window 5 Product Closure |
| Old P6, superseded W06/P16-P19, generated evidence | ARCHIVE | `GOVERNANCE_ARCHIVE` | Window 0 Governance |

Window 6 owns no implementation asset. It provides the later independent
read-only `EXT-Q1` QA gate for Browser Route Repair and Court Writer AST
Scanner.

## QA Review

QA returned `NO-GO` on `25b0b807`. The implementer has remediated all four
reported items:

1. Browser Route Repair now has one owner and one target Packet.
2. Court Writer AST Scanner implementation ownership moved out of Window 6.
3. K2, R1, and R3 now state group-level source status and retained-untracked
   counts.
4. The one-file/one-writer rule and protected hunk-level files are explicit.

Window 6 independently reviewed candidate
`4214c0f5f6a173dd732a8ad3d72b69521c59b162` and returned `QA GO` with zero
blocking findings. All four findings above are closed.

Codex acceptance remains pending. This review does not integrate the Packet.

## Residual Risk

Asset Pool sources can drift after this snapshot. Before a target Packet
receives any asset, it must recompute the recorded identity and hashes or
record the exact byte differences and obtain review of those differences.

## Preservation Hold

No listed ref, worktree, dirty patch, untracked retained file, screenshot,
output directory, or archive may be deleted until its replacement Packet is
accepted and the governance owner records a separate retirement decision.
