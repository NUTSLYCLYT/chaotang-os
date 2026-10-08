# G3 六部 Runtime 指纹绑定（2026-10-08）

## Status

In Progress

## Product Definition

为最新 ext-dev 中已审计的锦衣卫真实性与 Feed 合同实现补充一组精确六部 Runtime 兼容指纹，保持 Harness 失败关闭、历史审查证据和验证强度不变。

## Acceptance Criteria

- [x] 当前 Runtime 指纹 `sha256:6243df4fe33ae51a23115d9fca12acb6fd3105f40bd769b536de616b5da84dfe` 与后继指纹 `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2` 作为一组精确 pair 被接受。
- [x] 单边、混搭、篡改和未知指纹继续被拒绝。
- [ ] `node scripts/check_harness.mjs --check`、`--self-test` 与 `git diff --check` 通过。
- [x] 不改变产品运行代码、API、数据库、权限、模型凭据、网络策略或 CI 标准。

## Delivery Constraints

- 只改动 `scripts/check_harness.mjs` 的兼容对表与对应 self-test 期望，以及本任务记录。
- 不修改历史指纹、来源提交、能力族统计、解析器数量、失败分类或测试标准。
- 不使用 `--no-verify`，不强推，不进行公共部署，不操作原生桌面窗口。
- 该变更不使用 M0 approval manifest：`scripts/check_harness.mjs` 属于 `PROTECTED_PRODUCT_PATHS`，本文件是 owner 直接治理记录。

## Affected Modules

- 模块：六部 Runtime 精确兼容指纹门禁与 owner 治理记录。
- 允许路径：`scripts/check_harness.mjs`、`docs/product/tasks/2026-10-08-g3-jinyiwei-runtime-fingerprint-binding.md`。

## Technical Plan

1. 计算并复核当前 ext-dev Runtime 与后继内容指纹。
2. 在现有精确 pair 表追加一组 pair，并同步 self-test 数量、说明和期望列表。
3. 运行 Harness check、Harness self-test 与差异检查。
4. 以单一原子提交保存，之后再进行候选验证与远端同步。

## Implementation Report

当前远端基线为 `18f3fc721cd1ddb87b26730c35f59116f1c04218`。本治理记录只绑定由当前实现内容计算出的精确 pair，不修改产品运行代码。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待 Harness check、self-test 和 pre-push 门禁完成后补充。
- 未通过项：当前 worktree 卫生门禁仍发现一个白名单外 worktree。

## Rollback

该变更保持单一原子提交；如候选验证或远端门禁不通过，使用 `git revert <commit-sha>` 回退，或回到父提交，不改写共享远端历史。
