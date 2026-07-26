# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9d3e-2f09-7fb0-81ad-4a0bb0a6ef3d` |
| Candidate | `ab3c35d3eee740f7da45ba4a9bfe9a97f3e0c3a5` |
| Tree | `25e5e43380efb9f9da88e24f78a2a7f40f18acc3` |
| Package SHA-256 | `81205d1bc94e3eb86b30261eb7523217ac41b6ff8d7a29214d0dee1b390be1e3` |
| Verdict | `NO_GO` |
| HIGH | `0` |
| MEDIUM | `1` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

Blocking finding: first-parent-only traversal did not inspect reachable
second-parent commits, and no behavioral merge-history fixture proved that
such history fails closed.
