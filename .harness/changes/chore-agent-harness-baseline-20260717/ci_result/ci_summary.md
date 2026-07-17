# CI 摘要：chore-agent-harness-baseline-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests -p no:randomly` | 1 | 2703 passed, 37 skipped, 7 failed；7 项均在既有 ledger | 后端全量回归 | 2026-07-17 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端护栏 | 2026-07-17 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根护栏 | 2026-07-17 |
| `git diff --check` | 0 | pass | 文档/JSON 空白 | 2026-07-17 |

## 结果

全量测试未全绿，但失败集合与 `.harness/changes/docs-full-court-v1-strategy-20260714/known-red-baseline-ledger.md` 精确一致；M0 未引入新失败。审计另有静态投影限制，已记录为非运行时结论。

## 未验证项

- 外部 required-check 尚未配置；Claude 独立复审待执行。

## Diff 与回滚复核

- changed files：仅本 change 目录（并行脏文件未 staged）。
- diff review：提交前 `git diff --cached --check` 与路径核对。
- 回滚是否演练：未执行；文档变更可删除目录回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 基线事实可复现 | capability-baseline.json + commit/branch | PASS |
| known-red 可对账 | 7 项与 ledger 一致 | PASS |
| 黄金分层 50 | golden-cases.md 配额 | PASS |
| 三层验证 | pytest/doctor/diff 记录 | PASS（pytest 为已知部分失败） |

## 声明状态

- `VERIFIED_PARTIAL`：已冻结并验证，因既有 7 项 known-red 与外部门禁缺失，不宣称完整发布就绪。
