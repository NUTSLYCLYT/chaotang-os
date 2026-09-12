# C01C 深链失败后的筛选恢复与可见重试连续性

## Status

Draft

## Product Definition

- 事实：C01B 已在远端 `56e6fc4df26d4526575e3371adc93701541c4820` 以两文件治理提交落地，并取得一次产品 GO；其尚无产品候选。C01B 的两文件实施草稿只证明了控制器层 RED→GREEN，独立 TypeScript Review 返回 `NO-GO / P0`，独立 Security Review 返回 `NO-GO / P2`，不得提交、验证或继承为候选。
- 新发现一：C01B 的最小控制器修复可让筛选正确进入 `ready`、`empty` 或 `error`，但现有 `ShiguanWorkspace` 只在 `archiveState.status === "error"` 时渲染“重试档案”。筛选恢复为 `ready` 后，用户失去重试对应深链的可见入口。
- 新发现二：若精确深链请求自身返回 `401`，C01B 草稿先执行全局认证失效清理，随后又把原目标写回 `failedDeepLinkTarget`，使旧会话的私有对象标识在清理后复活。后继必须在任何重试状态写入前识别认证失效并 fail-closed。
- 目标用户：从学习成果或历史链接进入史馆、先遇到临时读取失败、随后需要筛选其他档案并仍可能返回该回奏的已认证用户。
- 目标：列表筛选与失败深链的重试状态分别呈现。筛选完成后控件恢复可用；若深链仍未成功，界面保留一个明确、可访问的“重试对应回奏”动作，重新读取相同目标并复用现有选档与结果账生命周期。
- 非目标：不改变回奏授权、BFF、后端、数据库、Outcome、筛选语义、深链成功行为、部署或 product authority。

## Acceptance Criteria

- [ ] 深链读取返回 404、503 或网络失败后，用户执行筛选，列表结束于 `ready`、`empty` 或 `error`，不再永久 `loading`，筛选按钮恢复可用。
- [ ] 在筛选成功或为空后，失败深链仍有独立、可访问的“重试对应回奏”入口；该入口重试相同目标，成功后进入既有选档和结果账生命周期。
- [ ] 列表筛选的成功、空与再次失败不覆盖或伪造深链成功；失败深链的提示不把已经恢复的列表标成错误。
- [ ] 精确深链自身返回 `401` 时，认证失效清理后不得保留或复活失败目标；随后调用重试不得再次读取旧目标。
- [ ] 手动选档、后续新深链、其他请求触发的 401 清理和晚到响应的现有代际隔离不回归。
- [ ] 候选仅改动 manifest 固定的三条产品路径，完整前端门禁、根 Harness、隔离生产模式浏览器的桌面与 360px 窄屏操作和独立审查通过。

## Delivery Constraints

- 范围：仅 `frontend/src/app/shiguan/shiguanController.ts`、`frontend/src/app/shiguan/shiguanController.test.ts` 与 `frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx`。
- 兼容性：保留已接收 B1 的结果账状态机、C01A 精确 REPLY 深链和 owner/session 边界；C01B 的两文件工作树只是未接收的实施草稿，必须在本任务准确父提交下重新实施。
- 风险与限制：不得用把列表维持在 error 的方式保留按钮；列表请求和失败深链必须有各自真实状态。只使用隔离临时数据和服务，不调用真实模型或生产服务。
- Codex-only：是。本批不调用 Claude CLI；形成候选后由独立 Codex Review 复核，阶段后续集中 Claude 审查另行安排。

## Technical Plan

- 在控制器中公开最小的失败深链恢复信息，不暴露档案内容、owner、会话或服务地址；精确深链自身返回 `401` 时先完成全局清理并立即结束该失败分支，禁止重新写入恢复信息。
- 在史馆索引面板中将列表 `StateNotice` 与失败深链恢复提示并置；恢复提示仅在存在失败目标时渲染，操作复用现有 `onRetryArchives`。
- 先为“失败深链 → 筛选 ready/empty/error → 仍可见重试 → 同目标成功”和“精确深链 401 → 清理 → 重试不再读取旧目标”写 RED；然后最小 GREEN。
- 实际浏览器使用隔离 FastAPI 和生产模式 Next：临时 ASGI 包装层只对已拥有的测试回奏首读返回 503，筛选经真实 BFF 返回 200，重试经同一 BFF 返回 200。桌面与 360px 窄屏各执行一次。

## Affected Modules

- 模块：太史馆档案索引、精确回奏深链恢复状态机与索引面板恢复操作。
- 允许路径：`frontend/src/app/shiguan/shiguanController.ts`、`frontend/src/app/shiguan/shiguanController.test.ts`、`frontend/src/features/shiguan-visual/ShiguanWorkspace.tsx`。
- 依赖模块：既有 `ShiguanClient`、BFF 精确档案读取与 Outcome 状态机；本批不修改它们。
## Verification

- `node --test frontend/src/app/shiguan/shiguanController.test.ts`
- `cd frontend && npm test && npm run lint && npm run typecheck && npm run build`
- `node scripts/check_harness.mjs`
- `node scripts/product-authority.mjs --verify-candidate --task CT-ENTERPRISE-C01C-DEEP-LINK-RECOVERY-UI-CONTINUITY-20260912`
- 独立 Codex Review 与隔离浏览器证据。

## Current Evidence and Remaining Work

- C01B RED：失败深链后筛选最终为 `loading`，已由新增控制器测试复现。
- C01B 局部 GREEN：控制器修复使上述回归通过，完整前端门禁为 `879/879`、lint、typecheck、build 通过；独立复审仍发现 P0 可见恢复缺口与 P2 自身 401 状态复活，因此这些字节只可作为 `UNCOMMITTED_BYTE_EVIDENCE_ONLY / NO_CANDIDATE_IDENTITY`。
- 浏览器已证实真实路径为精确深链 `503` 后筛选 BFF `200`，并发现筛选恢复后现有 UI 不再渲染重试按钮。C01C 最终验收必须在桌面与 360px 窄屏分别完成“失败深链 → ready/empty 筛选 → 可见重试 → 同目标成功”，不得用控制器直接调用代替用户操作。
- 尚未创建 C01C 批准提交、机器 GO、产品候选或推送；不部署。
## Implementation Report

- 改动摘要：尚未实施。C01B 两文件工作树中的控制器修复和测试仅作为 `NO-GO` 后的可复核字节证据，不属于本任务候选。
- 自审：浏览器通过真实 BFF 验证了 `503` 深链后筛选返回 `200`，同时证明现有 UI 在列表恢复后隐藏重试入口。
- 验证：本草案仅完成根 Harness 格式验证；尚未获得本任务摘要确认和机器 GO。
- 未运行项与原因：本任务尚未获 Owner 摘要确认，不能创建 C01C 产品候选或执行候选门禁。

## Acceptance Review

- 验收结果：Pending。
- 验收证据：C01B RED/GREEN 控制器回归、完整前端门禁、独立 TypeScript/Security Review 及隔离浏览器的失败深链→筛选 BFF 记录；它们不替代 C01C 最终候选证据。
- 未通过项：C01C 独立批准提交、机器 GO、三路径产品候选、完整浏览器重试操作、候选门禁和独立审查均未完成。
