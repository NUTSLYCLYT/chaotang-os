# G3 结果卡进入史馆结果账（2026-10-07）

## Status

Ready

## Product Definition

当成果人工确认链路已经核验到真实史馆回奏时，结果卡要给出明确的“记录结果反馈”入口。该入口只跳转到现有史馆页面并携带已由服务端核验的回奏 ID；用户仍在史馆中选择结果、填写发生时间并主动提交，系统不自动写入结果账。

## Acceptance Criteria

- [ ] 只有服务端返回并由现有 /api/shiguan/archives/:replyId 核验为 REPLY 的 ID，才显示“记录结果反馈”。
- [ ] 入口跳转到现有史馆档案页，复用已有结果账读取、写入、幂等和失败恢复能力。
- [ ] 未关联回奏、回奏不可访问、未登录或旧成果状态不显示伪造反馈入口。
- [ ] 不新增 API、路由、权限、任务系统、模型调用或外部网络。
- [ ] 组件契约测试、前端全量测试、构建、类型检查、lint 和根 Harness 通过。

## Delivery Constraints

只修改本任务列出的两个前端文件，沿用现有朝堂视觉 token、回奏卡和史馆路由；不更改后端或结果账契约。

## Affected Modules

- 模块：上书房成果人工确认卡、史馆结果账入口。
- 允许路径：rontend/src/features/study-visual/StudyArtifactConfirmation.tsx、rontend/src/features/study-visual/StudyArtifactConfirmation.test.ts。
- 依赖模块：现有 StudyArtifactLinks 的回奏核验、ShiguanClient 的 eplyId deep link 和 ShiguanOutcomePanel。

## Technical Plan

在 StudyArtifactConfirmation 的 erifiedReplyId 对应区域增加一个无副作用的史馆入口。入口使用与“查看对应回奏”相同的已编码 eplyId，文案明确说明可在史馆记录结果反馈。用源代码契约测试锁定入口文案、核验条件和不自动写入边界。

## Acceptance Review

翰林院需确认入口只在真实回奏核验通过后出现，且不会在结果卡内自动调用结果账 API。

## Rollback

回退到父提交 $base；无数据迁移、无外部状态写入。
## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。
