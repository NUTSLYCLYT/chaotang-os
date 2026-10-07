# G3 预算账本重启恢复与 schema 治理（2026-10-07）

## Status

Ready

## Product Definition

首个真实任务执行时，`TaskTokenBudget` 会在现有 `decree_jobs.sqlite3` 中创建两个受治理的预算表。当前存储层和运行时登记只接受三表 schema，导致第一次执行后重启失败并阻断本地试用。本任务只补齐这两个已知、固定结构的预算表状态，使预算、任务、readiness 与备份在重启后保持可恢复，同时继续拒绝任意未知对象。

## Acceptance Criteria

- [ ] 带有 `task_token_budget_v1` 与 `task_token_reservation_v1` 的已知 history schema 可以安全重开。
- [ ] 未知表、索引、触发器、额外预算对象或未知 digest 仍然 fail closed。
- [ ] runtime registry/readiness 接受该精确预算 schema，且不放宽到任意额外表。
- [ ] SQLite backup/restore 对该精确 schema 保持可验证。
- [ ] 不删除、重写或迁移用户现有数据库；不调用外部模型或网络。

## Delivery Constraints

只修改本任务登记的两个运行时模块及其对应测试。沿用现有 token 预算表 DDL、三表 schema、权限和结果契约；不新增数据库、任务系统、权限系统、API、UI 或发布流程。

## Affected Modules

- 模块：decree job SQLite storage、runtime data registry、readiness/backup/storage tests。
- 允许路径：`backend/app/decree_jobs/storage.py`、`backend/app/operations/runtime_data_registry.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_readiness.py`、`backend/tests/test_sqlite_backup.py`。

## Technical Plan

1. 为现有 history schema 与两个固定预算表记录确定性 schema digest。
2. 在 `DecreeJobStore` 中只允许该精确组合直接重开；不改变未知 schema 的拒绝行为。
3. 在 runtime registry 中按有序 digest 增加该精确兼容状态，使 readiness 与 backup 共享同一事实源。
4. 增加“预算表创建后重启”和未知对象拒绝的回归测试。
5. 运行 focused、backend full、ruff、Harness 及隔离重开证据。

## Rollback

回退本产品子提交到批准父提交 `ab76b122d599995c939e083ceed166351ceeda4d`；不触碰现有数据库文件。若候选验证不通过，不推送产品子提交。

## Acceptance Review

翰林院需确认：真实预算表组合可重启恢复，未知对象仍被拒绝，且没有将预算、权限或任务边界扩大为新的系统。

## Implementation Report

批准提交只包含本任务书和精确 M0 manifest；产品子提交尚未施工。当前已在隔离临时库复现：创建预算表后重新打开 `DecreeJobStore` 会返回 `decree_job_schema_unrecognized`。该证据不修改用户运行库，也不代表产品候选已完成。
