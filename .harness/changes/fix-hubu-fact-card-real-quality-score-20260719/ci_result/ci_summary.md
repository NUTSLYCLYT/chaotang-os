# CI 摘要：fix-hubu-fact-card-real-quality-score-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest tests/test_sec_edgar.py tests/test_finance_intel_loop_honest_label.py tests/test_finance_intel_loop_contract.py tests/test_shangshufang_loop_api.py` | 0 | 40 passed | 事实卡提取 + 分数推导 + 受影响端点 | pkt-a2 分支 worktree，2026-07-19 |
| 真网 smoke `gather_sec_evidence('NVDA')` | 0 | verified=True；5 指标 FY2026（营收 215.938B/净利 120.067B/总资产 206.803B/总负债 49.51B/现金 10.605B USD，全为 10-K 申报原值） | G3 真实性 | 同上 |
| `pytest -q`（全量） | 0 | 2839 passed / 37 skipped / 0 failed（231.88s） | 全后端回归 | 同上 |
| `grep quality_score=0.` contract | 1 | 零命中 | G5 常量清零 | 同上 |
| `python3 scripts/harness_doctor.py`（backend） | 0 | 0 errors, 0 warning(s) | 后端结构 | 同上 |
| `node scripts/harness-doctor.mjs`（root） | 0 | 0 errors, 0 warning(s) | 三层结构 | 同上 |

## 结果

G3（奏折无实质数据）与 G5（编造分数）候选修复完成：事实卡只呈申报原值、
分数全部可由检查项复算（verified=1.0、模板=0.5）。

## 未验证项

- 前端渲染 factCard：增量字段，未改前端；渲染归后续体验包。
- 非 USD 申报与外国私募发行人（20-F）：诚实缺席，规模化后再评。

## Diff 与回滚复核

- changed files：2 源码 + 2 测试扩展 + 本 change 四件套。
- diff review：无 API 路径/词表/前端/lockfile/providers/var 变化。
- 回滚是否演练：未执行；`git revert` 单提交原子恢复。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 事实卡 ≥3 项 10-K 申报值 | NVDA 5 指标 | PASS |
| 常量分数清零 | grep 零命中 + 分档单测 | PASS |
| 无新增回归 | 2839 passed | PASS |
| 结构完整 | 双 doctor 0 errors | PASS |
| packet 复审 | 待 R/candidate | PENDING |

## 声明状态

- `IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING`：候选完成，未合入、未推送。
