# R0 Reviewer Reassignment Design

## Review Remediation Addendum

Candidate `a3652c91` was rejected by two independent Codex QA passes. The
replacement candidate must additionally enforce:

- v2 loader validation of the amendment registration and all overlay evidence;
- canonical, distinct role paths and distinct evidence digests;
- machine-readable owner/review evidence cross-bound to base H, candidate H,
  tree, package path/digest, session identity, verdict, and finding counts;
- Git verification that base H is an ancestor, candidate H/tree resolve, and
  package bytes equal `git diff --binary <baseH>..<candidateH>`;
- writer session exclusion and canonical unique review session IDs;
- ledger-driven expiry once R0-W07 reaches `MERGED_AND_VERIFIED`;
- no root-level `.gitattributes`.

After candidate `524c7f15` was rejected, the contract additionally requires
all rejected review session IDs to be bound and excluded, `baseH` to resolve
to the exact commit object, writer identity to appear in owner/review evidence,
and Git diff execution to use `--no-ext-diff --no-textconv`.

After candidate `8af162e5` was rejected, the narrow amendment implementation
pins the fixed EXT baseline, writer receipt, and all six rejected sessions.
The generic validator does not self-pin its own candidate H because a Git
commit cannot contain its own hash. Candidate H/tree/package are instead bound
by both independent reviews and Product Owner evidence, then registered in a
separate atomic event. The overlay is effective only for an `ACTIVE` W07 ledger
entry; merged, rolled-back, missing, or any future state falls back to the
historical reviewer.

## Approved Trust Boundary

The Product Owner approved option B. Codex platform session notifications and
coordinating-session Product Owner approval are external trust roots. The
repository prevents accidental or unauthorized state/evidence drift, but does
not claim to authenticate those identities against a malicious full repository
writer. Git verification disables replacement objects, external diff, and text
conversion and clears inherited `GIT_*` overrides.

The Product Owner also approved a clean Codex/terminal Node startup environment
and the host OS loader environment as external threat-model-B prerequisites.
Repository authority begins after trusted process startup and does not claim to
resist malicious host, loader, `NODE_OPTIONS`, or equivalent pre-start
injection. Inside that boundary, unsupported Git identities, missing pinned
commits, mutable authority fallback, governed-byte drift, and evidence drift
must still fail closed.

The Product Owner further approved controlled `HEAD` and local
`feature-chaotang-ext` ref non-rollback as external threat-model-B
prerequisites. Malicious rollback of those refs is a host/repository control
plane failure outside the repository authority guarantee. The implementation
still detects movement during an authorization attempt and validates all
history reachable from the trusted current ref. Four historical `/root/...`
review aliases are explicit denylist entries; current review evidence continues
to require canonical platform UUIDs.

The Product Owner also approved controlled isolated-worktree execution as an
external threat-model-B prerequisite. No concurrent external writer may mutate
governed files, `HEAD`, or the local EXT ref from authorization start through
result return. A malicious or uncooperative process violating isolation is a
host/workspace-control failure outside the repository guarantee. This boundary
does not replace immutable commit/blob checks, evidence binding, observed-drift
checks, or the two-event registration/activation contract.

## Two-Event Enforcement

When W07 is `ACTIVE`, the v2 loader proves that the activation commit's parent:

- already contains the exact reviewer overlay;
- contains every bound evidence artifact at its approved digest;
- has `activeWorkPackage=null` and no `ACTIVE` ledger entry.

It also requires the executing authority implementation blobs to equal those
in the reviewed candidate H. Registration and activation therefore cannot be
combined, and registration cannot silently replace reviewed authority logic.

## Goal

Replace the unavailable Claude Code reviewer for R0-W07 with a scoped,
auditable `Codex Independent QA` reviewer without rewriting the original
trusted-kernel amendment or letting the Codex writer self-review.

## Decision

Use a reviewer-reassignment overlay under the existing
`amendmentGovernance`. The original amendment, source digest, approval
evidence, execution owner, and historical Claude Code reviews remain
unchanged.

The overlay changes only the effective independent reviewer for `R0-W07`.
Execution-authority v2 remains the sole product execution decision.

## Independence Contract

Each Codex QA pass must:

- start as a fresh session without forked conversation context;
- be read-only and make no file changes;
- review an immutable candidate H, tree, and review-package digest;
- have a unique recorded session identifier;
- report findings before verdicts;
- be different from the Product Owner and the writing session;
- return GO with zero unresolved HIGH or MEDIUM findings.

Two independent Codex QA passes are required. The writing Codex may record
their immutable outputs but may not change their verdicts.

## Overlay Contract

```text
schemaVersion = reviewer-reassignment.v1
status = APPROVED
scope = [R0-W07]
from = Claude Code
to = Codex Independent QA
reviewPassesRequired = 2
sessionIsolation = FRESH_NO_FORK_CONTEXT
writeAccess = DENIED
candidateMutation = FORBIDDEN
```

The overlay binds:

- its own exact candidate H and tree;
- a deterministic review package and digest;
- Product Owner exact-H approval;
- two unique independent review records and digests;
- explicit expiration after R0-W07 is `MERGED_AND_VERIFIED`.

Unknown fields, missing evidence, reused session identifiers, non-GO review,
scope expansion, or digest drift fail closed.

## Bootstrap

The reassignment cannot rely on itself before approval. Bootstrap order:

1. Prepare a non-authorizing candidate and deterministic review package.
2. Run two fresh read-only Codex QA reviews under the Owner-directed migration
   request.
3. Request Product Owner exact-H approval after both reviews.
4. Atomically register the approved overlay.
5. Independently verify the overlay and integrate it into local EXT only after
   separate approval.

Until step 4, `Claude Code` remains the effective reviewer and W07 remains
stopped.

## Boundaries

- Governance only; no frontend/backend product code.
- No W07 activation in this Packet.
- No push, deployment, database migration, listener operation, real customer
  data, or production claim.
- The blocked W07 candidate and all of its digests are invalid after the
  overlay is integrated; W07 must be rebuilt from the new EXT exact-H.

## Rollback

Before integration, revert this isolated Packet. After integration, rollback
is a separately approved forward governance event that removes or expires the
overlay; it does not rewrite historical reviews.
