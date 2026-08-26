# Packet 01 — Readiness Compatibility Prerequisite Lineage Successor

任务 ID：`PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-LINEAGE-SUCCESSOR-20260826`

冻结基线：`e698fdc7771445f1e6bf2084fa94dc52d9e4064d`

冻结基线 tree：`45aa9e2aeee722c8c9cbd295929dca3a52cc8f12`

> 状态：`READY_FOR_OWNER_CONFIRMATION / NON_AUTHORIZING / GOVERNANCE_ONLY`
>
> 本任务是独立的 protected-path lineage successor。它不 re-anchor 前序 prerequisite，不继承旧 P01
> product authority，不授权 validator、产品、测试、提交、推送、Pilot、Release 或部署。

## Status

Ready for Owner confirmation

细分状态：`PREDECESSOR_REMOTE_BASE_DRIFT_STOP / APPROVAL_NOT_FROZEN / CANDIDATE_STOP`

## Lineage Trigger

前序 prerequisite 治理包冻结于 `c939bc4dc5f759d52ca86424c725f8ac2baf2d19` / tree
`a7ce87107ca4763c448183b1a21b467310a72443` 后，`origin/ext-dev` 被独立 First Decree Cockpit M0
治理 approval 推进到 `e698fdc7771445f1e6bf2084fa94dc52d9e4064d`。

该远端提交是冻结基线的直接单亲子：

- commit：`e698fdc7771445f1e6bf2084fa94dc52d9e4064d`；
- parent：`c939bc4dc5f759d52ca86424c725f8ac2baf2d19`；
- tree：`45aa9e2aeee722c8c9cbd295929dca3a52cc8f12`；
- subject：`docs(governance): approve first decree cockpit M0`；
- changed paths 精确为三条新增 `100644` 治理文件：
  1. `.harness/approvals/FIRST-DECREE-COCKPIT-V1-20260826.json`
  2. `docs/product/tasks/2026-08-26-first-decree-cockpit-v1.md`
  3. `docs/superpowers/plans/2026-08-26-first-decree-cockpit-v1.md`

该提交没有修改 prerequisite 三文件、两个 readiness validators、P01 exact10、65 路径 runtime 集合或两条
successor-content paths。它是独立产品线的治理 approval，不是 P01 产品或 readiness candidate。

## First Decree Authority Disposition

Owner 已明确放弃 First Decree Cockpit 当前未消费的 one-child product authority：

- task：`FIRST-DECREE-COCKPIT-V1-20260826`；
- approval commit：`e698fdc7771445f1e6bf2084fa94dc52d9e4064d`；
- disposition：`ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`；
- reason：`SERIALIZED_P01_PREREQUISITE_PRIORITY`。

First Decree approval commit 及其三份治理文件继续作为历史证据保留，不删除、不重写。无论是否存在本地
First Decree 产品字节，该旧 `APPROVED_FOR_ONE_CHILD` 均不得再消费、恢复、继承或 re-anchor，也不产生
candidate、通过或可恢复身份。First Decree 后续若继续，必须基于届时最新 `ext-dev` 创建新的 successor approval。

未来本 successor approval commit 若获单独授权并推送，会使远端离开 `e698fdc7…`，从机器状态上终止旧
First Decree approval。该 authority 生命周期副作用已由 Owner 明确确认，不是静默消费；本轮仍不授权实际
approval materialization、commit 或 push。

## Predecessor Disposition

前序任务 `PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-SUCCESSOR-20260826` 永久标记为：

`STOP / REMOTE_BASE_DRIFT / BYTE_DONOR_ONLY / NO_REANCHOR`

前序三文件只作为字节与审查证据保留：

- Task raw SHA-256：`sha256:4aade3ad3c25546aefa6802d1e37e4e2738928c5e86342bab9258152859a67ed`；
- Packet raw SHA-256：`sha256:bf9cbb3c60df414cc8221b30b8e9134c9b8b3363154acf5e7d7d8e0e83af644e`；
- Plan raw SHA-256：`sha256:476d6b724be54c410759dbdf3c8de689185fd3ae039e304488093675f7136e16`；
- predecessor Packet canonical digest：
  `sha256:d0e08e7ac11b137ff00a12d41e5608c922e056eac5d5a56c71b78ed408c384b1`；
- predecessor 三文件 bundle digest：
  `sha256:3938747e970b096eb1c299c3aacadd75b57f0bc126a4925976b2550b3d2482bb`。

上述摘要不构成本 successor 的 approval identity。前序 RED/GREEN evidence digest
`sha256:be2a644e6b1ff8e6213c81b9f65394b83635d736e74aef2b277d3f24e02af51d` 仍绑定旧
`c939bc4d… / a7ce8710…`，只能作为 predecessor evidence，不能冒充新基线 approval evidence。

## Frozen Product Byte Identity

由于 intervening commit 与全部受保护产品集合零重叠，机械复算确认以下 shadow byte identity 未变：

- exact10 结构：`2 ADD + 8 MODIFY`，全部 `100644`，无第十一条路径；
- exact10 bundle digest：
  `sha256:df3bb9e9d099433468191457b9e554dc59980aea45724f2bedb4b628305b400a`；
- 65 路径 runtime-content fingerprint：
  `sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e`；
- 两条 successor-content paths fingerprint：
  `sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924`；
- 唯一 proposed ordered tuple：

