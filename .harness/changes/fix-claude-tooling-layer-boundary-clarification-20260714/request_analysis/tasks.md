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
- 完成定义：`AGENTS.md:38` 与 `project-boundaries.md` 对同一问题的表述互相印证，不再需要"猜哪份文档说了算"（**未通过**，见任务3）

## 任务 3（补充：Codex stop-time review 第三次拦截）

- 目标：修正"'仅测试可达'仍可经组件间接绕过门禁"
- 前置条件：任务2a的检查规则只做单跳判断——查引擎的直接import者，排除掉是测试文件的情况，剩下是`.tsx`组件就算数。但如果这个`.tsx`组件本身只被某个e2e/spec文件单独mount渲染（测试专用挂载场景），从未被真实页面渲染，规则不会递归验证这一层，会误判为"已接线"
- 输入：`frontend/knip.json`（entry含`**/*.nodetest.ts`/`e2e/**/*.spec.ts`）；knip 官方支持 `--config` 指定备用配置文件
- 输出：
  - 新建 `frontend/knip.production-reachability.json`：`knip.json`的变体，entry去掉两条测试相关的pattern，只保留`src/middleware.ts`/`next.config.ts`/`scripts/**/*.{ts,mjs,js}`（Next.js的`app/**/page.tsx`等由knip内置Next.js插件自动识别，不需要手动声明）
  - `frontend/package.json` 新增脚本 `"knip:reachability": "knip --config knip.production-reachability.json --files"`
  - `.claude/agents/gongbu-quality-gate.md` 的roster检查规则整条替换：不再手搓"查import者→排除测试文件类型→看是不是.tsx"这种单跳启发式，改成直接跑 `pnpm knip:reachability`，靠knip自己的全图可达性分析（从真实entry出发，不管中间隔几跳、中间是不是组件，只要某一跳只能靠测试到达就判unused）一次性给出终审结果
- 涉及文件：`frontend/knip.production-reachability.json`（新增）、`frontend/package.json`、`.claude/agents/gongbu-quality-gate.md`
- 状态 / 数据变化：新增一个开发期配置文件+脚本，不影响生产构建
- 验证命令与证据：
  - `pnpm exec knip --files --config knip.production-reachability.json` → 退出码1（有unused文件），585行，2次复现一致
  - 吏部5个孤儿引擎（`hiring-review.ts`等）及其各自`.nodetest.ts`均在列表中——确认能抓住"仅测试可达"（含引擎自己和中间组件两种情况）
  - 反向验证：礼部真实接线的`relationship-ledger-tab.tsx`/`LifuOfficeDesk`/`lifu-relationship.ts`均不在列表中——确认无误伤
  - `pnpm knip:reachability`（走package.json声明的脚本）→ 590行，同样包含`hiring-review.ts`/`libu-roster.ts`——确认脚本化调用与直接`--config`调用结果一致
  - `cd frontend && pnpm exec tsc --noEmit` → 0 错误
  - `node scripts/harness-doctor.mjs` → 0 errors
- 回滚边界：删除 `frontend/knip.production-reachability.json`，`git checkout frontend/package.json .claude/agents/gongbu-quality-gate.md`
- 完成定义：`gongbu-quality-gate.md` 的roster检查不再依赖手搓的单跳grep链，改用有真实entry声明、可复现的knip全图分析；`harness-doctor.mjs` 0 errors（**未通过**，见任务4）

## 任务 4（补充：Codex stop-time review 第四次拦截）

- 目标：修正"备用 Knip 配置并未真正排除测试入口"
- 前置条件：任务3只是把 `**/*.nodetest.ts`/`e2e/**/*.spec.ts` 从 `knip.production-reachability.json` 的 `entry` 数组里删掉，但用 `pnpm exec knip --debug` 查看实际生效的entry列表发现：knip 的 Playwright 插件会侦测仓库根的 `playwright.config.ts` 并自动注册 `entry:e2e/**/*.@(spec|test).?(c|m)[jt]s?(x) (playwright.config.ts)`，这条entry完全不受我自定义config的`entry`数组控制——用人造探针文件（`src/features/knipprobe/probe.ts`，只被一个临时e2e spec文件import）实测验证：删除`entry`数组里的e2e pattern后，探针依然不出现在unused列表里，证明排除从未真正生效
- 输入：`pnpm exec knip --config knip.production-reachability.json --debug` 的完整entry列表；knip配置schema里插件可以设为`false`显式禁用
- 输出：
  - `knip.production-reachability.json` 新增 `"playwright": false`，显式禁用该插件——同一份探针文件重跑后正确出现在unused列表里，确认修复生效
  - 发现并记录一个已知残留缺口：`src/core/courtos/**/*.nodetest.ts`等3条entry来自`test:core`/`eval:court`/`test:courtos:mvp-api`这几个npm script命令行里直接写的glob（knip解析package.json scripts参数自动注册entry，不是可关闭的"插件"），暂未找到干净的关闭方法；但这个缺口范围限定在`src/core/courtos/`（军机处体系），不影响本检查实际针对的`src/features/<部>/` office-kit roster/引擎，已用吏部/礼部真实样本反复验证`src/features/`范围内判定准确
  - `.claude/agents/gongbu-quality-gate.md` 补充这两点说明（插件必须显式禁用+已知残留缺口的范围）
