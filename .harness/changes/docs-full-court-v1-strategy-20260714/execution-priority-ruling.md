# 2026-07-14 23:28 执行优先级裁决（用户）

## 后续裁决覆盖

用户随后明确要求将现有 EXT 改动、P0 与 P1 全部合并到
`feature-chaotang-ext`，并在合并后留在 EXT 继续后续工作。因此下文中
“EXT 冻结”和“P1 独立分支停审”的规定已被这项后续明确指令覆盖；其余范围纪律
仍作为历史决策与执行约束保留。

## 原裁决

即刻起**单线作战**：只执行主线归并战役 P0–P9（codex-absorption-plan.md v2），
按顺序、按停审门，一次一个 Packet。

## 排队/冻结（P7 收官前不动）

| 事项 | 状态 |
| --- | --- |
| census CEN-01..05 修订 | 排队——P1 GO 后可在等审空档做（docs-only） |
| EXT 三证认证（codex-ext-certification-prompt.md） | 冻结——absorption 完成后启动 |
| 并行会话对 ext 的功能性提交（uplift 类） | 暂停——有紧急修复需先报业主批，且不得触碰 P1–P9 范围文件 |
| feature-chaotang-release 分支动工 | 冻结——回 ext；release 迁移在三证之后 |

## 当时的唯一任务（发给 Codex）

P1 收尾三步，做完停审：

1. 把 task/p1-dept-id-ssot（c06d66d）rebase/重切到 integration/full-court-v1
   （f9b3e88）；冲突按结构重构后路径解决，语义不变；
2. 重建丢失的 change 目录 refactor-dept-id-ssot-20260714（spec/tasks/summary/
   ci_summary），worktree 放 ~/Projects/.fullcourt-worktrees/（不再用 /tmp）；
3. 重跑 P1 全套验收（SSOT 守门测试、golden 路由 30 条、三层 doctor、tsc、
   代表套件、冒烟旅程），证据落盘后输出
   PACKET_P1_READY_FOR_CLAUDE_REVIEW。

## 纪律重申

- 一个 Packet 一个 change 一个分支；没有 GO 不开下一个；
- 并行会话不再“先做后追认”——一切碰 ext 的实质变更走 Packet 或先批；
- 监理（Claude）监控在岗，Packet 落地自动开审。
