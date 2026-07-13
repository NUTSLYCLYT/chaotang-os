# 任务：fix-claude-tooling-layer-boundary-clarification-20260714

## 任务 1

- 目标：修正 Codex stop-time review 拦截的"项目级 agent 入口违反根级三层架构约束"
- 前置条件：`fix-chaotang-build-office-reviewer-gate-20260714` 把 `.claude/agents/gongbu-quality-gate.md` 变成建司流程的强制步骤，触发对 `AGENTS.md:38` 三层约束的字面检查
- 输入：`AGENTS.md:38` 原文、根 `CLAUDE.md`"Claude Code 配置"一节、`.harness/rules/project-boundaries.md` 既有 courtos-brain 例外声明先例
- 输出：`project-boundaries.md` 主线表格后新增一段，论证 `.claude/` 是工具配置层（不持有业务逻辑/运行时状态）、不是内容主线，因此不违反 `AGENTS.md:38`；不修改 `AGENTS.md:38` 原文
- 涉及文件：`.harness/rules/project-boundaries.md`
- 状态 / 数据变化：纯文档编辑，无运行时状态变化，不改变 `harness-doctor.mjs` 校验逻辑
- 验证命令与证据：`node scripts/harness-doctor.mjs` → `0 errors, 0 warning(s)`；`git diff --stat -- .harness/rules/project-boundaries.md` → `1 file changed, 17 insertions(+)`（含本次新增段落，插入位置在并行session的courtos-brain段落之前，人工通读确认无重叠/无重复）
- 回滚边界：手动删除新增段落（第11行，首尾有空行分隔，边界清晰），不影响文件其余内容，包括并行session的在制品
- 完成定义：`node scripts/harness-doctor.mjs` 0 errors；变更记录四文件填写完整
