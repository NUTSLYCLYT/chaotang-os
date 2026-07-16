# 变更摘要：fix-alembic-single-authority-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | fix-alembic-single-authority-20260717 |
| 类型 | fix |
| 状态 | VERIFIED_COMPLETE |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：后端数据库迁移权威与正式下旨运行可靠性；根级记录只承接跨线证据。
- 文件：`backend/alembic/`、`backend/src/`、`backend/web/main.py`、`backend/scripts/`、定向测试与本变更记录。
- 验证：TDD、未登记旧库副本接管、空库/旧库到 head、启动 fail-fast、worker 失败收口、真实库备份/迁移/重启及三案 canary。

## 触发事故

2026-07-17 真实低风险下旨 `task_291fbdb9334b` 在确认后 180 秒无回奏。
`outbox_7ffe205f5ce85d63` 停在 `processing/attempts=0`。运行日志证明：7 月 14 日
启动的旧进程持有无 `tenant_id` 的旧 ORM 类，却懒加载新版 worker；worker 与其
异常处理连续两次访问 `event.tenant_id` 后线程退出。真实库无 `alembic_version`，
不能通过重试、单独重启或盲目 `alembic upgrade head` 安全恢复。

## 完成结果

- 主库由未登记、运行时混合建表状态显式接管到唯一 head
  `014_tenant_identity_tables`；生产启动只接受 current=head。
- 迁移工具只读预检后选择最高可信接管点 010，`--apply` 强制生成不可覆盖的
  SQLite 一致性备份并输出 SHA-256。
- 主库业务路径运行时 DDL 清零；测试 bootstrap 只允许隔离内存库和显式测试身份库。
- outbox 具备周期触发、跨进程残留回收、同进程租约保护、错误记录失败兜底，成功重试
  清空过期 `last_error`。
- 真实卡单 `task_291fbdb9334b` 已从无回奏恢复为 `awaiting_evidence`，outbox
  `completed/attempts=1`，时间线落下 reports、quality.blocked、memorial.blocked。
- 新服务 PID 4125135，健康接口报告 strict/current=head=014。
