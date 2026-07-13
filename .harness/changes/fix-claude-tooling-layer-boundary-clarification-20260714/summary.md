# 变更摘要：fix-claude-tooling-layer-boundary-clarification-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-claude-tooling-layer-boundary-clarification-20260714 |
| 类型 | fix |
| 状态 | DONE（第六轮根治knip脚本glob问题，四profile功能等价性逐一验证，`harness-doctor` 0 errors） |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：根项目（`AGENTS.md`"不可绕过"条款 + `.harness/rules/project-boundaries.md`——三层架构边界规则本身，非任何一条内容主线）
- 文件：
  - `.harness/rules/project-boundaries.md`（在"主线"表格后新增一段，明确根级 `.claude/`（`agents/`/`skills/`/`hooks/`）是 Claude Code 工具本身的配置层，不是第四条内容主线，不违反 `AGENTS.md:38` 的三层约束）
  - `AGENTS.md`（第38行追加括号说明，明确该约束管"内容/所有权主线"、`.claude/`不算第四主线，并指向 `project-boundaries.md` 的精确定义，消除两份文档字面矛盾）
  - `.claude/agents/gongbu-quality-gate.md`（roster/引擎接线检查规则前两轮收窄两处漏报口子后，第三轮整条替换为调用 `pnpm knip:reachability` 的全图可达性分析，不再用手搓多跳grep）
  - `frontend/knip.production-reachability.json`（新增：`knip.json` 去掉测试entry的变体，专供该检查使用）
  - `frontend/package.json`（新增 `"knip:reachability"` 脚本；第六轮把 `test:node`/`test:core`/`eval:court`/`test:courtos:mvp-api` 四条脚本的字面量glob改为调用 `run-nodetest.mjs <profile>`）
  - `frontend/scripts/run-nodetest.mjs`（第六轮新增：按profile在脚本内部用`globSync`展开测试文件glob，取代package.json里的字面量glob字符串）
- 验证：`node scripts/harness-doctor.mjs` 0 errors；`cd frontend && pnpm exec tsc --noEmit` 0 错误；`pnpm knip:reachability` 585行输出且2次复现一致，吏部5个孤儿引擎+各自nodetest均在列，礼部真实接线的3个文件均不在列；`pnpm knip --files --production` 确认该参数不可用（0行输出，退出码0但无信号，与`knip:reachability`是两个不同机制，不要混淆）；`grep` 确认 `AGENTS.md`/`project-boundaries.md` 措辞互相呼应

## 背景

前一条变更（`fix-chaotang-build-office-reviewer-gate-20260714`）把 `chaotang-build-office` 建司流程的第5步"复核"改成强制调用 `.claude/agents/gongbu-quality-gate.md`，Codex stop-time review 随即拦截："项目级 agent 入口违反根级三层架构约束"——根 `AGENTS.md:38` 写"所有 agent 工作入口必须落在 `frontend/`、`backend/` 和根 `.harness/` 三层结构内"，而 `gongbu-quality-gate.md` 物理路径在 `.claude/agents/`，字面上不属于这三层中任何一层。

这与 `courtos-brain/` 那次的性质不同：`courtos-brain/` 是意外产生的、需要被"改名脱敏"以避免被工具自动发现的内容归档；而 `.claude/agents/gongbu-quality-gate.md` 是**故意**要被 Claude Code 自动发现并调用的 agent 定义——搬到别处或改名会让它失去功能，不是能靠改名解决的问题。且 `.claude/agents/`、`.claude/skills/` 本身是本仓根 `CLAUDE.md`"Claude Code 配置"一节里明文记载的既有惯例（7 个 `gongbu-*` agents 早于本次改动就存在），`AGENTS.md:38` 这条约束写死时未考虑这一层，属于治理文档本身的遗留缺口，不是本次改动引入的新问题——只是这次让 `gongbu-quality-gate` 从"存在但没被强制调用"变成"建司流程里的必过步骤"，才让这个缺口第一次被触发检查。

修复思路（第一版）：不改 `AGENTS.md:38` 的硬约束原文（这是根级"不可绕过"条款，不应轻易松动），而是在 `project-boundaries.md`（约束的详细解释层，courtos-brain 的例外声明也放在这里）新增一段，说明 `.claude/` 是"工具配置层"而非"内容主线"——`AGENTS.md:38` 管的是业务/知识内容树（像 courtos-brain 差点变成的第四主线），不是 Claude Code 自身怎么被配置调用；`.claude/` 下的 agent 实际检查的对象仍然落在三层结构内。

Codex stop-time review 第二次拦截，两个问题：

1. **新门禁仍可能漏报**：`gongbu-quality-gate.md` 的roster/引擎检查规则里，"roster不在knip unused files列表里"被当成"已接线"的充分条件，但knip把测试文件当合法入口，"不在unused列表"其实只是初筛；排除测试文件的写法也只排了"引擎自己的nodetest"，没排"别的模块的测试文件顺手import了它"。修复：明确初筛不是终审，排除范围扩大到任何测试文件。曾尝试用 `knip --production` 一次性解决（该参数按文档描述应该是"只看生产可达性，不算测试"），但实测这个仓库的knip配置下 `--production` 直接让 unused-files 报告清零（0行输出，退出码仍是0），比不加还瞎，已放弃并记录在案，防止未来审查者重蹈覆辙。

