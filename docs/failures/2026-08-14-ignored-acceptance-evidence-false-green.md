# Ignored Acceptance Evidence False Green

## Summary

The tracked backend suite depended on formal-round files under the ignored
`.superpowers/` directory. A developer workspace containing those files could
appear green while a clean checkout failed two tests with `FileNotFoundError`.

## Root Cause

Ordinary repository tests treated runtime acceptance evidence as a committed
test fixture even though `.gitignore` intentionally excludes the entire
`.superpowers/` tree. The tests therefore coupled correctness to residue from a
previous local formal run instead of constructing their own inputs or validating
tracked source. No clean-checkout guard asserted that tracked tests were
self-contained.

## Prevention

Keep formal-round output as ignored runtime evidence, but make ordinary tests use
tracked source and test-owned temporary fixtures. Do not weaken the formal runner:
it must still create and validate its own evidence. New tests must not reference
ignored paths as pre-existing input unless their setup creates those paths within
an isolated temporary directory.

## Detection

Run the complete backend suite with ignored formal-round evidence absent and
verify that it passes. Add a focused regression that executes the affected
contract checks using a temporary directory. The final acceptance flow must then
generate its own evidence for ten consecutive rounds; a missing or malformed
round remains a hard failure of that formal flow.

## Evidence

- Failing tests: `backend/tests/test_synthetic_accounting_acceptance_app.py`
- Ignored boundary: `.gitignore`
- Formal runtime runner: `backend/tests/run_accounting_synthetic_acceptance.py`
- Synthetic application: `backend/tests/synthetic_accounting_acceptance_app.py`
- Approved remediation: `docs/superpowers/specs/2026-08-14-main-flow-stabilization-design.md`
