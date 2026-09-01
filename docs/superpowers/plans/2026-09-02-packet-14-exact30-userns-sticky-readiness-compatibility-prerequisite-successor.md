# P14 Exact30 User-Namespace Sticky Readiness Compatibility Prerequisite Successor Plan

## Objective

以最窄 exact2 forward-only candidate，使 Python 与 Node readiness validators 原子接受最终 shadow exact30 的唯一第十一 ordered pair，同时保持全部历史身份、排除项、计数和 fail-closed 语义不变。

## Frozen Boundary

- Base: `13b9751a35815f873cdc986b8ee7e012089408ee / 5820fdfd917402e5f6bdcca01c1c4f459193644e`。
- Candidate paths: `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- Pair: runtime `sha256:32ecf613778ddc625567b08ec4526efbf22c0cd29a8c94fc3b9bacbe4e0dd05e` + successor `sha256:1922b611550d73daa6226d9dd8abf8d9f9691a0501f9f1fd0ea83e8c772829d2`。
- Existing ten pairs remain byte-for-byte and in order; append exactly one pair, `+1/-0`, total eleven。
- Final shadow exact30: 30 `M/100644`; bundle `sha256:2d72b2e0747ff55e77061440fd7940ea843d12bfb7bfe8f2a3a6aff6fc32bae8`; full-index diff `sha256:7b43ef3e1a095abc6b2c28c2c606d494ff9c28813776972980edeca8652fc78d`；包含 sticky owner 定向安全回归。
- Exact2 byte donor: bundle `sha256:b4c022f2750ecd016e6c5d1358b109d8ee83ebdfcc84821502d978c61714c87c`; full-index diff `sha256:32cf8415288f54f2f35c063717b85bc29175c4c49447658f7659ec2c1b080ba0`。
- Old local product child `3e89495f4e5b5d547e8b07ccb66b94a013417165` is stopped donor-only and must not be verified, pushed or retried。

## RED To GREEN

1. Preserve the two real readiness failures against the final shadow exact30 before validator modification.
2. Add negative tests proving single-sided, cross-pair, unknown, tampered, twelfth-pair, fifth-exclusion and Python/Node divergence fail closed.
3. Append the same eleventh pair in Python and Node, update exact count/self-test, and preserve old ten pairs.
4. Prove readiness and the complete governed matrix are green on unchanged exact2 bytes.

## Verification Matrix

- live remote, direct single-parent approval/candidate lineage, exact two `M/100644` paths and clean worktree.
- controller-provided exact reviewed approval commit anchor; approval itself exact three `A/100644` governance paths.
- old10+new11 ordered pair `+1/-0`; exclusions, counts, historical review identity, successor paths and predicate semantics unchanged.
- readiness focused、exact2 Ruff、backend-full 与全部 Node gates 必须运行 sealed memfd Git bundle 和 sealed user-site archive 解出的同一份已复核字节；外层 private-tmpfs bubblewrap 负责安全解包与 tree/digest 复核，内层 bubblewrap 只读执行、无网络、`env -i`、私有 POSIX `/tmp`，从结构上关闭 hash/check→live-bind TOCTOU。
- root Harness, self-test, Doctor, Doctor tests, hook self-test, product-authority regression with process-local POSIX temp, V2 check/tests and `git diff --check`.
- independent Governance, Python and Security reviews; any P0–P2 is NO-GO.

## Stop Conditions

Remote drift, third candidate path, pair reorder/removal, exclusion or file-count change, validation failure, reviewer P0–P2, need for a second authority/fact source, or any deployment request immediately stops this successor.

## Forward Reissue

After exact2 lands, create a new P14 exact30 Product Successor on the latest ext-dev. The new package must bind the frozen runner digest and the user-namespace sticky-owner correction, rematerialize all exact30 bytes, rerun Gate 00–99 and independent reviews, and obtain fresh machine candidate verification. No old approval, authority, candidate, validation or review identity may be inherited.
