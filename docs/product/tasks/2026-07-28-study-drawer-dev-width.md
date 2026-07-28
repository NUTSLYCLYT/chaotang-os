# Task: 上书房侧抽屉采用 dev 面板宽度

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Accepted

## Product Definition

- 用户确认：2026-07-28，用户通过“自动交付”明确指出当前面板过宽，并要求参考 `dev` 的面板实现。
- 问题：当前上书房左右侧抽屉使用 `width: min(420px, 100vw)`；`dev` 的同类辅政面板在桌面端仅为 `300px`，当前实现明显更宽。
- 目标用户：在桌面与窄屏设备上使用上书房左右辅助面板的登录用户。
- 目标：迁移 `dev` 的响应式面板宽度规则，使小视口使用 `44vw`、`sm` 使用 `260px`、`lg` 使用 `300px`，并保持窄屏不溢出。
- 非目标：不迁移 `dev` 的旧聊天数据、旧下旨行为、动画时长、定位测量逻辑或其他业务实现；不改变当前面板内容、配色、可访问性与业务 API。

## Acceptance Criteria

- [x] 上书房左右侧抽屉在 `lg` 桌面断点使用 `300px` 宽度。
- [x] 在 `sm` 至 `lg` 之间使用 `260px` 宽度。
- [x] 小于 `sm` 时参考 `dev` 使用 `44vw`，同时保留 `max-width: 100vw`，不产生横向溢出。
- [x] 左右抽屉继续使用与底部栏一致的背景渐变。
- [x] 抽屉内容、打开/关闭、Escape、焦点恢复与 360px 窄屏契约保持不变。
- [x] 自动化回归测试直接锁定来自 `dev` 的三档宽度规则。

## Delivery Constraints

- 范围：仅上书房侧抽屉 CSS、对应测试、本任务文件与本次失败记忆。
- 兼容性：保留 ADR 0028 下旨、证据与归档闭环，不引入 `dev` 的旧业务代码。
- 风险与限制：工作区已有用户后端改动和上一轮侧抽屉配色改动，必须原样保留。
- 技能计划：`using-superpowers`、`product-flow`、`systematic-debugging`、`record-failure`、`brainstorming`、`test-driven-development`、`codex-engineering-workflow`、`verification-before-completion`。
- Codex-only：否；按 product-flow 默认调用 Claude Code runner，受明确配额限制时由 Codex 专业角色接力。

## Affected Modules

- 模块：上书房左右侧辅助抽屉视觉尺寸。
- 允许路径：`frontend/src/features/study-visual/StudySideDrawers.module.css`,
  `frontend/src/features/study-visual/StudySideDrawers.test.ts`,
  `docs/product/tasks/2026-07-28-study-drawer-dev-width.md`,
  `docs/failures/2026-07-28-study-drawer-width-dev-drift.md`。
- 依赖模块：`dev:frontend/src/features/shared/components/global-edict-quick-dock.tsx`（只读参考）。

## Technical Plan

- 架构边界：只迁移 `dev` 面板几何宽度，不迁移旧业务；默认 `44vw`，
  在 640px 与 1024px 断点分别切换为 `260px` 与 `300px`。
- 接口与依赖：不新增或修改运行时接口。
- 实施顺序：先补能因当前 `420px` 规则失败的 CSS 源码守卫测试，再迁移三档响应式宽度，最后运行前端与 harness 验证。
- 验证计划：专项 `node:test`、前端 lint/typecheck/test/build、harness 与 `git diff --check`。
- 技术风险：CSS 断点语义必须与 `dev` 的 Tailwind `sm`（640px）和 `lg`（1024px）一致。

## Implementation Report

- 改动摘要：侧抽屉从固定上限 `420px` 改为 `dev` 等价的
  `44vw → 260px（≥640px）→ 300px（≥1024px）`，并保留
  `max-width: 100vw`；360px 断点仅保留紧凑 padding。
- 自审：保留上一轮底栏同色背景、现有抽屉内容与交互；未迁移 `dev`
  的旧聊天、下旨或定位逻辑，未触碰无关后端改动。
- 验证：TDD 首次专项运行 3/4，通过失败证明旧 `420px` 规则被捕获；
  实施后专项 4/4 通过。独立测试工程师首次发现测试正则 `/s` 与
  TypeScript target 不兼容，有限返工一次改为 `[\s\S]` 后全门禁通过。
- 实际使用的 skill：`using-superpowers`、`product-flow`、
  `systematic-debugging`、`record-failure`、`brainstorming`、
  `test-driven-development`、`codex-engineering-workflow`、
  `verification-before-completion`。
- 验证命令与结果：专项测试 4/4 PASS；`npm run lint` PASS；
  `npm run typecheck` PASS；`npm test` 301/301 PASS；
  `npm run build` PASS（30/30 静态页）；`node scripts/check_harness.mjs`
  PASS（72 个基线文件）；`git diff --check` PASS。
- 未运行项与原因：未执行真实浏览器多视口截图或像素测量；本任务采用
  `dev` 源码对照、CSS 守卫与生产构建作为约定验证矩阵。
- 剩余风险：若后续 `dev` 修改断点值，当前实现不会自动同步，需要产品
  明确决定是否再次迁移。

## Acceptance Review

- 验收结果：Accepted
- 验收证据：六项验收标准均由实际 CSS、专项守卫、原交互测试及前端
  lint/typecheck/test/build 覆盖；harness 证明 ADR 0028 未被破坏。
- 未通过项：无。
