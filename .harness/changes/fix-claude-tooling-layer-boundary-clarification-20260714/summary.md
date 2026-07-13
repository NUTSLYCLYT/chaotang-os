# 变更摘要：fix-claude-tooling-layer-boundary-clarification-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-claude-tooling-layer-boundary-clarification-20260714 |
| 类型 | fix |
| 状态 | DONE |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：根项目（`AGENTS.md`"不可绕过"条款 + `.harness/rules/project-boundaries.md`——三层架构边界规则本身，非任何一条内容主线）
- 文件：
  - `.harness/rules/project-boundaries.md`（在"主线"表格后新增一段，明确根级 `.claude/`（`agents/`/`skills/`/`hooks/`）是 Claude Code 工具本身的配置层，不是第四条内容主线，不违反 `AGENTS.md:38` 的三层约束）
  - `AGENTS.md`（第38行追加括号说明，明确该约束管"内容/所有权主线"、`.claude/`不算第四主线，并指向 `project-boundaries.md` 的精确定义，消除两份文档字面矛盾）
  - `.claude/agents/gongbu-quality-gate.md`（roster/引擎接线检查规则收窄两处漏报口子：knip"不在unused列表"只是初筛非终审；排除测试文件范围从"引擎自己的nodetest"扩大到"任何测试文件"；记录`knip --production`在本仓不可用）
- 验证：`node scripts/harness-doctor.mjs` 0 errors；`pnpm knip --files --production` 实测确认该参数不可用（0行输出，退出码0但无信号）；`grep` 确认 `AGENTS.md`/`project-boundaries.md` 措辞互相呼应

## 背景

前一条变更（`fix-chaotang-build-office-reviewer-gate-20260714`）把 `chaotang-build-office` 建司流程的第5步"复核"改成强制调用 `.claude/agents/gongbu-quality-gate.md`，Codex stop-time review 随即拦截："项目级 agent 入口违反根级三层架构约束"——根 `AGENTS.md:38` 写"所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内"，而 `gongbu-quality-gate.md` 物理路径在 `.claude/agents/`，字面上不属于这三层中任何一层。

这与 `courtos-brain/` 那次的性质不同：`courtos-brain/` 是意外产生的、需要被"改名脱敏"以避免被工具自动发现的内容归档；而 `.claude/agents/gongbu-quality-gate.md` 是**故意**要被 Claude Code 自动发现并调用的 agent 定义——搬到别处或改名会让它失去功能，不是能靠改名解决的问题。且 `.claude/agents/`、`.claude/skills/` 本身是本仓根 `CLAUDE.md`"Claude Code 配置"一节里明文记载的既有惯例（7 个 `gongbu-*` agents 早于本次改动就存在），`AGENTS.md:38` 这条约束写死时未考虑这一层，属于治理文档本身的遗留缺口，不是本次改动引入的新问题——只是这次让 `gongbu-quality-gate` 从"存在但没被强制调用"变成"建司流程里的必过步骤"，才让这个缺口第一次被触发检查。

修复思路（第一版）：不改 `AGENTS.md:38` 的硬约束原文（这是根级"不可绕过"条款，不应轻易松动），而是在 `project-boundaries.md`（约束的详细解释层，courtos-brain 的例外声明也放在这里）新增一段，说明 `.claude/` 是"工具配置层"而非"内容主线"——`AGENTS.md:38` 管的是业务/知识内容树（像 courtos-brain 差点变成的第四主线），不是 Claude Code 自身怎么被配置调用；`.claude/` 下的 agent 实际检查的对象仍然落在三层结构内。

Codex stop-time review 第二次拦截，两个问题：

1. **新门禁仍可能漏报**：`gongbu-quality-gate.md` 的roster/引擎检查规则里，"roster不在knip unused files列表里"被当成"已接线"的充分条件，但knip把测试文件当合法入口，"不在unused列表"其实只是初筛；排除测试文件的写法也只排了"引擎自己的nodetest"，没排"别的模块的测试文件顺手import了它"。修复：明确初筛不是终审，排除范围扩大到任何测试文件。曾尝试用 `knip --production` 一次性解决（该参数按文档描述应该是"只看生产可达性，不算测试"），但实测这个仓库的knip配置下 `--production` 直接让 unused-files 报告清零（0行输出，退出码仍是0），比不加还瞎，已放弃并记录在案，防止未来审查者重蹈覆辙。

2. **边界说明与根级硬约束冲突**：第一版只改了 `project-boundaries.md`，`AGENTS.md:38` 原文仍是无条件的"所有…必须…"，两份文档字面矛盾、互不指涉——只读 `AGENTS.md` 的人会误判 `.claude/agents/` 违规。修复：`AGENTS.md:38` 追加括号说明 + 指向 `project-boundaries.md` 的指针，不改变约束的实质范围（三条内容主线不变），只是让两份文档不再看起来互相打架。
