# 鸿胪寺 V1：外部能力国门 UI readiness successor

任务 ID：`HONGLUSI-EXTERNAL-CAPABILITY-GATEWAY-UI-V1-READINESS-SUCCESSOR-20260901`

冻结基线：`origin/ext-dev@fb5d3f4af426f6140ef905ff015721692396d084`

冻结 tree：`82718add3837287871b9905188e4428767094885`

本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。鸿胪寺只作为外部能力的可视化国门与受控入口，不建立第二执行器、第二能力注册表、第二 authority 或第二事实源。

## Status

Ready

细分状态：`OWNER_EXACT11_SUCCESSOR_AUTHORIZED / APPROVAL_COMMIT_PENDING / PRODUCT_STOP_UNTIL_MACHINE_GO`

## Successor Lineage

前序未提交三文件包冻结在 `c6bcaf524fbd6dd5984337b429e279d1791158c8`。在提交前，实时远端已前进到 `fb5d3f4af426f6140ef905ff015721692396d084`，新增 P14 readiness 治理与验证器变化。前序包从未提交、推送或运行 authority，现仅作为本地字节证据，不得恢复或消费。

新基线与鸿胪寺 exact11 产品路径零重叠。本 successor 只重锚定基线与任务身份，不扩大产品范围。

## Product Definition

- 用户确认：用户于 2026-09-01 明确授权提交并普通快进推送鸿胪寺 UI V1 三文件治理包；machine GO 后实施、提交并完整验证 exact11 本地产品 candidate，且暂不推送、不部署。
- 问题：现有朝堂具备大殿、上书房、军机处、六部、专署和史馆，但缺少一个清楚表达外部模型、MCP、自动化与合作方能力准入状态、风险与下一步决策的“外部能力国门”。
- 目标用户：企业主、产品负责人、AI 爱好者与极客用户。
- 目标：交付受保护、可访问、视觉完整、响应式、无真实外部副作用的 `/honglusi` V1，并接入朝堂全局导航和底部对话坞。
- 首屏原则：只回答“发生什么”“需要我决定什么”“朝堂下一步替我做什么”，并突出一个最高优先行动。
- 非目标：后端合同、真实第三方接入、凭据保存、外部写操作、支付结算、生产激活、部署或全局视觉重构。

## User Experience Contract

1. 顶部复用 `ChaotangHeader`，新增“鸿胪寺”一级入口与当前页状态。
2. 中央采用“国门星轨”：门外是模型、MCP、自动化和合作方；门内是朝堂能力池；鸿胪寺位于准入闸门。
3. 左栏为能力目录和准入状态；中栏为能力护照和影响链；右栏为预警、待决策与下一步。
4. 页内只有四个视图：国门总览、外部能力、准入审查、联盟路由，不新增四条路由。
5. 底部复用 `CourtQuickDock`，中央提供明确标记 `DEMO` 的鸿胪寺对话输入。
6. 外部能力固定分为 `模型智囊`、`MCP 使团`、`自动化行署`、`合作方服务`。
7. 准入状态只允许 `待审`、`沙箱`、`只读`、`阻断`；不得虚构“已上线”“已连接”。
8. 每个警报必须说明影响、原因和下一步；无依据时显示“待补证”。
9. 唯一主操作为“发起准入评估（演示）”，只改变 React 内存状态。
10. 不提供任意 URL、Token、密钥、安装、联网或真实执行入口。

## Visual Contract

- 风格为深青黑、旧金、朱砂与青玉，融合古代宾礼秩序与现代能力网关。
- 中央必须形成可识别的国门舞台，不制作通用 SaaS 卡片墙。
- 使用实体边框、印章角标、刻度和纸墨层次；避免大圆角、玻璃拟态和营销式口号。
- 1440–1920 px 为三栏沉浸布局；1024 px 以下顺序折叠；360 px 可完成核心操作。
- 遵循 `prefers-reduced-motion`，所有交互有键盘焦点和可访问名称。

## Exact11 Scope

