# 任务：docs-launch-blueprint-final-product-shape-20260714

## 任务 1：校准 S1 证据

- 目标：把 `93a4483` 的实际合入结果写回上线蓝图，保留未完成门。
- 前置条件：S1 独立 worktree 验证和 ext cherry-pick 已完成。
- 输入：S1 三份 change record、提交 `93a4483`、当前 `prod:doctor` 结果。
- 输出：不再陈述“候选 PR 未形成”“deploy/service/cron/monitor 均未修复”。
- 涉及文件：`plans/chaotang-os-launch-blueprint-2026-07-14.md`。
- 状态 / 数据变化：仅文档，无运行状态变化。
- 验证命令与证据：`git show --stat 93a4483`、`git diff --check`。
- 回滚边界：可单文件回滚。
- 完成定义：完成项、未完成项和 STOP 原因均与证据一致。

## 任务 2：冻结最终产品形态

- 目标：把首发客户界面、合同决策单字段和扩张门写入唯一产品事实源及执行蓝图。
- 前置条件：保留现有 5.1 草案，不覆盖其他待审成果。
- 输入：`PROJECT_PRODUCT.md` 5.1、上线计划 S6-S9、上书房控制面蓝图。
- 输出：客户只看到四个稳定界面；一项任务、一条状态线、一份正式奏折；第二切片按客户证据解冻。
- 涉及文件：`docs/product/PROJECT_PRODUCT.md`、`plans/chaotang-os-launch-blueprint-2026-07-14.md`。
- 状态 / 数据变化：仅产品契约文档，无数据库变化。
- 验证命令与证据：跨文档关键词/字段检查、独立蓝图会审。
- 回滚边界：可逐段回滚，不影响现有运行代码。
- 完成定义：产品事实源和上线蓝图无冲突，商业假设不冒充客户事实。

## 任务 3：候选验证与精确合入

- 目标：对 ext 累计候选状态执行 verification-loop，并只提交本变更拥有的文件。
- 前置条件：独立会审完成且阻断意见已处理。
- 输入：当前 ext 脏工作区和本 change record。
- 输出：命令、退出码、已知基线失败和声明状态均可复核。
- 涉及文件：本 change record 的 `ci_result/ci_summary.md`、`summary.md`。
- 状态 / 数据变化：创建一个只包含产品文档、计划和本记录的 git commit。
- 验证命令与证据：根/前/后 doctor，前端 typecheck/build，相关前后端测试，S1 契约测试，diff/secret 检查，`prod:doctor`。
- 回滚边界：revert 本文档提交；不得 reset 用户其他脏改动。
- 完成定义：验证结果写实，精确暂存清单不含其他用户变更。
