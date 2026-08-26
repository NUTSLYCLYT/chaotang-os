# Packet 01 Readiness Compatibility Prerequisite Lineage Successor Plan

状态：`READY_FOR_OWNER_CONFIRMATION / NON_AUTHORIZING`

任务：`PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-LINEAGE-SUCCESSOR-20260826`

基线：`e698fdc7771445f1e6bf2084fa94dc52d9e4064d`

基线 tree：`45aa9e2aeee722c8c9cbd295929dca3a52cc8f12`

## 1. Identity And No-Reanchor Boundary

- 前序 prerequisite 永久保持 `STOP / REMOTE_BASE_DRIFT / BYTE_DONOR_ONLY / NO_REANCHOR`。
- 本计划使用新 Task ID、新 Task/packet/Plan 路径和新 canonical identity，不覆盖或修改前序三文件。
- First Decree Cockpit approval、旧 P01 approval 和本 prerequisite 互不继承 authority。
- 当前只编制治理包；approval materialization、commit/push、validator candidate 和产品实施均需后续独立授权。

## 2. Mechanical Lineage Transition

从前序 base 到新 base 只有一个直接单亲提交：

```text
c939bc4dc5f759d52ca86424c725f8ac2baf2d19
  -> e698fdc7771445f1e6bf2084fa94dc52d9e4064d
```

新提交 tree 为 `45aa9e2aeee722c8c9cbd295929dca3a52cc8f12`，只新增：

1. `.harness/approvals/FIRST-DECREE-COCKPIT-V1-20260826.json`
2. `docs/product/tasks/2026-08-26-first-decree-cockpit-v1.md`
3. `docs/superpowers/plans/2026-08-26-first-decree-cockpit-v1.md`

三条均为 `ADD / 100644`。与前序 prerequisite approval paths、两个 readiness candidate paths、P01 exact10、
65 runtime-content paths 和两 successor-content paths 的交集均为空。

## 3. First Decree Authority Disposition

Owner 已对 `FIRST-DECREE-COCKPIT-V1-20260826` / approval commit `e698fdc7…` 作出明确处置：

`ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`

原因是 `SERIALIZED_P01_PREREQUISITE_PRIORITY`。该 approval 和三份治理文件保留为历史证据，但旧
`APPROVED_FOR_ONE_CHILD` 不得再消费、恢复、继承或 re-anchor，也不产生 candidate 或通过身份。

未来本 P01 successor approval 若获单独授权并推送，会使远端离开 First Decree approval commit；这一
authority 生命周期副作用已由 Owner 明确确认，不是静默消费。本计划本身仍不授权 materialization、commit
或 push。First Decree 若继续，必须基于届时最新 `ext-dev` 重新签发 successor approval。

## 4. Predecessor Evidence Preservation

前序三文件保持在原隔离工作区，只读保留以下 identity：

- Packet canonical：`sha256:d0e08e7ac11b137ff00a12d41e5608c922e056eac5d5a56c71b78ed408c384b1`
- 三文件 bundle：`sha256:3938747e970b096eb1c299c3aacadd75b57f0bc126a4925976b2550b3d2482bb`
- Task raw：`sha256:4aade3ad3c25546aefa6802d1e37e4e2738928c5e86342bab9258152859a67ed`
- Packet raw：`sha256:bf9cbb3c60df414cc8221b30b8e9134c9b8b3363154acf5e7d7d8e0e83af644e`
- Plan raw：`sha256:476d6b724be54c410759dbdf3c8de689185fd3ae039e304488093675f7136e16`
- RED/GREEN evidence：`sha256:be2a644e6b1ff8e6213c81b9f65394b83635d736e74aef2b277d3f24e02af51d`

这些值只能证明前序字节和旧基线审查历史，不能成为本 successor 的 approval identity。

## 5. Frozen Product Input

零重叠证明允许保留同一 shadow byte input：

- exact10 bundle：`sha256:df3bb9e9d099433468191457b9e554dc59980aea45724f2bedb4b628305b400a`
- runtime fingerprint：`sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e`
- successor fingerprint：`sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`
- proposed ordered tuple：

```json
["sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"]
```

