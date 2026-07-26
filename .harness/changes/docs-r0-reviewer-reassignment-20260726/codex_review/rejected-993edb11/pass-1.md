# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c6d-d611-7400-b03f-3b2e474543a8` |
| Candidate | `993edb11c084a8b9365a77151dd9a51bcfcdf599` |
| Tree | `6b8b73e9cbcd94f13e53de13626e9db16d7a101d` |
| Package SHA-256 | `32af654ccc7bf9212b974c0219c1acaa6774830821aecb159acfe94e422b44e7` |
| Verdict | `NO_GO` |
| HIGH | `2` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Findings

1. Registration could alter reviewed authority implementation blobs.
2. Overlay registration and W07 activation were not proven as separate commits.

The original reviewer output is retained in the coordinating session record.
