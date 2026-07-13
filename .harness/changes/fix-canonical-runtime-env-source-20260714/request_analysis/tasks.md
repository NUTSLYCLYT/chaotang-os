# 任务：fix-canonical-runtime-env-source-20260714

## 任务 1：冻结唯一自动环境来源

- 目标：三个运行消费者不再自动读取 monorepo 外的旧后端 `.env`。
- 前置条件：S1 真源已冻结，旧路径列表已确认。
- 输入：三个候选列表。
- 输出：先失败的 source contract。
- 涉及文件：`frontend/scripts/runtime-env-source-contract.nodetest.mjs`。
- 状态 / 数据变化：无。
- 验证命令与证据：首轮 3 failed。
- 回滚边界：删除测试会失去回归门。
- 完成定义：RED 分别命中三个消费者。

## 任务 2：最小实现与验证

- 目标：显式 override + canonical backend 默认。
- 前置条件：任务 1 RED。
- 输入：现有 parser/不覆盖规则。
- 输出：三处候选列表收敛。
- 涉及文件：Next wrapper、prod release gate、shared LLM env。
- 状态 / 数据变化：仅运行时读取候选变化；不写 secret。
- 验证命令与证据：专项 3/3、S1 联合、type/build、doctor。
- 回滚边界：整体 revert 单提交。
- 完成定义：构建通过且 prod STOP 边界不变。
