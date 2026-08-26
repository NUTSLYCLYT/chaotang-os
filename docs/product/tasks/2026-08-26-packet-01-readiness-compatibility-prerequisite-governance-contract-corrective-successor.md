# Packet 01 — Readiness Compatibility Prerequisite Governance Contract Corrective Successor

任务 ID：`PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-GOVERNANCE-CONTRACT-CORRECTIVE-SUCCESSOR-20260826`

冻结基线：`67cb1816dafcbf1558a0ff227dc3886fae02795e`

冻结基线 tree：`f672064439355715e5616d61eee9d872297130ce`

> 治理状态：`DRAFT / NON_AUTHORIZING / GOVERNANCE_CONTRACT_CORRECTIVE_ONLY`
>
> 本任务只设计一个 forward-only、单文件治理合同纠正。它不修改旧 approval commit，不 re-anchor
> 旧 authority，不授权双 validator、P01 exact10、candidate、提交、推送、Pilot、Release 或部署。

## Status

Draft

细分状态：`WAITING_FOR_OWNER_CONFIRMATION / OLD_TASK_CONTRACT_FAILURE_STILL_PRESENT`

## Product Definition

干净基线 `67cb1816… / f6720644…` 的完整 Harness 在具备本地子进程权限的环境中稳定只报告五项错误，
全部来自已提交的 lineage successor Task 不满足 `productTaskErrors` 闭合合同。本 successor 只授权未来
候选纠正该单一文档形状，不改变其冻结的 lineage、authority disposition、ordered tuple、产品字节身份或
安全边界。

产品结果定义为：旧 Task 在 forward-only corrective candidate 中满足当前产品任务合同，完整 Harness 不再
出现这五项错误；随后必须基于更新后的最新 `ext-dev` 重新签发 readiness validator successor。旧双 validator
工作区只能提供 byte donor evidence，不能继承 candidate 或通过身份。

## Acceptance Criteria

- [x] 基线精确绑定 `67cb1816… / f6720644…`。
- [x] 唯一确定性根因绑定旧 lineage successor Task 的四个缺失章节与一个非法 Status。
- [x] approvalCommitPaths 精确为本轮三份新治理文件。
- [x] future candidatePaths 精确为一个旧 Task 路径。
- [x] 新 Task 本身包含当前 `productTaskErrors` 要求的八个章节，且 Status 为 `Draft`。
- [ ] future corrective candidate 仅完成冻结的五项结构纠正并通过完整 Harness。
- [ ] corrective candidate 落地后，基于最新 `ext-dev` 重新签发双 validator successor。

## Delivery Constraints

- 当前阶段只允许创建和校验本 Task、packet、Plan。
- 不修改旧 lineage successor Task、双 validator、Harness、authority、First Decree 文件或 P01 exact10。
- 不把治理 Task 从 `validateProductTasks` 中排除，不放宽章节、Status、checkbox 或 Affected Modules 合同。
- 不运行产品测试；完整 Harness 只用于确认本草案没有引入第六项错误。
- 不物化 approval，不 commit、push、merge、rebase、fetch 或 pull。
- 任一远端漂移、第四条草案路径、新增 Harness 错误或独立审查 P0–P2 立即 STOP。

## Affected Modules

- 模块：P01 readiness governance contract corrective successor
- 允许路径：docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.md

这里登记的是 corrective candidate 实际可修改的单一文档路径，不是旧 Task 的历史产品范围。旧 Task 未来
补入的 `Affected Modules` 必须仅记录原两条 validator 路径为 historical/frozen scope。本轮 approval 草案
自身只允许三条新治理路径，见 packet 的 `approvalCommitPaths`。

## Technical Plan

1. 冻结 `67cb1816… / f6720644…`、五项确定性 Harness 错误和旧 Task 单路径冲突范围。
2. 创建只含三份新治理文件的 corrective successor approval package。
3. Owner 后续分别确认摘要、本地 approval commit 与普通 fast-forward push。
4. 在新的 approval commit 上创建唯一单文件 corrective candidate：
   - 将旧 Task 的 `## Status` 首行从 `Ready for Owner confirmation` 改为 `Blocked`；
   - 新增 `Product Definition`、`Affected Modules`、`Technical Plan`、`Acceptance Review`；
   - 在既有 `Implementation Report` 或新增 `Acceptance Review` 中如实记录本次 contradiction。
5. 单文件 candidate 通过 `productTaskErrors`、完整 Harness 与独立 Governance/Security Review 后，分别等待
   Owner 授权 candidate commit 和 push。
6. corrective candidate 落地后，旧双 validator 字节只作为 donor，在新 readiness validator successor 下
   byte-for-byte 重物化并重新执行 RED/GREEN、完整矩阵和双审。

## Trigger And Root Cause

`scripts/check_harness.mjs` 的 `validateProductTasks()` 无条件扫描全部 `docs/product/tasks/*.md`，并调用
`productTaskErrors()`。不存在 governance-only 例外。

