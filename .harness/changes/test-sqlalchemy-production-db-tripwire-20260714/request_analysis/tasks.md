# 任务：test-sqlalchemy-production-db-tripwire-20260714

## 任务 1

- 目标：pytest 连接默认生产 SQLAlchemy DB 前 fail closed。
- 前置条件：真实 DB 保留不动；其他脏工作区隔离。
- 输入：全局 conftest、默认 SessionLocal、现有 isolated factory。
- 输出：import-time 内存 URL + runtime blocked factory + 显式隔离迁移。
- 涉及文件：`backend/tests/conftest.py`、tripwire test、5 个 API test 文件、根 change、launch blueprint。
- 状态 / 数据变化：仅内存/临时测试数据；真实 DB 不变。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：单提交回滚测试/文档；不操作 DB。
- 完成定义：新门与迁移测试全绿，无新 tripwire full-suite 失败，真实 DB 三元一致。
