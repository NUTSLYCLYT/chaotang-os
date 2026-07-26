# R0-W07 Exact-H Activation Recovery Implementation Plan

**Goal:** 在不激活 W07 的前提下，准备可由 exact-H 审批和独立审查驱动的原子
activation train。

**Baseline:** `b0df777a1fe94d98afdc62b4cdd02a2f8a091391`

## Task 1: Packet Candidate

- [x] 创建隔离 worktree。
- [x] 核对 authority、overlay 和旧 Packet 边界。
- [x] 编写新 Packet、design 和 implementation plan。
- [ ] 运行治理验证。
- [ ] 独立只读审查本 Packet。
- [ ] 冻结 candidate H/tree 并请求受控整合。

Changed files: only the new Packet, this design, and this plan.

## Task 2: Canonical Profile TDD

需要单独实施授权。

1. 在 `scripts/execution-authority-v2.nodetest.mjs` 添加 RED：
   新 root 正确、旧 root 拒绝、混合证据拒绝、manifest 仍 quiescent。
2. 在 `scripts/lib/execution-authority-v2.mjs` 更新 W07 profile 常量与 allowlist。
3. 必要时同步 `.harness/wiki/execution-authority-v2.md`，不改变 authority 边界。
4. 运行 focused tests，再运行完整 authority/amendment/doctor regression。

## Task 3: Quiescent Evidence Freeze

1. 从最新 local EXT 创建新 isolated worktree。
2. 生成规定 Git range 的 raw-byte review package。
3. 计算 package SHA-256 并生成 activation intent。
4. 保持 manifest `activeWorkPackage=null` 且无 W07 ledger。
5. commit 后记录 exact H/tree，运行 fresh verification。

## Task 4: Approval Registration Parent

1. 向 Product Owner 提交 exact H/tree/package/intent digest。
2. 只有收到逐字批准后才生成 owner evidence。
3. 由 fresh、read-only `Codex Independent QA` 审查。
4. 要求 `GO`、`HIGH=0`、`MEDIUM=0`。
5. commit 全部证据并冻结 registration parent。

## Task 5: Atomic Activation Candidate

需要单独 activation 授权。

1. 从 registration parent 创建单父提交。
2. 只修改 `.harness/manifest/execution-authority.v2.json` 的已批准转换。
3. 验证 W06 保持 closed，W07 唯一 ACTIVE，W08/W09 blocked。
4. 运行完整 verification-loop 和独立只读审查。
5. 请求受控整合到 local EXT；不 push、不部署。

## Proof Commands

```bash
node --test scripts/execution-authority.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority.mjs --authorize
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
node scripts/harness-doctor.mjs
(cd backend && python3 scripts/harness_doctor.py)
git diff --check
```

## Stop Conditions

任何 authority、scope、production、ownership、identity 或 concurrent-writer
冲突都停止当前事件。禁止把 local verification 描述为 deployment。
