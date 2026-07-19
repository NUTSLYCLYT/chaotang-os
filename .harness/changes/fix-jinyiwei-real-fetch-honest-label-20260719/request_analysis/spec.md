# 规格说明：fix-jinyiwei-real-fetch-honest-label-20260719

## 背景

`docs-mainline-a-truth-audit-20260719` 审计判定：锦衣卫取证零网络请求（URL
模板拼接、CIK 仅两只票），session 级 `source_label` 硬编码 `LIVE_SWARM`（HIGH
诚实违规）。真取证与诚实标必须捆绑修——先修标签会让界面全变 FALLBACK，
观感是降级；捆绑修则用户看到升级。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 前端标签词表固定 `LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO` | `frontend/scripts/validate-*.mjs` | rg 全仓扫描 | 否（方案落词表内） |
| 已确认事实 | EDGAR 免 key 可用 | 真网 smoke：NVDA 全量表解析 + companyfacts 200 | 本 worktree 实跑 2026-07-19 | 否 |
| 已确认事实 | 生产调用方两处 | `swarm.py:265`、`shangshufang.py:1997` | rg | 否 |
| 已确认事实 | 两个 AST 冻结测试基线预存失败 | 干净 79b1eaa worktree 同样失败 | pytest 对照 | 否，范围外记录 |

## 数据流与调用链

`/complete` → `build_finance_intel_session(evidence_fetcher=gather_sec_evidence)`
→ `resolve_cik`（全量表，var 缓存）→ companyfacts 真 GET → `verified` 三态标
→ session/task/review/edict 标签一致 → timeline 取证真值。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `source_label` 值域 | 前端合同校验器 | 全链 | 只用既有 `LIVE/FALLBACK`，零扩展 |
| `evidenceVerified` / `official_sources_verified` | contract 新增字段 | 前端可选消费（增量字段，非破坏） | 新测试断言 |
| `evidence_fetcher` 注入点 | contract 签名 | router / 测试 stub | 默认 None 保持旧行为 |

## 范围

- 新增：`backend/src/sec_edgar.py`、`tests/test_sec_edgar.py`、`tests/test_finance_intel_loop_honest_label.py`。
- 修改：`finance_intel_loop_contract.py`（fetcher 注入 + 三态标 + verified 字段）、`web/routers/shangshufang.py`（接线 + 标签统一 + 门禁升级）、`tests/test_shangshufang_loop_api.py`（stub fetcher 断网隔离）。
- 本 change 四件套。

## 非目标

- 不动 quality_score 常量、户部实算（A2）。
- 不动 swarm.py 调用方签名。
- 不扩展标签词表、不改前端。
- 不修两个基线预存失败测试。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 网络不可达 | verified=False → FALLBACK，链路不崩 | `test_fetch_failure_degrades_honestly` + `_boom` 单测 |
| 全量表拉取失败 | 回退内置两只票，过期缓存优先 | `test_load_ticker_map_falls_back_when_fetch_fails` |
| 未知 ticker | sourceUrls 空，诚实缺证走 needs_evidence | `test_gather_sec_evidence_unknown_ticker_returns_empty` |
| 用户自带证据 | 不调 fetcher，沿用请求标 | `test_user_supplied_urls_keep_request_label` |
| CI 无网络 | 所有测试 stub/monkeypatch httpx | 两个新测试文件全 mock |

## 风险与回滚边界

风险：`/complete` 请求路径新增最多 2 次外网 GET（8s 超时），失败降级不阻塞。
SEC 限流 10 req/s，内测量级远低。回滚：`git revert` 单提交原子恢复。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-19（"下一步 批了"——审计包 commit + PKT-A1 开工）
- 批准范围：PKT-A1 捆绑包；碰代码逐行 diff 审后才 commit。
- 明确未批准：合入 ext、推送、A2/A3 内容夹带。

## 验收标准

1. 真网 smoke：非内置 ticker 解析 CIK 且 companyfacts 200 → verified。
2. `LIVE_SWARM` 从本链产物中消失（测试断言 json dump 无此值）。
3. 三态标全路径测试覆盖（verified/template/user-supplied/失败）。
4. 全后端 suite 无新增失败；双 doctor 0 errors。

## 验证计划

新单测（全 mock）→ 受影响测试 → 真网 smoke → 全 suite → 基线失败对照 →
doctor → 业主逐行 diff 审。
