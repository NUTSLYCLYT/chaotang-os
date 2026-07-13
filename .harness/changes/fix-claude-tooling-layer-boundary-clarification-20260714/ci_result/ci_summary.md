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
| `cd frontend && pnpm exec knip --files --config knip.production-reachability.json` | 1 | 585行输出，吏部5个孤儿引擎及各自`.nodetest.ts`均在列，礼部真实接线的`relationship-ledger-tab.tsx`/`LifuOfficeDesk`/`lifu-relationship.ts`均不在列 | 第三轮"仅测试可达可经组件间接绕过"的核心验证——确认全图可达性分析既能抓住孤儿又不误伤真实接线 | 本会话实测，2次复现一致（585/585） |
| `cd frontend && pnpm knip:reachability`（走package.json声明脚本） | 1 | 590行输出，同样包含`hiring-review.ts`/`libu-roster.ts` | 确认脚本化调用（声明依赖，非临时命令）与直接`--config`调用结果一致 | 本会话实测 |
| `cd frontend && pnpm exec tsc --noEmit`（新增`knip.production-reachability.json`+package.json脚本后） | 0 | 无类型错误 | 确认新增配置文件/脚本未破坏类型检查 | 本会话实测 |
| `node scripts/harness-doctor.mjs`（第三轮改动后复跑） | 0 | `0 errors, 0 warning(s)` | 确认第三轮改动未破坏根级护栏一致性 | 本会话实测 |
| `pnpm exec knip --config knip.production-reachability.json --debug`（grep entry/Enabled plugins） | 0 | 发现 `entry:e2e/**/*.@(spec\|test).?(c\|m)[jt]s?(x) (playwright.config.ts)`——Playwright插件自动注册，不受自定义`entry`数组控制 | 定位第四轮"备用配置未真正排除测试入口"的根因 | 本会话实测 |
| 人造探针实验（`src/features/knipprobe/probe.ts` + `e2e/knipprobe-e2e.spec.ts`，禁用playwright插件前） | 1 | 585行输出中**不含**probe.ts——证明仅删entry数组不生效 | 复现"排除未生效"问题 | 本会话实测 |
| 人造探针实验（同上，加`"playwright": false`后） | 1 | 588行输出，`src/features/knipprobe/probe.ts` 正确出现 | 证明显式禁用插件才是真正生效的修复 | 本会话实测；探针文件已用`rm`删除，未提交 |
| `cd frontend && pnpm exec knip --files --config knip.production-reachability.json`（加`playwright:false`后，对吏部/礼部真实样本复测） | 1 | 586行，吏部5引擎+其nodetest均在列，礼部3个真实接线文件均不在列 | 确认修复后对真实样本仍然准确，2次复现一致（586/586） | 本会话实测 |
| `cd frontend && pnpm exec tsc --noEmit`（第四轮改动后） | 0 | 无类型错误 | 确认`playwright:false`未破坏类型检查 | 本会话实测 |
| `node scripts/harness-doctor.mjs`（第四轮，尝试复跑） | 无法执行 | `SyntaxError: Unexpected token '<<'`——`frontend/scripts/harness-doctor.mjs`当前带未解决合并冲突标记（另一并行session"unify chaotang harness architecture"合并中） | 确认崩溃原因与本变更无关：`git status --short`确认我方5个目标文件均为干净`M`/`??`，不在`git status`报告的21个`both added`冲突路径列表内 | 本会话实测 |
| `pnpm exec knip --config knip.production-reachability.json --debug`（加`"node": false`后） | 0 | `(package.json)`标记的entry（`**/*.itest.ts`、`src/core/courtos/**/*.nodetest.ts`等）原样全部存在，未受影响 | 证明这些entry不挂在"node"插件下，`"node":false`对此无效 | 本会话实测 |
| `find src/features -type f -regex ".*[.\-_]test\.\(ts\|tsx\|js\|jsx\|cjs\|mjs\)$"` | 1（空结果） | 无输出 | 确认`src/features/`下无文件命中knip内置`.test.ts`/`-test.ts`/`_test.ts`模式 | 本会话实测 |
| `find src/features -type f \( -name "test.ts" -o -name "test-*.ts" \)` | 1（空结果） | 无输出 | 确认无文件字面命名`test.ts`或以`test-`开头 | 本会话实测 |
| `find src/features -type d -name "test"` | 1（空结果） | 无输出 | 确认无`test/`目录 | 本会话实测 |
| `find src/features -type f -name "*.itest.ts"` | 1（空结果） | 无输出 | 确认无`.itest.ts`文件 | 本会话实测 |
| `cd frontend && pnpm exec tsc --noEmit`（第五轮改动后） | 0 | 无类型错误 | 确认文档措辞修订未影响任何代码 | 本会话实测 |
| `node scripts/harness-doctor.mjs`（第五轮，对方合并已完成后复跑） | 0 | `0 errors, 0 warning(s)` | 确认外部阻塞已解除，根级护栏一致性恢复可验证 | 本会话实测 |

