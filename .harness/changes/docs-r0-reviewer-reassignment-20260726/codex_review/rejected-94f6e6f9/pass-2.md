# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c8a-e301-7430-a67f-270e119262b2` |
| Candidate | `94f6e6f96da22314c542ca8934a279c16f15bb2c` |
| Tree | `4f8dee347217f21471aa0acf0952446094be29d1` |
| Package SHA-256 | `0e5af59ec65335ca822019cdb477d8b4cd12344b5f4ed8dc29582a7eee8b57b1` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Finding

The v2 evidence validator remains frozen to W06 paths, exclusions, changed
paths, and verification commands. Genuine W07 evidence therefore cannot pass,
and no end-to-end W07 activation path is proven.

The original reviewer output is retained in the coordinating session record.
