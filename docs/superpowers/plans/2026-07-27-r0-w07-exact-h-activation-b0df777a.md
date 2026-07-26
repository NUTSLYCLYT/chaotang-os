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
2. 添加 integrated activation RED：feature EXT ref 指向 activation HEAD 时，当前
   ref/effective-base 等值规则会拒绝。
3. 在 `scripts/lib/execution-authority-v2.mjs` 更新 W07 profile、review base 和
   identity contract：EXT ref 等于 pinned HEAD，approved candidate 是其第一父祖先。
4. 添加 ref drift、HEAD drift、non-ancestor、merge activation 和 rollback negatives。
5. 同步 `.harness/wiki/execution-authority-v2.md`，保持 threat-model-B 边界。
6. 运行 focused tests，再运行完整 authority/amendment/doctor regression。

## Task 3: Authority Candidate Freeze

1. 从最新 local EXT 创建新 isolated worktree。
2. 完成 Task 2 profile/identity remediation，保持 manifest
   `activeWorkPackage=null` 且无 W07 ledger。
3. 先 commit，再记录 exact H/tree 并运行 fresh verification。
4. 该 commit 不包含引用自身 H 的 activation intent。

## Task 4: Reviewer Overlay Refresh

1. 以 Task 3 H/tree 为 reviewer reassignment candidate。
2. 以 overlay 的固定 `baseH=55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca`
   到 Task 3 exact H 生成 hardened review package。
3. 运行两轮 fresh/read-only Codex review，取得 Product Owner exact-H approval。
4. 以独立 quiescent commit 刷新 overlay，并证明 protected bytes 精确匹配 Task 3。
5. W07 仍须 `STOP / NO_ACTIVE_WORK_PACKAGE`。

## Task 5: Activation Evidence Registration Parent

1. 从 Task 3 的已知 H/tree 生成规定 Git range 的 raw-byte review package。
2. 计算 package SHA-256 并生成绑定 Task 3 H/tree 的 activation intent。
3. 向 Product Owner 提交 H/tree、package path/digest、intent path/digest、scope 和
   exclusions。
4. 只有收到逐字批准后才生成 owner evidence。
5. 由 fresh、read-only `Codex Independent QA` 审查并绑定 owner digest。
6. 要求 `GO`、`HIGH=0`、`MEDIUM=0`。
7. commit 全部证据并冻结仍为 quiescent 的 registration parent。

## Task 6: Atomic Activation Candidate

需要单独 activation 授权。

1. 从 Task 5 registration parent 创建单父提交。
2. 只修改 `.harness/manifest/execution-authority.v2.json` 的已批准转换。
3. 验证 W06 为 `WORK_PACKAGE_MISMATCH`，W07 唯一 GO，W08/W09 为
   `BLOCKED_DEPENDENCY`。
4. 运行完整 verification-loop 和独立只读审查。
5. 请求受控整合到 local EXT；不 push、不部署。

## Proof Commands

```bash
export BASE_H=b0df777a1fe94d98afdc62b4cdd02a2f8a091391
: "${CANDIDATE_H:?set CANDIDATE_H from the exact-H review receipt}"
test "$(git rev-parse "$CANDIDATE_H^{commit}")" = "$CANDIDATE_H"
git rev-parse "$CANDIDATE_H^{tree}"
git diff --check "$BASE_H..$CANDIDATE_H"
export REVIEW_PACKAGE_PATH=/tmp/r0-w07-activation-candidate.diff
/usr/bin/git --no-replace-objects diff --no-ext-diff --no-textconv --binary \
  "$BASE_H..$CANDIDATE_H" > "$REVIEW_PACKAGE_PATH"
sha256sum "$REVIEW_PACKAGE_PATH"
test -z "$(git status --porcelain=v1)"
node --test scripts/execution-authority.nodetest.mjs scripts/r0-amendment-check.nodetest.mjs scripts/execution-authority-v2.nodetest.mjs
node scripts/execution-authority.mjs --check
node scripts/execution-authority.mjs --authorize
node scripts/execution-authority-v2.mjs --check
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W06
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W07
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W08
node scripts/execution-authority-v2.mjs --authorize --work-package R0-W09
node scripts/harness-doctor.mjs
(cd backend && python3 scripts/harness_doctor.py)
```

`CANDIDATE_H` 由仓外 exact-H receipt 注入，不能在候选自身文件中预写。`BASE_H`
同时是后续 W07 profile 的 frozen review base。验证记录必须保存命令退出码、时间、
H/tree、raw diff SHA-256 和各 authorize reason。Event 1-3 预期四个 package 均
`NO_ACTIVE_WORK_PACKAGE`；Event 4 预期 W06 mismatch、W07 GO、W08/W09 blocked。

## Stop Conditions

任何 authority、scope、production、ownership、identity 或 concurrent-writer
冲突都停止当前事件。禁止把 local verification 描述为 deployment。
