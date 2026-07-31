# Windows Skill front matter false green

## Summary

The repository Chancellor drafting tests passed with LF checkouts but failed on
Windows after Git converted `SKILL.md` to CRLF. Delivery was initially described
as acceptable despite 16 full-suite failures, creating a false-green handoff.

## Root Cause

`load_chancellor_draft_skill()` decoded the file and required byte-derived text to
start with `---\n` and contain `\n---\n`. Git stored the file with LF but checked it
out as CRLF because no repository EOL rule fixed Markdown line endings. The loader
therefore rejected the repository's own valid governed Skill before any graph test
could run. Focused Qintian tests did not exercise this pre-existing cross-platform
boundary, and the full-suite failure was incorrectly treated as outside the
delivery gate.

## Prevention

Text front-matter loaders must normalize CRLF and lone CR to LF after strict UTF-8
decoding and before delimiter parsing. Integrity hashes continue to use the
original bytes. Product delivery is not complete while any required full-suite
command has failures, even when the failing module is outside the feature diff.

## Detection

`backend/tests/test_chancellor_draft_skill_loader.py` contains a deterministic
test that writes an otherwise valid Skill with explicit CRLF bytes and requires
the fail-closed loader to accept it. The repository gate remains the complete
`python -m pytest` command, followed by frontend test/typecheck/lint/build and
`node scripts/check_harness.mjs`.

## Evidence

- `backend/app/agents/chancellor_draft/skill_loader.py`
- `backend/tests/test_chancellor_draft_skill_loader.py`
- `docs/product/tasks/2026-07-30-qintian-decision-radar-full-loop.md`
- ADR 0028 and ADR 0034
