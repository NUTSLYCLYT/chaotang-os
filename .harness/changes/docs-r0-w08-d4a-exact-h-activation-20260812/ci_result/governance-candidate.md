# Governance candidate verification

## TDD baseline

`node --test scripts/reviewer-successor-w08-d4a.nodetest.mjs` initially failed with `ERR_MODULE_NOT_FOUND`, proving the new continuation module did not exist.

## Focused verification

- Node syntax checks: PASS.
- `node --test scripts/reviewer-successor-w08-d4a.nodetest.mjs`: PASS, 7 tests, including exact 7/11/9 paths, a real final-M loader `errors=[]` fixture with committed cross-bound evidence, and a damaged-chain STOP fixture.
- `node --test scripts/reviewer-successor-w08-d4a.nodetest.mjs scripts/reviewer-successor-w08.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs`: PASS, 50 tests.
- Focused execution-authority dispatch test: PASS, 1 test.
- Four changed runtime modules passed `node --check`; `git diff --check` passed.
- `node --test scripts/execution-authority-v2.nodetest.mjs`: PASS, 79 tests, including legacy profiles, D4A-aware dispatch, identity-split rejection, and real-repository pre-integration behavior.

No manifest or activation evidence is included in G.
