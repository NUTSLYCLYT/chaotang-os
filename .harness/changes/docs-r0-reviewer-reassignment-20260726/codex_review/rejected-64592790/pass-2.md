# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9cd7-fbed-7e73-9774-80c8c23569ac` |
| Candidate | `6459279075aabe7cf4cc28d5d14402a110655590` |
| Tree | `ed5edf0227379ce29f52aa1842ae22f79f81f00f` |
| Package SHA-256 | `b6a1efb66a11bdf5ed3d6d58f5743aac24df785ef59535165dc10a345e21d05e` |
| Verdict | `NO_GO` |
| HIGH | `0` |
| MEDIUM | `1` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Finding

Review packages and Git diffs were decoded as UTF-8 before comparison.
Different invalid UTF-8 byte sequences can normalize to the same replacement
characters, violating the exact-byte contract.

The original reviewer output is retained in the coordinating session record.
