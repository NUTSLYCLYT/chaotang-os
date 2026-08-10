# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c43-e603-76c3-b30b-d78789057441` |
| Candidate | `524c7f15c83570bd3662f8d6785a0eb033b4c550` |
| Tree | `f052e129373980203fc9ccb870e49cd56fb78635` |
| Package SHA-256 | `37515799c7f84e57df2a39d7fda3fd7ce0292c753397f49e70b9e69ad15e6d88` |
| Verdict | `NO_GO` |
| HIGH | `3` |
| MEDIUM | `1` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Findings

1. `baseH` could be a peelable tag object rather than the exact base commit.
2. Owner evidence did not bind `writingSessionId`.
3. Git diff verification allowed external diff and text conversion.
4. The exact ranged `git diff --check` contradicted the CI claim.

The original reviewer output is retained in the coordinating session record.
