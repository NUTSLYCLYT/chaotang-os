# 变更摘要：fix-p5-1-literal-normalization-repair-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | fix-p5-1-literal-normalization-repair-20260717 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260717 |

Packet ID: P5.1

## 范围

- 主线：从远端 ext 精确前序 `bbb100004845331b314e5196e645125f25199a5f`
  fast-forward 修复 P5.1 的 CHECK/default 字符串字面量大小写误判。
- 文件：`backend/src/schema_adoption.py`、对应 adoption 回归、P5.1 既有变更记录、
  事故更正与本修复包证据。
- 事实源：SQL 字面量按原始字节语义保留；迁移 006/009 的
  `server_default="FALLBACK"` 是默认值大小写事实源。
- 验证：旧 RED / 新 GREEN、adoption 与 007–015 代表集、Ruff/compile、根/后端
  doctor、独立 Claude 精确 `B..H` review。
- 边界：不改写远端历史，不触碰冻结中的 P6 工作树，不连接真实数据库或服务。
