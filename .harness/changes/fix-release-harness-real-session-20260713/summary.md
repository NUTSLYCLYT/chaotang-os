# 变更摘要：fix-release-harness-real-session-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | fix-release-harness-real-session-20260713 |
| 类型 | fix |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

- 主线：release harness 会话等价于真实登录，同时注入前端 cookie、后端 token cookie 和 study-edict COURT_TOKEN。
- 文件：final-release-harness、回归测试及两层 change 记录。
- 验证：4 tests passed；上书房与史馆 401 清零，study-edict PASS。
