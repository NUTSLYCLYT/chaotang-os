# Protected runtime directory mtime caused a false acceptance failure

## Summary

After the writable database defaults were isolated, every command in the
complete acceptance baseline passed and every protected child entry ended in
the same state. The runner still rejected the baseline because the
`backend/data` directory timestamp had changed after a transient filesystem
entry was removed.

## Root Cause

The protected-runtime snapshot included directory modification timestamps but
only enumerated the immediate children of `backend/data`. A directory timestamp
records directory-entry activity rather than terminal contents, so it can
remain changed after create-and-delete activity leaves no artifact. At the
same time, the shallow metadata snapshot could miss a nested or same-length
file-content change.

## Prevention

The runner now models protected runtime state recursively. Directories
contribute normalized path, presence, and kind but not timestamps. Files
contribute path, size, modification time, and content SHA-256. Reparse points
are recorded without traversal. This accepts a terminally identical directory
while still detecting added, deleted, nested, or same-length changed files.

## Detection

Runner self-tests use an isolated evidence directory to prove that directory
mtime-only and create-delete terminally identical changes are accepted, while
added files, deleted files, and same-length content changes with restored
timestamps are rejected. The external runner test requires the behavior flag,
so retaining only a source-code token cannot pass.

## Evidence

- [`scripts/run_final_acceptance.ps1`](../../scripts/run_final_acceptance.ps1)
- [`scripts/run_final_acceptance.test.ps1`](../../scripts/run_final_acceptance.test.ps1)
- [`docs/failures/2026-08-09-pytest-default-storage-runtime-db-pollution.md`](2026-08-09-pytest-default-storage-runtime-db-pollution.md)
