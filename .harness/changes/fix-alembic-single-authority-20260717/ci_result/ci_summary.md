# CI 摘要：fix-alembic-single-authority-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest` P5 相关 18 文件 | 0 | 104 passed, 6 skipped | authority、三起点迁移、worker、poller、auth、正式奏折 | 2026-07-17 |
| `ruff check` 新增/核心变更文件 | 0 | 通过 | Python 静态错误与导入 | 2026-07-17 |
| `python -m compileall -q src web scripts tests` | 0 | 通过 | Python 编译 | 2026-07-17 |
| `python scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness | 2026-07-17 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根级边界与 change | 2026-07-17 |
| 真实副本 `--apply --backup` | 0 | 010→014，integrity ok | 接管、备份 hash、数据保持 | 2026-07-17 |
| 真实服务 health + SQL trace | 0 | PID 4125135，schema at_head | 真实恢复和三案 | 2026-07-17 |

## 结果

P5-R0 已通过。生产主库 current/head 均为 `014_tenant_identity_tables`，旧卡单和
三类 canary 均有可审计终态。

## 未验证项

- 全量 pytest：2688 passed、24 skipped、26 failed；其中 19 个本轮相关失败已修复或
  迁移为 6 个明确 skip，余下 6 个在同一 HEAD 干净 worktree 可复现为既有基线；
  钦天监 1 项仅在含本机运行素材的工作区多出 3 条结果，不由本轮 diff 触发。
- PostgreSQL 主库被 strict gate 明确阻断，直至 legacy `src.tenant` 迁入 SQLAlchemy；
  本轮只认证当前 SQLite 生产形态。

## Diff 与回滚复核

- changed files：Alembic 004b/014、schema authority/adoption、worker/poller、startup/health、
  移除运行时 DDL 的业务调用点、测试与本 change record。
- diff review：stop-gate 修复了同进程长任务误回收、主库/身份库分裂、apply 无强制备份、
  成功重试残留 last_error 四项二阶问题；无未解决阻断项。
- 回滚是否演练：副本迁移和 stale 回收已演练；真实备份 SHA-256
  `8db7377b8d831f77bf37e95495726ceecf21250e44c92d1040eb0621c8ecf015`，保存在
  `backend/var/backups/fengqun-pre-p5-20260717.db`（运行态，不提交）。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| Alembic 为唯一生产 schema 写权 | runtime DDL guard 3 passed | 完成 |
| 非 head/未登记库 fail closed | schema authority 6 passed | 完成 |
| 接管失败零写入且 apply 强制备份 | adoption 5 passed + 副本演练 | 完成 |
| worker 不再永久 processing/0 | outbox 11 passed + 真实卡单 completed/1 | 完成 |
| 真实服务同版且三案可审计 | PID/health/SQL timeline | 完成 |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_COMPLETE
