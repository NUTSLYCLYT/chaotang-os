# 兵部 Graph Worker P2 Runtime 指纹绑定（2026-10-08）

## Status

In Progress

## Product Definition

为兵部 Graph → `decree_jobs` worker P2 的 worker control 变更绑定当前六部 Runtime 精确内容指纹，保持 Harness 失败关闭和产品候选路径隔离。

## Acceptance Criteria

- [x] 当前 Runtime 指纹 `sha256:b78d00ced70bb6f0c59c079f36475bab0b1ab77b287cc3e72e30f751283e0a69` 与后继指纹 `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2` 作为精确 pair 被接受。
- [x] 单边、混搭、篡改和未知指纹继续被拒绝。
- [ ] `node scripts/check_harness.mjs --check`、`--self-test` 与 `git diff --check` 在最终 candidate 基线上通过。
- [x] 不改变产品 API、数据库、权限、模型凭据、网络策略或 CI 标准。

## Delivery Constraints

- 只改动 `scripts/check_harness.mjs` 的兼容对表与对应 self-test 期望，以及本任务记录。
- 不修改历史指纹、来源提交、能力族统计、解析器数量、失败分类或测试标准。
- 不使用 `--no-verify`，不强推，不进行公共部署。
- 该变更属于 owner 直接治理记录，不进入兵部 P2 的 productPaths。

## Affected Modules

- 模块：六部 Runtime 精确兼容指纹门禁、兵部 P2 worker trusted-spine 绑定与治理记录。
- 允许路径：`scripts/check_harness.mjs`、`docs/product/tasks/2026-10-08-bingbu-p2-runtime-fingerprint-binding.md`。

## Technical Plan

1. 在包含 P2 worker control 变更的 candidate 基线上计算 Runtime 与 successor 指纹。
2. 在现有精确 pair 表追加一组 pair，并同步 self-test 数量、说明和期望列表。
3. 运行 Harness check、Harness self-test 与差异检查。
4. 以单一治理提交保存，再重新生成 P2 approval/candidate lineage。

## Implementation Report

当前 pair 只绑定 P2 candidate 的实际 trusted-spine 内容；产品提交仍严格限制在 P2 approval manifest 的 6 个路径。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待最终 P2 candidate 的 authority 验证和 pre-push 门禁完成后补充。
- 未通过项：远端同步仍受现有 worktree 卫生门禁影响。

## Rollback

该变更保持单一原子提交；如候选验证或远端门禁不通过，使用 `git revert <commit-sha>` 回退，不改写共享远端历史。
