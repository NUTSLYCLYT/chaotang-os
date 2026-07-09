---
name: e2e-test-write
description: 为用户可见前端流程编写或规划 Playwright 验证。
---

# E2E 测试 Skill

## 适用场景

- 页面、导航、表单、弹窗、状态展示。
- 浏览器可见的 source label。
- 发布烟测。
- 视觉或交互回归。

## 原则

- 使用真实浏览器验证用户会看到的东西。
- mock 只能证明前端状态处理，不能证明外部运行质量。
- 涉及运行事实时，要记录 API 契约、环境变量和运行证据来源。

## 输出

更新：

- `e2e_test/e2e_plan.md`
- `e2e_test/e2e_summary.md`
