# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9d4c-1bff-71c3-8967-d8f6550f1b33` |
| Candidate | `53d868516f795050bda26f4e4b32ab7b009c7fdb` |
| Tree | `244ad5baa291f420b708bcff28635edec1886be3` |
| Package SHA-256 | `c88e64251b8e370a72299515c1b55250b5de6d0ce5cdf39ed34e1316ee974392` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

Blocking finding: the synchronous authorization API could consume a loaded
result after HEAD or the EXT ref moved, without a new Git identity check.
