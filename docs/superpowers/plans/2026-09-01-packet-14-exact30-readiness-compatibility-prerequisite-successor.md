# P14 Exact30 Readiness Compatibility Prerequisite Successor Plan

## Objective

以最窄 exact2 forward-only candidate，使 Python 与 Node readiness validators 原子接受 P14 exact30 最终运行时字节对应的唯一第十 ordered pair，同时保持所有历史身份、排除项、计数和 fail-closed 语义不变。

## Frozen Boundary

- Base: `c6bcaf524fbd6dd5984337b429e279d1791158c8 / 37a9e25c184b873c87bb65422482e70a32e31071`。
- Candidate paths: `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- Pair: runtime `sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e` + successor `sha256:9d10d2bed258e632c909719f05df50c6b33530d9f40be2458a38dd063fcde3c5`。
- Existing nine pairs remain byte-for-byte and in order; only append one pair, `+1/-0`, total ten。
- Exact2 donor bundle `sha256:fd7dc8d7afdec2c99df166cd2cdcb231a0ea72b9bcc65b090845880fd7a5be2c`; full-index diff `sha256:58b17810b439e5c5f06be297024d96b7974ed6f912c8e75b4d466680186bad3e`。
- Old exact30 authority is abandoned unconsumed. Its bytes stay donor-only, and its CDP/edge promise cleanup P1 must be fixed in the next exact30 successor.

## RED To GREEN

1. Baseline exact30 precheck exposes the closed-pair readiness failure before any product child is created.
2. The exact2 test for the missing tenth pair first fails with one missing expected pair.
3. Append the same tenth pair in Python and Node, update exact count/self-test, and preserve old nine pairs.
4. Prove single-sided, cross-pair, unknown, tampered, eleventh-pair, fifth-exclusion and Python/Node divergence all fail closed.

## Verification Matrix

- readiness focused `16 passed` and complete backend with process-local POSIX temp.
- exact Python validator Ruff.
- root Harness, self-test, Doctor, Doctor tests and hook self-test.
- product-authority regression with process-local `TMPDIR=/tmp`.
- V2 convergence check/tests and `git diff --check`.
- mechanical candidate identity: direct single-parent child, exact two `M/100644` paths, frozen raw/blob/bytes/bundle/full-index diff, old9+new10 `+1/-0`, exclusions/counts/review identity/successor paths unchanged.
- independent Governance, Python and Security reviews; any P0-P2 is NO-GO.

## Stop Conditions

Remote drift, third candidate path, pair reorder/removal, exclusion or file-count change, validation failure, reviewer P0-P2, need for a second authority/fact source, or any deployment request immediately stops this successor.

## Forward Reissue

After exact2 lands, create a new P14 exact30 Product Successor on the latest ext-dev. The new product package must explicitly include the CDP/edge observation promise cleanup P1 and its negative tests. The old P14 approval, machine authority, uncommitted bytes and prior verification do not retain candidate or passing identity; only byte-for-byte donor reuse followed by new RED/GREEN, full validation, independent review and machine candidate verification is permitted.
