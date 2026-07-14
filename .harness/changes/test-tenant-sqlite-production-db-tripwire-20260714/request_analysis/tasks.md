# 任务：test-tenant-sqlite-production-db-tripwire-20260714

## 任务 1：legacy tenant sqlite3 测试隔离

- 目标：pytest 永不通过 `src.tenant` 默认入口打开真实 `data/fengqun.db`。
- 前置条件：S2.3a SQLAlchemy tripwire 已完成；真实 DB 基线已记录。
- 输入：`src.tenant.DB_PATH/get_db/_get_db` 与 pytest collection 顺序。
- 输出：import-time 临时路径、connection-time fail-closed、RED→GREEN 回归证据。
- 涉及文件：`backend/src/tenant.py`、`backend/tests/conftest.py`、`backend/tests/test_production_db_tripwire.py`。
- 状态 / 数据变化：只创建测试进程临时 SQLite；真实数据库无变化。
- 验证命令与证据：见 `../ci_result/ci_summary.md`。
- 回滚边界：单提交反向回滚；无数据迁移。
- 完成定义：有效 RED、聚焦 GREEN、全量无新增失败、真实 DB 三元一致、doctor 通过。