- 涉及文件：`frontend/knip.production-reachability.json`、`.claude/agents/gongbu-quality-gate.md`
- 状态 / 数据变化：无（探针文件为临时验证用，验证后已用`rm`删除，未提交）
- 验证命令与证据：
  - 探针实验：`src/features/knipprobe/probe.ts`（导出函数）+ `e2e/knipprobe-e2e.spec.ts`（唯一引用者）；禁用playwright插件前，`pnpm exec knip --files --config knip.production-reachability.json`不显示probe.ts为unused；禁用后（加`"playwright": false`），同一命令正确显示`src/features/knipprobe/probe.ts`为unused
  - 禁用后对吏部/礼部真实样本重新验证：`hiring-review.ts`/`training-review.ts`/`org-headcount-review.ts`/`promotion-review.ts`/`compensation-band.ts`/`libu-roster.ts`均正确出现在586行的unused列表；`relationship-ledger-tab.tsx`/`LifuOfficeDesk`/`lifu-relationship.ts`均不出现；连续2次复现（586/586）稳定
  - `cd frontend && pnpm exec tsc --noEmit` → 0 错误
  - `node scripts/harness-doctor.mjs` → **无法运行**：另一个并行session当前正在进行一次大范围harness架构合并（"unify chaotang harness architecture"），`frontend/scripts/harness-doctor.mjs`等多个文件当前带有未解决的`<<<<<<< HEAD`冲突标记，导致脚本本身语法错误崩溃（`SyntaxError: Unexpected token '<<'`）。已确认这与本次改动无关（我方5个目标文件均为干净的`M`/`??`状态，不在冲突文件列表里），不属于本变更范围，不会尝试解决该合并冲突
- 回滚边界：`git checkout frontend/knip.production-reachability.json .claude/agents/gongbu-quality-gate.md`
- 完成定义：`gongbu-quality-gate.md` 的knip检查方法论证据完整、经人造样本正反验证；`harness-doctor.mjs` 暂时无法作为验收证据（外部原因），改用 `tsc --noEmit` + 直接knip实测作为本轮验收依据（**未通过**，见任务5）

## 任务 5（补充：Codex stop-time review 第五次拦截）

- 目标：修正"生产可达性检查仍把测试文件注册为入口"
- 前置条件：任务4只堵住了 Playwright 插件那一条路（e2e/spec entry）。用`--debug`完整核对entry列表发现还有一批`(package.json)`标记的entry未处理：`**/*.test.ts`/`**/test-*.ts`/`**/test.ts`/`**/test/**/*.ts`这几个knip内置通用测试文件名模式、`src/**/*.itest.ts`（不限于courtos的通用模式）、以及此前任务3已记录但归因为"某插件"的`src/core/courtos/**/*.nodetest.ts`等3条——尝试`"node": false`验证是否能像`"playwright": false`一样关掉，实测无效，说明这些不是挂在具体插件名下的行为
- 输入：`node_modules/knip/dist/WorkspaceWorker.js`（`runPlugins()`方法里`getInputsFromScripts`调用）、`node_modules/knip/dist/manifest/helpers.js`（`getFilteredScripts`实现）源码直接阅读
- 输出：
  - 查清机制：knip 核心无条件解析 `package.json` 所有 npm script 的命令行文本提取文件glob注册为entry，不受任何`"<插件名>": false`配置项控制（`getFilteredScripts`只把字面量脚本名`start`归为production，其余（含所有`test:*`）都归development，但development脚本一样会贡献entry，只是在`--production`模式下会被过滤——这也解释了任务2里`--production`表现"清零"的诡异行为，可能与isProduction分支下`project`/`entry`整体判定方式的其他交互有关，未继续深挖）
  - 精确核查`src/features/`范围内是否有文件命中这几个knip内置模式：`find src/features -type f -regex ".*[.\-_]test\.\(ts\|tsx\|js\|jsx\|cjs\|mjs\)$"`、`find src/features -type f \( -name "test.ts" -o -name "test-*.ts" \)`、`find src/features -type d -name "test"`、`find src/features -type f -name "*.itest.ts"`，四条命令全部空结果——确认该缺口在当前代码库对office-kit范围零命中，是记录在案的理论风险而非活跃bug
  - `.claude/agents/gongbu-quality-gate.md` 补充：把"已知残留缺口"从"某插件关不掉"订正为"核心script-parsing关不掉"，列出精确的不可控pattern清单，加一条强制前置检查——审查具体文件前先确认文件名/路径不命中这些pattern，命中了knip判定对该文件不可信，需人工核实
- 涉及文件：`.claude/agents/gongbu-quality-gate.md`
- 状态 / 数据变化：无
- 验证命令与证据：
  - `pnpm exec knip --config knip.production-reachability.json --debug`（加`"node": false`后）→ `(package.json)`标记的entry原样全部存在，确认`"node": false`对此无效
  - 四条`find`精确核查命令均空结果（见上）
  - `cd frontend && pnpm exec tsc --noEmit` → 0 错误
  - `node scripts/harness-doctor.mjs` → 本轮对方并行session的合并已完成，恢复可运行，`0 errors, 0 warning(s)`
- 回滚边界：`git checkout .claude/agents/gongbu-quality-gate.md`
- 完成定义：`gongbu-quality-gate.md` 对残留缺口的描述精确到机制层面（而非笼统归因"某插件"），列出可验证的精确pattern清单和前置检查步骤；`harness-doctor.mjs` 0 errors