## 结果

在 `project-boundaries.md` 新增一段解释性文字，明确根级 `.claude/`（agents/skills/hooks）是 Claude Code 工具本身的配置层，其判定豁免前提是"不持有业务逻辑、不持有运行时状态"，不是无条件豁免。**第二轮**：`AGENTS.md:38` 原文追加括号说明+指针（不改变三条内容主线的实质要求，只消除与 `project-boundaries.md` 的字面矛盾）；`gongbu-quality-gate.md` 的 roster/引擎接线检查规则收窄两处漏报口子（knip初筛不是终审、排除测试文件范围扩大到所有测试文件）；`knip --production` 经实测确认在本仓不可用并记录在案。**第三轮**：第二轮的单跳grep检查仍可被"引擎→真实.tsx组件→组件本身只被测试mount"这种多跳链路绕过；改用新建的 `frontend/knip.production-reachability.json`（去掉测试entry的knip配置变体）+ `pnpm knip:reachability` 脚本，靠knip的全图可达性分析一次性终审，不再手搓多跳grep链。与同文件内另一个并行 session 正在进行的 courtos-brain 相关未提交编辑无文本冲突。**第四轮**：第三轮的"删entry数组"对Playwright插件自动注册的e2e entry无效（插件不受config的entry数组控制），实测确认后加`"playwright": false`显式禁用插件才真正生效；记录一个范围受限、未解决的残留缺口（`src/core/courtos/`下几个nodetest entry来自npm scripts参数，非"插件"无法直接关闭，但不影响本检查实际针对的`src/features/`范围）。本轮验证过程中，另一并行session开始大范围harness架构合并，`node scripts/harness-doctor.mjs`当前因对方未解决的合并冲突标记而崩溃，与本变更无关，本轮验收改用`tsc --noEmit`+直接knip实测。

## 未验证项

- 未对"是否还有其他类似 `.claude/` 的、字面不在三层结构内但实际合法的工具配置路径"做全仓排查（如 `.codex/`、`.superpowers/`）——本次范围只解决当前被 Codex 拦截的具体问题，不做预防性穷举。
- 未与另一个并行 session 直接协调确认其 courtos-brain 编辑的最终提交计划——已通过 `git diff` 静态核实当前无文本冲突，但如果对方后续对同一文件做大范围重排，理论上仍可能与本次插入位置产生冲突，需要提交前再次核对。
- `knip --production` 在本仓不可用的根本原因未查清（可能与 `knip.json` 显式声明的稀疏 entry 列表和 `--production` 内部逻辑的交互有关）——已确认现象可复现，但只记录"不可用"结论，未深挖 knip 内部实现。
- `knip.production-reachability.json` 是否还有第四层绕过场景（比如动态 `import()` 字符串拼接路径，knip 静态分析原生就无法追踪）未穷举——本次只验证了已知的吏部孤儿+礼部真实接线两组样本，不代表覆盖所有可能的绕过手法。
- `src/core/courtos/**/*.nodetest.ts` 等3条npm-scripts派生entry的关闭方法未找到——已记录为已知缺口而非已解决，范围限定在`src/core/courtos/`，不影响`src/features/`。
- 本轮无法运行 `node scripts/harness-doctor.mjs` 验证根级护栏一致性——被另一并行session进行中的合并冲突阻塞，非本变更问题，但也意味着"整个仓库当前doctor校验是否0 errors"这件事本身在本轮暂时是未知状态，需等对方合并完成后由某一方复跑确认。
- 六部命名体系冲突（ministry-bridge/"libu"命名）不在本次验证范围内，见 `spec.md` 非目标。

