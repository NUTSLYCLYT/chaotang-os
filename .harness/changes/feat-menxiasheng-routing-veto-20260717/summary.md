# 变更摘要：feat-menxiasheng-routing-veto-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | feat-menxiasheng-routing-veto-20260717 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：PKT-3 门下省路由前置封驳/准奏 gate。
- 文件：`backend/src/menxia_veto.py`、`backend/src/chancellor/routing_service.py`、对应测试。
- 验证：门下 gate 3 passed；routing service 5 passed；黄金路由套件存在 4 个由 PKT-2 关键词收口暴露的基线失败，已记录。
- 边界：只审路由决定，不执行部门任务；封驳转人工确认，第三轮有限准奏并保留原因。
