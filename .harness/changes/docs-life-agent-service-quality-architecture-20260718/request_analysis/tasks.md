# 任务：docs-life-agent-service-quality-architecture-20260718

## 任务 1：汇总产品与服务质量架构

- 目标：把完成度门、MCP、用户体验、第三方边界和实施路线汇总为唯一根级规划文档。
- 前置条件：只读核对仓库边界、现有 M0–M10 计划与 MCP 配置。
- 输入：现有执行计划、仓库事实、已批准的外部集成原则。
- 输出：`docs/plans/chaotang-os-life-agent-service-quality-architecture-2026-07-18.md`。
- 涉及文件：根级计划文档和本 change 记录。
- 状态 / 数据变化：只新增/更新文档，不改变运行时状态。
- 验证命令与证据：`node scripts/harness-doctor.mjs`、冲突标记检查、Markdown 标题检查。
- 回滚边界：删除本 change 目录与计划文档即可；不影响代码或数据。
- 完成定义：文档覆盖架构、质量、MCP、Agent/Skill、UX、第三方和路线。

## 任务 2：建立执行优先级与现状审计

- 目标：回答“先做什么、为什么、目前还缺什么”。
- 前置条件：确认当前 Git、M1 契约、Agent/Prompt/Skill 数量及 mock/TODO。
- 输入：`git status`、`backend/src/contracts/task_trace.py`、`backend/agent_design/`、`backend/runtime_prompts/`、`backend/config/mcp_servers.yaml`。
- 输出：P0–P15 队列、完成度审计、首批 6 个 Packet。
- 涉及文件：同任务 1。
- 状态 / 数据变化：无运行时变化；所有判断带声明状态。
- 验证命令与证据：只读 inventory 命令、`git diff --check`、无冲突标记检查。
- 回滚边界：回退文档章节即可。
- 完成定义：愿景、已有资产、已验证实现与缺口不混淆；下一步唯一指向 P0 工程收敛。
