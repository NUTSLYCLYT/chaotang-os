# CI 摘要：fix-chaotang-dispatch-durable-fact-20260714

## TDD 证据

| 阶段 | 结果 |
| --- | --- |
| RED-1 | 3 failed：正式任务缺失、DB 故障假成功、失败后仍执行 |
| GREEN-1 | 11 passed：原子持久化与失败封驳通过 |
| RED-2 | 1 failed：缺少 `dispatch.started` 事件 |
| GREEN-2 | 17 passed：事件账本与幂等字段通过 |

## 最终验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| 15 个朝堂/主链/权限/账本专项文件 | 0 | 153 passed、1 skipped |
| `node --test scripts/capability-entry-governance.nodetest.mjs` | 0 | 3 passed |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings |
| `python3 -m py_compile ...` | 0 | 通过 |
| `git diff --check` | 0 | 通过 |

未运行全量后端、前端构建、浏览器 E2E、PostgreSQL staging 或 30 条黄金旨意。

## Diff 与回滚复核

- 无 schema、前端、部署配置和凭据变化。
- 并发生成的 `backend/knowledge/docs/ima_archived/*` 未跟踪文件不属于本变更，不纳入提交。
- 数据库故障从假成功改为封驳是本轮唯一有意的失败语义变化。
- 可整体 revert 单提交；无破坏性回滚操作。

## 声明状态

- `VERIFIED_PARTIAL`：派单切片完成；未验证全量测试、staging、黄金旨意和生产发布。
