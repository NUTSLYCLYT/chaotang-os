# 变更摘要：fix-k0c-block-legacy-court-flywheel-write-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-k0c-block-legacy-court-flywheel-write-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE_K0C_1 / K0C_REMAINS |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：K0C-1，封禁 `POST /api/court/action` 的 `feed_flywheel` 旁路知识写入；新客户端不再收到该动作，旧客户端重放由 runtime tripwire fail closed。
- 文件：集中式 legacy write policy、court router、后端动作生产者、前端类型/adapter/组件、聚焦测试、capability inventory、根 change 与知识飞轮蓝图。
- 验证：两轮有效 RED→GREEN、聚焦/相邻 pytest、capability inventory、root/backend doctor、compile/diff/security scan。
- 边界：只完成一个 legacy writer；8099、Q&A、Vault/brain DB/Qdrant 和其余业务 writer 仍待 K0C 后续纵切。
