# R0-W06 To R0-W07 Authority Transition Design

## Goal

Close the completed R0-W06 work package into a quiescent authority state, then
prepare a separately reviewed exact-H activation for R0-W07. No R0-W07 product
implementation may begin until the second event is independently reviewed,
owner-approved, and returns `GO / APPROVED_WORK_PACKAGE`.

## Confirmed Baseline

- Local integration target: `feature-chaotang-ext` at
  `bdc5865fd20ffe7c026a571e9c2b14262b6edde2`.
- Remote `origin/feature-chaotang-ext` remains
  `8feae838f09ad5202b21332d4280b989ab776bd7`.
- R0-W06 accepted Packet: `ea4260c2932b24fb5903bd92322a4e398214856d`.
- Local W06 post-integration closeout: `bdc5865f`.
- Current v2 result: W06 `GO / APPROVED_WORK_PACKAGE`; W07
  `STOP / BLOCKED_DEPENDENCY`.
- v1 remains an integrity-only inactive guard.

The transition must not describe the local branch as pushed or the current
workspace as deployed.

## Chosen Architecture

The transition uses the existing `execution-authority.v2` as the only scoped
product execution authority. It consists of two independent governance events.

### Event 1: W06 Quiescent Closeout

The W06 closeout candidate:

- changes the W06 ledger status from `ACTIVE` to `MERGED_AND_VERIFIED`;
- sets `activeWorkPackage` to `null`;
- retains the approved W06 evidence as immutable historical provenance;
- makes both W06 and W07 authorization return
  `STOP / NO_ACTIVE_WORK_PACKAGE`;
- records the accepted W06 Packet, local integration commit, verification
  results, and production exclusions.

This event does not create W07 activation intent, owner approval, review GO, or
product authority.

### Event 2: W07 Exact-H Activation

Only after Event 1 is independently reviewed and accepted, the W07 activation
candidate:

- adds W07 as the sole `ACTIVE` ledger item after W06
  `MERGED_AND_VERIFIED`;
- binds W07 owner approval, activation intent, independent review, candidate
  commit, tree, scope, and review-package digest;
- makes W07 the only package that can return
  `GO / APPROVED_WORK_PACKAGE`;
- keeps W06 and W08 stopped;
- authorizes only W07's existing product contract.

R0-W07 remains the canonical `/shangshufang` one-order, one-card, one-pack
frontend consumer. Immutable Release Identity remains R0-W09 scope.

## Evidence Generalization

The current v2 loader has W06 recovery paths, changed-path inventory,
verification commands, activation-intent path, and exclusions embedded as
constants. Replacing those constants with W07 values would make each
transition destructive to the previous packet.

Event 2 therefore introduces one generic active-packet evidence profile:

- the manifest points to the active packet's owner approval and independent
  review;
- the owner evidence points to its activation intent;
- the activation intent points to the exact review package;
- the independent review must repeat those paths and digests;
- allowed changed paths and required commands are derived from a closed,
  versioned activation profile, not arbitrary review text;
- all paths remain safe repository-relative paths with duplicate-key and
  symlink rejection.

The profile supports the existing W06 evidence and the new W07 evidence. It
does not introduce another authority manifest, resolver, status ledger, or
completion system.

## Candidate Identity

The original amendment's `effectiveBase` remains the historical remote base
already pinned by governance. Because no push is authorized, it is not changed
to a false remote value.

The actual local transition is bound by:

- Event 1 candidate commit and tree;
- Event 2 pre-activation candidate commit and tree;
- exact review-package digest;
- owner approval and independent review digests;
- the local EXT ancestry from `bdc5865f`.

Any candidate or tree drift invalidates activation evidence.

## File Ownership

### Event 1 Allowed Changes

- `.harness/manifest/execution-authority.v2.json`
- a new root W06 closeout change record
- authority v2 tests that assert the real repository is quiescent
- this design and the implementation plan

### Event 2 Allowed Changes

- `.harness/manifest/execution-authority.v2.json`
- `.harness/contracts/execution-authority-v2.schema.json` only if the generic
  profile needs a closed schema field
- `scripts/lib/execution-authority-v2.mjs`
- `scripts/execution-authority-v2.mjs`
- `scripts/execution-authority-v2.nodetest.mjs`
- `.harness/wiki/execution-authority-v2.md`
- a new root W07 activation change record and machine-readable evidence

### Forbidden Changes

- frontend product implementation;
- backend product implementation;
- W08 or W09 activation;
- deployment or production claims;
- database migration;
- listener start, stop, or takeover;
- push or remote branch mutation;
- copying the dirty Immutable Release Identity workspace.

## Verification

Event 1 must prove:

- v1 integrity check passes;
- v2 structural check passes;
- W06 and W07 both return `STOP / NO_ACTIVE_WORK_PACKAGE`;
- exactly zero ledger entries are `ACTIVE`;
- W06 is `MERGED_AND_VERIFIED`;
- both harness doctors pass;
- the candidate is a clean descendant of local EXT `bdc5865f`.

Event 2 must prove:

- v1 integrity check passes;
- v2 structural check passes;
- W07 alone returns `GO / APPROVED_WORK_PACKAGE`;
- W06 returns `STOP / WORK_PACKAGE_MISMATCH`;
- W08 returns `STOP / BLOCKED_DEPENDENCY`;
- exactly one ledger entry is `ACTIVE`;
- evidence paths, bytes, hashes, candidate H, tree, scope, changed paths, and
  commands all match;
- negative fixtures reject missing, reused, self-reviewed, forged, partial,
  extra, or drifted evidence;
- both harness doctors and `git diff --check` pass.

Each event requires an independent read-only review. Event 2 additionally
requires final owner approval bound to its exact candidate before its manifest
can become authoritative.

## Rollback

Before integration, rollback is the revert of the isolated event commits.
After local integration, rollback requires a separately approved forward
governance event:

- W07 activation rollback sets W07 to `ROLLED_BACK` or restores quiescence,
  depending on whether product work began;
- W06 evidence remains historical and is not rewritten;
- no production database, stored artifact, process, listener, or remote branch
  rollback is implied.

## Completion Boundary

This design is complete when:

1. Event 1 is locally integrated and independently verified as quiescent.
2. Event 2 exact-H activation evidence is independently GO and owner-approved.
3. The local EXT authority returns GO only for W07.

That completion authorizes W07 implementation planning. It does not complete
W07, deploy the application, or authorize W08/W09.
