# CI 摘要：fix-claude-tooling-layer-boundary-clarification-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warning(s)` | 根级护栏一致性，含新变更记录识别 | 本会话实测 |
| `git diff --stat -- .harness/rules/project-boundaries.md` | 0 | `1 file changed, 17 insertions(+)` | 确认改动范围；该数字是本次新增段落与并行session此前未提交的courtos-brain改动的**合计**（两者共享同一未提交工作树文件），非本次单独贡献的行数 | 本会话实测 |
| `grep -n "\.claude/" AGENTS.md CLAUDE.md` | 0 | 确认根 `CLAUDE.md` 已有"Claude Code 配置"段落记载 `.claude/agents/`、`.claude/skills/`、`.claude/hooks/` 为既有惯例 | 论证依据来源核实 | 本会话实测 |
| 人工通读 `.harness/rules/project-boundaries.md` 全文 | 不适用 | 新增段落（第11行）与既有courtos-brain段落（第13行起）之间有清晰空行分隔，无文本重叠、无重复、无截断 | 文档完整性 | 本会话实测 |

## 结果

在 `project-boundaries.md` 新增一段解释性文字，明确根级 `.claude/`（agents/skills/hooks）是 Claude Code 工具本身的配置层，其判定豁免前提是"不持有业务逻辑、不持有运行时状态"，不是无条件豁免。未修改 `AGENTS.md:38` 原文（根级"不可绕过"条款保持不变），未新增任何自动化校验逻辑。与同文件内另一个并行 session 正在进行的 courtos-brain 相关未提交编辑无文本冲突。

## 未验证项

- 未对"是否还有其他类似 `.claude/` 的、字面不在三层结构内但实际合法的工具配置路径"做全仓排查（如 `.codex/`、`.superpowers/`）——本次范围只解决当前被 Codex 拦截的具体问题，不做预防性穷举。
- 未与另一个并行 session 直接协调确认其 courtos-brain 编辑的最终提交计划——已通过 `git diff` 静态核实当前无文本冲突，但如果对方后续对同一文件做大范围重排，理论上仍可能与本次插入位置产生冲突，需要提交前再次核对。
- 六部命名体系冲突（ministry-bridge/"libu"命名）不在本次验证范围内，见 `spec.md` 非目标。

## Diff 与回滚复核

- changed files：`.harness/rules/project-boundaries.md`（本次实际贡献第11行一段；同文件另有并行session未提交的courtos-brain相关改动，不属于本变更范围）
- diff review：已人工通读全文确认新增段落边界清晰、与前后文无重叠
- 回滚是否演练：未实际执行回滚演练（本变更风险低、边界清晰，认为不需要）；理论回滚路径为删除新增段落对应的单一段落文本

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第1行 | 已达成 |
| 新增段落不与并行session内容冲突 | 命令表第4行，人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份（summary/spec/tasks）已同步填写 | 已达成 |
| 未修改 `AGENTS.md:38` 原文 | 未对 `AGENTS.md` 做任何 Edit 调用 | 已达成 |

## 声明状态

- `VERIFIED_COMPLETE`：本次声明范围（`.claude/` 工具层边界解释性补充）已实测验证完整，无遗留空模板。提交时需只 `git add` 本次实际贡献的这一部分，不应把并行session未完成的courtos-brain改动一并提交——该部分归属另一变更，不属于本记录声明范围。
