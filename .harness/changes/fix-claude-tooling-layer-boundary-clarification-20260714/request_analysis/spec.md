# 规格说明：fix-claude-tooling-layer-boundary-clarification-20260714

## 背景

前一条变更 `fix-chaotang-build-office-reviewer-gate-20260714` 把 `chaotang-build-office` 建司流程的第5步改成强制调用 `.claude/agents/gongbu-quality-gate.md`。提交后 Codex stop-time review 拦截："项目级 agent 入口违反根级三层架构约束"——根 `AGENTS.md:38` 写"所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内"，`gongbu-quality-gate.md` 物理路径 `.claude/agents/` 字面上不在这三层任何一层里。

与 `courtos-brain/` 那次不同：那是意外产生、需要"改名脱敏"避免被工具自动发现的内容归档；`.claude/agents/gongbu-quality-gate.md` 是**故意**要被 Claude Code 发现调用的 agent 定义，改名/搬移会让它失效。`.claude/agents/`、`.claude/skills/` 本身是根 `CLAUDE.md`"Claude Code 配置"一节记载的既有惯例（7 个 `gongbu-*` agents 早于本次改动就存在）——`AGENTS.md:38` 写死时未考虑这一层，是治理文档的遗留缺口，这次只是第一次让它被触发检查（因为 `gongbu-quality-gate` 从"存在但未被强制调用"变成"建司流程必过步骤"）。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 根 `CLAUDE.md`"Claude Code 配置"一节明文记载 `.claude/agents/`（7个gongbu-* agents）、`.claude/skills/`、`.claude/hooks/` 为既有惯例 | `CLAUDE.md` "## Claude Code 配置" 段落 | 已验证（人工读取） | 否 |
| 已确认事实 | `AGENTS.md:38` 原文只字面提及 frontend/backend/根.harness 三层，未提及 `.claude/` | `grep -n "不可绕过" -A 10 AGENTS.md` | 已验证 | 否 |
| 已确认事实 | `.harness/rules/project-boundaries.md` 是 `AGENTS.md` 硬约束的详细解释层，`courtos-brain/` 的例外声明先例也放在此文件 | 该文件第11行起既有 courtos-brain 段落 | 已验证 | 否 |
| 已确认事实 | 该文件当前有另一个并行 session 正在编辑 courtos-brain 相关内容（未提交），本次新增段落插入位置在其之前，未产生文本重叠 | `git diff --stat -- .harness/rules/project-boundaries.md` 显示单文件17行新增，人工核对无重复/截断 | 已验证 | 否——但提交时只 `git add` 本次新增的这一段所在提交范围需要人工核实，见"验证计划" |
| 推测 | `AGENTS.md:38` 写死时的原意是防止出现"第二条内容/知识主线"（如 courtos-brain 差点变成的那样），不是要禁止 Claude Code 自身的工具配置目录 | 基于对 courtos-brain 那次 change 记录的背景推断 | 无法100%确认原作者意图，但与"不可绕过"条款上下文（另外三条都在管内容/证据边界）一致 | 否 |
| 未知问题 | 是否还有其他 `.claude/` 之外的、同样未被 `AGENTS.md:38` 字面覆盖但实际合法的 Claude Code 工具配置路径（如项目根的 `.codex/`、`.superpowers/`） | 未逐一核查 | 待后续需要时再核查，本次不阻塞 | 否 |

## 数据流与调用链

无运行时数据流影响——本变更只在 `.harness/rules/project-boundaries.md` 追加一段解释性文档，不改变任何代码路径、不改变 `harness-doctor.mjs` 的校验逻辑（`.claude/` 从未被该脚本的 courtos-brain 边界扫描或任何其他校验规则处理过，本次也不新增对 `.claude/` 的自动化校验）。

## 接口、数据结构与事实源

无新增契约。本变更是对已有约束（`AGENTS.md:38`）的解释性补充，不修改约束本身的文本。

## 范围

- `.harness/rules/project-boundaries.md`：在"主线"表格与 courtos-brain 段落之间插入一段，说明根级 `.claude/` 是 Claude Code 工具配置层，不是第四条内容主线。
- 本目录变更记录（summary/spec/tasks/ci_result）。

## 非目标

- 不修改 `AGENTS.md:38` 原文——这是根级"不可绕过"条款，不应轻易松动措辞，只在详细解释层（project-boundaries.md）补充适用范围。
- 不新增 `harness-doctor.mjs` 对 `.claude/` 目录的自动化校验——`.claude/` 不持有业务逻辑/运行时状态，不需要像 `courtos-brain/` 那样的符号链接/目录段/文件名扫描。
- 不处理另一个并行 session 正在编辑的 courtos-brain 相关内容——那是对方的在制品，本次只保证自己的新增段落不与其冲突。
- 不涉及六部命名体系冲突（ministry-bridge/"libu"命名）——独立未决事项，不在本次范围。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| `.claude/` 下的 agent/skill 定义文件本身 | 不算违反 `AGENTS.md:38`，因为它们不持有业务逻辑，只是配置 | 本次新增段落的核心论证 |
| 若未来有人往 `.claude/` 下塞入实际业务逻辑代码或运行时状态 | 那时会真正违反三层约束，需要重新审视，不在本次豁免范围内 | 本次未做自动化检测，留待未来触发时处理 |

## 风险与回滚边界

- 风险：给"三层约束"开了一个解释性口子，未来可能被滥用为"任何东西塞进 `.claude/` 都不算违规"——已在新增段落里明确限定"不持有业务逻辑、不持有运行时状态"作为豁免前提，不是无条件豁免。
- 风险：与并行 session 编辑同一文件——已用 `git diff --stat` 核实无文本重叠，但提交前需要人工确认 diff 范围只包含自己这一段。
- 回滚边界：`git diff` 后手动移除新增的这一段落即可，不影响文件其余内容（本变更的插入位置和内容边界清晰，段落首尾有明确的空行分隔）。

## 计划确认记录

- 批准人：用户在对话中要求"把成果整合进ext分支"，隐含要求先解决 Codex 拦截的问题才能视为完成整合。
- 批准日期：2026-07-14
- 批准范围：仅本次 `.claude/` 边界解释性补充；不包含六部命名体系的更大范围整合（用户随后被要求先确认范围，见对话）。
- 明确未批准：`AGENTS.md:38` 原文修改、`harness-doctor.mjs` 新增自动化校验、ministry-bridge 相关工作。

## 验收标准

- `node scripts/harness-doctor.mjs` 0 errors。
- 新增段落与既有 courtos-brain 段落无文本重叠、无重复、无截断（人工核对）。
- 本目录四个变更记录文件填写完整，无"待填写"占位符残留。

## 验证计划

- `node scripts/harness-doctor.mjs`
- `git diff --stat -- .harness/rules/project-boundaries.md`（确认改动范围）
- 人工通读整份 `project-boundaries.md`，确认新增段落与原有内容（含并行session的courtos-brain段落）都完整、不冲突
