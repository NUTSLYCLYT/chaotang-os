# 变更摘要：fix-r0-w08-task-card-doctor-gate-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-task-card-doctor-gate-20260729 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260729 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：`backend/harness/manifest.json`、`backend/tests/test_backend_harness_manifest.py`
- 验证：TDD RED/GREEN、backend/root doctors、W08 focused harness、W08 preflight、authority、diff hygiene

## 结论

W08 参与者任务卡现在被 backend harness manifest 声明为 required surface。backend doctor 会检查该文件存在，防止任务卡丢失后验收流程仍显示完整。
