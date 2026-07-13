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
- 完成定义：`node scripts/harness-doctor.mjs` 0 errors；变更记录四文件填写完整（**未通过**，见任务2、任务3）

## 任务 2（补充：Codex stop-time review 第二次拦截，两个问题合并处理）

### 2a：新门禁仍可能漏报

- 目标：修正 `gongbu-quality-gate.md` 里 roster/引擎接线检查规则残留的两个漏报口子
- 前置条件：
  1. 规则第1步"roster不在knip unused files列表里"被当作"roster已接线"的充分条件——但knip的entry配置把`**/*.nodetest.ts`当合法入口，roster若只被某个测试文件（不一定是它自己名字对应的）import，knip也不会报unused，"不在unused列表"因此只是初筛，不是终审
  2. 规则第3步排除自测试的写法只写"排除该引擎自己的`<司>-review.nodetest.ts`"——没排除**其他**司/模块的测试文件顺手import了它的情况（比如一个跨司集成测试一次性import 5个引擎）
  3. 曾尝试用 `knip --production` 替代手动排除测试文件的逻辑——实测这个仓库配置下 `--production` 直接把 unused-files 报告清零（0行），比不开更瞎，已放弃
- 输入：`pnpm knip --files --production` 实测结果（0行输出，两次复现一致）
- 输出：`gongbu-quality-gate.md` 检查规则改为：① 明确"roster不在unused列表"只是初筛，不是终审；② 排除测试文件的范围从"这个引擎自己的nodetest"扩大为"任何`*.nodetest.ts`/`e2e/**/*.spec.ts`，不论是不是这个引擎自己的"；③ 记录`--production`在本仓不可用及其现象，防止未来审查者踩同样的坑
- 涉及文件：`.claude/agents/gongbu-quality-gate.md`
- 状态 / 数据变化：无
- 验证命令与证据：`cd frontend && pnpm knip --files --production` → stdout 只有 pnpm 脚本头两行，无任何 unused files 条目，确认此路不通；`node scripts/harness-doctor.mjs` → 0 errors
- 回滚边界：`git checkout`
- 完成定义：规则文本不再有"仅凭knip初筛结论"或"仅排除同名nodetest"这类过窄表述

### 2b：边界说明与根级硬约束冲突

- 目标：修正 `AGENTS.md:38` 用绝对语气写"所有…必须…"，而 `project-boundaries.md` 声称`.claude/`例外，两份文档字面矛盾、互不指涉的问题
- 前置条件：任务1只改了 `project-boundaries.md`，刻意不改 `AGENTS.md:38` 原文（当时判断是"不可绕过"条款不应轻易松动）——但结果是留下一条看起来绝对、实际有隐藏例外的规则，读者只看`AGENTS.md`会误判`.claude/agents/`违规
- 输入：`AGENTS.md` 现有"启动顺序"第2步已经要求读者去读`project-boundaries.md`，说明该文件本来就是`AGENTS.md`规则的详细解释层，不是外部覆盖
- 输出：`AGENTS.md:38` 原句后追加括号说明——明确该约束管"内容/所有权主线"，`.claude/`因不持有业务逻辑/运行时状态不算第四主线，并指向`project-boundaries.md`获取精确定义。不改变约束的实质范围（三条内容主线仍然是三条），只是让两份文档不再字面矛盾
- 涉及文件：`AGENTS.md`
- 状态 / 数据变化：无
- 验证命令与证据：`node scripts/harness-doctor.mjs` → 0 errors；`grep -n "内容/所有权主线\|不算第四条主线\|不是第四条内容主线" AGENTS.md .harness/rules/project-boundaries.md` 确认两文件措辞互相呼应、无矛盾
- 回滚边界：`git checkout AGENTS.md`
- 完成定义：`AGENTS.md:38` 与 `project-boundaries.md` 对同一问题的表述互相印证，不再需要"猜哪份文档说了算"