2. **边界说明与根级硬约束冲突**：第一版只改了 `project-boundaries.md`，`AGENTS.md:38` 原文仍是无条件的"所有…必须…"，两份文档字面矛盾、互不指涉——只读 `AGENTS.md` 的人会误判 `.claude/agents/` 违规。修复：`AGENTS.md:38` 追加括号说明 + 指向 `project-boundaries.md` 的指针，不改变约束的实质范围（三条内容主线不变），只是让两份文档不再看起来互相打架。

Codex stop-time review 第三次拦截："仅测试可达"仍可经组件间接绕过门禁——第二版把"排除测试文件"限定在"直接import引擎的那一跳"，但如果引擎被一个真实 `.tsx` 组件 import（第二版规则认为这就算数），而这个组件本身只被某个e2e/spec文件单独mount渲染（测试专用挂载，从未被真实页面渲染），规则依然会误判"已接线"——因为检查只做了单跳判断，没有递归验证"import引擎的这个中间组件，它自己是不是也只能靠测试摸到"。

修复：放弃手搓的多跳grep链，改用 knip 自己的全图可达性分析解决——新建 `frontend/knip.production-reachability.json`（`knip.json` 去掉 `**/*.nodetest.ts`/`e2e/**/*.spec.ts` 两条测试entry的变体），配 `package.json` 新脚本 `pnpm knip:reachability`。knip 天生做的就是从声明的entry出发的全图可达性分析，去掉测试entry后，只要一个文件在任何一跳只能靠测试到达，不管中间隔了几层、中间是不是`.tsx`组件，都会被正确判定unused。实测585行（比默认knip.json的349行更完整），吏部5个孤儿引擎连同它们各自的nodetest文件一起被识别；反向验证礼部真实接线的`relationship-ledger-tab.tsx`/`LifuOfficeDesk`/`lifu-relationship.ts`均未被误判。

Codex stop-time review 第四次拦截："备用 Knip 配置并未真正排除测试入口"——用人造探针文件（只被一个e2e spec引用）实测发现：光从`entry`数组删掉`e2e/**/*.spec.ts`没用，探针依然被判"used"。用`--debug`查证：knip的Playwright插件侦测到`playwright.config.ts`后会自动注册`e2e/**/*.@(spec|test).*`为entry，完全不受自定义config的`entry`数组控制。修复：显式加`"playwright": false`禁用该插件，同一份探针重跑后正确变为unused。顺带发现一个已知残留缺口——`src/core/courtos/`下几个nodetest entry来自npm scripts里直写的glob，不是能关闭的"插件"，暂无干净解法，但范围不影响`src/features/<部>/`（本检查实际针对的office-kit roster），已记录在案。

本轮验证途中，另一并行session开始一次大范围harness架构合并（"unify chaotang harness architecture"），导致`frontend/scripts/harness-doctor.mjs`等多个文件当前带有未解决的合并冲突标记，`node scripts/harness-doctor.mjs`暂时无法运行（`SyntaxError: Unexpected token '<<'`）——已确认与本变更无关（我方5个目标文件均干净，不在冲突列表内），不属于本变更范围，改用`tsc --noEmit`+直接knip实测作为本轮验收依据。

Codex stop-time review 第五次拦截："生产可达性检查仍把测试文件注册为入口"——直接阅读`node_modules/knip/dist/WorkspaceWorker.js`/`manifest/helpers.js`源码查清机制：knip核心无条件解析package.json所有npm script命令行文本提取文件glob注册entry，不挂在任何可`"xxx":false`关闭的插件名下（`"node":false`实测无效）。精确核查`src/features/`范围内knip内置通用测试文件名模式（`.test.ts`/`test.ts`/`test-*.ts`/`test/`目录/`.itest.ts`）零命中，确认该缺口目前对office-kit范围零影响。`gongbu-quality-gate.md`把"某插件关不掉"订正为精确的机制层面描述+可验证的pattern清单+强制前置检查步骤。此轮`harness-doctor`已恢复可运行（对方合并已完成），0 errors。

Codex stop-time review 第六次拦截：仍判定第五轮"核心行为无法关闭"的归因是错的。用户拍板不再继续猜插件名，改为根治——新建`frontend/scripts/run-nodetest.mjs`，把`test:node`/`test:core`/`eval:court`/`test:courtos:mvp-api`四条脚本原本直接写在package.json里的glob字符串搬进脚本内部（用`node:fs`的`globSync`运行时展开），package.json侧只剩`"node scripts/run-nodetest.mjs <profile>"`这种不含文件路径字符的调用。knip自然无从提取这几条entry（`--debug`确认`entry:.*itest`/`entry:.*courtos.*nodetest`类目全部消失）。四个profile逐一实跑，通过/失败数与改动前的原始字面量写法完全一致，确认重构不影响任何测试的真实执行结果。`gongbu-quality-gate.md`从"已知残留缺口/无法关闭"改写为"已解决"，只保留一条与本仓脚本无关的knip自带通用测试命名约定说明。
