# 蜂群 final_output 结构性断裂 · 根因+修复 spec

> 2026-06-22 · 由朝堂前端"诚实真链"反查出。前端接 libu/pack_rd 真链时发现:蜂群 run 完成、QA 打分,
> 但 `final_output` 永远空 → 前端拿不到任何蜂群产出。逐层定位到结构根因。

## 数据(决定性)
全部 `swarm_sessions/*.json` 统计:**105 run · final_output 非空 = 0 · quality≥3.8 = 32**。
→ 连 quality=5.0(health_check)、4.4(ai_ops)的**通过** run,final_output 也空。
→ 结论:**不是质量门挡的(32 个过了),是 final_output 聚合结构性断裂**(0/105,与质量无关)。

## 根因(精确到行)
- `src/flow_engine.py:1350`:`final_output, qa_result = _parse_qa_output(_qa_step.output, self.output_fields)`
- `src/flow_engine.py:4121`:`final_output = parsed.get("final_output")`
**final_output 从 QA agent 输出里 `parsed.get("final_output")` 抠取。但 QA agent 的 JSON 不含(或字段名变了)`final_output` → 永远 None。**

## 待查/待修(后端,按序)
1. **确认 QA 契约**:QA prompt(各 `prompts_*.py` 的 qa 段 / `runtime_prompts/qa_tester`)现在到底输不输出 `final_output` 字段?是改了契约、还是字段嵌套/改名?
2. **修聚合源**:final_output 本应是**蜂群业务 agent 的产出**(如 libu 的岗位画像/筛选/面试题),不该依赖 QA agent 回吐。考虑从业务步骤输出直接聚合 final_output,而非 `parsed.get` QA 的。
3. **加结构断言**:`final_output is None 但 run completed` → 这本身该是一条硬失败/告警(现在静默空),否则下次再断没人知道。

## 次病(独立,别混):QA 域错配
QA 质量门**不是全坏**(32/105 过)。但:
- **libu(招聘)栽 C2**:`prompts_qa_domain.py:30` C2=产品量化指标(电压/能量/倍率),招聘输入永远没有 → C2 必 FAIL。**libu 该用招聘域 QA,不该套产品 C2。**
- **pack_rd 栽 C1/C3**(数字勾稽/来源)——产品蜂群 C2 套对了,但 C1/C3 不过,需看是产出真弱还是判太严(用 `score_swarm.py --swarm pack_rd` 独立裁判验)。

## 验收
- 修 final_output 后:`score_swarm.py --swarm libu`(或任一)的 run,`final_output` 非空。
- libu 金标:豁免产品 C2 后 quality 回升、产出非空。
- 前端 `/api/court/dept/li-bu/recruit/result` 拿到真招聘方案(非 null)。

## 复用的现成工具(reuse-first)
- `scripts/gate_calibration.py`(诚实闸校准,已验 100% 准)· `scripts/score_swarm.py`(独立裁判+golden)· `scripts/smoke_all.py`(全蜂群彩排,慢)· `src/yushi_gate.py` · `tests/test_qa_generic.py`。
