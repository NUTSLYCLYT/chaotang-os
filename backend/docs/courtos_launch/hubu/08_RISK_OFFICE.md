# 风控司设计

## 本文件目的

定义户部风控司: 负责坏账、负债、偿债、清算价、高风险确认门。风控司给老板看最坏情况, 不是只看乐观 ROI。

## 职责

- 坏账风险。
- 应收账龄。
- 资产负债率。
- 净利率/毛利率异常。
- 清算价。
- 偿债压力。
- 大额投资/付款/合同风险门。

## 当前可复用实现

- `sanity_guards()`
- `liquidation()`
- `ar_aging()`
- `investment_decision_gate()`
- `finance_risk` prompt

## 输出 contract 草案

```json
{
  "riskLevel": "low|medium|high|blocked",
  "riskGates": [],
  "downsideScenario": {},
  "requiredConfirmations": [],
  "handoff": "none|legal|council|manual"
}
```

## 高风险触发条件

- 大额付款。
- 合同/股权/融资条款。
- 对外承诺。
- 生产环境或设备部署。
- 资产负债率过高。
- 现金流缺口。
- 应收账龄超过 180 天。
- 数据来源 unknown。

## 后续 Codex 可执行任务

- 新增统一 `hubu_risk_gate(fact_pack)`。
- 将投资、出纳、预算、现金流结果汇入风险门。
- 输出给前端老板二次确认。

