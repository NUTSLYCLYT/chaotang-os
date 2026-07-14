# CI 摘要：fix-compat-decision-task-adapters-20260714

## TDD 证据

| 阶段 | 命令 | 结果 |
| --- | --- | --- |
| RED | `pytest -q backend/tests/test_compat_decision_task_adapters.py` | 3 failed：正式任务均不存在 |
| GREEN | 兼容适配 + 契约 + registry 专项 | 33 passed |

## 最终验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| 9 个朝堂主链/权限/账本/契约专项文件 | 0 | 85 passed，2 个既有 OpenAPI warning |
| `node --test scripts/capability-entry-governance.nodetest.mjs` | 0 | 3 passed |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings |
| `python3 -m py_compile ...` | 0 | 通过 |

未运行全量后端、前端构建、浏览器 E2E、PostgreSQL staging 或 30 条黄金旨意；本轮状态不升级为完整发布验证。

## Diff 与回滚复核

- 无 schema、前端、部署配置和凭据变化。
- 仓库中并发出现的若干 `backend/knowledge/docs/ima_archived/*` 未跟踪文件不属于本变更，不纳入提交。
- 变更可用单提交 revert；无破坏性回滚操作。

## 声明状态

- `VERIFIED_PARTIAL`：代码级事实主链已验证；未运行 staging 黄金旨意、生产发布和旧入口遥测观察。
