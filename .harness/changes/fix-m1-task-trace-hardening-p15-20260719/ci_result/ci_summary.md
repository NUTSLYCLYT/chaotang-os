# CI 摘要：fix-m1-task-trace-hardening-p15-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| B15 默认 trace 唯一性 Python 断言 | 1 | `('trace-unassigned', 'trace-unassigned')`，预期 RED | 缺陷复现 | P15 隔离 worktree，2026-07-19 |
| B15 冲突 trace ID Python 断言 | 1 | 冲突被静默接受，预期 RED | 缺陷复现 | 同上 |
| `python3 -m pytest -q tests/test_task_trace_contracts.py -p no:randomly` | 0 | 18 passed | 契约全部声明边界 | 同上 |
| `rg -n "TaskEnvelope|from_legacy\\(" backend/src backend/tests` | 0 | 命中仅契约文件与单测 | 调用面边界 | 同上 |
| `python3 -m pytest -q tests -p no:randomly` | 0 | 2738 passed, 37 skipped, 4 warnings, 0 failed | backend 全量回归 | 同上，271.66s |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端结构护栏 | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根三层结构 | 同上 |
| `git diff --check` | 0 | 无输出 | 候选格式 | 同上 |

## 结果

RED/GREEN 与 backend 全量回归通过。4 条 warning 与 P13/P14 基线一致，来自两个重复
FastAPI Operation ID 和两个 OpenClaw fallback 场景，不是本包引入。

## 未验证项

- 尚未接入真实生产调用方；生产接线属于后续 M1-B Packet。
- 尚未取得固定候选 SHA 的独立 Claude review；ext 合并/推送保持禁止。

## Diff 与回滚复核

- changed files：2 个后端文件 + 4 个根 change 证据文件。
- diff review：无 API、路由、数据库、队列、provider 或其他业务线变化。
- 回滚是否演练：未执行破坏性回滚；可 `git revert <implementation-commit>` 原子恢复。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 唯一默认 trace ID | RED 复现 + 唯一性测试 | PASS |
| 冲突输入 fail closed | dict/TraceContext 两条负例 | PASS |
| 类型与字段边界 | 非 Mapping、非法 trace、无关 BaseModel、extra/version 负例 | PASS |
| backend 无回归 | 2738/37/4/0 | PASS |
| 两级 doctor / diff | 0 errors, 0 warnings；diff 干净 | PASS |
| 独立 Packet 复审 | 等待最终 SHA | PENDING |

## 声明状态

- `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING`：实现、全量回归和结构验证完成；固定 SHA 复审待收口，未合入、未推送。
