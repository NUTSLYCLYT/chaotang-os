# 变更摘要：chore-shangshufang-step0-contract-baseline-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | chore-shangshufang-step0-contract-baseline-20260714 |
| 类型 | chore |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：S1 唯一真源与可信基线；上书房契约 characterization
- 文件：backend/frontend 测试、launch plan、本 change 证据
- 验证：pytest、Node test、tsc、三层 doctor、diff、对抗复审

## 2026-07-14 Step 0 续办状态

- Task 4 正式入口清算已形成，仍保留 8 组明确阻断后续步骤的 UNKNOWN。
- Task 5 ADR-005 已冻结 D0/D1/D2、hard gate 与动态升级语义，只批准规划，不代表运行时已实现。
- Task 6 已新增 `golden-assets-plan.md`：冻结 10 条 D1、10 条 D2、10 条失败/对抗/恢复工作流，另列 D0 咨询契约，并独立冻结合同领域 schema、支持法域、风险分层、双人标注和数据授权边界。
- Task 7 已新增 `production-unknowns.md` 与 `data-governance-gate.md`：本机 runtime、仓库静态拓扑和 production-only 事实严格分层，所有无实名 owner/生产证据项明确 BLOCKED；真实客户数据门保持关闭。
- Task 8 最终绑定快照 `96d9a38`：真实 API 模式构建、TypeScript、前后端合同、上书房组合回归、三层 doctor、secret/diff 检查通过。此前 `direct_fallback` 超时已确认是沙箱拦截 asyncio 自唤醒 socket 的 `EPERM` 假阴性，沙箱外合同基线 6/6、最终 SHA 相关组合回归 38/38 通过，无需修改业务代码。最终 SHA 全量后端为 2601 passed / 26 skipped / 9 failed，9 项均属本 change 范围外资产、期望或并发合入的 P2 legacy-writer 门禁漂移；生产诊断仍 STOP，真实浏览器链未运行。整体状态保持 `VERIFIED_PARTIAL`，不申请 Step 1 或生产发布。
