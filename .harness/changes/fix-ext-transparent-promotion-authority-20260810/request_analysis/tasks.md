# 任务：fix-ext-transparent-promotion-authority-20260810

## 任务 1：锁定误报根因

- 目标：证明产品 tree 未变且错误只来自平台 merge 拓扑。
- 前置条件：PR !20 已合并，远端最终对象可读取。
- 输入：冻结候选、PR 最终提交、执行权威 manifest。
- 输出：候选、父节点与 tree 的可复核关系。
- 涉及文件：无。
- 状态 / 数据变化：已完成；只读调查。
- 验证命令与证据：Git object/first-parent 检查。
- 回滚边界：不适用。
- 完成定义：根因唯一且不涉及产品内容。

## 任务 2：实现失效关闭的透明推广识别

- 目标：兼容 Gitee tree-identical no-ff promotion，不信任普通第二父可达。
- 前置条件：任务 1 完成。
- 输入：真实拓扑和既有攻击用例。
- 输出：resolver、正例、tree 改写反例、无祖先关系反例、wiki。
- 涉及文件：`scripts/lib/execution-authority-v2.mjs`、`scripts/execution-authority-v2.nodetest.mjs`、`.harness/wiki/execution-authority-v2.md`。
- 状态 / 数据变化：实现与本地全量验证完成。
- 验证命令与证据：authority v2 node tests。
- 回滚边界：单提交回滚，不改 manifest 或批准事实。
- 完成定义：严格正例通过，所有反例拒绝。

## 任务 3：合入并复验 EXT

- 目标：经 Gitee PR 合入唯一 EXT 主线并恢复全部门禁绿色。
- 前置条件：任务 2 全量验证通过。
- 输入：独立治理修复提交。
- 输出：远端 EXT 最终提交、本地同步和 CI 摘要。
- 涉及文件：本 change 记录的 CI 摘要。
- 状态 / 数据变化：本地门禁完成，等待提交、Gitee PR 与合并后复验。
- 验证命令与证据：authority/Doctor/backend Doctor/diff checks。
- 回滚边界：Gitee revert 修复提交。
- 完成定义：Gitee 合入完成，远端与本地一致，Doctor 无错误。
