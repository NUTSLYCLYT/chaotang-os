# Codex Independent QA Pass 1: Rejected Candidate b9b99172

| Field | Value |
| --- | --- |
| Session ID | `019f9e63-ae15-7342-b54d-eb1335b88ca1` |
| Isolation | `FRESH_NO_FORK_CONTEXT` |
| Write access | `DENIED` |
| Candidate H | `b9b99172263885c2381c6c3cea06486f02a9a8f3` |
| Tree | `6318660e3e26422a361a6d1b2be926d9b05c7e18` |
| Review base | `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca` |
| Review package SHA-256 | `3c575336b394c24cd57b184a903777bb9c850f1f18117de9ee9f2bcab712c1d0` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |

## Finding

The final Git identity stability check runs before asynchronous working-tree
verification. A forward movement of `HEAD` or the EXT ref after that check can
escape detection while unchanged governed working bytes pass, after which the
CLI can synchronously convert `ELIGIBLE` to `GO`.

Exact H, tree, package bytes/digest, ancestry, and hardened diff equality
passed. The candidate remained quiescent and made no production claim.

```text
VERDICT NO_GO
HIGH 1
MEDIUM 0
session isolation FRESH_NO_FORK_CONTEXT
write access DENIED
```
