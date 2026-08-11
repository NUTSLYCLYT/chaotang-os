# Pytest default storage polluted runtime databases

## Summary

The complete backend test suite returned a successful exit code while changing
`backend/data/junjichu_cases.sqlite3` and
`backend/data/report_artifacts.sqlite3`. The final acceptance runner rejected
the run because its protected-runtime snapshot changed, preventing a false
green from entering the formal ten-round series.

## Root Cause

The shared pytest configuration isolated the Shiguan database and the private
DeepSeek dotenv fallback, but it did not isolate the default writable paths
used by Junjichu case lifecycle storage and accounting report artifact
storage. Tests that exercised `execute_decree_now()` could therefore reach the
module-level production defaults through `_StorageCaseLifecycleObserver` and
`build_accounting_report_session()`, even when the individual test's primary
fixture used a temporary database. Accounting artifact helpers also captured
their production paths as Python default arguments at import time, so merely
monkeypatching the module constants could not redirect those calls.

## Prevention

The backend autouse fixture now redirects every runtime reference used by
those two call chains to a per-test `tmp_path/runtime-defaults` directory. A
focused guard test binds the accounting storage module, both API modules, and
the Junjichu storage module to the same isolated paths so later imports cannot
silently reintroduce repository runtime storage. Accounting artifact helpers
now use `None` sentinels and resolve module defaults at call time, making the
autouse isolation effective without changing production callers.

## Detection

Run `backend/tests/test_runtime_storage_isolation.py` to verify the per-test
path bindings. The final acceptance runner also records SHA-256-backed
source evidence plus a recursive protected-runtime terminal-state snapshot
before and after every complete round. Protected files include content SHA-256,
size, and modification time; directory timestamps are excluded because they
can remain changed after a temporary file is safely removed. The focused
pollution check additionally compares both database files by SHA-256.
`node scripts/check_harness.mjs` validates this failure record's required
structure.

## Evidence

- [`backend/tests/conftest.py`](../../backend/tests/conftest.py)
- [`backend/tests/test_runtime_storage_isolation.py`](../../backend/tests/test_runtime_storage_isolation.py)
- [`backend/app/api/decrees.py`](../../backend/app/api/decrees.py)
- [`backend/app/junjichu_cases/storage.py`](../../backend/app/junjichu_cases/storage.py)
- [`backend/app/api/report_artifacts.py`](../../backend/app/api/report_artifacts.py)
- [`scripts/run_final_acceptance.ps1`](../../scripts/run_final_acceptance.ps1)
- [`scripts/final_acceptance_commands.json`](../../scripts/final_acceptance_commands.json)
