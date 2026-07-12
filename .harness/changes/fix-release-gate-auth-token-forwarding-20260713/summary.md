# 变更摘要：fix-release-gate-auth-token-forwarding-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-release-gate-auth-token-forwarding-20260713 |
| 类型 | fix |
| 状态 | DONE |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：前端 production release gate 向后端 jiqun 受保护契约传递真实测试会话。
- 文件：`frontend/scripts/jiqun-contract-smoke.mjs` 及回归测试。
- 验证：`HARNESS_AUTH_TOKEN=... pnpm gate:prod-release` 全绿：doctor 4/4、浏览器 9/9、jiqun 5/5。
