# 变更摘要：fix-flow-store-legacy-tripwire-20260715

| 字段 | 值 |
| --- | --- |
| Change ID | fix-flow-store-legacy-tripwire-20260715 |
| 类型 | fix |
| 状态 | READY_FOR_CLAUDE_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260715 |

## 范围

- 主线：P2 legacy writer fail-closed、governance compat 持久化、迁移 telemetry、前后端依赖守门。
- 文件：`backend/src/{legacy_write_tripwire,migration_telemetry,legacy_writer_architecture,governance_compat_store}.py`、旧写调用点、`frontend/scripts/architecture-import-guard.mjs` 及测试。
- 验证：新增测试先 RED；178 backend targeted、tsc、5 项前端守门、ruff、三层 doctor 全绿；完整 nodetest 1013 pass / 7 个既有基线失败。

## 结果

- 7 个 legacy SQL writer 与 JSON review/retrospective writer 默认 fail-closed，精确 writer × operation 白名单见 `legacy-writer-allowlist.md`；rollback 开关仅止血且保留 bypass 计数。
- governance bills 从模块内 dict 改为现有 `DecisionTask` canonical adapter；重复 `_IMA_DOCS` 路由退役；ID collision fail-closed。
- outbox、DecreeExecutionEvent、FinalMemorial 指标只在事务成功后计数，rollback 不计，幂等 replay 不重复。
- chaotang 待吸收端点和 chaotang_store 读写输出 caller 标识 deprecation 计数，供 P3 用流量证据逐端点拆除。
- 后端 AST gate 与前端 Node import gate 冻结当前精确依赖面；新增符号、module import、side-effect attic import 或跨本地引擎 import 均会让常规测试失败。

## 数据安全

测试使用隔离 DB；主仓生产 `backend/var/data/fengqun.db` SHA-256 复核仍为 `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`。
