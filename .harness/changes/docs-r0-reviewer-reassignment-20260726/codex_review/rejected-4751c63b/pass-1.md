# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c7c-09d3-7d70-890a-9f77201076e3` |
| Candidate | `4751c63b689c3304ea462f468d94aa2ad9a1df62` |
| Tree | `1a2878336d455dd6ffb33acd1318aacb8b455700` |
| Package SHA-256 | `85ae15c7b0eb7370602c08614c40085b39f603f5b3d8ec823712a89b253ac19f` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `0` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Finding

The loader reads live authority state from the working tree while the history
gate assumes `HEAD` is the activation commit. An uncommitted activation can
therefore be accepted after a registration descendant, protected executable
files are not bound to working-tree bytes, and valid post-activation commits
are rejected.

The original reviewer output is retained in the coordinating session record.
