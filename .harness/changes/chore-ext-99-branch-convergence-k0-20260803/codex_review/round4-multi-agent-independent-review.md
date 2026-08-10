# Round 4 Multi-Agent Independent Review

Three fresh independent reviewer axes examined the exact Round 3 remediation
candidate. The Git graph reviewer additionally delegated independent spec and
standards axes; their out-of-axis findings were cross-checked by both the code
and governance reviewers before the aggregate verdict was set.

## Reviewed identity

- Base / EXT: `b78a4f8f4ea84d01de5255cbc1c4e566b2f8932f`
- Candidate: `14d5d1d32ad243252cb5357b2b4c4290db671657`
- Candidate tree: `6badff731ab1206d3df0fddfe06dce935d2be7a1`
- Hardened full-index diff SHA256:
  `218a3a9887d65fea57534ca58d80de56d98211d0a5eb52f086201b36131f2474`

## Primary verdicts

| Reviewer | Domain | Initial verdict |
| --- | --- | --- |
| `/root/task1_round4_code_schema` | total validator, schema parity, CLI behavior | `GO` |
| `/root/task1_round4_git_graph` | frozen graph and duplicate relations | graph `GO`; integration precondition `NO_GO` |
| `/root/task1_round4_governance` | amendment, authority, sequencing | `GO` |

The graph review's standards axis identified an unverified snapshot-provenance
condition. Fresh follow-up by both code and governance reviewers classified it
as `Important`, changing the aggregate Round 4 verdict to:

```text
NO_GO / CRITICAL 0 / IMPORTANT 1 / MINOR 1
```

## Blocking finding

The manifest records `snapshot.integrationHead`, `integrationTree`, and the
inventory rule `LOCAL_BRANCH_NOT_ANCESTOR_OF_INTEGRATION_TARGET_AT_CAPTURE`.
The validator checked only hash syntax. `--check` did not prove that:

1. the frozen integration head exists as a commit;
2. the recorded tree exists and equals `integrationHead^{tree}`; and
3. none of the 99 recorded source tips is an ancestor of that frozen head.

The current values were independently confirmed correct, but a different
well-formed 40-character hash could pass without representing the captured
baseline. The correct proof is against the frozen historical Git objects, not
against the current EXT ref, which may legitimately advance after integration.

## Cross-review disposition of other questions

- `canonicalDonor: null`: `Minor` documentation inconsistency, not a current
  data defect. The plan explicitly allows one donor or an explicit no-product-
  donor decision; all current 47 families have exactly one donor. The change
  spec should later use the same wording.
- arbitrary non-empty `authorityPackage`: not a finding. It is a planning
  requirement label, not machine authority; v2 remains the only grant.
- empty `proofCommands`: not a finding. The plan's canonical graph example uses
  an empty list; current records are `PLANNED` or `BLOCKED`, not falsely closed.

## Verified strengths

- The validator is total for arbitrary JSON shapes and prevents semantic joins
  after record-shape errors.
- Focused tests were 16/16 PASS.
- The frozen set remains 99 refs plus only the control branch, with 47 families,
  59 reachable candidate commits, and eight direct duplicate relations.
- Scope Amendment 01, unchanged authority manifests, unchanged EXT, and the
  sole pre-integration STOP were independently confirmed.

## Disposition

Round 4 does not authorize integration. Add read-only Git-object snapshot
provenance verification with injected negative tests, freeze a new exact-H,
and obtain a fresh independent review.
