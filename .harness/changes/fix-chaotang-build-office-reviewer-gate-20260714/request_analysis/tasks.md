# 任务：fix-chaotang-build-office-reviewer-gate-20260714

## 任务 1（初版）

- 目标：把 `ai-job-search` 的 drafter-reviewer 模式移植进 `chaotang-build-office`，让写引擎的 agent 不能自审
- 前置条件：`gongbu-quality-gate` agent 已存在，此前未被建司流程引用
- 输入：`.claude/skills/chaotang-build-office/SKILL.md`（原4步）、`.claude/agents/gongbu-quality-gate.md`（原通用检查清单）
- 输出：建司步骤加第5步"复核（必过）"，quality-gate 新增office-kit专项检查项（含"ROI/年成本/毛利等金额自算违铁律6"）
- 涉及文件：`.claude/skills/chaotang-build-office/SKILL.md`、`.claude/agents/gongbu-quality-gate.md`
- 状态 / 数据变化：纯文档编辑，无运行时状态变化
- 验证命令与证据：人工读取确认改动落地
- 回滚边界：`git checkout` 两文件
- 完成定义：Codex stop-time review 通过（**未通过**，见任务2）

## 任务 2（补充：Codex stop-time review 第一次拦截）

- 目标：修正"新增门禁会误拦合法的毛利实现"
- 前置条件：任务1的检查项把"毛利"和"ROI/年成本"并列列为违铁律6
- 输入：SKILL.md"每部找它独有的一条真回执"段落（兵部=定价毛利是该部专属职能）
- 输出：quality-gate.md 检查项收窄为只针对`annualLaborCost`/`computeRoi`两个具体函数，不含毛利
- 涉及文件：`.claude/agents/gongbu-quality-gate.md`
- 状态 / 数据变化：无
- 验证命令与证据：人工比对措辞与 SKILL.md 是否矛盾
- 回滚边界：`git checkout`
- 完成定义：Codex 通过（**未通过**，见任务3）

## 任务 3（补充：Codex stop-time review 第二次拦截）

- 目标：修正"收窄不完整，建司规范仍会误拦部门专属算账"
- 前置条件：任务2只改了 quality-gate.md，但 SKILL.md 里"写引擎"步骤本身和"铁律6"定义仍是无限定的"禁自算钱"/"钱只户部算"
- 输入：SKILL.md 第15行（写引擎步骤）、第39行（铁律6定义）
- 输出：两处均改为限定"户部通用算钱原语（`annualLaborCost`/`computeRoi`）"，明确部门专属逻辑不受限
- 涉及文件：`.claude/skills/chaotang-build-office/SKILL.md`
- 状态 / 数据变化：无
- 验证命令与证据：`grep -n "算钱\|专属\|真回执" .claude/skills/chaotang-build-office/SKILL.md .claude/agents/gongbu-quality-gate.md` 确认三处用词一致
- 回滚边界：`git checkout`
- 完成定义：Codex 通过（**未通过**，见任务4）

## 任务 4（补充：Codex stop-time review 第三次拦截）

- 目标：修正"项目级 Claude 工作流被实质修改，但未创建或更新根级变更记录"
- 前置条件：`AGENTS.md` 第5条要求跨线/项目级实质变更必须在 `.harness/changes/` 建记录，任务1-3的改动都没有
- 输入：`scripts/new-change.mjs`、`.harness/templates/change-template/`
- 输出：`node scripts/new-change.mjs fix "chaotang-build-office reviewer gate"` 建出本目录，填写 summary.md（范围/文件/验证/背景）
- 涉及文件：`.harness/changes/fix-chaotang-build-office-reviewer-gate-20260714/summary.md`（新增）
- 状态 / 数据变化：无
- 验证命令与证据：`node scripts/harness-doctor.mjs` 0 errors，识别到新变更记录
- 回滚边界：删除本目录
- 完成定义：`node scripts/harness-doctor.mjs` 通过（**通过**，但用户随后要求深度侦察六部，衍生出任务5-8）

## 任务 5（补充：用户要求深度侦察六部后，实测发现 roster 诚实标注被架空）

- 目标：给 `gongbu-quality-gate` 加一条能照出"roster 声明了但没人真接线"的检查
- 前置条件：深度侦察实测发现吏部 `libu-roster.ts` 标 `engine:true` 的选才司/薪酬司/铨叙司/组织编制司，全仓查无任何 `.ts`/`.tsx` 真实 import
- 输入：`libu-roster.ts` 实测结果
- 输出：quality-gate.md 新增检查项——roster 声明的 `engine:true`/`reuses` 若全仓 grep 不到真实 import，判定为造假标注
- 涉及文件：`.claude/agents/gongbu-quality-gate.md`、`summary.md`（补充背景第4条）
- 状态 / 数据变化：无
- 验证命令与证据：`node scripts/harness-doctor.mjs` 0 errors
- 回滚边界：`git checkout`
- 完成定义：Codex 通过（**未通过**，见任务6）

## 任务 6（补充：Codex stop-time review 第四次拦截）

