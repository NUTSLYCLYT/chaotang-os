# 上书房下旨入口假绿

## Summary

上书房曾修复重复的下旨编辑器并通过静态回归测试，但用户随后仍在提交有效旨意时看到“无法连接朝堂后端”。该修复只证明点击入口唯一，未证明有效旨意的完整处理链路可用。

## Root Cause

此前验证只覆盖了组件源码中的按钮数量和回调绑定，没有用已认证会话验证同源 BFF 到 FastAPI 的提交边界，更没有区分参数校验、后端配置、模型调用和传输错误。因而 UI 入口修复被误当作后端连通性修复。

## Prevention

涉及下旨的修复必须分别验证：未认证短路、已认证空旨意的 422 BFF 转发，以及在不触发真实模型调用的条件下对有效旨意后端配置/模型异常的稳定分类。不得用组件静态断言替代跨进程 BFF 验证。

## Detection

将下旨 BFF 的已认证空旨意 422 场景保留在 `scripts/verify_integration.mjs`，并运行其对应测试与 `node scripts/check_harness.mjs`。人工排查时，先记录 `/health`、BFF 422 与有效旨意的脱敏状态码/`reason`，而不是只观察页面文案。

## Evidence

- `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
- `frontend/src/app/study/studySubmission.ts`
- `frontend/src/app/api/decrees/chancellor/route.ts`
- `backend/app/api/decrees.py`
- `docs/product/tasks/2026-07-28-study-decree-submit-entry.md`
