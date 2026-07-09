# 任务拆解：chore-harness-migration-20260708

## 任务 1：新增 Harness 核心

- 目标：创建 `.harness/` 工程工作系统。
- 输入：当前 `chaotang-os/frontend` 结构。
- 输出：agents、rules、skills、wiki、templates、MCP index。
- 验收：必需文件存在，`harness-doctor` 通过。
- 依赖：无。

## 任务 2：接入脚本

- 目标：新增可编程 harness 入口。
- 输入：现有 `package.json` 与 scripts 目录。
- 输出：`scripts/harness-doctor.mjs`、`scripts/new-change.mjs`、package scripts。
- 验收：doctor 通过，new-change 能创建渲染后的 change 目录。
- 依赖：任务 1。

## 任务 3：更新入口文档

- 目标：让当前文档把 agent 路由到新的 harness 结构。
- 输入：根 `AGENTS.md`、前端 `AGENTS.md`、前端 `README.md`。
- 输出：当前三层架构入口说明。
- 验收：文档指向 `.harness/agents/frontend-owner.md` 与 `.harness/rules/*`。
- 依赖：任务 1。

## 任务 4：新增人工使用指南

- 目标：让日常 harness 用法和编写责任能从 `docs/` 找到。
- 输入：当前朝堂约束。
- 输出：`docs/HARNESS-USAGE-GUIDE.md`、`docs/AUTHORING-GUIDE.md`、`CLAUDE.md` harness 启动说明。
- 验收：`harness-doctor` 检查入口引用。
- 依赖：任务 1。

