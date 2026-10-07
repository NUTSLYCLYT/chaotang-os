# G3 Harness owner 指纹绑定（2026-10-08）

## Status

In Progress

## Product Definition

为 G3 预算 50,000 与 standalone 资源同步候选补充一个精确六部 Runtime 后继指纹绑定，让现有 Harness 能识别当前实现；保持失败关闭、历史审查证据和验证强度不变。

## Acceptance Criteria

- [x] 当前运行时指纹 `sha256:c18e2cf4a921f5b890b029ceb809f71fde2a73d96fe9c226a593e7f6264d6bb2` 与后继指纹 `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2` 作为一组精确 pair 被接受。
- [x] 单边、混搭、篡改和未知指纹继续被拒绝。
- [x] `node scripts/check_harness.mjs --check`、`--self-test` 与 `git diff --check` 通过。
- [x] 不改变产品运行代码、API、数据库、权限、模型凭据、网络策略或 CI 标准。

## Delivery Constraints

- 只改动 `scripts/check_harness.mjs` 的兼容对表与对应 self-test 期望，以及本任务记录。
- 不修改历史指纹、来源提交、能力族统计、解析器数量、失败分类或测试标准。
- 不使用 `--no-verify`，不强推，不进行公共部署，不操作原生桌面窗口。
- 该变更不使用 M0 approval manifest：`scripts/check_harness.mjs` 属于 `PROTECTED_PRODUCT_PATHS`，M0 会拒绝 `PRODUCT_PATH_PROTECTED`；本文件是 owner 直接治理记录。

## Affected Modules

- 模块：六部 Runtime 精确兼容指纹门禁与 owner 治理记录。
- 允许路径：`scripts/check_harness.mjs`、`docs/product/tasks/2026-10-08-g3-harness-owner-fingerprint-binding.md`。

## Technical Plan

1. 计算并复核当前候选运行时与后继内容指纹。
2. 在现有精确 pair 表追加一组 pair，并同步 self-test 数量和说明。
3. 运行 Harness check、Harness self-test 与差异检查。
4. 以单一原子提交保存，之后再进行候选验证与远端同步。

## Implementation Report

当前候选基线为 `97dfe53f245f8840ec208a483eaff8233245ae97`，本治理提交为其直接后继。用户确认本次治理摘要：`sha256:599b140f8c98bae6f76b163bca571fef9bdbc30a144ba5f3444378b43466bc17`。

本次仅增加上述精确 pair，并将 self-test 的 pair 数量由 22 更新为 23；未修改产品运行代码。预验证结果：

- `node scripts/check_harness.mjs --check` → `agentic-check: 通过 (159 个基线文件)`。
- `node scripts/check_harness.mjs --self-test` → `agentic-check self-test: 通过 (175 项)`。
- `git diff --check` → 通过。

## Acceptance Review

本记录只证明 owner 直接治理变更的范围和本地门禁结果；它不替代候选提交验证、远端 CI、真实模型流程、Shiguan 不可变证据快照或发布批准。候选验证与双远端同步必须在本提交稳定后单独执行，失败时保留原始错误。

## Rollback

该变更保持单一原子提交；如候选验证或远端门禁不通过，使用 `git revert <commit-sha>` 回退，或回到父提交 `97dfe53f245f8840ec208a483eaff8233245ae97`，不改写共享远端历史。
