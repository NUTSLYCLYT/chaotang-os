# Change Summary: docs-r0-reviewer-reassignment-20260726

| Field | Value |
| --- | --- |
| Change ID | docs-r0-reviewer-reassignment-20260726 |
| Type | `docs` |
| Status | `QUIESCENT_REGISTRATION_CANDIDATE / OWNER_APPROVED / NOT_AUTHORIZED` |
| Owner | EXT Master Governance |
| Date | `2026-07-26` |
| Local EXT baseline | `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca` |
| Baseline tree | `f692b9090be04722595bbedd8725578f5ed9a745` |

## Objective

Prepare a W07-only reviewer reassignment from `Claude Code` to
`Codex Independent QA` with two fresh read-only review passes.

## Current State

This Packet is non-authorizing. Product Owner approval, both source-candidate
reviews, the exact package, and the W07-only overlay exist on this isolated
governance branch. They are not integrated into local EXT. The effective
reviewer remains `Claude Code`, and W07 remains
`STOP / NO_ACTIVE_WORK_PACKAGE`.

Registration candidates `b781166a`, `7075c126`, `311555d0`, and `37f575bd`
are rejected after independent review. The committed state containing this
block is the quiescent registration candidate pending independent acceptance.

## Historical Timeline

Everything below this heading records the state at the named historical stage.
It is not a second current-state source.

The Product Owner approved the clean Codex/terminal Node startup environment
and OS loader environment as external threat-model-B prerequisites. Malicious
host or pre-start injection is outside the repository authority guarantee.
This direction permitted a twentieth candidate and two fresh read-only Codex
reviews; it was not exact-H approval and did not register or activate W07.

Candidate `a3652c91eaf02f868e8741ed9cf8e1c87db80ec8` was independently
reviewed twice and rejected. Its H/tree/package digest are historical only and
must not be used for approval or registration.

The remediation fails closed unless a W07-only overlay binds:

- one base commit, immutable candidate commit, and exact tree;
- one byte-verified review package;
- two unique, canonical-session `FRESH_NO_FORK_CONTEXT`, read-only Codex QA reviews;
- zero unresolved HIGH or MEDIUM findings;
- one byte-verified Product Owner exact-H approval.

At that stage, the v2 loader was required to validate the overlay and all
evidence before any authority decision; no overlay had yet been registered in
`project-harness.json`.

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

Candidate `ddc2770e66bcdbf769e3a490b938d7b7c7bce456` was rejected by both
fresh reviews. A copied CLI nested inside an unrelated parent Git repository
could omit its own `.git`, fall back to mutable authority files, discover the
parent repository, reach `ELIGIBLE`, and convert that result to `GO`.

The eighteenth remediation must require the exact authority root to own a Git
identity, prevent ancestor discovery, and bind `git --show-toplevel` exactly to
that root before reading any authority facts.

The eighteenth remediation now rejects a missing, symbolic, or unsupported
root `.git` marker, sets `GIT_CEILING_DIRECTORIES` to the exact root for every
authority Git subprocess, and requires the canonical `--show-toplevel` path to
equal the canonical authority root. A real nested-parent fixture observes the
historical replay as RED and verifies `STOP / INVALID_EXECUTION_AUTHORITY`
after remediation.

Candidate `2c3aeaaa8c56d891d61836793fc7d9469984054e` was rejected by both
fresh reviews. One review proved that a successful non-40-hex Git identity
silently disabled committed-blob pinning and fell back to mutable authority
files. The other proved that inherited `PATH` could substitute the unqualified
`git` executable and manufacture every Git trust fact needed for canonical
`GO`.

The nineteenth remediation must reject every unsupported object identity
without mutable fallback and bind all authority Git subprocesses to an
absolute trusted executable. Both historical bypasses require behavioral
regression tests before implementation.

The nineteenth remediation now treats every successful non-40-hex `HEAD` as
an unsupported object identity and records a fail-closed loader error.
Authority Git subprocesses in both the v2 loader and amendment governance
module spawn the absolute Linux trust root `/usr/bin/git`; inherited `PATH`
cannot select a wrapper. Behavioral tests observed both historical bypasses as
RED before implementation and now verify them as GREEN.

Candidate `a633b68773dfc5dbca457b03cae32368036867a5` was rejected by both
fresh reviews. One review found that an absolute Git child remains downstream
of the Node process startup and dynamic-loader environment; code already
injected through that environment executes before repository checks. The other
found that unsupported object identity is sticky-fail-closed but still causes
mutable authority files to be read and parsed.

Mutable fallback removal remains an in-repository remediation. Startup
integrity requires a separate decision: either clean Node startup is an
external threat-model-B prerequisite, or a protected launcher/service becomes
a newly authorized trust root. No twentieth candidate may be frozen by
silently assuming either choice.

The post-rejection remediation now returns `null` for every governed authority
input when no supported pinned commit exists. Manifest, schema, and amendment
governance parsing therefore cannot consume mutable working-tree bytes after a
missing repository identity or unsupported object identity. The focused
regression passes 3/3 and the full authority suites pass 106/106.

Repeated-error prevention:

- causal assumption: recording a sticky loader error was treated as equivalent
  to preventing later authority reads;
- missed signal: the `pinnedCommitH === null` branch still selected the mutable
  file reader;
- preventive instruction: no supported pinned commit means no governed
  authority bytes may be read or parsed;
- future check: missing-root and unsupported-object fixtures must assert null
  manifest/schema/governance in addition to `STOP`;
