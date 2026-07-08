# 户部怎么用（用户指南 · 2026-07-06）

一句话:**放一次公司真实财务数据 → 用自然语言下旨 → 得到确定性、可裁决、可溯源的户部回奏。**
无数据也不崩:诚实退回,绝不编数(守 dept_constitution C6 禁假PASS)。

## 户部能接的下旨(4 类,前三类走真确定性引擎)

| 下旨说什么(自然语言) | 走哪条引擎 | 回奏形态 |
|---|---|---|
| 「报价 / 成本核算 xxx」 | quotation 真引擎(flow_quotation+QA硬核查) | LIVE 报价裁决 |
| 「**审批**这笔**付款** xxx」 | **3司链(会计→出纳→预算)** | LIVE_ENGINE,三门 + 老板可批 |
| 「评估**现金跑道 / 资金缺口 / 回款 / 偿债**」 | 确定性现金跑道门 | LIVE_ENGINE,资金安全裁决 |
| 其余财务问题(无结构化数据) | flow_finance 弱链(6步,含投资司) | MIXED,诚实标未审计 |

## 用法一:配置公司数据(一次),之后自然语言下旨

把公司真实财务数据放到规范存储(gitignored,不进 git),之后下旨自动读:

```
data/hubu/payment_case.json     # 付款审批场景:{caseId,accounting,treasury,budget,paymentRequest}
data/hubu/cashflow_pack.json    # 现金流场景:{cash,bank,monthly_flows,receivables,...}
```
(路径可用 env `HUBU_PAYMENT_CASE` / `HUBU_CASHFLOW_PACK` 覆盖。样例形状见 `tests/fixtures/hubu_payment_fact_pack.json`。)

配好后,上书房下旨「请审批这笔自动化设备尾款付款」→ 户部读 `payment_case.json` → 会计/出纳/预算三门审 → 出可裁决奏折。**实测**:自然语言付款下旨 → 3司 LIVE_ENGINE court_doc(light=green,7 门 items)。

## 用法二:下旨直接内嵌结构化数据(临时/单次)

不配存储也行,把数据作 JSON 内嵌在下旨里:
```
请审批这笔付款。case:{"caseId":"c1","accounting":{...},"treasury":{...},"budget":{...},"paymentRequest":{...}}
```
户部优先读内嵌 JSON,其次读存储,都没有 → 退回 flow_finance。

## 户部有几个司(建制)

- **登记 4 司**:会计 / 出纳 / 预算 / 税务(2026-07-06 补)
- **落地模块 ~8**:会计·审计 / 出纳 / 预算 / 税务 / 融资·风控 / 现金流 / 投资 / 报表
- **确定性门**(`finance_validators`,20+):会计恒等式 / 三表勾稽 / 财务比率 / 清算价 / 数字回链 / 应收账龄 / 投资ROI·IRR·NPV / 税负测算 / 证券交易边界红线

## 确定性 = 数据在则真门生效,数据不在则诚实退回

户部所有真引擎都要**结构化真实数据**才跑确定性门:
- 有数据(存储/内嵌/verified_facts) → 走确定性门,出 LIVE_ENGINE 可溯源回奏。
- 无数据 → None 诚实退回 flow_finance,标"未审计",**绝不凭空构造事实包硬跑**。

要户部对**普通财务下旨**也满血,把公司金蝶导出灌进 `verified_facts`(见 `scripts/hubu_finance_import_preview.py` + `finance_data_parser`),`flow_finance` 的 `number_provenance` 硬闸即从空转变实。

## 只读安全

付款/现金流引擎复用的 `build_hubu_payment_preview` / `preview_cashflow_court_doc` 均**只读**:不真付款、不写库、不改账。不可逆动作一律 `PENDING_HUMAN_SIGNOFF`,需人工签字。
