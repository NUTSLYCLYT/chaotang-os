# /study 第一旨恢复动作最小修复

任务编号：`OC-STUDY-FIRST-DECREE-RECOVERY-MINIMAL-20261003`

状态：`APPROVED_FOR_ONE_CHILD`（仅授权一个候选子提交；commit、push、merge、deploy 仍分别受门禁约束）

基线：`caba3eb7752b6da523ed8d2658dc8d3f272ac2f1`

## 目标

收敛 `/study` 第一旨闭环的恢复动作和恢复状态源：非 `DRAFT_READY` 的草案状态不能伪装成 `EMPTY`；恢复动作必须唯一、明确、可测试；渲染阶段不得清理 `sessionStorage`。

## 允许产品路径

- `frontend/src/features/study-visual/studyTaskCockpit.ts`
- `frontend/src/features/study-visual/DevStudyWorkspace.tsx`
- `frontend/src/app/study/decreeJobPolling.ts`
- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/features/study-visual/studyTaskCockpit.test.ts`
- `frontend/src/features/study-visual/DevStudyWorkspace.test.ts`
- `frontend/src/app/study/decreeJobPolling.test.ts`

## 非目标

- 不改后端、BFF、认证、数据库、部署和视觉基线。
- 不改变 `DRAFT_READY` 才能下旨的硬门槛。
- 不新增第二套状态机、任务账本或恢复存储。
- 不启用真实 provider，不接入生产数据。

## 验收

1. 非 `DRAFT_READY` 状态显示真实阻断和唯一恢复动作。
2. `EMPTY` 只表示没有草案。
3. 非法持久态在 render 阶段不会被删除；主动加载流程仍保持清理行为。
4. 相关前端测试、lint、typecheck、build 和根级治理检查通过。
5. 候选只修改本文件列出的 7 个产品路径。

## 回滚

候选失败时删除候选分支或按完整候选提交回退；基线提交不变。禁止 reset、clean、stash 和 force-push。
