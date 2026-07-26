# Codex Independent QA Pass 1: Rejected Candidate

| Field | Value |
| --- | --- |
| Canonical platform session | `019f9d05-77f5-79a3-8d0c-4a0e036ce563` |
| Candidate | `f452879556a62263afe9b0d3d67137cb7bfe5edb` |
| Tree | `68f81993a81938432aa4666a8f8df8f82db34142` |
| Package SHA-256 | `dcb54b0bb9da0310153e36ba1260c4fea75865db5ac08d228ccc86953fab9536` |
| Verdict | `NO_GO` |
| HIGH | `1` |
| MEDIUM | `2` |
| Write access | `DENIED` |
| Candidate mutated | `NO` |

Blocking findings: path-simplified history could omit a merge-introduced W07
state; historical manifests were parsed but not fully validated; the EXT ref
was not rechecked.
