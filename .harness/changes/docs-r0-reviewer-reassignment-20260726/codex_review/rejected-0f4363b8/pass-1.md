# Codex Independent QA Pass 1: Rejected Candidate

Session `019f9d5d-2fac-76b0-8043-e18374e699b7` reviewed candidate
`0f4363b85e6d969dc7c3eb2ccd4342542d3b4271`, tree
`846948d0da061a42fd14d318958bd9453087e685`, package
`bed060734bc720606955de366d18424011e7d007e91a6500dd494cc8fcda3898`.

Verdict: `NO_GO / HIGH 1 / MEDIUM 0 / writeAccess DENIED /
candidateMutated false`.

Finding: governed working-tree bytes could change during the asynchronous load
after their last byte check, while HEAD and the EXT ref remained stable.
