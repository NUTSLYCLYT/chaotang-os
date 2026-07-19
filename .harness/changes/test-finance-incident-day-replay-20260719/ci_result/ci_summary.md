# CI 摘要：test-finance-incident-day-replay-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest tests/test_finance_intel_incident_day_replay.py` | 0 | 3 passed | 三事故日场景 | pkt-a2 分支 worktree，2026-07-19 |
| `pytest -q`（全量） | 0 | 2842 passed / 37 skipped / 0 failed（266.27s） | 全后端回归 | 同上 |
| `python3 scripts/harness_doctor.py`（backend） | 0 | 0 errors, 0 warning(s) | 后端结构 | 同上 |
| `node scripts/harness-doctor.mjs`（root） | 0 | 0 errors, 0 warning(s) | 三层结构 | 同上 |

## 结果

台账 #3 落地为黄金回归；恐慌输入下红线、诚实阻断、人工裁决位全部钉死。

## 未验证项

- 真实行情数据回放（数值级）：归评测线（台账 ② perf-outcomes 一并考虑）。
- 前端恐慌场景渲染：不在本包。

## Diff 与回滚复核

- changed files：1 测试文件 + 本 change 四件套；零生产代码。
- 回滚是否演练：未执行；删文件/revert 即回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 三场景不变量 | 3 passed | PASS |
| 无新增回归 | 2842 passed | PASS |
| 结构完整 | 双 doctor 0 errors | PASS |
| packet 复审 | 待 R/candidate | PENDING |

## 声明状态

- `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING`。
