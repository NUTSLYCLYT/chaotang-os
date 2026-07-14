# 变更摘要：fix-k0c-block-legacy-knowledge-upload-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-k0c-block-legacy-knowledge-upload-20260714 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE_K0C_2 / K0C_REMAINS |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：封禁旧 `POST /api/knowledge/upload` 文件与索引双写入口；不实现替代 writer。
- 文件：后端集中 tripwire、knowledge router、聚焦测试/迁移说明，前端 OpenAPI 快照，根 inventory/wiki/blueprint 与本变更证据。
- 验证：先得到 `201 != 409` 的 RED；实现后聚焦与相邻 pytest、inventory/schema、doctor、compile、diff/security 均须通过。
