# 规格说明：docs-r0-w03-secure-ingest-approval-20260722-20260722

## 背景

R0-W02 已 `MERGED_AND_VERIFIED`，ledger 静默收口。下一包 R0-W03（安全摄取与租户隔离）需要
独立、具名的 Product Owner 批准才能开工——不能因为 W02 完成就自动推导。本变更记录该批准 +
OQ-02/OQ-06 冻结 + ledger 原子翻转，不含 W03 业务代码（业务代码是独立的后续实现变更）。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | Product Owner 通过 AskUserQuestion 明确批准 R0-W03，明确不批 W04-W09/真实客户数据/上线 | `owner_approval/exact-h-approval.md`，2026-07-22 | 已验证 | 否 |
| 已确认事实 | OQ-02（20MB/100页）、OQ-06（provider policy 全 UNKNOWN 上线）、admin 零例外、真病毒扫描排除 R0 范围，均经 AskUserQuestion 确认 | 同上 | 已验证 | 否 |
| 推测 | 无 | 不适用 | 不适用 | 不适用 |
| 未知问题 | 无 | 不适用 | 不适用 | 不适用 |

## 数据流与调用链

```
Product Owner 批准（本变更）→ execution-authority.v2.json ledger 翻转
  （R0-W02 保持 MERGED_AND_VERIFIED，R0-W03→ACTIVE）
  → node scripts/execution-authority-v2.mjs --authorize --work-package R0-W03 → GO
    → 后续独立 R0-W03 实现变更（secure_ingest 模块/路由/迁移/测试）方可开工
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `execution-authority.v2` manifest activeWorkPackage | 本变更翻转 | resolver/CLI/doctor/未来 W03 实现变更 | resolver 判定链 + doctor 动态断言 |
| OQ-02/OQ-06 冻结值 | 本变更 owner_approval 文件 | 未来 W03 实现变更的 `limits.py`/`provider_policy.yaml` | 人工核对一致 |

## 范围

execution-authority v2 ledger 治理翻转 + OQ-02/OQ-06 冻结记录，不含业务代码。

## 非目标

不实现任何 secure_ingest 模块/路由/迁移/测试（留给独立的 R0-W03 实现变更）；不批 W04-W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 翻转前请求 R0-W03 | STOP/NO_ACTIVE_WORK_PACKAGE | 翻转前先跑一次命令确认此状态 |
| 翻转后请求 R0-W04 | STOP/BLOCKED_DEPENDENCY（W03 未 MERGED_AND_VERIFIED） | 翻转后跑命令验证 |
| 翻转后请求 R0-W02 | STOP/WORK_PACKAGE_MISMATCH（已完成不可重复领取） | 同上 |

## 风险与回滚边界

纯 harness manifest 数据变更，`git revert` 即可恢复到静默收口态，不影响任何运行时代码。

## 计划确认记录

- 批准人：lyt
- 批准日期：2026-07-22
- 批准范围：R0-W03 实现（安全摄取模块/路由/迁移/测试）
- 明确未批准：R0-W04–R0-W09 runtime、真实客户数据、上线

## 验收标准

`execution-authority-v2.mjs --authorize --work-package R0-W03` 从 STOP 变为 GO，doctor 0 错误。

## 验证计划

见 `ci_result/ci_summary.md`。
