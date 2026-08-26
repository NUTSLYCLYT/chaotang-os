# P01 Readiness Compatibility Prerequisite Governance Contract Corrective Successor Plan

任务：`PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-GOVERNANCE-CONTRACT-CORRECTIVE-SUCCESSOR-20260826`

基线：`67cb1816dafcbf1558a0ff227dc3886fae02795e`

基线 tree：`f672064439355715e5616d61eee9d872297130ce`

状态：`DRAFT / NON_AUTHORIZING`

## 1. Objective

以 forward-only successor 修复一个确定性治理合同错误：已提交的 P01 readiness lineage successor Task 位于
`docs/product/tasks/`，但未满足当前 `productTaskErrors` 的完整章节与 Status 合同。修复必须保持旧 approval
历史、readiness tuple、validator byte donor 和 P01 exact10 身份边界，不允许修改或放宽 Harness。

## 2. Frozen Facts

- 实时诊断基线为 `67cb1816… / f6720644…`。
- 普通沙箱的 `spawnSync git EPERM` 是环境限制。
- 外部本地进程权限下的干净基线完整 Harness 只报告五项旧 Task 合同错误。
- `validateProductTasks()` 无条件扫描全部 `docs/product/tasks/*.md`，没有治理 Task 豁免。
- 旧双 validator 工作区只有两条未提交修改，状态为 byte donor only。
- 当前 corrective drafting 不授予旧 Task 修改、validator、authority、candidate、commit 或 push。

## 3. Approval Draft Scope

本轮只创建：

1. `docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-governance-contract-corrective-successor.md`
2. `docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-governance-contract-corrective-successor.packet.json`
3. `docs/superpowers/plans/2026-08-26-packet-01-readiness-compatibility-prerequisite-governance-contract-corrective-successor.md`

三文件以外任何差异立即 STOP。

## 4. Future Candidate Scope

future candidatePaths 精确为：

`docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-lineage-successor.md`

候选只完成：

1. `## Status` 首行 `Ready for Owner confirmation` → `Blocked`；
2. 添加 `Product Definition`；
3. 添加 `Affected Modules`，包含非空 `- 模块：`，并将原两条 validator 路径记录为
   historical/frozen scope：
   - `backend/tests/test_six_ministry_readiness_report.py`
   - `scripts/check_harness.mjs`
4. 添加 `Technical Plan`；
5. 添加 `Acceptance Review`，明确旧 Task 为 `Blocked`，不得进入任何 `Status === Ready` 的 product-flow
   或自动交付入口，并要求 forward-only validator successor reissue；
6. 在既有 `Implementation Report` 或新 `Acceptance Review` 中如实记录 contradiction 和 reissue 要求。

上述两条 validator 路径只表示旧 Task 原历史产品范围，不扩大当前 corrective candidate 的单文件修改范围，
也不授予 validator 执行权。corrective candidatePaths 仍精确为旧 Task 一条路径；后续新 readiness successor
必须重新冻结两条 validator candidatePaths。不得删除或重解释旧 Task 的任何冻结历史、安全边界或产品身份。

## 5. Phase A — Draft And Freeze Governance Package

1. 只读确认远端与本地 base commit/tree。
2. 创建干净 detached 治理工作区。
3. 起草精确三文件，新 Task 自身使用 `## Status` 首行 `Draft` 并满足八章节合同。
4. 执行 strict JSON、无重复键、单文件 `productTaskErrors`、路径、模式与差异检查。
5. 运行完整 Harness；只允许旧 Task 原五项失败，不允许第六项。
6. 计算 Packet RFC 8785 canonical digest、三文件 raw SHA-256 和 bundle digest。
7. 独立 Governance Review 与 Security Review 任一 P0–P2 立即 STOP。
8. 返回 Owner 精确摘要；不得 commit 或 push。

## 6. Phase B — Future Approval Commit And Push

必须等待 Owner 分别授权：

