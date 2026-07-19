# CI 摘要：fix-jinyiwei-real-fetch-honest-label-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest tests/test_sec_edgar.py tests/test_finance_intel_loop_honest_label.py tests/test_finance_intel_loop_contract.py tests/test_shangshufang_loop_api.py` | 0 | 35 passed | 新模块 + 诚实标 + 受影响端点 | pkt-a1 worktree，2026-07-19 |
| `pytest tests/test_canonical_chain_metrics.py tests/test_real_department_engines.py tests/test_p0b_cross_user_behavioral.py` | 0 | 78 passed | LIVE_SWARM fixture 消费方无回归 | 同上 |
| 真网 smoke `gather_sec_evidence('NVDA')` | 0 | cik=0001045810（全量表解析）、verified=True、companyfacts 200 | G1/G2 真实性 | 同上 |
| `pytest -q`（全 suite） | 1 | 2817 passed / 2 failed / 37 skipped | 全后端回归 | 同上 |
| 基线对照：同 2 个测试在干净 79b1eaa worktree | 1 | 同样 2 failed | 失败为基线预存，非本包引入 | docs-absorption-ledger worktree，2026-07-19 |
| `python3 scripts/harness_doctor.py`（backend） | 0 | 0 errors, 0 warning(s) | 后端 harness 结构 | pkt-a1 worktree |
| `node scripts/harness-doctor.mjs`（root） | 0 | 0 errors, 0 warning(s) | 三层结构 | 同上 |

## 结果

G1（零请求）、G2（两只票）、G4（假标）候选修复完成。链路降级路径全测；
真网验证一发命中（NVDA 非内置票，证明全量表与 companyfacts 均真实工作）。

## 未验证项

- 浏览器 E2E：本包不改前端；标签值落在既有词表内，前端合同校验器零改动。
- SEC 限流边界未压测（内测量级 ≤3 req/任务，远低于 10 req/s 红线）。
- 既有 2 个 AST 冻结测试失败为基线预存（并发线引入），归属另案，不在本包修。

## Diff 与回滚复核

- changed files：新增 3（模块+2 测试文件）+ 修改 3（contract/router/既有测试）+ 本 change 四件套。
- diff review：无 lockfile、前端、rules、providers 配置变化；无 var/ 运行态混入。
- 回滚是否演练：未执行；单提交 `git revert` 原子恢复。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 真取证（非模板拼接） | 真网 smoke verified=True | PASS |
| CIK 全量 | NVDA（非内置）解析成功 + 缓存/回退单测 | PASS |
| LIVE_SWARM 消失 | 测试断言 json dump 无此值 | PASS |
| 三态标全路径 | 4 用例（verified/template/失败/用户自带） | PASS |
| 无新增回归 | 全 suite 对照基线 | PASS |
| 业主逐行 diff 审 | staged 待审 | PENDING |

## 声明状态

- `IMPLEMENTED_CANDIDATE / OWNER_DIFF_REVIEW_PENDING`：staged，未 commit、未合入、未推送。
