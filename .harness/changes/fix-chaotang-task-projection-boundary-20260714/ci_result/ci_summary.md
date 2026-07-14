# CI 摘要：fix-chaotang-task-projection-boundary-20260714

## TDD 证据

| 阶段 | 结果 |
| --- | --- |
| RED | 6 failed、1 passed：孤儿/漂移/越权/攻击面问题被实证 |
| GREEN-行为 | 7 passed：投影与归属规则通过 |
| GREEN-扩大回归 | 160 passed、1 skipped |

## 最终验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| 17 个朝堂/权限/账本/契约专项文件 | 0 | 160 passed、1 skipped |
| `node --test scripts/capability-entry-governance.nodetest.mjs` | 0 | 3 passed |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings |
| `python3 -m py_compile ...` | 0 | 通过 |
| `git diff --check` | 0 | 通过 |

未运行全量后端、前端构建、浏览器 E2E、PostgreSQL staging 或 30 条黄金旨意。

## Diff 与回滚复核

- 新增一个归属 accessor、两条执行投影行为门和两条 P0-B 探针；无 schema 变化。
- 并发生成的知识归档文件不属于本变更，不纳入提交。
- 可整体 revert 单提交；不修改历史正式任务和执行数据。

## 声明状态

- `VERIFIED_PARTIAL`：任务投影切片完成；未完成旧奏折 review、staging 和生产发布验证。
