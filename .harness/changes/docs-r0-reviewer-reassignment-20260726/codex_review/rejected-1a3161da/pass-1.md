# Codex Independent QA Pass 1: Rejected Candidate

Session `019f9d56-e07e-7d10-b75c-7e07bbf5c2eb` reviewed candidate
`1a3161dae4c75b9ad5c44dfcb4f522381e6af07f`, tree
`b49bc03629e8ca91b8742155b1a3080662a827bf`, package
`03fdeb699e3d11145685f28e4d4482ea852cfc467bbef082b0b6e93cf4f17098`.

Verdict: `NO_GO / HIGH 1 / MEDIUM 0 / writeAccess DENIED /
candidateMutated false`.

Finding: the async API accepted an unbound `root` and stale `loaded` object.
