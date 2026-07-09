# 任务：chore-harness-architecture-doctor-20260709

## 任务 1

- 目标：对照参考 scaffold 审计当前 harness 期望。
- 输入：当前 `.harness/`、`scripts/harness-doctor.mjs`。
- 输出：聚焦 doctor 失败原因的差距清单。
- 验收：理解失败原因。
- 依赖：无。

## 任务 2

- 目标：修复 doctor 验证兼容性。
- 输入：`scripts/harness-doctor.mjs`。
- 输出：CRLF/LF frontmatter 解析与严格架构契约检查。
- 验收：skill frontmatter、package scripts、模板、MCP JSON、change 元数据、阶段状态和 delivered 阶段文件均可验证。
- 依赖：无。

## 任务 3

- 目标：补齐历史 change 审计记录。
- 输入：BFF removal、V1 taxonomy、V1 route-prune 变更目录。
- 输出：无遗留占位符的 delivered 记录、完整 taxonomy 阶段文件、规范 route-prune summary 元数据。
- 验收：delivered change 占位符扫描通过。
- 依赖：已有历史验证记录。

## 任务 4

- 目标：验证 harness 健康度。
- 输入：完整 harness 树。
- 输出：`node scripts/harness-doctor.mjs` 通过。
- 验收：0 errors，0 warnings。
- 依赖：任务 2 与任务 3。

