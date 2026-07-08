# 户部供应链司 MVP

## 本文件目的

把户部供应链司收口成可上线前验证的 P0/P1 能力边界：只读导入供应商、采购、应付、库存、收货和质量事件，生成老板可裁决的供应链风险奏折。

## 范围

P0：
- 供应商台账导入。
- 采购订单导入。
- 应付账款导入。
- 库存占用导入。
- 收货记录导入。
- 质量/交付事件导入。
- sourceLabel 硬门。
- 预算超支、应付超过采购单、未收货即应付、高风险供应商、库存呆滞、供应商集中度风险识别。
- 生成 JSON/Markdown 供应链司奏折。

P1：
- 接真实 ERP/进销存/财务系统导出。
- 供应商评分卡。
- 采购价格趋势和 TCO 分析。
- 付款排程与现金流联动。
- 审计抽样规则。

P2：
- 供应商门户。
- 自动询价流。
- 多仓库存优化。
- 智能补货建议。

## 当前已知事实

- 后端已有 `scripts/supply_chain_check.py`，但它偏电芯 sourcing 文本核查，不是老板级供应链司总账。
- 后端已有 `scripts/build_supplier_registry.py`，可从供应商/采购台账抽取供应商真值台账。
- 户部已有确定性财务校验层，供应链司应沿用“不信 LLM 编数、无证据不裁决”的模式。

## 当前数据契约

目录：`templates/hubu_supply_chain_import/`

必需文件：
- `suppliers.csv`
- `purchase_orders.csv`
- `payables.csv`
- `inventory.csv`

可选但强烈建议：
- `goods_receipts.csv`
- `quality_events.csv`

所有行必须带 `sourceLabel`，当前允许：
- `internal_uploaded_file`
- `manual_confirmed`
- `historical_archive`
- `erp_export`
- `supplier_statement`
- `invoice_scan`
- `goods_receipt`

未验证来源不得进入老板裁决，只能进入待补证。

## 能做什么

- 从本地 CSV/ERP 导出生成供应链风险摘要。
- 找出 7 天内到期应付。
- 找出超预算采购。
- 找出应付金额超过采购单金额的异常。
- 找出没有收货记录支撑的应付。
- 找出高风险供应商和质量事件。
- 找出库存呆滞和供应商集中度。
- 输出老板裁决选项。

## 不能做什么

- 不自动付款。
- 不自动下单。
- 不连接真实供应商系统。
- 不承诺供应商价格。
- 不删除或覆盖原始证据。
- 不把 LLM 生成的价格、交期、库存当作真实证据。

## 验收标准

- `python3 -m pytest tests/test_supply_chain_import_parser.py tests/test_build_supply_chain_memorial_cli.py -q` 通过。
- JSON 奏折包含 `sourceLabel`、`boss_brief`、`riskIssues`、`forbiddenActions`。
- Markdown 奏折明确写出不得自动付款、不得自动下单。
- 缺少必需文件时状态必须是 `needs_evidence`。
- 有高风险事项时状态必须是 `needs_boss_decision`。

## 后续 Codex 可执行任务

1. `HUBU-SC-01`：把供应链司奏折接入户部后端 API，只读返回 JSON，不接付款接口。
2. `HUBU-SC-02`：增加供应商评分卡，按质量、交付、价格、响应、证据完整度打分。
3. `HUBU-SC-03`：把应付计划与现金流/预算司联动，输出“付款后现金余额”。
4. `HUBU-SC-04`：增加审计抽样规则，识别拆单、重复采购、异常高价。
5. `HUBU-SC-05`：把供应链司奏折归档到史馆，支持旧案引用。

## 最小实现方案

第一阶段只做离线导入：

```text
CSV/ERP 导出
-> sourceLabel 校验
-> 外键交叉检查
-> 确定性风险识别
-> 供应链司奏折
-> 老板裁决 / 退回补证 / 交审计复核
```

第二阶段再接真实数据源：

```text
ERP/进销存/财务系统只读 API
-> 定时导入
-> 增量校验
-> 风险变更提醒
-> 史馆归档
```
