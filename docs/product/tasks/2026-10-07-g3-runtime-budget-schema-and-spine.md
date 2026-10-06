# G3 预算账本重启恢复与六部 Runtime 绑定（2026-10-07）

## Status

Ready

## Product Definition

首个真实任务执行时，`TaskTokenBudget` 会在现有 `decree_jobs.sqlite3` 中创建两个受治理的预算表。当前存储层和运行时登记只接受三表 schema，导致第一次执行后重启失败；同时六部 Runtime 指纹门禁尚未登记本次受审实现。本任务补齐这两个固定预算表的重启、readiness、备份恢复和精确指纹绑定，继续拒绝任意未知漂移。

## Acceptance Criteria

- [ ] 带有 `task_token_budget_v1` 与 `task_token_reservation_v1` 的已知 history schema 可以安全重开。
- [ ] runtime registry/readiness 与 SQLite backup/restore 接受该精确预算 schema。
- [ ] 六部 Runtime 指纹门禁只增加当前实现与既有 successor 的精确兼容对，混搭、篡改和未知状态仍被拒绝。
- [ ] 未知表、索引、触发器、额外预算对象或未知 digest 仍然 fail closed。
- [ ] 不删除、重写或迁移用户现有数据库；不调用外部模型或网络。

## Delivery Constraints

只修改本任务登记的运行时模块、治理指纹和对应测试。沿用现有 token 预算表 DDL、三表 schema、权限和结果契约；不新增数据库、任务系统、权限系统、API、UI 或发布流程。

## Affected Modules

- 模块：decree job SQLite storage、runtime data registry、readiness/backup/storage tests、六部 Runtime fingerprint gate。
- 允许路径：`backend/app/decree_jobs/storage.py`、`backend/app/operations/runtime_data_registry.py`、`backend/tests/test_decree_job_storage.py`、`backend/tests/test_readiness.py`、`backend/tests/test_six_ministry_readiness_report.py`、`backend/tests/test_sqlite_backup.py`、`scripts/check_harness.mjs`。

## Technical Plan

1. 为现有 history schema 与两个固定预算表记录确定性 storage/runtime schema digest。
2. 在 `DecreeJobStore` 中只允许该精确组合直接重开；未知 schema 继续拒绝。
3. 在 runtime registry/readiness/backup 中按有序 digest 接受该精确兼容状态。
4. 将本次实际实现 fingerprint 与既有 successor fingerprint 绑定为一个明确兼容对，并补齐 Harness 自测与报告测试。
5. 运行 focused、backend full、ruff、六部报告、Harness 及隔离重开证据。

## Rollback

回退产品子提交到批准父提交 `edbb6a34f94c34ef0df2119782fe7d49bbce67f9`；不触碰现有数据库文件。若候选验证不通过，不推送产品子提交。

## Acceptance Review

翰林院需确认：真实预算表组合可重启恢复，未知对象仍被拒绝，六部 Runtime 只承认精确兼容对，且没有将预算、权限或任务边界扩大为新的系统。

## Implementation Report

批准提交只包含本任务书和精确 M0 manifest；产品子提交尚未施工。隔离复现已证明：创建预算表后重新打开 `DecreeJobStore` 会返回 `decree_job_schema_unrecognized`；当前实现 fingerprint 已计算并将在产品子提交验证中绑定。
