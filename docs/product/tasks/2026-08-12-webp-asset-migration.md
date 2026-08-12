# 任务：项目图片迁移为 WebP

## Status

Ready

## Product Definition

- 用户确认：用户于 2026-08-12 确认转换范围，并选择“透明图无损、非透明图质量 82”的策略。
- 问题：项目仍有 PNG 运行时资源和产品文档素材，文件体积较大且格式不统一。
- 目标用户：项目使用者与维护者。
- 目标：将指定目录中的 27 个 PNG 全部迁移为可用的 WebP，并保持现有页面与文档引用有效。
- 非目标：不处理 `.superpowers` 验收截图，不重新设计或重绘图片，不修改业务流程。

## Acceptance Criteria

- [ ] `frontend/public` 与 `docs/product/assets` 中不再存在 PNG 文件。
- [ ] 27 个对应 WebP 保持原目录、基础文件名和尺寸。
- [ ] 透明源图使用无损 WebP 且保留透明通道；不透明源图使用质量 82。
- [ ] 指向这些资源的运行时代码、测试和 Markdown 引用全部更新为 `.webp`。
- [ ] 前端测试、lint、typecheck、build 与仓库 harness 通过。
- [ ] 同一最终版本连续完整通过 10 轮最终验收，并逐轮记录命令与结果。

## Delivery Constraints

- 范围：目标图片、对应引用、转换与验证脚本、本任务文件和设计/计划文档。
- 兼容性：页面行为、图片尺寸、透明效果和既有业务契约保持不变。
- 风险与限制：保留工作区现有改动；不访问网络；不提交、推送或部署。
- 技能计划：`using-superpowers`、`brainstorming`、`writing-plans`、`codex-engineering-workflow`、`test-driven-development`、`verification-before-completion`。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。

## Affected Modules

- 模块：前端静态资源与产品文档素材。
- 允许路径：`frontend/public/**`、`frontend/src/**`、`frontend/package.json`、`scripts/**`、`docs/product/assets/**`、`docs/product/tasks/2026-08-12-webp-asset-migration.md`、`docs/superpowers/specs/2026-08-12-webp-asset-migration-design.md`、后续对应实施计划，以及引用目标资源的 Markdown 文件。
- 依赖模块：前端现有 `sharp` 依赖树与 Node.js 工具链。

## Technical Plan

- 架构边界：以独立资源迁移/检查脚本处理文件，不把转换逻辑引入应用运行时。
- 接口与依赖：保持公开资源 URL 的目录和基础名称，仅改变扩展名。
- 实施顺序：先写失败检查，再转换资源，更新引用，删除源文件，最后完整验证。
- 验证计划：资源检查、前端 test/lint/typecheck/build、harness 与 10 轮最终验收。
- 技术风险：有损转换的像素差异、透明通道丢失、历史文档误替换和遗漏运行时引用。

## Implementation Report

- 改动摘要：待实施。
- 自审：待实施。
- 验证：待实施。
- 实际使用的 skill：待实施后填写。
- 验证命令与结果：待实施后填写。
- 未运行项与原因：待实施后填写。
- 剩余风险：待实施后填写。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待实施后逐条核对。
- 未通过项：待实施后填写。
