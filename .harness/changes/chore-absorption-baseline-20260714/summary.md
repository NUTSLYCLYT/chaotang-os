# 变更摘要：chore-absorption-baseline-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | chore-absorption-baseline-20260714 |
| Packet | P0（BASE `2a92646` 重切版） |
| 类型 | chore / evidence only |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 新 integration predecessor：`f9b3e88668cfa0e891274a0b4b5cc3947c1e36fe`。
- 新 campaign BASE：`2a92646cbae6c411a48a5a9a72257e7ac188e49f`。
- 仅记录重切后的环境、doctor、测试、真实 DB 三元、P7 KPI 与 deferred 项。
- 仓库测试基础设施修复：`NONE`；产品行为修改：`NONE`。

## 验证结论

- 根/前端/后端 doctor：各 0 errors / 0 warnings。
- 后端 DB tripwire：5 passed；canonical 主链：43 passed / 1 deselected；collect-only：2589 tests。
- 前端 TypeScript：PASS；node suite：1009 tests，1002 pass / 7 个与旧 P0 完全相同的已知失败。
- 真实控制面 DB hash/size/mtime 前后完全一致，P0 worktree 未生成控制面 DB。
- 无 push、无 upstream；原 dirty ext worktree 未修改。

详证见 `baseline.md` 与 `ci_result/ci_summary.md`。

## Commit 审批日志

- [x] 2026-07-14，P0 evidence-only staged stat 为 6 files / +183；用户批复原文：“批”。授权仅覆盖本 change 目录内的 P0 基线证据 commit，不覆盖合入 integration 或启动 P1。
