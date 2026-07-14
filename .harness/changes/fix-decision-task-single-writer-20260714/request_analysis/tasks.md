# 任务：fix-decision-task-single-writer-20260714

## 任务 1

- 目标：把全部正式 `DecisionTask` 创建收口到一个运行时 owner。
- 前置条件：固定发布候选分支，P0-B 权限门与 rollout 控制面已全绿。
- 输入：上书房正式拟旨、PACK、finance-intel、research-budget 四类字段。
- 输出：统一创建的 ORM 任务，保持原事务与 API 契约。
- 涉及文件：创建内核、上书房路由、结构测试、能力入口清单。
- 状态 / 数据变化：无 schema 变化；现有四条写路径改经统一函数。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：整体 revert 本提交；无需数据迁移。
- 完成定义：直接构造点归零、专项测试和 doctor 全绿。