```json
["sha256:da31e8098bf76c72ff8d00b073d86e3442b0811223ef3e3bab770af31e89c28e", "sha256:709ebaf18862a4c2d78422756ca1e353eeb8dd5925c624ee74d9ebdaf43cc924"]
```

该 tuple 只冻结未来 prerequisite candidate 输入，不授予 dirty exact10 candidate、通过或可提交身份。

## Governance Boundary

- approvalCommitPaths 精确为本 Task、packet、Plan 三条新 lineage successor 路径。
- future candidatePaths 精确为：
  1. `backend/tests/test_six_ministry_readiness_report.py`
  2. `scripts/check_harness.mjs`
- 两个 validator 必须在同一 candidate 中原子追加同一个完整 ordered tuple。
- 现有三个 allowed pairs 必须原样、同序保留；candidate 集合差必须为 `+1 / -0`，总数精确为 `4`。
- 禁止 wildcard、目录匹配、单边 fingerprint、笛卡尔积、第五 pair、第五 exclusion 或策略分叉。
- 前序 P01 authority、First Decree Cockpit authority 和本治理包之间没有授权继承关系。
- 已放弃的 First Decree one-child authority 不得被本治理包视为已消费 candidate，也不得在未来恢复。

## Immutable Historical Boundary

以下事实不得修改：

- `docs/migrations/2026-08-14-six-ministry-runtime-readiness.json`；
- historical file count `69`；
- current runtime-content file count `65`；
- historical review status `approved-with-notes`；
- historical reviewed fingerprint
  `sha256:a6c2de2ca7f15069a6d997ce2cccb9498ddd4dd1269d539c192993e85a265190`；
- readiness exclusions 精确四条：
  - `backend/app/accounting_reports/storage.py`
  - `backend/tests/test_six_ministry_accounting_evidence_adapter.py`
  - `backend/tests/test_six_ministry_readiness_report.py`
  - `scripts/check_harness.mjs`
- successor-content paths 精确两条：
  - `backend/app/accounting_reports/storage.py`
  - `backend/tests/test_six_ministry_accounting_evidence_adapter.py`
- 现有三个完整 allowed pairs 及其顺序。

## Future Execution Order

1. Owner 精确确认本 successor 的 canonical/raw/bundle digests。
2. 实时远端仍为 `e698fdc7…` 时，创建只含三条新 approvalCommitPaths 的本地单亲 approval commit。
3. Owner 再次确认 approval commit/tree 后，才可单独授权普通 fast-forward push。
4. 在新 approval commit 上创建唯一 readiness candidate，只修改两个 validators，原子追加 frozen tuple。
5. candidate 完成完整治理矩阵与独立双审后，Owner 才可确认 candidate commit/push。
6. prerequisite candidate 落地后重新签发 P01 Corrective Successor；旧 P01 authority 永久终止。
7. 在新基线 byte-for-byte 重物化 exact10，重新 machine GO、完整验证和独立审查。

## Acceptance Criteria

- [x] successor 基线精确为 `e698fdc7… / 45aa9e2a…`。
- [x] predecessor 明确为 byte donor only，未 re-anchor 或继承 approval identity。
- [x] intervening commit 是直接单亲子且 changed paths 精确为三条 First Decree 治理文件。
- [x] First Decree 未消费 one-child authority 已由 Owner 明确放弃并要求未来重新签发。
- [x] prerequisite、validators、exact10、runtime 与 successor paths 重叠均为零。
- [x] approval paths 精确为三条新文件；candidate paths 精确为两个 validators。
- [x] ordered tuple、历史边界和 fail-closed 语义已冻结。
- [ ] future candidate 机械证明 pair 集合 `+1 / -0`、总数 `4` 且第五 pair 失败关闭。
- [ ] future candidate 在同一 SHA/tree 完成 readiness、backend-full、Harness、doctor、authority regression、
  V2 convergence 和独立 governance/security review。

## Delivery Constraints

- 当前只允许编制和校验本 Task、packet、Plan。
- 不修改 predecessor、P01 exact10、两个 validators、First Decree 文件、Harness、authority 或产品代码。
- 不运行产品测试或 authority，不物化 approval，不 commit、push、merge、rebase、fetch 或 pull。
- 仓内没有 `governance-repair.packet.v1` 正式 JSON Schema；本轮只声明 strict JSON、无重复键、先例闭合
  合同、路径、模式、RFC 8785 canonical 和内部一致性检查。
- 其他可能移动 `origin/ext-dev` 的写入者在 successor approval 落地前必须暂停；再次漂移立即 STOP。

## Risks

- **Repeated head advance**：任何新远端提交使本 successor 失效，不得再次静默 re-anchor。
- **Evidence laundering**：predecessor evidence 不能冒充新 base evidence。
- **Cartesian-product weakening**：runtime 与 successor 必须作为完整 ordered tuple。
- **Authority collision**：First Decree、旧 P01 与本 prerequisite authority 互不继承。
- **Disclosed head effect**：future successor approval 推送将终止 First Decree 旧 approval；该效果已获 Owner
  明确 disposition，但 commit/push 仍需后续独立授权。
- **Validator split-brain**：Python 与 Node 必须同提交、同 tuple、同负测。

## Implementation Report

- 已完成：远端 drift 根因、直接 ancestry、三路径差异、零重叠、byte donor 和 successor 设计。
- 未完成：approval materialization、commit/push、validator candidate、产品验证和新 P01 approval。
- 当前结果：`READY_FOR_OWNER_CONFIRMATION / NON_AUTHORIZING`。
