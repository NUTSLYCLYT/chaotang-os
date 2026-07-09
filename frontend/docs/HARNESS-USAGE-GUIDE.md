# Harness 使用指南

> 这是朝堂前端 harness 的日常使用手册。所有权与编写规则见 `AUTHORING-GUIDE.md`。

## 心智模型

```text
Prompt Engineering   -> 改善一次对话
Context Engineering  -> 改善一个上下文窗口
Harness Engineering  -> 设计可跨会话延续的工程系统
```

在这个仓库里，业务代码告诉浏览器如何运行；`.harness/` 告诉 agent 如何工作。

不要把它和根级运行评测资料混淆；前端 `.harness/` 是修改前端线时使用的跨会话工程系统。

## 目录地图

| 目录 | 用途 |
| --- | --- |
| `.harness/agents/` | Owner / 调度入口 |
| `.harness/rules/` | 不可绕过的约束 |
| `.harness/skills/` | 阶段操作手册 |
| `.harness/wiki/` | 当前项目事实 |
| `.harness/changes/` | 每个变更的审计轨迹 |
| `.harness/templates/` | 新 change 骨架 |
| `.harness/mcp/` | 工具 / server 索引 |

## 日常闭环

```bash
cd frontend
pnpm harness:doctor
pnpm harness:new-change feat short-name
```

然后填写生成目录：

```text
.harness/changes/{change-id}/
  summary.md
  request_analysis/spec.md
  request_analysis/tasks.md
  request_analysis/review/spec_review_v1.md
  coding/coding_report_v1.md
  coding/review/code_review_v1.md
  unit_test/test_plan.md
  unit_test/review/test_review_v1.md
  e2e_test/e2e_plan.md
  e2e_test/e2e_summary.md
  ci_result/ci_summary.md
  deployment/preview_report.md
```

## 阶段流

规范流程定义在 `.harness/rules/dev-workflow.md`：

```text
0 Bootstrap
1 Request Analysis -> 2 Plan Review -> 3 Coding -> 4 Code Review -> 5 Test Writing
                                                               |
                         7 Commit / Push <- 6 Test Review <----+
                              |
                8 CI Verify -> 9 E2E -> 10 Deploy Verify -> 11 User Acceptance
```

## 使用哪个 Skill

| 场景 | Skill |
| --- | --- |
| 第一次进入项目 | `.harness/skills/project-analysis/SKILL.md` |
| 把需求转成工作 | `.harness/skills/request-analysis/SKILL.md` |
| 评审计划 / 代码 / 测试 | `.harness/skills/expert-reviewer/SKILL.md` |
| 实现有边界的改动 | `.harness/skills/coding-skill/SKILL.md` |
| 静态 / 架构评审 | `.harness/skills/code-review/SKILL.md` |
| 增加领域测试 | `.harness/skills/unit-test-write/SKILL.md` |
| 增加浏览器测试 | `.harness/skills/e2e-test-write/SKILL.md` |
| 发布验证 | `.harness/skills/deploy-verify/SKILL.md` |
| 卡住诊断 | `.harness/skills/frontend-doctor/SKILL.md` |

## 验证菜单

选择最小充分集合：

```bash
pnpm harness:doctor
pnpm exec tsc --noEmit
pnpm build
pnpm test:node
pnpm test:core
pnpm test:e2e
pnpm guard:auth
pnpm guard:tenant
pnpm guard:realdata
pnpm gate:prod-release
```

## 常见规则

- 前端事实源与根级运行评测资料必须分开。
- 诚实标记 LIVE / MIXED / DEMO 能力。
- 能进入主闭环的能力，不要新建页面承载。
- 保持端口：dev 3002，production 3050，禁止 3001。
- 对重复出现的 agent 错误，优先加固 `.harness/`，不要只补业务代码。
