# 变更摘要：fix-secret-decree-real-pipeline-migration-20260712

| Field | Value |
| --- | --- |
| Change ID | fix-secret-decree-real-pipeline-migration-20260712 |
| Type | fix |
| Status | DRAFT |
| Owner | Frontend Agent |
| Created | 20260712 |

## 阶段

| # | 阶段 | Status | 证据 |
| ---: | --- | --- | --- |
| 0 | 加载上下文 | DONE | 已加载 harness 上下文 |
| 1 | 需求分析 | DONE | request_analysis/spec.md, tasks.md |
| 2 | 需求复核 | DONE | 沿用已批准的 /home/ubuntu/.claude/plans/valiant-crunching-candy.md 阶段2 |
| 3 | 实现记录 | DONE | coding/coding_report_v1.md |
| 4 | 代码复核 | DONE | 见 coding_report_v1.md 验证小节 |
| 5 | 测试计划 | DONE | tsc + test:node + 真实浏览器提交密旨全流程 |
| 6 | 测试复核 | DONE | 989/995(同组既有失败) |
| 7 | 提交 / 收口 | TODO | 待提交 |
| 8 | CI 验证 | DONE | 三层 harness doctor 全绿 |
| 9 | E2E 验证 | DONE | 真实浏览器提交密旨→轮询到 awaiting_emperor_decision→确认 3 个真实 LIVE_ENGINE 部门意见 |
| 10 | 部署验证 | N/A | 本地 dev 验证，未涉及部署 |
| 11 | 用户确认 | AWAITING_REVIEW | 等待用户确认 |

## 说明

- 范围：密旨(secret 模式)从独立的 `chaotang.orchestrateAll()` → `OrchestrateResult` 兼容占位路径，迁移到和下旨共用的 `draft-edict/confirm-edict` 真实管线。`runOrderDecree` 加 `mode` 参数，`runSecretDecree` 变成薄封装；`secretBriefToEdict`(专门渲染占位数据的函数)整体删除，复用 `confirmedEdictToView`；退役 `chaotang.orchestrateAll`；移除 `DecreeInput.tsx` 里已经过时的"占位"诚实降级徽标(密旨现在是真功能，不再需要)。
- 风险：`court_compat.py::orchestrate_all` 后端端点本身未删除(有既有契约测试依赖它的形状，且可能有仓库外调用方)，只是前端不再调用——已加代码注释标注弃用状态。
- 验证：`pnpm exec tsc --noEmit`、`pnpm test:node`(989/995)、三层 `harness:doctor` 全绿、真实浏览器提交密旨全流程验证(见 coding_report_v1.md)。

