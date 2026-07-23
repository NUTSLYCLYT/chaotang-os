# 规格说明：docs-r0-w04-canonical-completion-approval-20260722-20260722

## 背景

R0-W03 已 `MERGED_AND_VERIFIED`，ledger 静默收口。下一包 R0-W04（canonical 完成与恢复）需要
独立、具名的 Product Owner 批准才能开工——不能因为 W03 完成就自动推导。本变更记录该批准 +
ledger 原子翻转，不含 W04 业务代码（业务代码是独立的后续实现变更）。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | Product Owner 通过 AskUserQuestion 明确批准 R0-W04，绑定 exact HEAD `eefd4133`，明确不批 W05-W09/真实客户数据/上线 | `owner_approval/exact-h-approval.md`，2026-07-22 | 已验证 | 否 |
| 已确认事实 | R0-W03 已合并进 `origin/feature-chaotang-ext`（`0a24fa3d` 是合并提交 `eefd4133` 的祖先），前置条件满足 | `git merge-base --is-ancestor` | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | 无 | 不适用 | 不适用 | 不适用 |

## 数据流与调用链

```
Product Owner 批准（本变更）→ execution-authority.v2.json ledger 翻转
  （R0-W03 保持 MERGED_AND_VERIFIED，R0-W04→ACTIVE，effectiveBase 前进到 eefd4133）
  → node scripts/execution-authority-v2.mjs --authorize --work-package R0-W04 → GO
    → 后续独立 R0-W04 实现变更（canonical idempotency/single writer/DELIVERED 公式/trace 等）方可开工
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `execution-authority.v2` manifest activeWorkPackage/effectiveBase | 本变更翻转 | resolver/CLI/doctor/未来 W04 实现变更 | resolver 判定链 + doctor 动态断言 |
| amendment §R0-W04 冻结范围 | `.harness/changes/docs-r0-trusted-kernel-amendment-20260720/amendment.md` | 未来 W04 实现变更 | 人工核对一致 |

## 范围

execution-authority v2 ledger 治理翻转，不含业务代码。

## 非目标

不实现任何 idempotency runtime/single writer/DELIVERED 公式/trace identity/硬上限代码（留给
独立的 R0-W04 实现变更）；不批 W05-W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 翻转前请求 R0-W04 | STOP/NO_ACTIVE_WORK_PACKAGE | 翻转前先跑一次命令确认此状态 |
| 翻转后请求 R0-W05 | STOP/BLOCKED_DEPENDENCY（W04 未 MERGED_AND_VERIFIED） | 翻转后跑命令验证 |
| 翻转后请求 R0-W03 | STOP/WORK_PACKAGE_MISMATCH（已完成不可重复领取） | 同上 |

## 风险与回滚边界

纯 harness manifest 数据变更，`git revert` 即可恢复到静默收口态，不影响任何运行时代码。

## 计划确认记录

- 批准人：lyt
- 批准日期：2026-07-22
- 批准范围：R0-W04 实现（canonical 完成与恢复：idempotency/single writer/DELIVERED 公式/
  取消 fencing/局部重试/UNKNOWN 查单/全链 trace identity/确定性硬上限）
- 明确未批准：R0-W05–R0-W09 runtime、真实客户数据、上线

## 验收标准

`execution-authority-v2.mjs --authorize --work-package R0-W04` 从 STOP 变为 GO，doctor 0 错误。

## 验证计划

见 `ci_result/ci_summary.md`。
