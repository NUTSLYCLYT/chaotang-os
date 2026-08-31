# P04 Shiguan Outcome Readiness Compatibility Prerequisite Successor Plan

## Objective

以最窄 exact2 forward-only candidate，使 Python 与 Node readiness validators 原子接受 P04 exact12 最终运行时字节对应的唯一第七 ordered pair，并保持所有历史身份、排除项、计数和 fail-closed 语义不变。

## Frozen Boundary

- Base: `a8d631210372924cbe96a348050d20c10a756584 / 04d325513eb8aa69106cc8421c62417d5598f04f`。
- Candidate paths: `backend/tests/test_six_ministry_readiness_report.py`、`scripts/check_harness.mjs`。
- Pair: runtime `sha256:eb0d8d214c2dc51ca4eb37ce5a13423e424fd6fdd3b6b8c3dac6a5f5757bd2df` + successor `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`。
- Fingerprint algorithm: `sha256-path-null-content-null-v1`，使用治理包冻结的路径顺序。
- Existing six pairs remain byte-for-byte and in order; only append one pair.
- P04 exact12 stays untouched as predecessor byte evidence.
- Validator exact2 is pre-materialized only as a byte donor: bundle `sha256:8066b455294e0a2eaa453efb4fcf84c9779144de0e950da1186a13d3e5f9351f`, full-index diff `sha256:4325efe5e148d6b120f194c420be562034e814b41025855ef972bbc34ebac28b`; it has no candidate or inherited verification identity.

## RED To GREEN

1. Baseline P04 donor backend-full proves the closed pair failure and no other failure.
2. Byte-for-byte rematerialize the packet-frozen exact2 donor on the new approval baseline; the donor itself remains non-candidate evidence.
3. The frozen bytes append the seventh pair in both policies and require exact equality/count seven.
4. Prove single-sided, cross-pair, tampered, eighth-pair, fifth-exclusion and Python/Node divergence all fail closed.

## Verification Matrix

- readiness focused and complete backend with process-local POSIX temp.
- packet-owned、Owner 控制执行的闭合命令矩阵：approval lineage、隔离 Git 配置后的 live remote parent、exact2 `M/100644`、old6+new7 精确策略、两侧四 exclusions、两 successor paths、69/65 计数、review identity；Python 受保护绑定唯一且仅允许 pair/负向测试白名单变化；Node 实际 fingerprint、ordered-pair predicate、完整 readiness gate、repository error sink、STATIC_POLICY_GUARDS 注册、validateHarness 传播与 main 调用相对 parent 不变。当前仓库没有 `governance-repair.packet.v1` runner，不把该矩阵描述为 product-authority machine-enforced。
- committed-tree byte verifier 从 `HEAD:<path>` 读取 blob，核对工作树等于 HEAD，并在隔离 Git/attribute 配置、禁用 external diff/textconv 后验证 bundle 与 full-index patch；禁止以 clean-looking 工作树掩盖恶意提交。
- exact Python validator Ruff；第七 runtime digest 篡改必须按末位是否为 `0` 在 `0/1` 间翻转，禁止固定替换为其原末位 `f`。
- Harness, self-test, doctor, doctor tests, hook self-test and authority regression.
- V2 convergence check/tests and `git diff --check`.
- independent Governance and Security reviews; any P0-P2 is NO-GO.

## Stop Conditions

Remote drift, third candidate path, pair reorder/removal, exclusion or file-count change, validation failure, reviewer P0-P2, need for a second authority/fact source, or any deployment request immediately stops this successor.

## Forward Reissue

After exact2 lands, create a new P04 exact12 Product Successor on the latest ext-dev. The old P04 approval, authority and uncommitted bytes do not retain candidate or passing identity; only byte-for-byte donor reuse is allowed, followed by full validation, independent review and machine candidate verification.
