# 变更摘要：refactor-chaotang-endpoint-absorb-20260715

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-chaotang-endpoint-absorb-20260715 |
| 类型 | refactor |
| 状态 | VERIFIED_PARTIAL（P3a 完成，P3b–P3e 待执行） |
| Owner | Project Agent |
| 创建日期 | 20260715 |

## 范围

- 主线：P3 chaotang legacy 链逐端点吸收；同一 change、同一任务分支，严格按 P3a→P3e。
- 当前检查点：P3a 已把史官 `lessons` / `archive-docs` 从 legacy 双读切到
  `ShiguanArchive` + 可选 `FinalMemorial` canonical 投影；返回信封与 CourtDoc 形状不变。
- 当前文件：`backend/web/routers/scribe.py`、三个相邻测试文件及本 change 证据。
- 验证：P3a RED 见 6 failed / 5 passed；实现后聚焦与史馆相邻回归 22 passed。
- 冻结边界：`backend/web/routers/throne.py` 未修改，其旧读依赖登记为
  `DEFERRED_REQUIRES_USER_DECISION`。
- 未完成：P3b taskDetail/stream、P3c dispatch、P3d daemon（受计数证据门约束）、
  P3e 白名单清零；P3e 前不得输出顶层 Packet 停审 token。
