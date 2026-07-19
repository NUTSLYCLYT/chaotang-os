# 变更摘要：docs-super-task-delivery-design-20260718

| 字段 | 值 |
| --- | --- |
| Change ID | docs-super-task-delivery-design-20260718 |
| 类型 | docs |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 2026-07-18 |

## 范围

- 主线：根级跨前后端产品与架构设计，不修改运行时代码。
- 文件：`docs/plans/chaotang-os-super-task-delivery-blueprint-2026-07-18.md`、`docs/README.md` 与本 change 记录。
- 验证：`node scripts/harness-doctor.mjs`、`git diff --check`、文档事实路径核对。

## 结论

- 目标产品冻结为“一旨一案、一案一包、一包可行动、每个结论可追溯”。
- 采用控制/工作/证据/成果四平面，六部负责治理、动态任务司与蜂群负责具体能力。
- 首期复用 canonical task、outbox、worker 和事件账本，不引入 LangGraph。
- OpenClaw 定位为可替换出站 worker/渠道驿站，Hermes 定位为隔离研究与技能候选工坊；两者均不接管任务、证据、授权和知识事实源。
- “Humen”按销售外联 Humen、语音 Hume AI 与人工审批层三种可能解释明确分流，待准确链接后选型。
- 知识库以 SQL 控制面、不可变对象、可重建检索投影、史馆案卷和追加式 outcome 分层；旧知识与现有飞轮旁路在收口前保持禁写/隔离。
- 日常复杂任务默认 6 个逻辑角色，按证据缺口扩缩；丞相为唯一主对话，钦天监仅在时机/情景能改变选择时出现。
- 先修复超域误路由与硬封驳，再建设成果包与两个黄金旅程。
