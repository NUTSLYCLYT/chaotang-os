# 任务：docs-claude-code-specific-rules-20260714

## 任务 1

- 目标：把用户提供的5条 Claude Code 操作规则加入根 `AGENTS.md`
- 前置条件：`AGENTS.md` 当前干净（`git status --short -- AGENTS.md` 无输出），未处于任何并行session的合并冲突中
- 输入：用户在对话中给出的规则原文（复杂任务先Plan mode / 规划阶段不改文件 / 审查只审查不重写 / 调研大模块用子代理主会话只留结论 / 范围外问题记录不顺手修）
- 输出：`AGENTS.md` 末尾新增"## Claude Code specific rules"一节，5条原样收录
- 涉及文件：`AGENTS.md`
- 状态 / 数据变化：纯文档编辑，无运行时状态变化
- 验证命令与证据：`node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`；人工通读确认新增章节与既有"不可绕过"条款无冲突、格式一致
- 回滚边界：`git checkout AGENTS.md`
- 完成定义：`harness-doctor.mjs` 0 errors；变更记录四文件填写完整
