# 上书房下旨：未绑定的浏览器 fetch 被误报为后端不可达

## Summary

上书房将全局 `fetch` 直接作为依赖传入提交边界；在内嵌浏览器中，该函数随后以依赖对象的方法形式调用，失去 `window` 接收者并被拒绝。页面因此显示“无法连接朝堂后端”，即使 BFF 与 FastAPI 均可用。

## Root Cause

`StudyClient` 使用 `fetchImpl: fetch`，而 `requestStudySubmission` 通过 `dependencies.fetchImpl(...)` 调用它。该调用形式改变了接收者；当前浏览器运行时将其归类为网络失败。

## Prevention

显式传入 `window.fetch.bind(window)`，并由 `StudyClient.test.ts` 守护该绑定，避免重构时退回未绑定函数。

## Detection

真实浏览器下旨应按 BFF 的稳定错误分类显示结果。针对同一认证链路的 BFF 请求返回 `502` / `model` 时，页面必须显示模型调用失败，而不是后端不可达。

## Evidence

- `frontend/src/app/study/StudyClient.tsx`
- `frontend/src/app/study/StudyClient.test.ts`
- 浏览器复验：实际点击“下旨”后显示“丞相暂时无法给出回奏（模型调用失败）”。
