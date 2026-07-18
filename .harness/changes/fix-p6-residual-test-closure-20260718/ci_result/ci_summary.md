# CI 摘要：fix-p6-residual-test-closure-20260718

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_persona_registry.py::test_real_roster_splits_into_two_benches backend/tests/test_tianjian_verdict.py::test_forecast_endpoint_end_to_end -p no:randomly`（修改前） | 1 | 1 failed, 1 passed；旧 `munger` 观点席断言 RED | 基点缺陷复现 | 隔离 worktree，2026-07-18 |
| `python3 -m pytest -q backend/tests/test_persona_registry.py::test_real_roster_splits_into_two_benches backend/tests/test_tianjian_verdict.py::test_forecast_endpoint_end_to_end backend/tests/test_legacy_router_telemetry.py -p no:randomly` | 0 | 4 passed | roster、钦天监隔离、7 个 legacy 入口遥测 | 隔离 worktree，2026-07-18 |
| `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2723 passed, 37 skipped, 4 warnings；234.35s | 后端全量回归与 known-red 当前口径 | 隔离 worktree，2026-07-18 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端 harness 结构 | 隔离 worktree，2026-07-18 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根/前端/后端三层委托结构 | 隔离 worktree，2026-07-18 |
| `git diff --check` | 0 | 无输出 | 当前未提交 diff 格式 | 隔离 worktree，2026-07-18 |

## 结果

候选实现与文档验证通过；未发现新增后端红灯。当前状态只证明 Packet P13 的测试
核销范围，不证明 14 天零调用、router 退役、P8/P9 总体验收或 campaign DONE。

## 未验证项

- 未运行浏览器验证：本包不修改前端或生产运行路径。
- 未观察 legacy/canonical 连续 14 天生产流量；router RETIRED 门保持阻塞。
- 独立 Claude Code 尚未对最终实现提交 SHA 复审；ext 合并与推送保持禁止。

## Diff 与回滚复核

- changed files：3 个后端测试、known-red 台账、4 个本 change 文档；无生产实现。
- diff review：精确范围不含旧 packet、P8/P9 前端残余、门下省/工部/M1 或运行产物。
- 回滚是否演练：未执行破坏性回滚；可用 `git revert <packet-commit>` 原子回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 基线 RED 可复现 | roster 旧断言 `1 failed, 1 passed` | PASS |
| 定向回归 | 4 passed | PASS |
| 后端全量无失败 | 2723 passed, 37 skipped | PASS |
| 台账自洽 | 后端 OPEN 0，7 项逐行 CLOSED，保留总体验收边界 | PASS |
| 三层结构与 diff | 两层 doctor 0 error/warning；diff check 通过 | PASS |
| 独立 packet 复审 | 等待最终 SHA | PENDING |

## 声明状态

- `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING`：本地实现与机器验证完成，等待独立复审；未合入、未推送。