## Diff 与回滚复核

- changed files：`.harness/rules/project-boundaries.md`（本次实际贡献第11行一段；同文件另有并行session未提交的courtos-brain相关改动，不属于本变更范围）、`AGENTS.md`（第38行追加括号说明；**注意**：第四轮期间该文件被另一并行session的大合并卷入冲突，本变更不再对`AGENTS.md`做任何进一步操作，也不参与其冲突解决）、`.claude/agents/gongbu-quality-gate.md`（roster检查规则历经四轮收窄，最终改用knip全图分析+显式禁用playwright插件）、`frontend/knip.production-reachability.json`（新增，含`playwright:false`）、`frontend/package.json`（新增`knip:reachability`脚本）
- diff review：已人工通读全文确认新增段落边界清晰、与前后文无重叠
- 回滚是否演练：未实际执行回滚演练（本变更风险低、边界清晰，认为不需要）；理论回滚路径为删除新增段落对应的单一段落文本，`AGENTS.md`/`gongbu-quality-gate.md` 同理用 `git checkout` 单独还原

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `harness-doctor.mjs` 0 errors | 命令表第1、7行（第1-3轮）；第四轮外部阻塞；第五轮补跑确认 | 全部已达成——第4轮因外部合并冲突暂缺，第5轮对方合并完成后补跑确认0 errors |
| 新增段落不与并行session内容冲突 | 命令表第4行，人工通读 | 已达成 |
| 变更记录四文件填写完整 | 本文件即为其一，另三份（summary/spec/tasks）已同步填写 | 已达成 |
| `AGENTS.md:38` 与 `project-boundaries.md` 不再字面矛盾 | 命令表第6行 | 已达成（第一版"未修改AGENTS.md原文"的判断已被第二轮推翻并订正）——但注意`AGENTS.md`第四轮期间被并行session的大合并卷入冲突，本变更内容与其无关，是否最终保留由对方合并结果决定 |
| roster检查规则不再漏报"仅测试可达"（含多跳/组件间接绕过、插件自动注册的entry） | 命令表第8-13行（人造探针实验+吏部/礼部真实样本586行复测，2次复现一致） | 已达成（第二、三轮"已达成"的判断分别被后一轮推翻——先是单跳grep有多跳绕过口子，改knip全图分析后又发现knip插件自动entry不受config的entry数组控制，加`playwright:false`才真正堵上；已知残留缺口`src/core/courtos/`已如实记录，不算"已达成"范围内） |

## 声明状态

- `VERIFIED_COMPLETE`：第四轮因外部合并冲突暂缺的`harness-doctor`验证，第五轮已在对方合并完成后补跑确认`0 errors, 0 warning(s)`，恢复完整验收链条。本次声明范围（`.claude/`工具层边界说明、`AGENTS.md`措辞对齐、roster检查规则改用knip全图分析+显式禁用playwright插件+精确记录核心script-parsing残留缺口及其零命中范围）已实测验证完整，无遗留空模板，无遗留"某插件"这类不精确归因。提交时只包含本变更自己贡献的文件，不触碰其他并行session的独立改动。
