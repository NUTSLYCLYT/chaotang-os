# CI 摘要：docs-r0-w04-canonical-completion-approval-20260722-20260722

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W04` | 0 | GO | ledger 翻转生效 | 2026-07-22 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W03` | 2 | STOP/WORK_PACKAGE_MISMATCH | 已完成的包不可重复领取 | 同上 |
| `node scripts/execution-authority-v2.mjs --authorize --work-package R0-W05` | 2 | STOP/BLOCKED_DEPENDENCY | 依赖链守住 | 同上 |
| `node --test scripts/execution-authority-v2.nodetest.mjs` | 0 | 27 passed | v2 全量单测 | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors | 全仓 doctor | 同上 |

## 结果

owner_approval 落盘，ledger 原子翻转成功（`effectiveBase` 前进到 `eefd4133`，与本次批准的
`candidateH` 一致），GO/STOP 三态均验证正确。

## 未验证项

- W04 的实际业务实现（idempotency runtime/single writer/DELIVERED 公式/trace/硬上限）尚未
  开始，本变更只是开工前置关卡

## Diff 与回滚复核

- changed files：`.harness/manifest/execution-authority.v2.json`（ledger 翻转）+ 本变更记录本身
- diff review：单人会话内自查，纯数据翻转无逻辑改动
- 回滚是否演练：未演练；`git revert` 即可恢复到 W03 静默收口态

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| Product Owner 批准 R0-W04 落盘 | `owner_approval/exact-h-approval.md` | 已满足 |
| ledger 原子翻转且 GO/STOP 均正确 | 命令表 | 已满足 |
| doctor 0 错误 | 0 errors / 0 warnings | 已满足 |

## 声明状态

- `VERIFIED_COMPLETE`（Step 0 治理关卡范围内）；R0-W04 实际业务实现是独立的后续变更。
