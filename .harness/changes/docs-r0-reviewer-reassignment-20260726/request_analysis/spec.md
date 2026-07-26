# Specification: R0 Reviewer Reassignment

## Required Result

An approved overlay may select `Codex Independent QA` only for R0-W07 after
two unique fresh-session read-only reviews and exact-H Product Owner approval.

## Fail-Closed Rules

- Original amendment bytes and approval evidence remain unchanged.
- Scope must be exactly `R0-W07`.
- Reviewer must differ from owner and writing session.
- Two review sessions are mandatory and unique.
- Both reviews must be GO with no unresolved HIGH/MEDIUM findings.
- Every candidate, tree, path, and digest must match stored bytes.
- Missing, proposed, expired, or malformed overlay has no effect.
