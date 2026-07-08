# 前端交接:工部 PACK 完整方案报告(2026-07-06 新增)

> 给前端仓 `chaotang-web-lyt`。后端只产**结构化 JSON**;把它画成"完整方案卷轴"是前端的活。
> 本文是数据契约,不在后端实现 UI。

## 一、背景(为什么补这个)

`config/flow_pack_rd.yaml` 是一条已跑通、持续迭代(6月中~7月初多次真实运行修 bug)的成熟蜂群——
11 个专业角色(需求/供应链/电芯/BMS软硬件/结构热/工艺/测试/成本)+ 197 芯真值库 + **双确定性闸**
(`sizing_validation`/`cost_validation`,no-LLM,禁 LLM 自评算术)+ **五维度评审门**(强制引用机器
verdict)。产出完整、专业、有确定性接地。

但此前前端 `GongbuPackSizingPanel` 触发这条链后,`reverify` 只回读 `session_id`/`status`/
`source_label`,**11 个 output_fields 一个字段都没有回传**——用户只知道"跑完了",看不到任何实质
方案内容。本次新增端点补上"聚合→诚实标源→交前端"这一环。

## 二、新端点

```
GET /api/swarm/sessions/{session_id}/pack-report
```

`session_id` 就是 `dispatchPackSizing`(`/api/court/gongbu/pack-sizing` → `/api/swarm/run`)拿到的
那个 session_id,无需额外查询,现有 dispatch 流程不用改。

## 三、返回字段契约

### 找不到会话 → HTTP 404

### 会话存在但不含 pack_rd 运行
```json
{"found": false, "session_id": "...", "headline": "该会话未含 pack_rd(工部 PACK 研发)运行", "source_label": "NOT_APPLICABLE"}
```

### 会话存在但 run 未落盘(理论上不该发生,兜底)
```json
{"found": false, "run_id": "...", "headline": "未找到该 run(可能尚未跑完或 run_id 有误)", "source_label": "NOT_FOUND"}
```

### 正常情况
```json
{
  "found": true,
  "session_id": "20260706_085026_9264bd",
  "run_id": "20260706_085026_379051",
  "light": "green | yellow | red",
  "deterministic_gated": true,
  "source_label": "DETERMINISTIC_GATE | PARTIAL_OR_UNVERIFIED",
  "sizing_gate_verdict": { "...": "见下" } ,
  "cost_gate_verdict": { "...": "见下" },
  "narrative": {
    "expert_review_gate": "五维度评审门的完整 markdown 文本",
    "pack_summary_expert": "方案汇总专家的完整 markdown 文本",
    "executive_summary": "决策摘要专家的完整 markdown 文本"
  },
  "sections": {
    "pack_rd_leader": "需求规格……",
    "supply_chain_feasibility": "供应链可行性……",
    "cell_engineer": "电芯选型……",
    "bms_hw_engineer": "……", "bms_sw_engineer": "……",
    "structure_thermal_engineer": "……", "pack_reliability_tester": "……",
    "bms_summary": "……", "process_test_summary": "……",
    "presale_cost_estimator": "……",
    "cross_module_checker": "……", "qa_tech_support": "……", "critic_challenge": "……"
  },
  "missing_steps": {"gates": [], "narrative": []},
  "step_count": 18
}
```

`sections`/`narrative` 的 key 是 flow yaml 里的 **step id**(稳定,不受 prompt 措辞影响),覆盖
`output_fields` 里除两道闸之外的全部 11 个方案维度。`missing_steps` 列出还没跑到/跑失败的步骤——
不是所有历史 run 都跑全 18 步(比如两道确定性闸是后加的,老 run 会缺)。

### `sizing_gate_verdict`(no-LLM 重算,来自 `pack_rd_sizing.run_sizing_gate`)
关键字段:`seriesTruth`/`parallelTruth`(`PASS`/`FAIL`/`UNKNOWN`)、`deterministic{series,parallel,
config_label,electrical{...},thermal{...}}`(算出来的基线配置)、`claimed{series_S,parallel_P}`
(精算自报值)、`deviations`、`extracted`(能否解析出精算 JSON)。

### `cost_gate_verdict`(no-LLM 重算,来自成本确定性闸)
关键字段:`priceTruth`/`specTruth`(`PASS`/`FAIL`)、`c1`(化学体系单价真值带校验)、
`deviations{energy_wh,current_a,price_band,bom_calc}`、`notes[]`(人话偏差说明,如"单价 6.72元 不在
化学体系真值带 [33,45]")、`green`(bool)、`extracted`。

## 四、渲染纪律(禁假 PASS,和 court_doc 一致的原则)

1. `deterministic_gated=false` → **绝不渲染成绿灯/通过**,显式标"未接地·部分方案/需人工核实"。
2. `light=red` 时即使 `sizing_gate_verdict` 全 PASS 也可能是 `cost_gate_verdict` 抓到造价异常
   (真实案例:2026-07-01 一次运行 sizing 两项 PASS,但 `priceTruth=FAIL` 因为单价不在真值带、
   BOM 复算偏离申报 >5%)——**总灯色以两道闸的最差结果为准**,不要只看 sizing 就判断通过。
3. `missing_steps` 非空的字段,不要留白当"这部分没问题",要显式标"该维度未产出"。
4. `narrative.expert_review_gate` 里的五维度评审文本本身会**引用** sizing/cost 的机器 verdict
   做判断(如"【sizing确定性闸】曾提及8P19S,但被否决"),建议这段和确定性闸的结构化数据对照展示。

## 五、建议渲染结构

参照 `output_fields`(需求规格/售前成本核算/供应链可行性/BMS选型/通信协议适配/结构热设计/
PACK工艺/测试验证/五维度评审/系统BOM汇总/风险建议)做 11 卡片或 Tab,`sections`/`narrative` 直接
对应内容;顶部用 `light`+`deterministic_gated` 做总览灯,`sizing_gate_verdict`/`cost_gate_verdict`
的结构化字段单独做一个"确定性验收"卡片,不要和其余纯 LLM 方案段落混在一起(呼应工部 `#8` 标源
原则:硬(确定性闸)/软(专业角色方案)分开标,别让用户分不清哪句是算出来的、哪句是写出来的)。

## 六、边界与限制(诚实说明,别过度承诺)

- 这条 flow 目前只由蜂群 dispatch 触发产出;本端点是**只读聚合**,不会主动触发新的 pack_rd 运行。
- 不是所有 `pack_rd` 运行都会跑到确定性闸(取决于精算 agent 是否吐出可解析的 fenced JSON;抽不到
  → `extracted=false` → 诚实 `UNKNOWN`,不是 bug)。
- 本端点不改动 `flow_pack_rd.yaml` 或确定性闸算法本身,纯粹是"把已存在的产出交给前端"这一环。
