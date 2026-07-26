# Codex Independent QA Pass 2: Rejected Candidate

Session `/root/r0_w07_qa19_pass2_retry` reviewed candidate
`a633b68773dfc5dbca457b03cae32368036867a5`, tree
`0f9f026a5d565a37fa7e1ce4e54149fb949d9c9c`, package
`15a306ad23eedb9f4452084d3b6379d27eee8d8c1960cc41f858402c0aead974`.

Verdict: `NO_GO / HIGH 0 / MEDIUM 1 / writeAccess DENIED /
candidateMutated false`.

Finding: an unsupported Git object identity records a sticky loader error and
therefore cannot return `GO`, but `pinnedCommitH === null` still selects
`readPinnedAuthorityFile` and parses mutable authority facts. That contradicts
the checked task and documentation promise that mutable fallback does not
occur.
