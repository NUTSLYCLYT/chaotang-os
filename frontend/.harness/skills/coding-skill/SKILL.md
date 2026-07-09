---
name: coding-skill
description: 按前端结构规则实现代码或文档改动，并留下实现记录。
---

# 实现 Skill

## 开始前

- 读取 active change 的 `spec.md` 与 `tasks.md`。
- 读取相关 `.harness/rules/`。
- 确认文件应该落在哪一层。
- 选择最小充分验证命令。

## 实现规则

- 保持改动范围贴合任务。
- 优先复用现有组件、adapter、类型和工具。
- 不复制外部运行执行、运行记录、质量基线和生产逻辑。
- 不把 DEMO 或 FALLBACK 写成 LIVE。
- 高风险改动要同步准备 review 和测试证据。

## 输出

更新 `coding/coding_report_v1.md`：

- 改了什么。
- 为什么这样改。
- 哪些文件属于本轮。
- 已运行或待运行的验证。