1. 基于实时最新且仍精确的 `67cb1816…` 创建三文件单亲 approval commit；
2. 只读复核 parent/tree/paths/modes/digests；
3. 再执行一次普通 fast-forward push；
4. 禁止 force-push、merge、rebase、fetch、pull 或旧 approval re-anchor。

如果远端漂移，本包立即转为 byte donor only，必须重新签发 lineage successor。

## 7. Phase C — Future One-Path Corrective Candidate

1. 从落地的 corrective approval commit 创建唯一、干净、隔离 candidate 工作区。
2. 只修改旧 lineage successor Task 一条路径。
3. 先物化合同负向检查，证明原五项稳定失败。
4. 只执行冻结的 Status 与四章节补齐，形成 GREEN。
5. 验证 Task ID、lineage、First Decree disposition、tuple、paths、exclusions、fingerprints 和未来顺序未变。
6. 运行完整 Harness、self-test、doctor、authority regression、V2 convergence 与 `git diff --check`。
7. 独立 Governance/Security Review 任一 P0–P2 立即 STOP。
8. candidate commit 与 push 分别等待 Owner 授权。

`Blocked` 是旧 Task 的 historical-only/no-reanchor 合同投影，不授予 candidate、产品实施或可恢复
authority；任何 Ready-gated product-flow 都必须拒绝该旧 Task。

## 8. Phase D — Readiness Validator Reissue

corrective candidate 落地后：

1. 旧 `67cb1816…` 双 validator 工作区保持 byte donor only；
2. 以最新 ext-dev commit/tree 创建新的 readiness validator successor；
3. 新 successor 精确绑定两条 validator candidatePaths 和 donor 两文件身份；
4. 在新 approval commit 上 byte-for-byte 重物化两文件；
5. 重新证明 RED/GREEN，不继承旧验证结论；
6. 重新运行 readiness、backend-full、Harness、doctor、authority regression、V2 convergence 和双审；
7. candidate commit/push 分别等待 Owner 授权；
8. readiness candidate 落地后再重新签发 P01 Corrective Successor。

## 9. Verification Matrix

草案阶段：

```bash
# strict JSON + duplicate-key rejection
# new Task productTaskErrors check
node scripts/check_harness.mjs
git diff --check
```

草案完整 Harness 的唯一允许失败拓扑为旧 lineage successor Task 的四个缺失章节和一个非法 Status。

future corrective candidate：

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

## 10. Review Questions

Governance Review：

- 是否保持 forward-only，且没有重写或 re-anchor `67cb1816…` approval？
- candidatePaths 是否精确为一条旧 Task？
- 新 Task 是否自身满足当前产品任务合同？
- validator donor 是否明确无 candidate 身份并要求重新签发？

Security Review：

- 是否禁止通过 Harness 豁免或状态放宽绕过合同？
- 是否完整保留 First Decree disposition、tuple、exclusions、fingerprints 与 no-reanchor 边界？
- 是否存在把旧 RED/GREEN 结论冒充新基线证据的 evidence laundering？
- 是否存在第三条 candidate path、authority 继承或产品范围扩大？

## 11. Stop Conditions

- `origin/ext-dev` 离开 `67cb1816…`；
- 旧 Task、双 validator、Harness 或 authority 在 drafting 中出现差异；
- 新治理 Task 自身不满足 `productTaskErrors`；
- 完整 Harness 出现旧五项以外的新错误；
- 需要第四条 approval path 或第二条 candidate path；
- 任一摘要、路径、模式、内部一致性或独立审查失败；
- 任一 Governance/Security Review P0–P2。

命中任一条件立即 STOP，不得 commit、push 或继续产品实施。

## 12. Current Authorization Boundary

当前只授权三文件草案与只读验证。未授权修改旧 Task、双 validator、Harness、authority、产品测试、approval
materialization、commit、push、merge、rebase、fetch、pull、candidate、Pilot、Release 或部署。
