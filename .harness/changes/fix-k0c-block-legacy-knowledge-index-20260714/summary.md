# 变更摘要：fix-k0c-block-legacy-knowledge-index-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-k0c-block-legacy-knowledge-index-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE_K0C_3 / K0C_REMAINS |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：封禁 `POST /api/knowledge/index` 直接 RAG 重建入口，不实现替代 writer。
- 文件：knowledge router/test/迁移说明、前端 OpenAPI 快照、root inventory/wiki/blueprint 与本变更证据。
- 验证：先得到 `200 != 409` RED；再运行聚焦/相邻 pytest、tsc、governance、三层 doctor、compile、diff/security。