在普通沙箱中观察到的 `spawnSync git EPERM` 是环境限制。使用具备所需本地进程权限的干净 `67cb1816…`
工作区精确运行一次完整 Harness 后，EPERM 消失，只剩以下五项确定性错误：

1. 缺少 `## Product Definition`；
2. 缺少 `## Affected Modules`；
3. 缺少 `## Technical Plan`；
4. 缺少 `## Acceptance Review`；
5. `## Status` 首行 `Ready for Owner confirmation` 不属于允许枚举。

因此根因是 `DETERMINISTIC_PRODUCT_TASK_CONTRACT_VIOLATION`，不是 validator 实现、远端漂移或 Harness
策略缺陷。

## Frozen Corrective Candidate Contract

future candidatePaths 精确为：

1. `docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.md`

允许的语义保持型差异精确为：

- `## Status` 首行改为当前允许且与 historical-only/no-reanchor 状态相符的 `Blocked`；
- 新增四个闭合合同章节；
- `Affected Modules` 必须包含非空 `- 模块：`，并把以下原两条 validator 路径记录为
  historical/frozen scope：
  - `backend/tests/test_six_ministry_readiness_report.py`
  - `scripts/check_harness.mjs`
- 上述两条历史路径不扩大当前 corrective candidate 的实际单文件修改范围，也不授予 validator 执行权；
- `Acceptance Review` 明确旧 Task 保持 `Blocked`，不得被任何 `Status === Ready` 的 product-flow 或自动交付
  入口接收，并要求 forward-only validator successor reissue；
- `Implementation Report` 可追加本次失败与纠正事实，但不得删除既有历史。

不得改变：

- task ID、历史 base commit/tree、First Decree authority disposition；
- predecessor、byte-donor、no-reanchor 和无 authority 继承边界；
- ordered tuple、现有三个 pair、四项 exclusions、`69 / 65` 文件计数；
- exact10 bundle、runtime fingerprint、successor fingerprint；
- approvalCommitPaths、原两条 readiness candidatePaths；
- future execution order 的安全语义。

## Predecessor And Donor Disposition

- `67cb1816…` approval commit 及其三份治理文件继续作为历史证据保留，不删除、不重写。
- 原 lineage successor 执行身份标记为：
  `STOP / APPROVAL_BASE_HARNESS_CONTRACT_CONTRADICTION / HISTORICAL_EVIDENCE_ONLY / NO_REANCHOR`。
- `Blocked` 是该停用身份的产品任务合同投影，不授予 validator candidate、产品实施或可恢复 authority。
- 双 validator 保全工作区仍绑定 `67cb1816… / f6720644…`，只含两条未提交修改；其状态为：
  `STOP / BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY`。
- 既有 RED/GREEN 证据可作为 donor provenance，但不得冒充新基线验证或通过结论。

## Future Execution Order

1. 冻结并确认本 corrective successor 三文件摘要。
2. 创建并推送只含三条 approvalCommitPaths 的单亲 approval commit。
3. 创建只改旧 Task 的单文件 corrective candidate，完成结构 RED/GREEN、完整 Harness 与双审。
4. 分别确认并推送 corrective candidate commit。
5. 以 corrective candidate commit/tree 为新 base，签发全新的 readiness validator successor。
6. 从旧工作区 byte-for-byte 重物化两 validator 字节；不得继承旧 candidate identity。
7. 重新执行负向测试、readiness、backend-full、Harness、doctor、authority regression、V2 convergence 和双审。
8. readiness candidate 落地后，再重新签发 P01 Corrective Successor。

## Verification Matrix

当前草案阶段允许：

- strict JSON 与无重复键；
- 新 Task 单文件 `productTaskErrors` 检查；
- RFC 8785 canonical、三文件 raw SHA-256 与 bundle；
- 精确路径、模式、差异和内部一致性检查；
- 完整 Harness：只允许旧 lineage successor Task 的原五项错误。

future corrective candidate 必须运行：

```bash
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node --test scripts/product-authority.test.mjs
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check
```

## Implementation Report

已完成：根因分离、外部权限复验、单路径冲突确认、最窄 correction contract 和 validator 重授权顺序设计。

未完成：Owner 摘要确认、approval commit/push、单文件 corrective candidate、validator successor reissue、
validator 重物化、candidate commit/push、P01 reissue、Pilot 或 Release。

当前结果：`DRAFT / NON_AUTHORIZING`。

## Acceptance Review

Pending Owner confirmation。当前草案不授予 approval、candidate、产品实施或发布身份；必须等待独立
Governance Review 与 Security Review 均无 P0–P2，并由 Owner 精确确认最终摘要。future corrective
candidate 写入旧 Task 的 Acceptance Review 必须保持该旧 Task 为 `Blocked`，禁止 Ready-gated product-flow
接收，并要求基于最新 `ext-dev` 重新签发 readiness validator successor。
