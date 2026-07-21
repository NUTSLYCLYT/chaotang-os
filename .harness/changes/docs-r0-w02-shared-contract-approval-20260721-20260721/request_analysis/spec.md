# 规格说明：docs-r0-w02-shared-contract-approval-20260721-20260721

## 背景

R0-W01（execution-authority v2）已 `MERGED_AND_VERIFIED`（PR #7 → `feature-chaotang-ext@656a4fe3`）。
按 amendment 依赖链，下一个待开的 work package 是 R0-W02（共享合同契约）。v2 resolver 目前只认
`activeWorkPackage:"R0-W01"`，请求 R0-W02 一律 `BLOCKED_DEPENDENCY`。本变更是 W02 的开工前置
治理关卡：新的 Product Owner exact-approval（对话内 AskUserQuestion 确认，非笼统"继续"）+ OQ-03
（支持/拒答 taxonomy）冻结 + ledger 原子翻转，不含任何 W02 业务代码。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | Product Owner 对话内明确批准 R0-W02，明确不批 W03-W09/真实客户数据/上线 | `owner_approval/exact-h-approval.md`，2026-07-21 | 已验证 | 否 |
| 已确认事实 | OQ-03 taxonomy 取值 + UNSUPPORTED_OR_UNKNOWN 哨兵机制 + OurRole 四值均经 Product Owner 确认 | 同上 | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | 无 | 不适用 | 不适用 | 不适用 |

## 数据流与调用链

```
Product Owner 批准（本变更）
  → execution-authority.v2.json ledger 翻转（R0-W01→MERGED_AND_VERIFIED，R0-W02→ACTIVE）
    → node scripts/execution-authority-v2.mjs --authorize --work-package R0-W02 → GO
      → 后续独立 R0-W02 实现变更（Pydantic 契约/路由/测试）方可开工
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `execution-authority.v2` manifest activeWorkPackage | 本变更翻转 | resolver/CLI/doctor/未来实现变更 | resolver 12步判定链 + doctor 硬断言 |
| OQ-03 taxonomy 冻结值 | 本变更 owner_approval 文件 | 未来 W02 实现变更的 Pydantic Literal 定义 | 人工核对一致，无自动化交叉校验（后续实现变更自行保证） |

## 范围

execution-authority v2 ledger 治理翻转 + OQ-03 冻结记录，不含业务代码。

## 非目标

不实现任何 Pydantic 契约/路由/测试（留给独立的 R0-W02 实现变更）；不批 W03-W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 请求 R0-W02 但 ledger 未翻转 | STOP/BLOCKED_DEPENDENCY | 翻转前先跑一次命令确认此状态 |
| 翻转后请求 R0-W03 | 仍 STOP/BLOCKED_DEPENDENCY（W02 未 MERGED_AND_VERIFIED） | 翻转后跑命令验证 |

## 风险与回滚边界

纯 harness manifest 数据变更，`git revert` 即可恢复到只授权 R0-W01 的状态，不影响任何运行时代码。

## 计划确认记录

- 批准人：lyt
- 批准日期：2026-07-21
- 批准范围：R0-W02 实现（Pydantic 契约/路由/OpenAPI快照/RED测试）
- 明确未批准：R0-W03–R0-W09 runtime、真实客户数据、上线

## 验收标准

`execution-authority-v2.mjs --authorize --work-package R0-W02` 从 STOP 变为 GO，doctor 0 errors。

## 验证计划

见 `ci_result/ci_summary.md`。
