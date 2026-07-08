# 户部蜂群总蓝图

## 本文件目的

把 CourtOS 户部从单一 finance 蜂群扩展为企业财务内阁。目标不是堆更多 Agent, 而是把会计、出纳、预算、审计、投资、税务、现金流、风控和奏折统一进一条老板可裁决的财务闭环。

## 北极星

真实数据进入 -> 出纳核余额 -> 会计核账 -> 审计查证 -> 预算看偏差 -> 现金流预测 -> 投资测算 -> 税务/风控查红线 -> 户部奏折 -> 老板裁决/退回补证/交刑部/交军机处。

## 当前已落地事实

- `config/flow_finance.yaml` 已注册 finance 流程。
- 当前 finance step 包含: `finance_analyst`, `finance_investment`, `finance_cashflow`, `finance_risk`, `conflict_resolver`, `qa_tech_support`。
- `src/finance_validators.py` 已有确定性骨架: 会计恒等式、三表勾稽、财务比率、清算价、数字回链、应收账龄、企业投资 sourceLabel 闸、ROI/回本期/估值测算。
- `runtime_prompts/finance_investment/` 已有企业投资备忘录专员 prompt。
- `docs/financial_swarm_design.md` 已定义“确定性包住 LLM”和“每数可溯源”铁律。

## 户部九司

| 司 | 定位 | P0/P1 | 当前融合点 | 下步 |
| --- | --- | --- | --- | --- |
| 会计司 | 账务、凭证、科目、三表 | P0 | `accounting_identity`, `tie_out`, `ratios` | 凭证/科目 contract |
| 出纳司 | 现金、银行、收付款 | P0 | 可接 `verified_facts` | 资金日记账 contract |
| 预算司 | 预算、占用、偏差 | P0 | 可复用 sourceLabel 闸 | 预算偏差 calculator |
| 审计司 | evidence、sourceLabel、异常 | P0 | `verify_numbers`, `investment_source_gate` | 财务审计门统一化 |
| 投资司 | 项目投资、ROI、估值 | P0 | `finance_investment`, `investment_metrics` | 真实样例 JSON |
| 税务司 | 发票、税负、合规 | P1 | finance QA 税务要求 | 税务风险 contract |
| 现金流司 | 回款、付款、资金缺口 | P0 | `finance_cashflow`, `ar_aging` | 30/60/90 天现金流 |
| 风控司 | 坏账、负债、偿债、红线 | P0 | `finance_risk`, `sanity_guards`, `liquidation` | 风险门输出统一 |
| 奏折司 | 汇总为老板裁决语言 | P0 | `output_fields` | HubuMemorial contract |

## 设计铁律

1. 确定性能算的都进代码, 不交给 LLM 算。
2. 每个财务数字必须有 `sourceLabel` 和可回链证据。
3. 账不平, 不得进入投资/预算/付款裁决。
4. 余额不明, 不得批准付款。
5. 超预算, 必须触发老板确认门。
6. 口述数据可以生成草稿, 但只能是 `needs_evidence`。
7. 高风险事项不得自动批准。
8. 个股/证券/仓位建议不属于户部投资司, 必须转 legal 红线。
9. 最终输出必须变成老板能看懂的户部奏折。

## 能做什么

- 支撑设备投资、项目投资、融资估值、企业经营投资判断。
- 接入真实财务表、出纳流水、合同/报价单、预算表后形成 verified facts。
- 给老板输出可批准、暂缓、退回补证、交刑部复核、交军机处会审的财务建议。

## 不能做什么

- 不做证券荐股、买卖点、仓位建议。
- 不把用户口述包装成已验证事实。
- 不在缺少凭证/来源时自动裁决。
- 不让 LLM 独立计算财务核心数字。

## 后续 Codex 可执行任务

1. HBI-03A: 新增真实企业投资样例 JSON, 用 `investment_decision_gate` 生成 ready/needs_evidence/invalid 结果。
2. HBI-04: 新增会计司 `accounting_contract.py`, 定义凭证、科目、三表事实包。
3. HBI-05: 新增出纳司 `treasury_contract.py`, 定义资金日记账、银行余额、付款确认门。
4. HBI-06: 新增预算司 `budget_validators.py`, 计算预算占用、剩余额度和超支风险。
5. HBI-07: 新增户部奏折 contract, 汇总九司输出为 `HubuMemorial`。

