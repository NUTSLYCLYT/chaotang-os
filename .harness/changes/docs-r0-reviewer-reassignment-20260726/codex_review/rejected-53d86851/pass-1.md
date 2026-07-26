# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9d4b-e4ac-7c92-a38c-492e4619f442` |
| Candidate | `53d868516f795050bda26f4e4b32ab7b009c7fdb` |
| Tree | `244ad5baa291f420b708bcff28635edec1886be3` |
| Package SHA-256 | `c88e64251b8e370a72299515c1b55250b5de6d0ce5cdf39ed34e1316ee974392` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

Blocking finding: a merge activation commit could hide prior W07 authority in
its second parent because pre-activation traversal started from only the first
parent.
