# 变更摘要：fix-r0-w07-test-fixture-20260726

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w07-test-fixture-20260726 |
| 类型 | fix |
| 状态 | VERIFIED_CANDIDATE / NOT_INTEGRATED |
| Owner | Codex |
| 创建日期 | 20260726 |

## 范围

- 主线：本地 `feature-chaotang-ext` 上的 R0-W07 authority 测试可靠性。
- 文件：仅测试夹具与本 change record；不修改 authority 运行时代码。
- 验证：EXT 分支上下文 focused RED/GREEN、108 项 authority 测试、root doctor、
  W07 `STOP / NO_ACTIVE_WORK_PACKAGE`。

## 边界

`NO_W07_ACTIVATION / NO_RUNTIME_CODE / NO_PUSH / NOT_DEPLOYED /
NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
