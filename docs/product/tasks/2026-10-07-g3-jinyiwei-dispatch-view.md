# G3 锦衣卫事实分发视图（2026-10-07）

## Status

Ready

## Product Definition

锦衣卫案卷页在已有真实只读调查数据上展示“事实 → 证据 → 回奏”的透明分发视图。视图只读取已由服务端校验的案卷详情，不新增调查、写入、模型调用或权限入口。

## Acceptance Criteria

- [ ] 仅由真实 `JinyiweiDetail` 的 `requiredFacts`、`evidenceByFact`、`resolvedFacts` 和 `adoptions` 计算展示行。
- [ ] 每个事实明确显示证据数量、核验状态和关联回奏数量；没有证据时显示“尚无证据”，不得推断结论。
- [ ] 视图沿用锦衣卫现有朝堂视觉 token，移动端可读，不增加空按钮或伪操作。
- [ ] 未选案卷、详情加载中或详情失败时不显示伪造分发数据。
- [ ] 组件契约测试、前端全量测试、构建、类型检查、lint 和根 Harness 通过。

## Delivery Constraints

只修改本任务登记的锦衣卫前端组件和测试；沿用现有只读 API 与结果契约，不新增 API、路由、权限、数据库、模型调用、外部网络或桌面窗口操作。

## Affected Modules

- `frontend/src/features/jinyiwei-visual/JinyiweiScrollDesk.tsx`
- `frontend/src/features/jinyiwei-visual/JinyiweiScrollDesk.module.css`
- `frontend/src/features/jinyiwei-visual/JinyiweiScrollDesk.test.ts`

## Technical Plan

1. 增加纯函数，将已校验案卷的事实、证据和回奏引用归一为稳定的分发行。
2. 在案卷正文的证据留痕区域展示分发行；数据未就绪时保持原有加载/失败状态。
3. 用测试锁定空证据、未解决事实、重复回奏和确定性排序边界。

## Acceptance Review

翰林院需确认：展示值全部来自现有只读案卷契约；视图不改变调查状态、不写入结果账，也不把“有页面”当成真实调查执行。

## Rollback

回退产品子提交到批准父提交 `431644905ff77522d27b25ce663738e542e16bdd`；无数据迁移和外部状态写入。

## Implementation Report

待产品子提交后填写实际改动、测试命令、开始/结束时间和未验证项。
