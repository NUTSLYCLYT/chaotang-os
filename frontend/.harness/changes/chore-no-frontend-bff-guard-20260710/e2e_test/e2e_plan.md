# E2E 计划

## 覆盖范围

不适用（N/A）。本变更是 `frontend/scripts/harness-doctor.mjs` 的构建期/CI 期检查逻辑，
不涉及任何页面渲染、路由或用户可见的浏览器交互，没有可测的 UI 行为。

## 命令

无。

## 浏览器证据

不适用。验证方式是 `unit_test/test_plan.md` 里的子进程回归测试，覆盖了检查逻辑的
正常路径和两条失败路径。
