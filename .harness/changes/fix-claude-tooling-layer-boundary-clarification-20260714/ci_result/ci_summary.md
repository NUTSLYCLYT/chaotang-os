# CI 摘要：fix-claude-tooling-layer-boundary-clarification-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node scripts/harness-doctor.mjs` | 0 | `0 errors, 0 warning(s)` | 根级护栏一致性，含新变更记录识别 | 本会话实测 |
| `git diff --stat -- .harness/rules/project-boundaries.md` | 0 | `1 file changed, 17 insertions(+)` | 确认改动范围；该数字是本次新增段落与并行session此前未提交的courtos-brain改动的**合计**（两者共享同一未提交工作树文件），非本次单独贡献的行数 | 本会话实测 |
| `grep -n "\.claude/" AGENTS.md CLAUDE.md` | 0 | 确认根 `CLAUDE.md` 已有"Claude Code 配置"段落记载 `.claude/agents/`、`.claude/skills/`、`.claude/hooks/` 为既有惯例 | 论证依据来源核实 | 本会话实测 |
| 人工通读 `.harness/rules/project-boundaries.md` 全文 | 不适用 | 新增段落（第11行）与既有courtos-brain段落（第13行起）之间有清晰空行分隔，无文本重叠、无重复、无截断 | 文档完整性 | 本会话实测 |
| `cd frontend && pnpm knip --files --production` | 0 | 无任何 unused files 条目输出（只有 pnpm 脚本头两行）——确认该参数在本仓配置下不可用，退出码为0但无实质信号，比不加更不可靠 | 验证第二轮"新门禁仍可能漏报"里对 `--production` 的排除结论 | 本会话实测，复现2次一致 |
| `grep -n "内容/所有权主线\|不算第四条主线\|不是第四条内容主线" AGENTS.md .harness/rules/project-boundaries.md` | 0 | 两文件均命中，措辞互相呼应 | `AGENTS.md:38` 与 `project-boundaries.md` 不再字面矛盾 | 本会话实测 |
| `node scripts/harness-doctor.mjs`（`AGENTS.md`/`gongbu-quality-gate.md` 编辑后复跑） | 0 | `0 errors, 0 warning(s)` | 确认第二轮改动未破坏根级护栏一致性 | 本会话实测 |

## 结果

在 `project-boundaries.md` 新增一段解释性文字，明确根级 `.claude/`（agents/skills/hooks）是 Claude Code 工具本身的配置层，其判定豁免前提是"不持有业务逻辑、不持有运行时状态"，不是无条件豁免。**第二轮**：`AGENTS.md:38` 原文追加括号说明+指针（不改变三条内容主线的实质要求，只消除与 `project-boundaries.md` 的字面矛盾）；`gongbu-quality-gate.md` 的 roster/引擎接线检查规则收窄两处漏报口子（knip初筛不是终审、排除测试文件范围扩大到所有测试文件）；`knip --production` 经实测确认在本仓不可用并记录在案。与同文件内另一个并行 session 正在进行的 courtos-brain 相关未提交编辑无文本冲突。

## 未验证项

- 未对"是否还有其他类似 `.claude/` 的、字面不在三层结构内但实际合法的工具配置路径"做全仓排查（如 `.codex/`、`.superpowers/`）——本次范围只解决当前被 Codex 拦截的具体问题，不做预防性穷举。
- 未与另一个并行 session 直接协调确认其 courtos-brain 编辑的最终提交计划——已通过 `git diff` 静态核实当前无文本冲突，但如果对方后续对同一文件做大范围重排，理论上仍可能与本次插入位置产生冲突，需要提交前再次核对。
- `knip --production` 在本仓不可用的根本原因未查清（可能与 `knip.json` 显式声明的稀疏 entry 列表和 `--production` 内部逻辑的交互有关）——已确认现象可复现，但只记录"不可用"结论，未深挖 knip 内部实现。
- 六部命名体系冲突（ministry-bridge/"libu"命名）不在本次验证范围内，见 `spec.md` 非目标。

## Diff 与回滚复核

- changed files：`.harness/rules/project-boundaries.md`（本次实际贡献第11行一段；同文件另有并行session未提交的courtos-brain相关改动，不属于本变更范围）、`AGENTS.md`（第38行追加括号说明）、`.claude/agents/gongbu-quality-gate.md`（roster检查规则收窄）
- diff review：已人工通读全文确认新增段落边界清晰、与前后文无重叠
- 回滚是否演练：未实际执行回滚演练（本变更风险低、边界清晰，认为不需要）；理论回滚路径为删除新增段落对应的单一段落文本，`AGENTS.md`/`gongbu-quality-gate.md` 同理用 `git checkout` 单独还原

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第1、7行 | 已达成 |
| 新增段落不与并行session内容冲突 | 命令表第4行，人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份（summary/spec/tasks）已同步填写 | 已达成 |
| `AGENTS.md:38` 与 `project-boundaries.md` 不再字面矛盾 | 命令表第6行 | 已达成（第一版"未修改AGENTS.md原文"的判断已被第二轮推翻并订正） |
| roster检查规则不再漏报"仅测试可达"和"仅knip初筛" | `gongbu-quality-gate.md` 文本比对；`knip --production` 排除结论见命令表第5行 | 已达成 |

## 声明状态

- `VERIFIED_COMPLETE`：本次声明范围（`.claude/` 工具层边界解释性补充，含第二轮的 `AGENTS.md` 措辞对齐 + roster检查规则收窄）已实测验证完整，无遗留空模板。提交时需只 `git add` 本次实际贡献的部分（`project-boundaries.md`的对应段落、`AGENTS.md`、`gongbu-quality-gate.md`、本变更记录目录），不应把并行session未完成的courtos-brain改动一并提交——该部分归属另一变更，不属于本记录声明范围。