1. `frontend/src/app/court-entry-pages.test.ts`
2. `frontend/src/app/honglusi/page.tsx`
3. `frontend/src/components/chaotang/ChaotangHeader.test.ts`
4. `frontend/src/components/chaotang/ChaotangHeader.tsx`
5. `frontend/src/features/court-visuals/types.ts`
6. `frontend/src/features/honglusi-visual/HonglusiScene.module.css`
7. `frontend/src/features/honglusi-visual/HonglusiScene.test.ts`
8. `frontend/src/features/honglusi-visual/HonglusiScene.tsx`
9. `frontend/src/features/honglusi-visual/honglusiRegistry.test.ts`
10. `frontend/src/features/honglusi-visual/honglusiRegistry.ts`
11. `frontend/src/lib/requireUser.ts`

需要第十二条产品路径、图片二进制、后端/BFF、数据库、外部网络或新依赖时立即 STOP，另立 successor。

## Acceptance Criteria

- [ ] `/honglusi` 在渲染前直接执行一次 `requireUser("/honglusi")`。
- [ ] 顶部导航包含“鸿胪寺”，当前路径正确设置 `aria-current="page"`。
- [ ] 页面复用 `ImmersiveCourtShell`、`ChaotangHeader` 和 `CourtQuickDock`。
- [ ] 首屏呈现三个核心问题且只有一个视觉主操作。
- [ ] 四个页内视图可由鼠标和键盘切换并暴露可访问状态。
- [ ] 选择能力会同步更新能力护照、风险、影响链和建议动作。
- [ ] 底部对话拒绝空输入；回复明确显示 `DEMO`，不声称已调用或执行。
- [ ] 所有静态能力、告警、时间和评估均标记 `DEMO` 或“待接入真实事实源”。
- [ ] 页面源代码不含 `fetch(`、第三方 URL、浏览器存储、凭据输入或写方法。
- [ ] 未新增依赖，未修改后端、BFF、Harness、ADR、CI、发布或部署文件。
- [ ] 1920×1080 无意外溢出；1024 px 和 360 px 均可完成核心交互。
- [ ] focused/full tests、lint、typecheck、build、Harness、Doctor、V2 convergence 与 authority regression 全绿。
- [ ] 浏览器控制台零错误；独立前端审查 P0–P2 为零。

## Delivery Constraints

- 治理提交与产品 candidate 必须是两个独立直接单亲提交。
- 治理提交只允许 manifest 中三条 `approvalCommitPaths`。
- 产品 candidate 只允许 exact11，并按 TDD 先 RED 后 GREEN。
- V1 唯一数据源为只读、可审计的本地 DEMO registry。
- 不新增 npm 包，不访问公网、真实模型、MCP、账号、凭据或生产数据。
- 验证通过只代表本地候选可供 Owner 验收，不授权推送、合并、部署或激活。

## Affected Modules

- 模块：受保护路由、全局导航、沉浸式场景类型、鸿胪寺视觉模块及对应测试。
- 允许路径：仅限本任务 `Exact11 Scope` 十一条产品路径。
- 依赖模块：复用 `requireUser`、`ChaotangHeader`、`ImmersiveCourtShell` 与 `CourtQuickDock`；不新增运行时依赖。

## Technical Plan

1. 先修改入口与导航测试并新增 registry/scene 测试，证明真实 RED。
2. 实现无副作用 DEMO registry 与纯投影。
3. 实现三栏国门场景、四个视图、能力选择、演示评估和演示对话。
4. 接入受保护路由、全局导航和 scene 类型。
5. 完成响应式、焦点、减少动画和诚实状态。
6. 提交唯一 exact11 candidate，运行 manifest 完整矩阵、浏览器验收与独立复审。

## Implementation Report

- 改动摘要：Pending machine GO。
- 自审：Pending。
- 验证：新基线 `check_harness` PASS；Doctor 为 `BOOTSTRAP_OBSERVE`；Product Authority 为 `STOP / APPROVAL_NOT_SELECTED`。
- 实际使用的 skill：`frontend-design`、`test-driven-development`。
- 未运行项与原因：产品实现必须等待本 successor approval 普通快进至远端且 machine GO。
- 剩余风险：V1 没有真实外部能力事实源，必须保持 DEMO。

## Acceptance Review

- 验收结果：Pending
- 验收证据：Pending machine candidate verification 与 Owner 视觉验收。
- 未通过项：当前 successor 尚未形成 approval commit。

## Stop Conditions

远端离开 `fb5d3f4af426f6140ef905ff015721692396d084`、machine STOP、需要第十二路径、需要真实外部副作用、验证失败或出现 P0–P2 时立即停止并另立 successor。
