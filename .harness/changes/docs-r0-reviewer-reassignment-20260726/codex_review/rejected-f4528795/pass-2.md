# Codex Independent QA Pass 2: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9d05-782d-78e3-98ca-b76baf67ba94` |
| Candidate | `f452879556a62263afe9b0d3d67137cb7bfe5edb` |
| Tree | `68f81993a81938432aa4666a8f8df8f82db34142` |
| Package SHA-256 | `dcb54b0bb9da0310153e36ba1260c4fea75865db5ac08d228ccc86953fab9536` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `2` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

Blocking findings: activation history did not require candidate first-parent
ancestry; malformed W07 overlays affected historical W06 behavior; the EXT
ref was not rechecked.
