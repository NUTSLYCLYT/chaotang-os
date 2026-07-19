# 规格说明：fix-hubu-fact-card-real-quality-score-20260719

## 背景

真实度审计（docs-mainline-a-truth-audit-20260719）G3：户部奏折为固定文案，
无任何真实获取的个股数据；G5：全链 quality_score 为编造常量。P22 已把取证
换真（EDGAR 真 GET），本包让 GET 到的数据真正进奏折，并让分数可追溯。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | P22 后 companyfacts 已真 GET 但 body 被丢弃 | P22 版 `sec_edgar.py` 只查 status_code | 源码直读 | 否（本包修） |
| 已确认事实 | quality_score 常量六处 | 旧 contract `0.9/0.92/0.88/0.86/0.35/0.25` | 审计 G5 | 否（本包修） |
| 已确认事实 | 无测试/前端校验器绑定具体分数值 | rg 全仓 | 2026-07-19 | 否 |
| 已确认事实 | NVDA 真网事实卡产出 5 指标 FY2026 | 本 worktree smoke | 2026-07-19 | 否 |

## 数据流与调用链

`/complete` → `gather_sec_evidence`（GET companyfacts → `extract_key_facts`
解析最新 10-K）→ contract `evidence_facts` → `memorial.factCard` →
CourtReview.memorial_json / session JSON → 前端可增量消费。
分数：各 run `quality_score = _qa_score(qa_result)`（checks 通过率）。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `memorial.factCard[]`（metric/tag/value/unit/fiscalYear/periodEnd/form/entity） | SEC EDGAR 10-K 申报值 | 奏折渲染（增量字段，前端零改动） | 新单测 + 真网 smoke |
| `quality_score` 推导规则 | `_qa_score`：checks 通过率；无 checks 按 pass | session 回放/评测 | 新单测锁 1.0/0.5 分档 |

## 范围

`backend/src/sec_edgar.py`、`backend/src/finance_intel_loop_contract.py`、
`backend/tests/test_sec_edgar.py`、`backend/tests/test_finance_intel_loop_honest_label.py`、
本 change 四件套。

## 非目标

- 不做估值/DCF/评级——factCard 只呈现申报数字。
- 不改前端、不改 API 契约值域、不动 swarm.py 旧调用方。
- 不处理非 USD 单位与非 10-K 表单（诚实缺席）。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| companyfacts 解析异常 | facts=[]，verified 不受影响 | gather 内层 try + 单测 |
| 指标标签缺失 | 该指标缺席，不推算 | fixture 单测（total_assets 缺席） |
| 10-Q 数据 | 不采用，只取 10-K FY | fixture 单测（1200 非 400） |
| 模板路径（无 fetcher） | factCard=[]，锦衣卫分 0.5 | 单测锁定 |

## 风险与回滚边界

风险极低：纯增量字段 + 分数推导替换，无路径/词表变化。回滚 `git revert` 单提交。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-19（"继续任务"——P22 落地后按既定队列执行 PKT-A2）
- 批准范围：G3/G5 整改；packet 标准形过闸。
- 明确未批准：估值结论生成、前端改动、A3 内容夹带。

## 验收标准

1. 真网 smoke：非内置 ticker 产出 ≥3 项 10-K 事实且全为申报原值。
2. 常量分数六处清零，分数可由 checks 复算。
3. 受影响测试 + 全量 suite 无新增失败；双 doctor 0 errors。
4. diff 只含声明范围；恰好一个 root change。

## 验证计划

单测（fixture 全 mock）→ 受影响测试 → 真网 smoke → 全量 suite → doctor →
packet 复审 → 标准形过闸。
