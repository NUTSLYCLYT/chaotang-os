# 任务：军机处无案卷完整主舞台

> 所有任务必须遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。

## Status

Implemented

## Product Definition

- 用户确认：当前用户，2026-07-28；确认军机处在无案卷时仍展示完整模块，所有业务数据为空。
- 问题：当前筛选无案卷时以整页空态卡片替代会审主舞台，用户无法看见军机处的固定信息架构。
- 目标用户：查看自己会审案卷的下旨者。
- 目标：无案卷时保留左侧账册、中央会审舞台和右侧六部目录；只显示事实为空的文案。
- 非目标：不创建案卷、不伪造状态/路径/部门意见、不新增写入入口或变更下旨和归档流程。

## Acceptance Criteria

- [ ] 当 API 成功返回空案卷数组时，页面不再以整页空态替代主舞台。
- [ ] 左栏保留筛选与“进行中 / 已归档 / 办理失败”三个空列表。
- [ ] 中央显示等待下旨的空舞台，不显示虚构案卷、处理路径或意见。
- [ ] 右栏保留六部固定目录，六部均显示“未参与”。
- [ ] 加载、读取错误、以及筛选后无匹配案卷仍保持现有真实状态语义。

## Delivery Constraints

- 范围：仅 `frontend/src/features/junjichu-visual/` 的场景、样式和测试。
- 兼容性：保持 `/api/junjichu/cases` 只读契约、当前 owner 隔离和现有响应式断点。
- 风险与限制：空态不得表现为真实会审进度或部门办理事实。
- 技能计划：brainstorming、writing-plans、test-driven-development、verification-before-completion。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：军机处会审主舞台。
- 允许路径：`frontend/src/features/junjichu-visual/JunjichuScene.tsx`、`frontend/src/features/junjichu-visual/JunjichuScene.module.css`、`frontend/src/features/junjichu-visual/JunjichuScene.test.ts`、`frontend/src/features/junjichu-visual/junjichuController.test.ts`。
- 依赖模块：同源只读 BFF `/api/junjichu/cases`。

## Technical Plan

- 架构边界：仅在 `JunjichuScene` 对读取成功的空数组做视觉投影；不改变 controller、BFF、案卷领域或下旨链路。
- 接口与依赖：继续消费现有 `JunjichuSceneProps`，以及共享只读正文卷轴 `EdictStage`；不新增网络接口或参数。
- 实施顺序：先以场景源码测试锁定空态三栏和统一卷轴接入，再替换中央本地纸面容器，最后运行前端质量门禁。
- 验证计划：运行场景测试、军机处定向测试、lint、typecheck、build 与差异检查。
- 技术风险：空态不得补造业务字段；筛选后无匹配必须保留紧凑空态而非显示系统初始空台。

## Acceptance Review

- 验收结果：Passed
- 验收证据：
  - 成功空数组保留左侧筛选与三组空列表、中央等待下旨舞台、右侧六部“未参与”目录。
  - 筛选导致的无匹配继续显示紧凑空态；加载与读取错误分支未改变。
  - 中央空态不包含案卷、路径、部议、会审结论、回奏或史馆入口；未新增写请求、owner 参数或业务路由。
- 未通过项：无。

## Implementation Report

- 改动摘要：将成功读取但无案卷的军机处页面从整页空卡片改为完整三栏空态主舞台；保留筛选无匹配、加载和错误的既有语义。
- 自审：仅修改军机处场景、样式与离线测试；未触碰 BFF、案卷存储、下旨或归档流程。
- 实际使用的 skill：using-superpowers、brainstorming、writing-plans、subagent-driven-development、test-driven-development、verification-before-completion。
- 验证命令与结果：
  - `cd frontend; npm test -- --test-name-pattern=junjichu`：PASS，55/55。
  - `cd frontend; npm run lint`：PASS。
  - `cd frontend; npm run typecheck`：PASS。
  - `cd frontend; npm run build`：PASS。
  - `git diff --check -- frontend/src/features/junjichu-visual/JunjichuScene.tsx frontend/src/features/junjichu-visual/JunjichuScene.module.css frontend/src/features/junjichu-visual/JunjichuScene.test.ts frontend/src/features/junjichu-visual/junjichuController.test.ts`：PASS（仅行尾转换提示）。
- 未运行项与原因：全量前端测试、后端和 harness 门禁未作为本次仅前端空态改动的验收项；此前已知后端 Python 环境和无关全量门禁问题不在本任务范围内。
- 剩余风险：无已知任务范围内风险。
