# 实现报告 v1

## 改动

- `src/features/shangshufang/ShangshufangPage.tsx`：
  - `runOrderDecree` 加 `mode: ExecutableDecreeMode = 'order'` 参数，内部计算 `isSecret = mode === 'secret'`，把原来硬编码"圣旨"/"下旨"的聊天标签、状态提示文案、错误消息改成按 `mode` 条件分支；`appendDecreeChat`/`setEdictOverride` 的 `chatMode` 从字面量 `'order'` 改成变量 `mode`。控制流(draft-edict→confirm-edict→pollForRealVerdict→setEdictOverride)完全不变，只是文案分叉。
  - `runSecretDecree` 从 82 行的独立实现(调 `chaotang.orchestrateAll()`)改成 `useCallback((cmd) => runOrderDecree(cmd, undefined, 'secret'), [runOrderDecree])` 三行薄封装。
  - 删除 `secretBriefToEdict()`(102 行，专门渲染 `OrchestrateResult` 占位数据、经过 5 轮 Codex 审查修诚实标注的函数)——密旨现在返回真实 `ShangshufangConfirmResponse`，直接复用 `confirmedEdictToView()`。
- `src/lib/api/chaotang.ts`：删除 `orchestrateAll()`(零生产调用者，仅测试文件的否定断言提及)，留注释指向本次架构工作。
- `src/features/shangshufang/components/DecreeInput.tsx`：
  - `MODE_OPTIONS` 密旨项的 `title` 从"当前为兼容占位，未接入真实蜂群"改成"同下旨走一条真实管线，仅措辞更收敛克制"——保留历史注释记录两轮误判的教训，新增 2026-07-12 架构修复的说明。
  - 删除按钮上的占位圆点(`decree-mode-secret-placeholder-dot`)和常驻徽标(`decree-secret-placeholder-badge`，含默认视图即可见的"密旨为占位模式"文案)，以及关联的 `secretOptionVisible`/`isSecretOption` 变量——这些都是本次 session 前半段为"密旨是空壳"这个事实做的诚实降级 UI，事实变了，UI 必须跟着变，否则就是新的说谎。
- `backend/web/routers/court_compat.py`：`orchestrate_all` 加弃用说明注释，不删除函数本身(见 spec.md 风险小节)。

## 取舍

- 没有给 `DraftEdictRequest`/`ConfirmEdictRequest` 加后端 `mode` 字段——原计划草稿设想过这个字段用于"文案/来源标注分支"，但实现后发现 `confirmedEdictToView` 本身就是 mode 无关的通用渲染(圣裁/参审部门/分奏这些标签跟"圣旨"或"密旨"无关)，前端仅有的措辞差异全部在 `runOrderDecree` 内部用 `isSecret` 三元表达式解决，不需要往返后端。加一个当前用不到的字段会违反"不做超出需求的设计"。
- 没有删除 `court_compat.py::orchestrate_all` 端点本身——`backend/tests/test_contract_alignment_p0.py::test_court_orchestrate_all_contract_returns_swarm_receipt_shape` 依赖它的契约形状，且不确定是否有仓库外调用方。只加弃用注释，符合原计划"先加 deprecation 标注一个版本周期，再删"的稳健顺序。
- `OrchestrateResult` 类型保留——探索阶段发现它仍被"问丞相"(`chaotang.orchestrate`，一条完全独立、真实可用的会审功能，`chancellorReplyFromResult`/`councilToEdict` 都在用)使用，误删会破坏一个无关的真实功能。只删除了 `orchestrateAll` 这一个具体函数。

## 验证

- `pnpm exec tsc --noEmit`：绿，无新增错误(密旨改造过程中出现过的"Cannot find name 'runSecretDecree'"等 TDZ 报错，在补上薄封装后消失)。
- `pnpm test:node`：995 条测试，989 通过 / 6 失败，同一组既有失败(BFF 写隔离/`dispatchDeptToSwarm` 鉴权守门/学习持久化解耦/e2e 后门安全)，与本次改动无关。
- `pnpm harness:doctor`(前端)、`python3 backend/scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`(根级)：三层全绿。
- 真实浏览器验证(playwright-cli，登录态 `验证用户0711`)：
  - 提交密旨"验证密旨接入真实管线：新产品线是否值得追加两百万投资？请户部与工部各陈利弊。"，页面立即显示真实任务号 `task_ede87bf18eaa`、真实 trace、"蜂群执行中"真实进度追踪(非此前 5 轮修复针对的假进度条问题——这次是真任务，进度条本身合法)。
  - 直接调用后端 `GET /api/shangshufang/tasks/task_ede87bf18eaa/status` 轮询(约 75 秒，15 次轮询从 `executing` 转为 `awaiting_emperor_decision`，符合此前记录的"六部真实会审 1-3 分钟"量级)，最终 `ministry_outputs` 里户部/刑部/吏部三个部门的 `source_label` 全部是 `LIVE_ENGINE`，`opinion` 是具体、有实质内容的真实判断(例如"可签——但先改 7 处，否则有风险")，不是恒定的空态或 FALLBACK。
  - 默认(圣旨选中)状态和切到密旨后，界面均确认不再出现任何"占位"字样的徽标或圆点。
