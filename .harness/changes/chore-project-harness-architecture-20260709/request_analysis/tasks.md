# 任务：chore-project-harness-architecture-20260709

## 任务 1

- 目标：新增根级 harness 入口。
- 输入：此前根目录缺少 AGENTS/README harness 地图。
- 输出：`AGENTS.md`、`README.md`。
- 验收：根文档指向 `.harness/`。

## 任务 2

- 目标：新增根级 harness 架构文件。
- 输入：前端 `.harness/` 与后端 `harness/` 基线。
- 输出：根 owner、rules、wiki、manifest、template 与 change 记录。
- 验收：文件存在，并编码全项目所有权。

## 任务 3

- 目标：新增根级 doctor。
- 输入：根 manifest 与子 harness。
- 输出：`scripts/harness-doctor.mjs`。
- 验收：根 doctor 通过，并委托前端 doctor。