- durable surface: the loader branch, behavioral tests, this Packet, and the v2
  authority wiki carry the invariant.

This remediation and the approved startup boundary were then eligible for a
twentieth exact-H candidate freeze and two fresh read-only reviews. Candidate
freeze did not approve or register the overlay.

Candidate `ac3a98650608c7d76450f00f939f27a7fb35e33c` was rejected by
both fresh read-only reviews. Both found that four eighteenth/nineteenth
review aliases lack canonical platform identity bindings and are absent from
the exact rejection set. The second review also found that repository-reachable
history cannot detect rollback of `HEAD` and the local EXT ref from a terminal
W07 state to an earlier valid ACTIVE state.

The two twentieth-candidate session identities are permanently rejected.
Remediation requires an explicit decision on terminal-state monotonicity:
either trusted Git ref non-rollback is an external threat-model-B prerequisite,
or a protected external monotonic state anchor is introduced. No successor
candidate may silently choose between those boundaries.

The Product Owner selected controlled Git ref non-rollback as the external
threat-model-B prerequisite. Malicious rollback of `HEAD` or the local EXT ref
is therefore outside the repository guarantee. The four eighteenth/nineteenth
`/root/...` aliases became explicit denylist identities, while all reviews
still required canonical UUID session IDs. This state was eligible for a
twenty-first candidate freeze and two fresh read-only reviews only.

Candidate `b9b99172263885c2381c6c3cea06486f02a9a8f3` received one
`NO_GO / HIGH 1` and one `GO`. It is rejected. The blocking review found that
the final Git identity stability check precedes asynchronous working-tree
verification, leaving an in-attempt movement window before synchronous
eligibility-to-GO mapping. Both twenty-first-candidate session identities are
permanently rejected. W07 remains stopped.

The post-rejection remediation moves Git identity stability verification after
all asynchronous working-tree checks. It is now the loader's final asynchronous
operation; no `await` remains between that recheck and return to the CLI's
synchronous eligibility mapper. The ordering regression observed RED before
the change and is GREEN afterward.

The Product Owner directed the task to continue. This permitted one successor
non-authorizing candidate and two fresh read-only reviews. It is not exact-H
approval, overlay registration, W07 activation, push, deployment, migration,
or listener takeover.

Candidate `5e60073fc6712e8e4f34a9cb8831ceea9b892c6f` was rejected by
both fresh reviews with one HIGH finding each. Separate asynchronous
observations cannot prove atomicity against an uncooperative external writer:
refs can move between samples and governed bytes can change while Git
subprocesses run. Both review identities are permanently rejected.

No further source-order candidate may be frozen. Progress requires an explicit
boundary decision: authorization runs in an isolated worktree with no
concurrent external writers as an external threat-model-B prerequisite, or an
external serialization/immutable-snapshot mechanism must be designed.

The Product Owner selected controlled isolated-worktree execution with no
concurrent external writers during authorization as the external
threat-model-B prerequisite. A process violating that isolation is outside the
repository guarantee. This direction permitted one twenty-third non-authorizing
candidate and two fresh read-only reviews; it does not approve, register, or
activate W07.

Candidate `6c01c810e60a20e955c5fb650e78317365c0d6df`, tree
`3c9dfce871c362e2e9d7e93f12d24db3847f9d8d`, and review package
SHA-256 `9fd0d7f60cc09362da78e3165d4e85283a69a178fd4a5faf6c920bba592a16f9`
received two fresh read-only `GO` reviews with zero HIGH and MEDIUM findings.
Pass 1 evidence SHA-256 is
`6ad0418e9495cd02c1719404d035ae2b11dd309527c76623ebdd0342d8443c29`;
pass 2 is
`e9fea702e0a618afb8ed77b6bafffd36127f5992f990c10b32248502e211c7b7`.

The Product Owner approved the exact candidate, tree, review package, and both
review evidence digests. The owner approval SHA-256 is
`c1388ecbab244a8e5f97e57790679bd10cdff79ba20bf6005f3b7b00f39d37ff`.

The W07-only reviewer reassignment overlay was then staged as a quiescent
atomic registration candidate. Registration did not add an active W07 ledger
entry, did not activate W07, and did not authorize product work. W07 remained
`STOP / NO_ACTIVE_WORK_PACKAGE` until a separately approved activation event.

Registration candidate `b781166aeaee9513e431908b9436043ac008043e`
received one `NO_GO / MEDIUM 1` and one `GO`. It was rejected because historical
status text could be read as the current state. The finding required an
unambiguous statement that the overlay was not integrated into local EXT and
did not activate W07.

Registration candidate `7075c126db558e4367ca4f1a4168071bcb8ebc65`
also received one `NO_GO / MEDIUM 1` and one `GO`. It was rejected because the
document still placed historical stages under `Current State` and retained
historical present-tense wording.

Registration candidate `311555d0f076eba24118777dd4430a56ba4d29c4`
was rejected by both reviews. Historical text still carried one current-state
sentence, and the immutable text review package caused the required ranged
`git diff --check` to fail. The findings required removal of the duplicate
status and the established scoped binary attribute for exact `.diff` evidence.

Registration candidate `37f575bd9635922fb4f37ea0b638085f5eb9745e`
received one `NO_GO / MEDIUM 1` and one `GO`. It was rejected because its
historical remediation record still referred to the then-current successor in
the present tense.

## Boundaries

`NO_W07_ACTIVATION / NO_PRODUCT_CODE / NO_PUSH / NOT_DEPLOYED /
NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER / NO_REAL_CUSTOMER_DATA`
