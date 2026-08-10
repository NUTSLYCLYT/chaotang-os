# EXT-A9 W08 Family Coverage Closeout

## Decision

All local `r0-w08` branch-family refs inspected in this Packet are
`SUPERSEDED_BY_EXT_HEAD`.

This does not close R0-W08. It only closes the question of whether the W08
branch family contains remaining code inventory that must be merged into EXT.
Current evidence says no: every listed W08 branch ref is already an ancestor of
`feature-chaotang-ext`.

## Branch Family Coverage

| Family | Refs | Ancestor result | Disposition | Reason |
| --- | ---: | --- | --- | --- |
| W08 activation and owner governance | 5 | all ancestors | `SUPERSEDED_BY_EXT_HEAD` | Activation design, exact-H activation, professional reassignment, readiness dashboard, and task card docs are already in EXT history. |
| Golden contract matrix | 6 | all ancestors | `SUPERSEDED_BY_EXT_HEAD` | Batch 1-6 commits are ancestors and closeout preflight reports 36 golden contracts passing. |
| Browser flow matrix | 4 | all ancestors | `SUPERSEDED_BY_EXT_HEAD` | Batch 1-4 commits are ancestors and closeout preflight reports 10 browser flows passing. |
| Product acceptance harness | 7 | all ancestors | `SUPERSEDED_BY_EXT_HEAD` | Runnable minimum, user acceptance gate, fixture, records discovery, fixture rejection, metadata, timestamp, path, prompt, task-card, and surface gates are present through current EXT history. |
| Financial data audit | 1 | ancestor | `SUPERSEDED_BY_EXT_HEAD` | Audit record is in EXT history; no W08 branch merge remains. |
| Closeout preflight | 1 | ancestor | `SUPERSEDED_BY_EXT_HEAD` | The preflight gate is present and still fail-closes without real records. |

## Explicit Remaining W08 Gap

W08 is automation-ready but not closeout-ready.

Fresh closeout preflight result:

- Golden contracts: `PASS`, `36` cases.
- Browser flows: `PASS`, `10` flows.
- User acceptance: `BLOCKED`, `0` approved records.
- Blocking reason: `records/ must contain exactly one approved user acceptance JSON file`.

Therefore the next W08 work is not branch integration. The next W08 work is
real user acceptance evidence capture under:

`backend/harness/chaotang-true-loop/product_acceptance/user_acceptance/records/`

## Rejected Actions

- Do not merge W08 historical branches.
- Do not cherry-pick W08 branch collections.
- Do not fabricate user acceptance records.
- Do not use fixture records for closeout.
- Do not activate W09.
- Do not push, deploy, migrate database, or operate 3050.

## Next Accepted Work

1. Capture one approved real user acceptance record in the governed records
   directory.
2. Run `run_w08_acceptance.py --closeout-preflight`.
3. If the preflight passes, prepare a separate W08 quiescent closeout candidate.
4. Only after W08 closeout is accepted may W09 activation be considered.