该输入仍是不可提交的 shadow identity，不是 P01 candidate 或通过结论。

## 6. Phase A — Successor Governance Freeze

本阶段仅执行：

1. 创建新 Task、packet、Plan 三条治理路径。
2. 绑定 `e698fdc7… / 45aa9e2a…`，记录直接 ancestry、三路径差异和零重叠。
3. 记录 predecessor 为 byte donor only；旧 evidence 不得升级为新 base evidence。
4. 冻结同一 ordered tuple、exact10 bundle、历史边界和 future candidatePaths。
5. 执行 strict JSON、无重复键、先例闭合合同、RFC 8785 canonical、raw SHA、bundle、路径、模式和 tuple
   一致性检查。
6. 只读 Governance Review 与 Security Review 任一出现 P0-P2 立即 STOP。

## 7. Phase B — Future Approval Materialization

必须等待 Owner 精确确认本 successor canonical/raw/bundle digests：

1. 实时 `origin/ext-dev` 必须仍精确为 `e698fdc7…`；漂移即 STOP，不再 re-anchor。
2. approval commit 必须是 `e698fdc7…` 的直接单亲子，只含三条新 approvalCommitPaths。
3. 三文件模式全部 `100644`，提交后工作树 clean。
4. 当前 packet 本身是 governance-repair manifest；不得偷偷加入 `.harness/approvals/` 第四路径。
5. Owner 确认 commit/tree 后才可另行授权普通 fast-forward push。
6. 该 push 终止已放弃的 First Decree one-child approval 是 Owner 已明确接受的生命周期结果，但不得被记录为
   First Decree candidate 消费或产品通过。

## 8. Phase C — Future Readiness Candidate

1. candidate 必须是落地 approval commit 的直接单亲子。
2. changed paths 精确为：
   - `backend/tests/test_six_ministry_readiness_report.py`
   - `scripts/check_harness.mjs`
3. Python 与 Node 原子追加同一 ordered tuple；现有三个 pair 原样、同序保留。
4. pair 集合差必须为 `+1 / -0`，总数精确为 `4`。
5. 新负例必须拒绝单边 fingerprint、旧新混搭、第三状态、第四 pair tamper、第五 pair、第五 exclusion 和
   validator 策略分叉。
6. 同一 candidate SHA/tree 执行完整验证和独立 governance/security review；任一失败或 P0-P2 STOP。
7. candidate commit/push 必须分别等待 Owner 授权。

## 9. Phase D — Reissue P01

1. prerequisite candidate 落地后，旧 `c939bc4d…` P01 authority 永久终止。
2. 以 prerequisite candidate commit/tree 为新 base，创建新的 P01 Corrective Successor approval。
3. readiness validators 不得并入 P01 产品范围；P01 产品范围仍是原 exact10。
4. exact10 从 shadow worktree byte-for-byte 重物化；bundle 必须仍为 `df3bb9e9…400a`。
5. machine GO 后重跑 RED/GREEN、focused、backend-full、Ruff、Harness 和独立 Python/Security Review。

## 10. Future Verification Matrix

```bash
cd backend && python3 -m pytest -q tests/test_six_ministry_readiness_report.py
cd backend && python3 -m pytest -q
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node .agents/hooks/check-harness.mjs --self-test
node --test scripts/product-authority.test.mjs
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check
```

当前治理编制阶段不运行上述产品/治理 candidate 矩阵。

## 11. Concurrency And Stop Conditions

- 其他可能移动 `origin/ext-dev` 的写入者在 successor approval 落地前必须暂停。
- 远端离开 `e698fdc7…` 立即 STOP。
- predecessor、First Decree 文件、exact10、validators、历史报告、exclusions、existing pairs 或 successor paths
  发生变化立即 STOP。
- 需要第四条 approval path、第三条 candidate path、merge、rebase、force-push、fetch/pull 或旧 authority re-anchor
  立即 STOP。
- schema 不存在时不得伪造 schema PASS；任一摘要或独立审查失败立即 STOP。

当前必须 STOP 于 `READY_FOR_OWNER_CONFIRMATION / NON_AUTHORIZING`，等待 Owner 对本 successor 最终摘要的
精确确认。
