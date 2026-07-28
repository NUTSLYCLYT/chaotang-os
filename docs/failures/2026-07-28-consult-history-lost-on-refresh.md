# 丞相咨询刷新后丢失

## Summary

用户在 `/study` 与丞相完成多轮咨询后刷新页面，全部聊天记录消失。

## Root Cause

咨询状态只由 `StudyClient` 的 React 内存持有，并按 `EMPTY_CONSULT_STATE` 初始化；原 ADR 0030 还明确要求刷新即清空，因此不存在任何刷新恢复路径。这一产品约束与用户对聊天界面的持续性预期不一致。

## Prevention

把成功完成的咨询消息写入按认证 `user.id` 隔离、带版本号且严格校验的浏览器缓存。所有未来关于“页面会话”的产品契约必须明确区分组件内存、当前浏览器、当前账号和后端持久化四种生命周期。

## Detection

`frontend/src/app/study/chancellorConsultPersistence.test.ts` 自动验证账号隔离、合法恢复、非法缓存回退、20 条上限和存储异常；`StudyClient.test.ts` 验证服务端认证用户 ID 跨入客户端，并绑定缓存读写。浏览器端到端的实际刷新仍需人工检查，因为当前项目不引入浏览器自动化框架。

## Evidence

- `docs/decisions/0030-chancellor-consult-chat-contract.md`
- `docs/decisions/0032-account-scoped-consult-browser-persistence.md`
- `frontend/src/app/study/chancellorConsultPersistence.ts`
- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/app/study/page.tsx`
