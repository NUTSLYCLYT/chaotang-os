# 任务：docs-r0-w08-readiness-dashboard-20260729

## 任务 1

- 目标：采集 exact EXT state 与 W08 closeout preflight 输出
- 前置条件：本地 EXT HEAD `4a81b9a8`
- 输入：git state、W08 authority、closeout preflight、records directory listing
- 输出：W08 pass/block gate facts
- 涉及文件：无运行时代码
- 状态 / 数据变化：已完成
- 验证命令与证据：见 `ci_result/ci_summary.md`
- 回滚边界：无代码变更
- 完成定义：事实足以区分 automation-ready 与 closeout-ready

## 任务 2

- 目标：生成 readiness dashboard
- 前置条件：事实采集完成
- 输入：W08 gate facts
- 输出：`readiness_dashboard.md`
- 涉及文件：本 change record
- 状态 / 数据变化：已完成
- 验证命令与证据：dashboard 内容与命令输出一致
- 回滚边界：docs-only
- 完成定义：dashboard 明确唯一 blocker 与非目标

## 任务 3

- 目标：验证并整合本地 EXT
- 前置条件：dashboard 完成
- 输入：doctor、authority、diff check
- 输出：verified docs Packet
- 涉及文件：本 change record
- 状态 / 数据变化：已完成
- 验证命令与证据：preflight expected BLOCKED、backend/root doctor、authority、diff check
- 回滚边界：docs-only
- 完成定义：提交候选并 fast-forward 整合到本地 EXT
