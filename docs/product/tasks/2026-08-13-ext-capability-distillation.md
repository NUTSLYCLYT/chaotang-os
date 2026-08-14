# 任务：EXT 能力蒸馏与晋级设计

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：用户于 2026-08-13 明确同意大神会审建议并要求开展下一步。
- 问题：`origin/feature-chaotang-ext` 保存了大量工程 Agent、开发 Skill、运行角色和领域方法，但与当前 `dev` 严重分叉，直接复制会覆盖现有治理并引入无调用链资产。
- 目标用户：朝堂 OS 的产品 Owner、工程维护者和 Runtime Skill 负责人。
- 目标：形成可重复的跨分支资产清单、去重分组、首批五项迁移设计和可量化晋级门。
- 非目标：本任务不复制 Prompt，不修改生产 Runtime Skill，不改变工具权限、ADR 0028、外部网络、凭据或部署。

## Acceptance Criteria

- [x] 可从指定 Git ref 生成工程 Agent、开发 Skill、运行角色和嵌套领域 Skill 的机器清单。
- [x] 清单记录来源 commit、内容指纹、重复维度和建议处置，且明确不授予复制或执行权限。
- [x] 设计文档明确区分开发期 Skill、产品 Runtime Skill、Tool Capability 和评测资产。
- [x] 首批五项候选均有目标落点、非目标、风险、评测集和晋级/回滚标准。
- [x] 新盘点器有离线测试，现有 Harness 与 Git diff 检查通过。

## Delivery Constraints

- 范围：只读分析 EXT；只新增根级盘点工具、机器清单和设计/任务文档。
- 兼容性：保持当前自适应工程路由、Python Runtime Skill 内核、动态工具发现和 ADR 0028 不变。
- 风险与限制：仓库规则引用的 `using-superpowers` 和 `scripts/execution-authority.mjs` 当前不存在；因此禁止进入产品/runtime 迁移阶段。
- 技能计划：使用 `skill-stocktake` 的 Keep/Improve/Merge/Retire 方法，并使用 `expert-perspective` 做重大架构会审。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：外部能力供应链与迁移治理
- 允许路径：`scripts/stocktake_external_capabilities.mjs`、`scripts/stocktake_external_capabilities.test.mjs`、`docs/migrations/2026-08-13-ext-capability-stocktake.json`、`docs/migrations/2026-08-13-ext-capability-stocktake-review.md`、`docs/superpowers/specs/2026-08-13-ext-capability-distillation-design.md`、`docs/product/tasks/2026-08-13-ext-capability-distillation.md`
- 依赖模块：Git 对象库、现有 `backend/app/agents/runtime_skills/` 契约和根级 Harness

## Technical Plan

- 架构边界：盘点器只读取 Git 对象并生成证据；它不能复制资产、注册 Skill、授予工具或修改运行时。
- 接口与依赖：Node.js 标准库和 Git CLI；不新增包依赖。
- 实施顺序：盘点 → 去重 → 风险分类 → 首批候选设计 → 离线验证 → 独立会审。
- 验证计划：运行盘点器测试、生成快照、校验 JSON、运行 Harness/self-test 与 `git diff --check`。
- 技术风险：EXT 名称仍是用户口语“EXP”的候选解释；真正源仓变化时必须重新生成清单并复审来源。

## Implementation Report

- 改动摘要：新增全树外部能力盘点器、CLI/安全测试、738 项内容寻址快照、人类审计报告和能力蒸馏/晋级设计；未迁移任何运行资产。
- 自审：改为固定 source/target commit 读取，去除生成时间噪声，限制输出只能位于仓内且不得覆盖控制面；独立复审修正了 CLI 入口、漏扫 59 个 Skill、证据归属和任务范围问题。
- 验证：盘点器 2 项测试通过；同 commit 连续生成字节一致；根 Harness、154 项自测、Stop hook、product-flow runner 与 diff 检查已通过，最终十轮结果在交付报告中记录。
- 实际使用的 skill：`skill-stocktake`、`expert-perspective`。
- 验证命令与结果：`node --test scripts/stocktake_external_capabilities.test.mjs` PASS；`node scripts/check_harness.mjs` PASS；三个 self-test PASS；`git diff --check` PASS。
- 未运行项与原因：产品/runtime 迁移因治理前置门缺失而未授权；Windows 原生 Node 经 UNC 的全树性能验证超过 60 秒后主动终止，推荐在 WSL 仓路径运行。
- 剩余风险：用户口语“EXP”仍需最终确认是否精确指向 `origin/feature-chaotang-ext`；正式晋级前还需恢复或替代缺失的 execution-authority/skill preflight 入口。

## Acceptance Review

- 验收结果：PASS（仅限固定来源盘点、去重与迁移设计，不授予 Runtime 晋级）。
- 验收证据：独立工程资产审计、Runtime 角色审计、架构会审和代码复审均已完成；后续任务已将来源明确冻结为 `origin/feature-chaotang-ext@939186f0331d9784bc8c4ceee393aeb197230ed0`，并完成候选控制面、Runtime 映射与可信证据脊柱。
- 未通过项：无本任务范围内未通过项；真实能力增益、生产 Shadow、Canary 与外部动作继续由后续任务单独授权和验收。
