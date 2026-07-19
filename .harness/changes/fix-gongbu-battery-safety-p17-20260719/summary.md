# 变更摘要：fix-gongbu-battery-safety-p17-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | fix-gongbu-battery-safety-p17-20260719 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW |
| Owner | Codex / Claude Code independent reviewer |
| 创建日期 | 20260719 |

Packet ID: P17

## 范围

- 主线：关闭 Opus 独立复审记录的工部储能物理安全 HIGH，并消除同类 fail-open 旁路。
- 文件：`backend/src/real_department_engines.py`、`backend/tests/test_real_department_engines.py`
  及本根级 change 证据目录。
- 行为：明确危险信号判 P0/black；其余储能事故判 P1/black 并强制人签；工部严重度
  不读取无逻辑版本的旧缓存。
- 基线：`9956a5a9a0a8ad5d8465c637dd8c7b81d08f50f8`（P16 已发布远端）。
- 验证：TDD RED 8 failed / 3 passed；修复后聚焦 11/11、跨门 70/70；后端全量
  2785 passed / 37 skipped / 4 warnings / 0 failed。

## 审查边界

- 本包不携带旧 `task/gongbu-p0-explosion-fix` 分支 ancestry，也不携带 Guoli、Census、Menxia
  或其他本地提交。
- P1/black 会增加人工复核量，这是物理安全 fail-safe 的明确成本，不伪装成零成本优化。
- P1 信号是否被所有未来派单入口消费属于后续端到端治理；本包以现有
  `signoff_gate.needs_signoff()` 的真实消费契约作回归证明。

PACKET_P17_READY_FOR_CLAUDE_REVIEW
