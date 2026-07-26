# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c8a-e2d2-7d13-8a5a-781992a38021` |
| Candidate | `94f6e6f96da22314c542ca8934a279c16f15bb2c` |
| Tree | `4f8dee347217f21471aa0acf0952446094be29d1` |
| Package SHA-256 | `0e5af59ec65335ca822019cdb477d8b4cd12344b5f4ed8dc29582a7eee8b57b1` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Finding

An expired overlay can be replayed by restoring its old active manifest and
overlay bytes in one later commit. The verifier finds the historical activation
but does not prove uninterrupted active history from that event to current
`HEAD`.

The original reviewer output is retained in the coordinating session record.
