# 变更摘要：fix-gongbu-component-scope-p18-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | fix-gongbu-component-scope-p18-20260719 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW |
| Owner | Codex / Claude Code independent reviewer |
| 创建日期 | 20260719 |

Packet ID: P18

## 范围

- 主线：关闭 P17 Claude 记录的工部 scope 旁路，确保组件/危险任务在 direct、蜂群路由、
  六部路由和 fallback 四条路径都不能无人签继续。
- 基线：`05582e520300e32a5d84e2b38b3822903f75c954`（P17 已发布远端）。
- 实现：共享 `is_gongbu_safety_scope()`；组件词进入 canonical YAML；工部 fallback
  在真实引擎无结论时强制 `复核 + requires_human_confirmation=true`。
- 验证：实现前 4 failed；修复后 4 passed；跨模块 96 passed；后端全量
  2789 passed / 37 skipped / 4 warnings / 0 failed。

## 边界

- 不把旧本地分支合入，不改前端、数据库、provider 或 P17 审查证据。
- 危险字符命中会增加工部过度参审，这是 fail-safe 的已知成本；后续只能用结构化安全事实
  降级，不能恢复“引擎无结论就自动准奏”。

PACKET_P18_READY_FOR_CLAUDE_REVIEW
