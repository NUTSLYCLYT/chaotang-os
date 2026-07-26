# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Session | `019f9c4f-1fef-74c2-9767-a8a653569bbd` |
| Candidate | `8af162e565345e29ad4fb508e7885dc3578dcaf2` |
| Tree | `6e28644ee7a757fff3c6f87b660346d196b1fde2` |
| Package SHA-256 | `1e88d3a81cedb496b0693bde09901e09159b32b687141bfb61691fb6aeec3ccb` |
| Verdict | `NO_GO` |
| HIGH | `2` |
| MEDIUM | `1` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

## Blocking Findings

1. Writer and rejected session identities were caller-controlled.
2. The fixed EXT baseline was not pinned by the validator.
3. Non-ACTIVE W07 ledger states could re-enable the overlay.

The original reviewer output is retained in the coordinating session record.
