---
name: request-analysis
description: 把用户请求收束成前端可执行、可验证、边界清楚的规格。
---

# 需求分析 Skill

## 目标

把用户请求转成 `.harness/changes/{change-id}/request_analysis/spec.md` 和 `tasks.md`。

## spec.md 应包含

- 背景：为什么要做。
- 范围：本轮会改哪些行为、文档或工具。
- 非目标：本轮明确不做什么。
- 验收标准：怎样证明完成。
- 风险：哪些地方容易误伤。
- 验证计划：准备跑哪些命令。

## tasks.md 应包含

- 每个任务的目标。
- 输入。
- 输出。
- 验收方式。
- 依赖。

## 边界规则

- 如果请求依赖运行事实，必须说明需要哪类 API 契约、运行证据或根级项目证据。
- 不借机扩范围做无关重构。
- UI 请求必须说明是否需要浏览器证据。
- 文档或 harness 请求必须说明是否需要 `pnpm harness:doctor`。
