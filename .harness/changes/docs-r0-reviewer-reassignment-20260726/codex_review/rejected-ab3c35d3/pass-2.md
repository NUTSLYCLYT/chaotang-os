# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9d3e-5bf0-7f71-b824-2747a3cc0bda` |
| Candidate | `ab3c35d3eee740f7da45ba4a9bfe9a97f3e0c3a5` |
| Tree | `25e5e43380efb9f9da88e24f78a2a7f40f18acc3` |
| Package SHA-256 | `81205d1bc94e3eb86b30261eb7523217ac41b6ff8d7a29214d0dee1b390be1e3` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `2` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

Blocking findings: reachable second-parent authority history was not audited;
the final EXT ref and HEAD checks occurred before later asynchronous reads;
critical merge and TOCTOU claims were asserted through source regex rather
than behavioral fixtures.
