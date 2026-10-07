# G3 成果下载、修改与复用（2026-10-07）

## Status

Ready

## Product Definition

用户在拿到真实回奏后，可以明确下载成果、提出修改或复用为新任务。复用只把带有上一回奏上下文的可编辑目标带回上书房；用户必须再次查看丞相复述、确认拟旨并主动下旨，旧成果不会自动变成新任务或继承验收结论。

## Acceptance Criteria

- [ ] 成果下载链接使用通用“下载成果”语义，不把所有文件误称为财务报告。
- [ ] 成功结果显示“提出修改”和“复用为新任务”两个明确动作，并说明会回到上书房。
- [ ] 两个动作都只填充可编辑的上书房目标，不自动调用模型、不自动下旨、不绕过人工确认。
- [ ] 原结果、来源、参与部门、验收和史馆回奏展示保持不变；失败或空结果不显示伪造动作。
- [ ] 结果复用专项测试、前端全量测试、构建、类型检查、lint 和根 Harness 通过。

## Delivery Constraints

只修改本任务列出的四个前端文件；不新增 API、路由、权限、任务系统、模型调用或外部网络。沿用现有朝堂视觉 token 和回奏卡结构。

## Affected Modules

- 模块：上书房成功结果卡与成果下载链接。
- 允许路径：`frontend/src/features/study-visual/DevStudyWorkspace.tsx`、`DevStudyWorkspace.test.ts`、`StudyArtifactLinks.ts`、`StudyArtifactLinks.test.ts`。
- 依赖模块：现有 `onDecreeTextChange`、结果契约、报告成果下载路径和上书房拟旨确认流程。

## Technical Plan

在成功回奏区域增加纯前端的下一步动作生成器：使用当前目标和最终结论组成可编辑的修改/复用草稿，调用既有 `onDecreeTextChange` 使上书房重新进入可编辑状态。下载链接只调整用户可见文案，不改变 URL。源码契约测试锁定动作文案、回到上书房语义和不自动提交边界。

## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。

## Acceptance Review

待翰林院复核；如果动作直接提交、绕过确认或把示例当成果，必须退回。

## Rollback

回退到父提交 `163c9b71667ad4eb70aa94b954acbbe6df521682`；无数据迁移、无外部状态写入。
