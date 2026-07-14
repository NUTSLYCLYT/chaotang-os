# CI 摘要：fix-p2-tripwire-regression-20260715

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 两个目标测试 | 1 | RED：单写入口失败，遥测单跑通过 | 基线复现 | 2026-07-15 本地 |
| `test_chaotang_store.py` + 遥测目标测试 | 1 | RED：累计值为 2.0，硬编码 1.0 失败 | 顺序依赖根因 | 2026-07-15 本地 |
| 两个目标测试 | 0 | 2 passed | 最小修复 GREEN | 2026-07-15 本地 |
| `test_chaotang_store.py` + 遥测目标测试 | 0 | 5 passed | 顺序污染回归 | 2026-07-15 本地 |
| P2 相关测试组 | 0 | 19 passed | 单写入口、legacy tripwire、兼容持久化、架构、canonical metrics | 2026-07-15 本地 |
| 尚书房组合 | 0 | 38 passed，2 warnings | 冻结契约、loop API、outbox、丞相契约、诏令状态 | 2026-07-15 本地 |
| `python3 -m pytest -q` | 1 | 2603 passed、26 skipped、7 failed、4 warnings | 后端全量；两个 P2 失败已关闭 | 2026-07-15 本地 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors、0 warnings | 根项目护栏 | 2026-07-15 本地 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors、0 warnings | 后端 harness | 2026-07-15 本地 |
| `pnpm harness:doctor` | 0 | 0 errors、0 warnings | 前端 harness | 2026-07-15 本地 |

## 结果

两个 P2 回归均已关闭。全量测试新增 2 个通过项，剩余 7 个失败与修复前基线一致且不属于本变更范围。

## 未验证项

- 全仓测试尚未达到全绿：
  - `test_commit_closeout_check.py` 1 项（文档重复主题检测）。
  - `test_lawyer_rag.py` 4 项（真实法条资源不可用/未命中）。
  - `test_persona_registry.py` 1 项（`munger` roster 分类）。
  - `test_tianjian_verdict.py` 1 项（预期 6 项，实际 9 项）。
- 上述失败均未修改，需另立任务处理。

## Diff 与回滚复核

- changed files：`backend/src/governance_compat_store.py`、`backend/tests/test_flow_store_legacy_tripwire.py`、本根级变更记录 4 文件。
- diff review：仅 canonical 创建调用、遥测增量断言和证据文档；未触碰前端、大殿或 flow-store。
- 回滚是否演练：不做破坏式回滚；通过独立提交与文件级边界复核可回滚性。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 两个回归均先有稳定 RED 证据 | 上述两条命令 | PASS |
| 最小修复后目标测试 GREEN | 2 passed；顺序复现 5 passed；P2 组 19 passed | PASS |
| 尚书房冻结组合保持通过 | 38 passed | PASS |
| 三层 doctor | 均 0 errors、0 warnings | PASS |
| 后端全量测试 | 2603 passed、26 skipped、7 个非目标失败 | PARTIAL |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL
