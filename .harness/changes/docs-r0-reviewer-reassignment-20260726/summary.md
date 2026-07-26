# Change Summary: docs-r0-reviewer-reassignment-20260726

| Field | Value |
| --- | --- |
| Change ID | docs-r0-reviewer-reassignment-20260726 |
| Type | `docs` |
| Status | `SEVENTEENTH_CANDIDATE_PRE_FREEZE / SIXTEEN_CANDIDATES_REJECTED / NOT_AUTHORIZED` |
| Owner | EXT Master Governance |
| Date | `2026-07-26` |
| Local EXT baseline | `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca` |
| Baseline tree | `f692b9090be04722595bbedd8725578f5ed9a745` |

## Objective

Prepare a W07-only reviewer reassignment from `Claude Code` to
`Codex Independent QA` with two fresh read-only review passes.

## Current State

This Packet is non-authorizing. The historical amendment and reviewer remain
effective, and W07 remains `STOP / NO_ACTIVE_WORK_PACKAGE`.

Candidate `a3652c91eaf02f868e8741ed9cf8e1c87db80ec8` was independently
reviewed twice and rejected. Its H/tree/package digest are historical only and
must not be used for approval or registration.

The remediation fails closed unless a W07-only overlay binds:

- one base commit, immutable candidate commit, and exact tree;
- one byte-verified review package;
- two unique, canonical-session `FRESH_NO_FORK_CONTEXT`, read-only Codex QA reviews;
- zero unresolved HIGH or MEDIUM findings;
- one byte-verified Product Owner exact-H approval.

The v2 loader validates the overlay and all evidence before any authority
decision. The overlay has not been registered in `project-harness.json`.

Candidate `524c7f15c83570bd3662f8d6785a0eb033b4c550` was also rejected by
two fresh sessions. Its H/tree/package digest are invalid for approval. The
second remediation binds all four rejected session IDs, exact base commit
identity, writer identity in owner/review evidence, and a no-ext-diff,
no-textconv package command.

Candidate `8af162e565345e29ad4fb508e7885dc3578dcaf2` was rejected. The
fourth remediation pins the EXT baseline, writer receipt, and all six rejected
sessions as implementation constants. The overlay is effective only while the
W07 ledger entry is exactly `ACTIVE`.

Candidate `8bfeaedb6223d21df9f32b6678e643a9581ea2a5` received one GO and
one NO_GO, so it was rejected. The Product Owner approved threat-model option
B; this is a governance boundary decision, not candidate approval. The fifth
candidate disables Git replacement objects and excludes all eight rejected or
superseded review sessions.

Candidate `993edb11c084a8b9365a77151dd9a51bcfcdf599` received one GO and
one NO_GO and was rejected. The sixth remediation requires an activation
commit's parent to contain the exact overlay and evidence in a quiescent state,
and pins executing authority blobs to the reviewed candidate.

Candidate `4751c63b689c3304ea462f468d94aa2ad9a1df62` was rejected by two
fresh sessions. Its history gate incorrectly treated current `HEAD` as the
activation commit and did not bind executable working-tree bytes.

The seventh remediation locates the unique W07 activation transition on the
first-parent history and binds manifest, overlay, evidence, and protected
authority files across the activation commit, current `HEAD`, and current
working tree. It also permits unrelated commits after a valid activation.

Candidate `94f6e6f96da22314c542ca8934a279c16f15bb2c` was rejected by two
fresh sessions. One found expired-overlay replay after an interrupted history;
the other proved that W07 could not satisfy the W06-frozen evidence contract.

The eighth remediation required uninterrupted first-parent activation history,
adds a W07 Codex evidence profile without changing W06 evidence semantics, and
binds W07 source ref, fixed review base, candidate H/tree, and exact hardened
Git diff. An end-to-end temporary repository test proves that a self-consistent
forged package fails while the exact package can authorize only after separate
registration and activation commits.

Candidate `6459279075aabe7cf4cc28d5d14402a110655590` received one GO and
one NO_GO and was rejected as a unit. The blocking finding was that review
package and Git diff bytes were decoded as UTF-8 before equality comparison,
allowing distinct invalid byte sequences to normalize to the same text.

The ninth remediation keeps review-package hashing and exact Git diff
comparison as raw `Buffer` values end to end. Text decoding is limited to
parsing the diff headers used to derive changed paths. A non-UTF-8 regression
fixture exercises registration and activation without weakening W06
compatibility or the real workspace's fail-closed state.

Candidate `50e05e85f791b8e90c2272155637110426a02b0f` received one GO and
one NO_GO and was rejected as a unit. The blocking review found terminal W07
reactivation, incomplete raw-byte treatment for non-package evidence, and a
path check/use race.

The tenth remediation permits a first W07 activation only when its quiescent
parent has no W07 ledger entry. All governed authority files now remain raw
Buffers through digest verification, with text decoding confined to parsing.
Working-tree readers open with `O_NOFOLLOW`, validate the opened descriptor's
real target through `/proc/self/fd`, and fail closed if that binding cannot be
proven.

Candidate `08555c3b25e610909b270861abe25782c1e46aa3` was rejected by both
fresh review passes. The findings covered terminal-state deletion replay,
missing canonical amendment byte verification, mutable HEAD reuse, and
hardlink aliases.

The eleventh remediation scans the complete non-shallow first-parent range
from the reviewed base to the registration parent and rejects any prior W07
ledger state or unreadable manifest. It pins one HEAD commit for all history
and blob reads, then verifies HEAD did not move. The v2 loader hashes the
canonical amendment directly, and governed readers reject multiply linked
inodes.

Candidate `f452879556a62263afe9b0d3d67137cb7bfe5edb` was rejected by both
fresh review passes. Its H/tree/package and review sessions are historical
only and cannot be approved or reused.

The twelfth remediation requires candidate first-parent ancestry and enumerates
every first-parent commit without path simplification. Every post-candidate
historical authority manifest used for registration, activation, or continuity
is parsed and passed through the complete v2 manifest validator.

A missing, malformed, or inactive W07 overlay has no effect on W06: the
historical reviewer and W06 evidence contract remain authoritative. An active
W07 overlay remains fail-closed. The mutable local EXT ref is sampled before
and after exact packet Git verification, and movement prevents GO.

Candidate `ab3c35d3eee740f7da45ba4a9bfe9a97f3e0c3a5` was frozen and
rejected by both fresh review passes. Its H/tree/package and both review
sessions are historical only and cannot be approved or reused.

The thirteenth remediation audits every commit reachable between the reviewed
base, registration parent, activation event, and current HEAD. First-parent
ancestry still defines the integration train, but second-parent commits can no
longer hide prior W07 lifecycle or malformed authority manifests.

The loader samples HEAD and the local EXT ref before active W07 evidence reads,
then checks both again after all asynchronous evidence and activation-history
verification, immediately before returning the authorization input. Real Git
merge and ref-movement fixtures replace the rejected source-regex assertions.

Candidate `53d868516f795050bda26f4e4b32ab7b009c7fdb` was rejected by both
fresh reviews. Its H/tree/package and sessions cannot be approved or reused.

The fourteenth remediation requires the activation event to have exactly one
parent. W07's synchronous result API now fails with
`AUTHORIZATION_BOUNDARY_RECHECK_REQUIRED`; only the asynchronous command API
can consume a loaded W07 authority after rechecking HEAD and the EXT ref with
no intervening await before the decision. CLI authorization uses that API.

The remediation passes 101 authority tests and doctor with zero errors or
warnings. No fourteenth candidate has yet been frozen or reviewed.

Candidate `1a3161dae4c75b9ad5c44dfcb4f522381e6af07f` was rejected twice.
The fifteenth remediation replaces caller-supplied loaded authorization with
an API that performs its own fresh load from its sole repository root.

The API no longer accepts a caller-supplied loaded object. Fresh loading,
final file/ref verification, one-shot W07 eligibility, and synchronous
decision occur in one call. Verification is 101/101 with doctor 0/0.

Candidate `0f4363b85e6d969dc7c3eb2ccd4342542d3b4271` was rejected by both
fresh Codex review passes. One review found that governed working-tree bytes
could change during the asynchronous load. The other additionally proved that
the exported in-memory resolver remained a direct `GO` path outside the
fresh-load boundary. The candidate and both platform sessions are permanently
excluded from approval and reuse.

The sixteenth remediation must make committed Git blobs the authority input,
use the working tree only as a fail-closed consistency check, and remove every
public direct resolver path capable of returning `GO`.

The sixteenth remediation now pins one repository `HEAD` before parsing
authority facts and reads governed inputs from that commit's immutable blobs.
Working files are compared afterward as a fail-closed consistency check but
cannot replace committed facts. The initial pinned commit, authorization
boundary HEAD, and final HEAD must remain identical.

The former public resolver is replaced by a policy evaluator whose positive
result is only `ELIGIBLE`. All direct synchronous command calls fail before
`GO`; only the fresh-load asynchronous command can consume the private
one-shot boundary token and convert eligibility to `GO`.

TDD observed both rejected behaviors before implementation. The remediated
authority suites pass 103/103 and doctor reports zero errors or warnings.

Candidate `6f2b5699da2a3e7d6f807282c5d324bfdd7b3d46` was rejected by both
fresh Codex QA sessions. Both found that the exported asynchronous command
still accepted a caller-controlled repository root and could return `GO`.
One review also found reviewer-reassignment evidence reads outside the pinned
blob reader. The candidate and both sessions are permanently excluded.

The seventeenth remediation must bind the only GO-producing command to the
module's canonical repository root and route every amendment/reviewer evidence
read through the same pinned commit reader.

The seventeenth remediation removes every GO-producing export from the
library. Public loaders, validators, policy evaluation, and synchronous
command evaluation can return `STOP`, structural status, or `ELIGIBLE`, but
never `GO`. Only the executable CLI derives its root from its own module path,
fresh-loads that repository, and converts a verified `ELIGIBLE` result to
`GO`.

The amendment evidence verifier now accepts the v2 loader's pinned reader.
Original amendment approvals, reviewer reassignment package, owner approval,
and both review passes are parsed from the same committed identity and are
also included in final working-tree consistency checks.

## Boundaries

`NO_W07_ACTIVATION / NO_PRODUCT_CODE / NO_PUSH / NOT_DEPLOYED /
NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER / NO_REAL_CUSTOMER_DATA`
