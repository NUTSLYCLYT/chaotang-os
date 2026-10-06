# G3 Windows Runtime Registry 与 SQLite 恢复修复

## Status

Ready

## Product Definition

修复 Windows 上已有 `decree_jobs.sqlite3` 重启恢复失败的问题，并让运行时登记与当前三表结构一致。目标是恢复真实 readiness、备份和归档链路；不打开外部模型、不改变 UI、不新增任务或权限体系。

## Acceptance Criteria

- [ ] 数据库 schema probe 使用数据库所在目录的临时目录，Windows 现有库可迁移、重开和清理。
- [ ] Runtime registry 登记 `decree_job_history_annotations`、`decree_job_idempotency_keys`、`decree_jobs` 三张表及当前 digest。
- [ ] 未知表、索引、触发器和未知 digest 仍然 fail closed。
- [ ] storage、readiness、SQLite backup/restore 相关测试通过，且不访问真实模型、外网或用户运行库。
- [ ] 候选必须通过精确批准、单亲子和完整验证；未通过前不得宣称客户可试用。

## Delivery Constraints

只修改登记的五个产品路径；不修改 authority、Harness、ADR 0028、权限、UI、模型开关、部署或远程数据；不删除数据库、不放宽 allowlist、不伪造 digest、不强推共享分支。

## Affected Modules

- 模块：decree job SQLite storage、runtime data registry、readiness/backup/storage 测试。
- 允许路径：`backend/app/decree_jobs/storage.py`、`backend/app/operations/runtime_data_registry.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_readiness.py`、`backend/tests/test_sqlite_backup.py`。

## Technical Plan

先在临时 Windows 数据库复现旧库迁移和重开失败，再把 schema probe 临时目录绑定到 `db_path.parent`；随后以当前三表实际结构更新 registry digest 和 required tables；运行 storage、readiness、backup/restore 及 diff 检查；失败时回退整个候选子提交。

## Implementation Report

候选尚未施工。先完成精确批准记录，再在批准的单亲子中实施；现有候选实验和证据仅作诊断参考，不作为已合入事实。

## Acceptance Review

Pending。真实多 Agent、外部模型、UI、翰林验收、史馆归档和 G3 封闭试用仍需后续验收门。
