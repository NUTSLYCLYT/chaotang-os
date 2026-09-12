# C01B 深链失败后的筛选恢复

## Status

Draft

## Product Definition

- 用户确认：以已接收 C01A 候选的阶段一集中 Claude 审查为依据；P2 已于 2026-09-12 在当前主线以临时只读回归脚本复现。尚未获得本后继批准包的 Owner 摘要确认。
- 问题：用户打开不存在、无权或暂不可用的回奏深链后，若改用史馆筛选，索引状态可能永久停在“正在读取”，使筛选按钮被禁用，用户只能刷新页面恢复。
- 目标用户：从学习成果或历史链接进入史馆、需要从失败中继续筛选和处理档案的已认证用户。
- 目标：深链读取失败后，新的列表筛选必须结束于 ready、empty 或 error，并保留可重试的失败提示；不得永久卡在 loading。
- 非目标：不改变回奏授权、BFF、后端、数据库、Outcome、筛选语义、深链成功行为、部署或产品 authority。

## Acceptance Criteria

- [ ] 深链读取返回 404、503 或网络失败后，用户执行筛选，列表状态不再停留在 loading；筛选控件恢复可用。
- [ ] 失败深链仍可通过既有“重试档案”入口重新读取相同目标，且成功后进入既有选档和结果账生命周期。
- [ ] 筛选结果为非空、空和再次失败时分别呈现 ready、empty、error；不把旧档案或旧深链视为本次成功。
- [ ] 手动选档、后续新深链、401 清理和晚到响应的既有代际隔离不回归。
- [ ] 候选仅改动本卡 manifest 固定的两条产品路径，完整前端门禁、根 Harness、实际隔离浏览器恢复操作和独立审查通过。

## Delivery Constraints

- 范围：仅 `frontend/src/app/shiguan/shiguanController.ts` 与其同目录测试；不得扩展为 C01A 或 B1 的重做。
- 兼容性：保留已接收 B1 的结果账状态机、C01A 精确 REPLY 深链和 owner/session 边界；必须以当前 `ext-dev` 的精确后继基线实施。
- 风险与限制：此修正的用户影响是恢复可用性。不得用清空错误或放宽授权来掩盖；只在隔离工作区和临时数据中验证，不调用真实模型或生产服务。
- 技能计划：无。遵循项目 Harness、ADR 0028、RED→GREEN 与 worktree 规则。
- Codex-only：是。本批不调用 Claude CLI；完成候选后由独立 Codex Review 复核，阶段后续集中 Claude 审查另行安排。

## Affected Modules

- 模块：太史馆档案索引与精确回奏深链恢复状态机。
- 允许路径：`frontend/src/app/shiguan/shiguanController.ts`、`frontend/src/app/shiguan/shiguanController.test.ts`。
- 依赖模块：既有 `ShiguanWorkspace`、BFF 精确档案读取与 Outcome 状态机；本批不修改它们。

## Technical Plan

- 架构边界：把失败深链的“可重试目标”与“阻止列表状态完成的活动深链目标”区分。筛选发起新的列表读取后，列表状态必须由该请求终结，不能被已失败的深链目标提前返回截断。
- 接口与依赖：不新增 HTTP 路由、字段、持久化或权限。`retryArchives` 必须仍能使用保留的失败目标重新请求精确档案。
- 实施顺序：先将已复现路径加入控制器回归；再进行最小状态机修复；运行针对性回归及完整前端门禁；使用隔离 loopback 前后端在浏览器完成“失败深链 → 筛选 → 重试/选档”的桌面和窄屏操作。
- 验证计划：404、503/网络、空筛选、再次筛选错误、手动选档、重试成功、401 和晚到响应；`npm test`、lint、typecheck、受控 build、根 Harness、机器候选门禁和独立审查。
- 技术风险：错误态与筛选请求竞态可能互相覆盖。回归必须断言请求代际和最终可见状态，而不只断言没有抛异常。

## Implementation Report

- 改动摘要：尚未实施；本卡只定义 P2 后继批准范围。
- 自审：已以临时只读 Node 回归复现“失败深链 → filter → archiveState=loading”。
- 验证：P2 复现脚本通过，证明当前主线存在该错误；尚未运行本后继的产品门禁。
- 实际使用的 skill：无。
- 验证命令与结果：`node --test /tmp/c01a-p2-deep-link-filter-repro.test.mjs`：1/1 通过（断言现有错误复现）。
- 未运行项与原因：本后继尚未获机器 GO，不能修改或运行候选验收。
- 剩余风险：P2 未修复，当前主线仍存在失败深链后的筛选恢复缺口。

## Acceptance Review

- 验收结果：Pending。
- 验收证据：阶段一 Claude 审查报告、临时 P2 复现脚本及当前 `ext-dev` `a1c2022245f864ae749d3582b2e0ba99561114a6`。
- 未通过项：尚未取得本卡摘要确认、独立治理提交、准确机器 GO、产品候选、浏览器验收与独立审查。