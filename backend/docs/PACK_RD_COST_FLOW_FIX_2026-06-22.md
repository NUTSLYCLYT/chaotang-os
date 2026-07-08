# pack_rd 成本无法自洽 · 根因+修复 spec(2026-06-22)

> 由朝堂工部 §0.5 验蜂群反查出。pack_rd 产出有(7字段),但 C1 数字勾稽永远 FAIL、quality 封顶≤3,
> 工部会诊台据此冻结。逐层排除后,根因不是缺价(已喂真价仍 FAIL),是**流程排序/结构问题**。

## 排除法(决定性,别再走回头路)
1. **不是 final_output 丢失** —— 产出有 7 字段(已修 SwarmRunRecord)。
2. **不是缺真电芯价** —— 已从采购部真报价补 `cell_price_benchmark`(金羽 ¥9.32/Ah 等)+ `bom_components`
   (commit 6e65360),pack_rd 仍 C1 FAIL(1.89)。**缺价被证伪。**
3. **不是 agent 编造**(已加诚实铁律#4,缺价标"待核")。

## 根因(精确)
pack_rd flow 的 agent 顺序:
```
step_1 presale_cost_estimator(售前成本核算)  ←★ 成本在这跑
step_2 supply_chain_feasibility(供应链门控)
step_3 cell_engineer(电芯选型)               ←★ 电芯在成本之后才定
step_4 bms_hw_engineer / step_6 structure_thermal
step_12 pack_summary_expert                    ←★ BOM 在这才齐
```
**成本 agent 排在 step_1,在电芯/BMS/结构(step 3-6)选定之前跑** → 它被要求给一个**还没设计出来的 BOM**
算账 → 产出"BOM汇总字段为空"、用 X/Y/Z 占位 → 最终 final_output 的成本字段=这份空 BOM 估算 → C1 必 FAIL。

**鸡生蛋**:`supply_chain_feasibility / cell_engineer / bms_hw_engineer` 的 prompt 都引用「成本」(依赖早期成本),
所以**不能简单把成本 agent 挪到设计之后**——挪了会断这些 `depends_on`。

## 修复方案(结构性,需 jiqun core 专注做,非顺序挪)
**把成本拆成两段**:
1. **早期粗估**(保留 step_1,改名/改职责为 `presale_rough_cost`):只出 ¥/Wh 量级粗估区间(供 supply_chain 门控/选型参考),
   **明确标"粗估·BOM未定",不进 C1 勾稽**(它本就不该自洽)。
2. **新增设计后精算**(`final_cost_reconciliation`,排在 step_6 结构之后 / step_12 汇总处):
   用已定的电芯(cell_engineer)×真单价(cell_price_benchmark ¥/Ah×容量)+ BMS(bms_summary)+ 结构(bom_components)
   **正推自洽 BOM 总额** → 这份进 final_output 的成本字段 → C1 可过。
3. flow_engine:确认 final_output 的「成本」字段取自**精算**(step后段),不是早期粗估(step_1)。

## 验收
- pack_rd 12V 1100Wh 低温任务:final_output 成本字段含**自洽 BOM**(电芯=120颗×真单价,Σ对得上总额),
  C1 PASS,quality ≥3.8。
- 工部 §0.5 解冻,据吏部范式接 LiveFeasibilityPanel(后端链已备:gongbu-feasibility-envelope + BFF,前端仓)。

## 依赖图谱(改前必读)
`config/flow_pack_rd.yaml` 各 step 带 `depends_on`(DAG)。改顺序前先画全依赖,确认无断边。
成本相关引用见 `runtime_prompts/{supply_chain_feasibility,cell_engineer,bms_hw_engineer}/*.md`。
