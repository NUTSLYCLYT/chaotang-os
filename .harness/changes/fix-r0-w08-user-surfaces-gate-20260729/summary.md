# 变更摘要：fix-r0-w08-user-surfaces-gate-20260729

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w08-user-surfaces-gate-20260729 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / Product Acceptance |
| 创建日期 | 20260729 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening
- 文件：W08 acceptance runner, focused tests, user acceptance template/fixture/docs
- 验证：TDD RED/GREEN、W08 focused harness、closeout preflight、backend/root doctors、authority、diff hygiene

## 结论

W08 final user records now require `surfaces_used` to be exactly `["/shangshufang", "/shiguan"]`. This makes the closed-world frontend surface boundary machine-checkable without creating final user evidence or closing W08.
