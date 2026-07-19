# 变更摘要：fix-gongbu-component-scope-p18-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | fix-gongbu-component-scope-p18-20260719 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW_V2 |
| Owner | Codex / Claude Code independent reviewer |
| 创建日期 | 20260719 |

Packet ID: P18

## 范围

- 主线：关闭 P17 Claude 记录的工部 scope 旁路，确保物理组件/危险任务在 direct、蜂群路由、
  六部路由和 fallback 四条路径都不能无人签继续。
- 基线：`05582e520300e32a5d84e2b38b3822903f75c954`（P17 已发布远端）。
- 实现：共享 `is_gongbu_safety_scope()`；物理硬件词进入 canonical YAML；工部 fallback
  在真实引擎无结论时强制 `复核 + requires_human_confirmation=true`。
- 首轮审查：H18=`c67f6d8` 的 Claude v1 报告虽写 GO，但同时列出 F1=HIGH：单字危险
  信号把防火墙、聚焦、烧钱、爆款等普通业务语言伪造成储能消防指令；另有 F2=MEDIUM：
  canonical 未覆盖控制柜爆燃。HIGH 与 GO 自相矛盾，治理上按实质 NO_GO 停止 D6。
- v2 回修：危险信号只在明确物理领域内做 P0/P1 分档；`模组/单体` 仅在与端子、电压、
  析锂等物理上下文共现时入域；canonical 增加控制柜、配电柜、端子并移除歧义裸词。
- 验证：原四条 RED/GREEN 保持；v2 新增 3 条 RED 后 7 条合并回归全绿；跨模块
  99 passed；后端全量 2792 passed / 37 skipped / 4 warnings / 0 failed。

## 边界

- 不把旧本地分支合入，不改前端、数据库、provider 或 P17 审查证据。
- Claude v1 的矛盾 GO 审查提交仅保留在隔离本地历史，不进入候选 lineage，也不作为 approval。
- 已确认物理范围仍偏 fail-safe；领域外的单字危险字符不得生成储能消防内容。后续不得恢复
  “引擎无结论就自动准奏”，也不得用告警泛滥冒充安全。

PACKET_P18_READY_FOR_CLAUDE_REVIEW_V2
