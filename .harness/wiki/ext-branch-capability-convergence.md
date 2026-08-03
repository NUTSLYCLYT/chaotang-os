# EXT Branch Capability Convergence

This control plane freezes the 99 local branches that were not ancestors of
`feature-chaotang-ext` at the 2026-08-03 audit baseline. It is read-only and
does not merge, cherry-pick, delete, move, or update any Git ref.

## Facts and ownership

- Manifest: `.harness/manifest/ext-branch-convergence.v1.json`
- Contract: `.harness/contracts/ext-branch-convergence.schema.json`
- Command: `scripts/ext-branch-convergence.mjs`
- Integration target: `feature-chaotang-ext`
- Current implementation authority: `R0-W08`
- Final scope governor: the user
- Readiness and acceptance owner: Codex

The manifest records a frozen source-ref snapshot. New implementation Packet
branches are not silently added to the 99-source denominator. A moved or
deleted frozen source ref makes `--check` fail until an audited successor
record preserves the original tip and explains the transition.

## Dispositions

| Disposition | Meaning |
| --- | --- |
| `ABSORB_ADAPT` | Use selected committed behavior through a scoped current-EXT Packet. |
| `REBUILD` | Preserve the capability but implement it on current EXT architecture. |
| `SUPERSEDED_VERIFY` | Close only after current EXT proves equal-or-stronger behavior. |
| `ARCHIVE` | Preserve provenance; do not import it as product functionality. |
| `REJECT` | Exclude an unsafe, obsolete, or product-conflicting asset. |
| `DUPLICATE` | Point to the frozen canonical donor that contains or duplicates it. |
| `BLOCKED_WIP` | No mergeable committed candidate exists or authority is unavailable. |

## Commands

```bash
node scripts/ext-branch-convergence.mjs --check
node scripts/ext-branch-convergence.mjs --status
node scripts/ext-branch-convergence.mjs --family W08_FULL_CONTRACT_LOOP
node --test scripts/ext-branch-convergence.nodetest.mjs
```

`--check` validates the manifest, verifies each frozen branch still resolves
to its captured tip, proves every candidate commit is reachable from that tip,
and requires each `DUPLICATE` to be either ancestor-contained or patch-equivalent
under `git cherry`. `--status` summarizes dispositions and progress without
consulting or mutating runtime state. `--family` returns one asset family and
its source refs. No mode accepts a write flag.

## Authority boundary

This inventory is evidence and planning infrastructure. A record marked
`ABSORB_ADAPT` or `REBUILD` is not implementation authority. Its exact Packet
must still receive machine-readable GO, RED evidence, independent review, and
exact-H acceptance before local EXT integration.
