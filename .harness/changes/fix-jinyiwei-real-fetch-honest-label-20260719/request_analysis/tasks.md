# 任务：fix-jinyiwei-real-fetch-honest-label-20260719

## 任务 1：sec_edgar 真取证模块（G1+G2）

- 目标：EDGAR 免 key 真 GET + 全量 ticker→CIK 表。
- 输入：SEC `company_tickers.json`、companyfacts API。
- 输出：`backend/src/sec_edgar.py`（~110 行）。
- 验证命令与证据：`tests/test_sec_edgar.py` 5 用例全 mock；真网 smoke NVDA verified=True。
- 回滚边界：删模块 + revert 接线。
- 完成定义：缓存/回退/失败路径全覆盖，不编造可达性。

## 任务 2：contract 诚实标（G4）

- 目标：删 `LIVE_SWARM` 硬编码，三态标 + verified 字段。
- 输出：`finance_intel_loop_contract.py` 修改（fetcher 注入、source_label 计算、`official_sources_verified`、`evidenceVerified`、jinyiwei `verified`）。
- 验证命令与证据：`tests/test_finance_intel_loop_honest_label.py` 4 用例。
- 完成定义：json dump 无 `LIVE_SWARM`；标签落既有词表。

## 任务 3：router 接线 + 门禁升级

- 目标：`/complete` 真取证接入，标签统一，取证 timeline 真值。
- 输出：`shangshufang.py` 修改（import、fetcher 传参、四处标签、`evidence_complete` 加 verified 条件、timeline）。
- 验证命令与证据：`test_shangshufang_loop_api.py` 20 用例（含 stub fetcher 隔离）。
- 完成定义：无真验证不再宣称取证完成。

## 任务 4：候选收口

- 验证：全 suite 2817 passed（2 failed 为基线预存，对照干净 worktree 确认）；backend/root doctor 0 errors。
- 状态：staged 待业主逐行 diff 审；不 commit、不合入、不推送。
- 回滚边界：`git revert` 单提交。
