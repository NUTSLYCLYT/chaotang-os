# Codex Independent QA Pass 1: Rejected Candidate

Session `/root/r0_w07_qa_pass1` reviewed candidate
`2c3aeaaa8c56d891d61836793fc7d9469984054e`, tree
`08b94a05313f40963ed8c6c6933deb7890c50c85`, package
`887d780aa885e40796b69b8c0b9dab9bfe4500723b32ca31f8946d9daeb6adc1`.

Verdict: `NO_GO / HIGH 1 / MEDIUM 0 / writeAccess DENIED /
candidateMutated false`.

Finding: a repository using the SHA-256 Git object format returned a 64-hex
`HEAD`. The loader silently converted that unsupported identity to `null`,
fell back to mutable working-tree authority files, and allowed an uncommitted
W06 manifest to produce canonical `GO`.
