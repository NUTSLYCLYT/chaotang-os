# 规格说明：feat-r0-w01-execution-authority-v2-20260721-20260721

## 背景

`R0-TRUSTED-KERNEL-AMENDMENT-01` 已完成 R0-W01 的批准链条（owner exact-H 批准 + 三路独立 Claude
Code 审查 GO，均绑定 H=`5e432ea4...`），但执行权威本身还没有能说 GO 的机制——`execution-authority.v1`
设计上永远输出 STOP（schema 把 `activation.*` 三字段类型钉死为 null）。本变更交付 W01 packet card
写死的产物：全新独立的 `execution-authority.v2` schema/manifest/resolver/CLI/tests，scoped 到仅
授权 R0-W01，同时把 `amendmentGovernance` 状态机从 `PROPOSED_NOT_AUTHORITY` 原子跃迁到
`APPROVED_FOR_W01`。完整设计过程见已批准计划 `/home/ubuntu/.claude/plans/serene-napping-anchor.md`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | v1 五个文件零字节改动 | `git diff --stat 48ea569a..e467254c -- <5 v1 frozen paths>` 空输出 | 已验证 | 否 |
| 已确认事实 | v2 resolver 只授权 R0-W01，W02 一律 BLOCKED_DEPENDENCY | `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W02` → exit 2 | 已验证 | 否 |
| 已确认事实 | 独立审查 GO，0 HIGH / 2 MEDIUM | `claude_code_review/exact-h-final.md`，2026-07-21 | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | hosted PR/required check 尚未走完（Gitee，无 CLI 工具直接开 PR） | 不适用 | 待用户或后续会话处理 | 是（阻塞正式 merge，不阻塞本地实现完成度） |

## 数据流与调用链

```
调用方（未来 W02+ packet 或 agent）
  → node scripts/execution-authority-v2.mjs --authorize --work-package <id>
    → loadExecutionAuthorityV2(root)：读 manifest+schema+project-harness.json.amendmentGovernance
      → 逐段 symlink 安全读取 + sha256 摘要重算（含两份批准证据文件）
    → resolveExecutionAuthorityV2(manifest, amendmentGovernance, {workPackage})
      → 12 步判定链（结构→digest→baseline→review→格式→ledger→依赖链→专业重指派→GO）
    → harness-doctor.mjs 独立双向硬断言复核（GO on W01, STOP on W02）
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `execution-authority.v2` manifest | `.harness/manifest/execution-authority.v2.json` | resolver/CLI/doctor | schema 校验 + doctor 硬断言 |
| `amendmentGovernance` 状态机 | `.harness/manifest/project-harness.json` | `amendment-governance.mjs` dispatcher | PROPOSED/APPROVED 两态各自的 mutation matrix 测试 |
| v2 CLI `--authorize` 输出 | `scripts/execution-authority-v2.mjs` | 未来 packet 的开工前置检查（§11 Codex 指令） | `decision===GO && activeWorkPackage` 精确匹配，见 nodetest |

## 范围

execution-authority v2 全新技术栈（schema/manifest/resolver/CLI/tests/wiki）+ amendmentGovernance
状态跃迁 + harness-doctor 接入。

## 非目标

不改 v1 任何字节；不改 `AGENTS.md`/`project-owner.md`/`project-workflow.md`（留待后续独立受控重钉
变更）；不批 W02-W09 runtime；不接真实客户数据；不预铺 W02-W09 依赖占位。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 请求 W08/W09 或 `--real-customer-data`，角色仍默认 owner | STOP/PROFESSIONAL_REASSIGNMENT_REQUIRED | nodetest「professional reassignment gate」 |
| `activeWorkPackage:null` + ledger 无 ACTIVE（回滚态） | STOP/NO_ACTIVE_WORK_PACKAGE，非异常 | nodetest「rollback state」 |
| manifest 文件缺失 | loader 报错 → INVALID_EXECUTION_AUTHORITY，绝不静默放行 | nodetest「missing manifest file」 |

## 风险与回滚边界

`git worktree`/分支操作不涉及；本变更是纯 harness 治理代码，回滚 = 撤销本 commit 即恢复到 v2 不
存在、v1 继续单独把关的状态，不会退化到"无 guard"（v1 从未被触碰）。

## 计划确认记录

- 批准人：lyt（W01 范围内实现工作，依据既有 owner exact-H 批准，未新增范围批准）
- 批准日期：2026-07-21（对话内确认「要」推进 R0 执行权威收口 + 批准实现计划 ExitPlanMode）
- 批准范围：execution-authority v2 实现（本变更全部内容）
- 明确未批准：hosted PR 的 merge 决定本身、W02-W09 任何 runtime

## 验收标准

- packet card 产物清单全部交付（见背景段）
- 独立（非实现者）review GO，0 HIGH
- doctor 双向硬断言、v1 回归、v2 全量测试均通过

## 验证计划

见 `ci_result/ci_summary.md`。
