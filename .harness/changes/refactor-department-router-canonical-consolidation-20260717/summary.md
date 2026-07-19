# 变更摘要：refactor-department-router-canonical-consolidation-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-department-router-canonical-consolidation-20260717 |
| 类型 | refactor |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：PKT-2 部门路由身份收口。
- 文件：`backend/harness/chaotang_department_protocol/departments.yaml`、`backend/src/shangshufang_loop.py`、`backend/src/chaotang_department_router.py`。
- 验证：路由/SSOT/上书房定向测试 29 passed；后续需补全量后端回归。
- 影响面：`route_department_task` 仍被 Web API、chancellor、persona harness、protocol harness 调用，因此保留兼容 API，未删除。
