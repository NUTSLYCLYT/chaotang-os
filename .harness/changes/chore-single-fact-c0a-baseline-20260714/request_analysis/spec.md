# Spec：C0A clean base 与业务入口 inventory

## 目标

在不触碰共享脏树和运行时的前提下，固定一个可复现父提交，并让根 Harness 的机器清单覆盖已发现的全部业务事实面，只允许一个 canonical business terminal writer。

## 前置事实

- ext HEAD 在调查过程中多次移动，不能作为稳定施工 worktree。
- inventory v1 只有 3 个 RELEASE/OPS 旧入口，没有 BUSINESS 事实面。
- Step 0 调查已发现上书房、chaotang、compat、swarm、direct、frontend local DB 和专业专线等并行写面。

## 验收

- 独立 worktree 起点 clean，父 SHA/tree 写入 baseline。
- inventory 包含12个已发现 BUSINESS 入口族。
- 恰好一个 BUSINESS entry 同时为 `DECISION_TASK_KERNEL + CANONICAL`。
- 非 canonical BUSINESS entry 没有 telemetry 时调用量为 `null`，且不是删除候选。
- 专项 Node test、root Harness doctor、diff check 通过。

## 非目标

- 不实现 runtime telemetry；不决定4个 DISCOVERED入口的最终处置。
- 不修改 API、数据库、worker、页面或部署。
- 不提交、推送、合并或发布，除非用户另行授权相应 Git 动作。
