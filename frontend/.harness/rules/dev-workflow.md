# 规则：11 阶段前端工作流

每个实质前端变更都应在 `.harness/changes/{change-id}/` 留下审计轨迹。

## 阶段 0：启动

入口：新会话或恢复任务。

输出：

- 读取 `AGENTS.md`、`.harness/agents/frontend-owner.md` 和相关规则。
- 找到当前 change，或创建一个新的 change。

门禁：

- 已确认工作目录是 `chaotang-os/frontend`。
- `node scripts/harness-doctor.mjs` 通过。

## 阶段 1：需求分析

输出：

- `request_analysis/spec.md`
- `request_analysis/tasks.md`

门禁：

- spec 包含背景、范围、非目标、验收标准和风险。
- tasks 包含目标、输入、输出、验收和依赖。

## 阶段 2：方案审查

输出：

- `request_analysis/review/spec_review_v1.md`

门禁：

- 结论为 `APPROVED`，或修改后重新审查。

## 阶段 3：实现

输出：

- 代码或文档改动。
- `coding/coding_report_v1.md`

门禁：

- 实现前已选择相关 type/build/guard。
- 文件位置符合 `.harness/rules/project-structure.md`。

## 阶段 4：代码审查

输出：

- `coding/review/code_review_v1.md`

门禁：

- 没有剩余 MUST FIX。
- 高风险区域有回归断言，或明确记录暂不需要的原因。

## 阶段 5：测试编写

输出：

- 按需新增单测、node 测试或 Playwright 测试。
- `unit_test/test_plan.md` 和/或 `e2e_test/e2e_plan.md`。

门禁：

- 测试类型与改动行为、风险匹配。

## 阶段 6：测试审查

输出：

- `unit_test/review/test_review_v1.md`

门禁：

- 测试证明行为，不只证明实现细节。
- 涉及用户可见行为时优先用 Playwright。

## 阶段 7：提交 / 推送

输出：

- 提交时 commit message 应包含 `Change: {change-id}`。

门禁：

- 不提交无关用户改动。

## 阶段 8：CI 验证

输出：

- `ci_result/ci_summary.md`

门禁：

- 使用足够小但能证明风险的检查，常见命令：
  - `pnpm exec tsc --noEmit`
  - `pnpm build`
  - `pnpm test:node` / `pnpm test:core`
  - `package.json` 中的领域 guard
  - `pnpm harness:doctor`

## 阶段 9：E2E 测试

输出：

- `e2e_test/e2e_summary.md`

门禁：

- 用户可见行为用 `pnpm test:e2e` 或聚焦 Playwright 路由检查证明。

## 阶段 10：部署验证

输出：

- `deployment/preview_report.md`

门禁：

- 面向发布的改动需要检查 build/start 路径和控制台健康。
- 端口保持 dev 3002、production 3050。

## 阶段 11：用户验收

输出：

- `summary.md` 状态更新为 `DELIVERED`，或明确保留为 `DRAFT` / `PENDING`。

门禁：

- 用户已确认，或剩余工作已清楚记录。

## 循环限制

- 方案审查最多循环 3 次，之后交给人决策。
- 代码/测试审查最多循环 2 次，之后交给人决策。
- 不删除旧审查文件；新增 `v2`、`v3` 等版本。