- 目标：修正"新增门禁会误拦…（仅测试引用、生产未接线的引擎无法识别）"
- 前置条件：任务5的检查项写"找不到任何 `.ts`/`.tsx` import"，但每个引擎自己的 `<司>-review.nodetest.ts` 本来就 import 自己做测试，会造成假阴性（门禁形同虚设）
- 输入：吏部5个引擎（hiring-review/training-review/org-headcount-review/promotion-review/compensation-band）
- 输出：检查项改为排除引擎自身的 `.nodetest.ts`，只认生产代码（`.tsx` 组件或非 nodetest 的 `.ts`）import 为真实接线证据
- 涉及文件：`.claude/agents/gongbu-quality-gate.md`、`summary.md`
- 状态 / 数据变化：无
- 验证命令与证据：`grep -rln "<engine>" --include="*.ts" --include="*.tsx" frontend/src | grep -v "\.nodetest\.ts$"` 对5个引擎逐一实测，确认排除自测试后仅剩 `libu-roster.ts` 字符串提及
- 回滚边界：`git checkout`
- 完成定义：Codex 通过（**未通过**，见任务7）

## 任务 7（补充：Codex stop-time review 第五次拦截）

- 目标：修正"'生产文件有 import' 仍不足以证明真实接线"
- 前置条件：生产 `.ts` 文件的 import 可能只是引用类型/re-export无人消费，或 importing 文件本身也是死代码，两三层后才断链——纯 grep import 无法证明"可达性"
- 输入：`frontend/knip.json`（仓库已有但未接依赖的死代码检测配置）
- 输出：检查项改为先跑 `npx knip@5 --include files` 判断 roster 文件本身是否在 unused files 列表里；同时记录 knip 自身盲区（entry 含 `**/*.nodetest.ts`，测试可达也算 used，不能替代"摸到 `src/app/` 路由"这一步的人工确认）
- 涉及文件：`.claude/agents/gongbu-quality-gate.md`、`summary.md`
- 状态 / 数据变化：无
- 验证命令与证据：`npx knip@5 --include files` 实测确认 `libu-roster.ts` 在 unused files 列表
- 回滚边界：`git checkout`
- 完成定义：Codex 通过（**未通过**，见任务8）

## 任务 8（补充：Codex stop-time review 第六次拦截）

- 目标：修正"新增门禁依赖未声明、不可复现的 Knip"
- 前置条件：任务7让 quality-gate 指令跑 `npx knip@5`，但 knip 从未作为本仓声明依赖，版本不锁、行为不可复现；`frontend/knip.json` 配置本身也是孤儿（配了没人接）
- 输入：`frontend/package.json`、knip 官方 npm registry（`npm view knip versions`，确认 latest 5.x = 5.88.1，匹配 `knip.json` `$schema` 指向的 v5，不跟进未验证的 v6）
- 输出：`frontend/package.json` devDependencies 新增 `"knip": "5.88.1"`，scripts 新增 `"knip": "knip"`；`pnpm install` 更新 `pnpm-lock.yaml`；quality-gate.md 门禁指令改引用 `pnpm knip --files`
- 涉及文件：`frontend/package.json`、`frontend/pnpm-lock.yaml`、`.claude/agents/gongbu-quality-gate.md`、`summary.md`
- 状态 / 数据变化：新增一个开发期依赖，不影响生产构建产物
- 验证命令与证据：
  - `cd frontend && pnpm exec tsc --noEmit` → 0 错误
  - `cd frontend && pnpm knip --files` 连续跑 5 次：第1次（刚装完依赖）128行、漏报 `libu-roster.ts`；第2-5次稳定在349行、含 `libu-roster.ts`/`hubu-roster.ts`——已把"依赖变动后首次运行可能漏报，需重跑一次"写入门禁指令
- 回滚边界：`git checkout` 三个文件，`pnpm install` 会自动移除 knip（若不手动删除 devDependencies 声明）
- 完成定义：Codex 通过（**未通过**，见任务9）

## 任务 9（补充：Codex stop-time review 第七次拦截，本次）

- 目标：修正"新增 change 记录被标为 DONE，但必需的规格、任务和 CI 证据仍是空模板"
- 前置条件：`node scripts/new-change.mjs` 建目录时会复制整套模板（`summary.md` + `request_analysis/{spec,tasks}.md` + `ci_result/ci_summary.md`），任务4只填了 `summary.md`，另外三个文件此前一直是"待填写"占位符，却标了 DONE
- 输入：`.harness/changes/fix-courtos-brain-boundary-scope-20260713/` 作为已完成变更记录的参考范例（其 `request_analysis/tasks.md` 展示了 Codex 多轮拦截应如何逐条记录为编号任务）
- 输出：本文件（`tasks.md`，把任务1-9完整记录）、`spec.md`（背景/范围/非目标/验收标准/验证计划）、`ci_result/ci_summary.md`（命令表+DoD映射+声明状态）
- 涉及文件：`.harness/changes/fix-chaotang-build-office-reviewer-gate-20260714/request_analysis/spec.md`、`request_analysis/tasks.md`、`ci_result/ci_summary.md`
- 状态 / 数据变化：无（纯文档补全）
- 验证命令与证据：`node scripts/harness-doctor.mjs` 0 errors；人工检查三文件不再含 `{{...}}` 占位符或"待填写"字样
- 回滚边界：删除/还原本目录三个文件
- 完成定义：三文件填写完整且与 `summary.md` 背景一致，`node scripts/harness-doctor.mjs` 0 errors
