# 变更摘要：docs-product-r0-freeze-20260718

| 字段 | 值 |
| --- | --- |
| Change ID | docs-product-r0-freeze-20260718 |
| 类型 | docs |
| 状态 | VERIFIED_COMPLETE（docs-only）/ PR_MERGE_PENDING |
| Owner | Project Agent |
| 创建日期 | 2026-07-18 |
| 基线 | 远端 `feature-chaotang-ext@5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43`（审查期前进后已线性重基） |
| 变更分支 | `docs/product-r0-freeze-20260718` |
| 当前目标快照 | `feature-chaotang-ext@05582e520300e32a5d84e2b38b3822903f75c954`（2026-07-19；移动即重验） |

## 范围

- 把 `docs/product/PROJECT_PRODUCT.md` 收敛成当前唯一产品 SSOT：可信复杂任务超级助手。
- 冻结第一商业 Offer：中文、中国大陆法域、制造业/B2B 日常采购、销售、服务合同决策包。
- 新增 R0/R1 release PRD，明确一旨一卡一包、需求 ID、失败语义、数据边界、验收、rollout/rollback。
- 把六部 41 司定义为 `TARGET_DIRECTORY_V1`；登记、实现、Beta、生产分别治理。
- 把世界杯定义为跨域只读 benchmark，不作为 R1 Offer。
- 把旧 `FULL_COURT_V1 全量 L3 → 再定发布` 裁决替换为 `R0 内核 → R1 合同 Paid Pilot → R2 邀请制生产 → R3+ 证据化扩张`。
- 把融合蓝图固化为 accepted decision record，把超级任务蓝图标为 reference input。
- 把旧 launch、全朝廷闭环、V2 backlog、部门 Agent、唯一事实源、知识飞轮六份计划标为 historical/reference，截断旧 FULL_COURT 与 Step 0–12 执行权威链。

## 不变范围

- 不修改 `frontend/`、`backend/`、`scripts/` 或运行时代码。
- 不修改 harness 规则、manifest、contracts、黄金样例或不可变 `source_inputs/`。
- 不修改 M0–M10 工程计划；其 amendment 是下一份独立 change。
- 不接收真实合同、不启用第三方组件、不创建 release 分支、不发布生产。

## 验证

- 文档路径 allowlist 与源快照 hash。
- Git ancestry、无 merge commit、无本地 78 个分叉提交污染。
- Markdown diff、围栏、相对链接与关键词冲突检查。
- `node scripts/harness-doctor.mjs`。
- 精确候选 HEAD 的独立 stop-gate review。

## 2026-07-19 PR 追补

- PR !3 原 head `3c05aae...` 对最新目标可干净预合并，但精确内容终审发现 3 项权威残留；修复正文与审计证据已进入 7 路径提交 `b2627be...`。
- `b2627be...` 已通过 27 文件 scope/Markdown/link、source hash、diff check、root doctor 和合并态验证；其 exact review 只发现证据仍误写成“未提交候选”，未发现产品内容 blocker。
- 当前证据提交只纠正上述审计时态。最终 PR head 的 SHA 级裁决必须记录在分支外的独立 review/Gitee 门中，不再写回分支制造自失效新 SHA；正式合入前仍须刷新服务端预合并。
