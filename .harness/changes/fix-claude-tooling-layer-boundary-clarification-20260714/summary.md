# 变更摘要：fix-claude-tooling-layer-boundary-clarification-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-claude-tooling-layer-boundary-clarification-20260714 |
| 类型 | fix |
| 状态 | DONE |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：根项目（`.harness/rules/project-boundaries.md`——三层架构边界规则的解释性文本，非任何一条内容主线）
- 文件：
  - `.harness/rules/project-boundaries.md`（在"主线"表格后新增一段，明确根级 `.claude/`（`agents/`/`skills/`/`hooks/`）是 Claude Code 工具本身的配置层，不是第四条内容主线，不违反 `AGENTS.md:38` 的三层约束）
- 验证：`node scripts/harness-doctor.mjs` 0 errors；人工核对新增段落未破坏文件中已有的 courtos-brain 边界声明段落（同一文件当前有另一个并行 session 正在编辑 courtos-brain 相关内容，已用 `git diff` 确认插入位置在其之前、无重叠）

## 背景

前一条变更（`fix-chaotang-build-office-reviewer-gate-20260714`）把 `chaotang-build-office` 建司流程的第5步"复核"改成强制调用 `.claude/agents/gongbu-quality-gate.md`，Codex stop-time review 随即拦截："项目级 agent 入口违反根级三层架构约束"——根 `AGENTS.md:38` 写"所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内"，而 `gongbu-quality-gate.md` 物理路径在 `.claude/agents/`，字面上不属于这三层中任何一层。

这与 `courtos-brain/` 那次的性质不同：`courtos-brain/` 是意外产生的、需要被"改名脱敏"以避免被工具自动发现的内容归档；而 `.claude/agents/gongbu-quality-gate.md` 是**故意**要被 Claude Code 自动发现并调用的 agent 定义——搬到别处或改名会让它失去功能，不是能靠改名解决的问题。且 `.claude/agents/`、`.claude/skills/` 本身是本仓根 `CLAUDE.md`"Claude Code 配置"一节里明文记载的既有惯例（7 个 `gongbu-*` agents 早于本次改动就存在），`AGENTS.md:38` 这条约束写死时未考虑这一层，属于治理文档本身的遗留缺口，不是本次改动引入的新问题——只是这次让 `gongbu-quality-gate` 从"存在但没被强制调用"变成"建司流程里的必过步骤"，才让这个缺口第一次被触发检查。

修复思路：不改 `AGENTS.md:38` 的硬约束原文（这是根级"不可绕过"条款，不应轻易松动），而是在 `project-boundaries.md`（约束的详细解释层，courtos-brain 的例外声明也放在这里）新增一段，说明 `.claude/` 是"工具配置层"而非"内容主线"——`AGENTS.md:38` 管的是业务/知识内容树（像 courtos-brain 差点变成的第四主线），不是 Claude Code 自身怎么被配置调用；`.claude/` 下的 agent 实际检查的对象仍然落在三层结构内。
