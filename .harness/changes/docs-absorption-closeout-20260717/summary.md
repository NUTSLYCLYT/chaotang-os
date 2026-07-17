# 变更摘要：docs-absorption-closeout-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | docs-absorption-closeout-20260717 |
| 类型 | docs（含 P7 指定测试 fixture 修复） |
| 状态 | VERIFIED_PARTIAL / READY_FOR_CLAUDE_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260717 |
| Packet ID | P7 |
| 基点 | `f5fa71459f61eb6c2041d30c485e321b1d4c7303` |

## 范围

- 主线：absorption P7 阶段对账，不是 campaign 最终终审。
- 文件：commit-closeout 测试 fixture、P7 KPI/Packet/deferred 证据、mainline 与 known-red 台账。
- 验证：RED→GREEN、P0 口径复算、相关/全量测试、三层 doctor、独立 Claude review。

## 当前结论

- 文档查重 known-red 已从可复现 RED 修到全文件 9 passed。
- P0 LOC `238894` → P6 ext `240856`，净 `+1962`，负增长目标未达。
- production legacy writer 授权为 0，但 10 个 rollback/test 定义仍在；前端旧裁决引擎
  production import 为 0，但 5 个 test/eval 定义仍在。
- 部门事实源目标达到 backend 1 + frontend 1。
- 连续 canonical 上升 / legacy 归零流量曲线缺失，禁止 campaign DONE。
- P8 未开工、P9 无顶层 Packet GO；P7 当前只可进入独立审查。
