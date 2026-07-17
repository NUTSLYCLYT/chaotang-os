# 变更摘要：chore-orphan-retirement-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | chore-orphan-retirement-20260717 |
| 类型 | chore |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

Packet ID: P6

## 范围

- 主线：跨前后端 P6 死码退役与 known-red 守门迁移。
- 安全实施：迁移 7 条前端 known-red；修复后端兼容派发 POST 的认证缺口；归档已证明 0 运行时引用的前端三省孤儿簇。
- 受阻项：`swarm_orchestrator.py` 仍被 canonical/平台运行面使用；两个 mock router 未满足 capability-entry 14 天零调用删除门；tracked `.bak` 在基线不存在。本 Packet 不绕过这些门。
- 验证：前后端专项测试、前端全量 node/type/build/censor/doctor、后端代表/全量 pytest、根 doctor。浏览器冒烟因两个许可端口均被其他工作树长期服务占用而未冒险重启，详见 `e2e_test/browser_smoke.md`。
