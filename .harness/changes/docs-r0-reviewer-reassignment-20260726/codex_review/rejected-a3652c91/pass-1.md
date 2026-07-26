# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c33-5ae7-7b00-9c0c-1b3b3be8452d` |
| Candidate | `a3652c91eaf02f868e8741ed9cf8e1c87db80ec8` |
| Tree | `3a5b928e41e43044a33c190e43565d44ef791b83` |
| Package SHA-256 | `da068313616f240ece9aee8a76c7f4e7c7b03a3f0ceaec68e01d2624a33b918d` |
| Verdict | `NO_GO` |
| HIGH | `3` |
| MEDIUM | `1` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Findings

1. The v2 loader did not enforce amendment registration or overlay evidence files.
2. Evidence roles, paths, digests, H/tree, and package bytes were not cross-bound.
3. Writer/reviewer session separation was not enforceable.
4. Overlay expiry did not consume the W07 ledger state.

The original reviewer output is retained in the coordinating session record.

