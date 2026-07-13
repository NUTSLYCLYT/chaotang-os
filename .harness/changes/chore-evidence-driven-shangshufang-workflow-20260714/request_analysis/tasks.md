# 任务：chore-evidence-driven-shangshufang-workflow-20260714

## 任务 1

- 目标：把证据驱动开发协议写入根 harness 与 change 模板。
- 前置条件：根 AGENTS、项目边界、架构清单和核心技巧已读；baseline doctor 通过。
- 输入：现有 `.harness/rules/project-workflow.md` 与 change 模板。
- 输出：协议、规格/任务/CI 证据字段。
- 涉及文件：`.harness/rules/project-workflow.md`、`.harness/templates/change-template/**`。
- 状态 / 数据变化：仅文档和模板；无运行时数据变化。
- 验证命令与证据：`node scripts/harness-doctor.mjs`；`rg` 字段检查。
- 回滚边界：可按文件回滚新增段落，不影响运行时。
- 完成定义：doctor 通过且模板包含规定字段。

## 任务 2

- 目标：形成上书房到蜂群的可执行分阶段蓝图。
- 前置条件：正式链路、旧链路、模型、worker、状态投影和前端消费逻辑已有代码证据。
- 输入：代码调查结果与现有 `docs-chancellor-junjichu-orchestration-design-20260713`。
- 输出：本 change 下 `blueprint.md`。
- 涉及文件：仅本 change 记录。
- 状态 / 数据变化：无。
- 验证命令与证据：逐项核对依赖、文件、验证、回滚；对抗审查。
- 回滚边界：删除蓝图不影响运行时。
- 完成定义：每一步可由新会话独立执行，且 100% DoD 可客观取证。
