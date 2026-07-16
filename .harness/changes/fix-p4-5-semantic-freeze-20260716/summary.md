# 变更摘要：fix-p4-5-semantic-freeze-20260716

| 字段 | 值 |
| --- | --- |
| Change ID | fix-p4-5-semantic-freeze-20260716 |
| 类型 | fix |
| 状态 | IN_PROGRESS（P4.5a-e VERIFIED） |
| Owner | Project Agent |
| 创建日期 | 20260716 |

## 范围

- 主线：后端语义事实源与根级跨包验收；不改前端既有 status 枚举。
- 文件：`backend/src/`、`backend/web/`、`backend/alembic/versions/012-013`、定向测试与本变更记录。
- 验证：每个微步 RED→GREEN、临时 SQLite 迁移链、真实库只读指纹、backend/root doctor；a–f 全部完成后统一独立停审。

## 当前进度

- P4.5a：`EmperorDecision.kind` 三值语义、全部 6 个生产写入口和迁移 012 已实现并验证。
- P4.5b：attempt-aware `execution_state`、失败/回执终态、两套读模型与 ADR 已实现并验证。
- P4.5c：质量门独立 import seam 已落地，原行为与兼容 patch target 保持不变。
- P4.5d：生产代码中 8 个 `CourtReview(...)` 写入调用已按路径/函数/数量冻结并由 AST 守门。
- P4.5e：swarm `department_sections` 已完整投影为严格 `DepartmentOpinionV1`，逐部门 signal/source provenance 不再丢失。
- P4.5f：待按批准顺序执行；P5 在 P4.5 获得 GO 前不得开始。
