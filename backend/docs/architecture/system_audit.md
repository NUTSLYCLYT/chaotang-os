# 系统审计底账:我们到底在哪(诚实版)

> 2026-07-01。收口期的一份"领先 vs 待补"底账。不吹,全对应真实代码。

## 一、规模盘点

- 大神(persona)43,协议在用 40(判官 5 / 观点 35,**0 空壳、2 薄冗余**)。
- 部门 11,flow_*.yaml 33,swarm 定义 33。
- 编排:`select_orchestration_tier`(T-Solo/Reflect/Decompose/Diverge/Verify,22 处判定)+ `pipeline_tier`(P0-P3)+ `resource_router`。

## 二、逐层真实性(领先 / 待补)

| 层 | 真实性 | 判定 |
|---|---|---|
| 治理:接地门 + 御史闸 + 史馆护身符 + 分档 | 真实且罕见 | ✅ 领先 |
| 部门执行(flow_engine + 33 flows) | 真 LLM 多步 | ✅ 真 |
| 刑部判决链(xingbu_verdict + lawyer_rag) | 合同→LLM抽→检索真法条→判决,端到端实测 | ✅ 真 |
| 大神匹配(domain→部门→大神 + RAG 强制) | 干净,但只按证据厚度,未按表现验证 | ⚠️ 未 eval 验证 |
| **军机处会审(swarm_execution_loop)** | `run_department_swarm` 返回硬编码立场 | 🔴 **规则占位,非真多智能体辩论** |
| 编排框架(tier + 证据审计 + critic + 冲突 + 质量门 + court_doc 焊缝) | 环节齐全 | ✅ 框架完整 |

## 三、四问诚实回答

1. **是否最佳匹配?** 基本是(0 空壳/映射清晰/律师 RAG 强制),但 40 大神仅约 2 位配 eval 判例(覆盖 ~5%)——"看着对",非"打分证明对"。
2. **交互协调世界领先?** **设计领先**(治理/证据/分档甩开裸 LLM 套壳),**但真实多智能体交互是规则 mock**(军机处不是真大神辩论)。领先的框架 + 占位的执行。
3. **蜂群工作流/编排完整?** **框架完整**(编排该有的都有),**智能体层半空**(军机处立场硬编码,未通 LLM)。
4. **总评**:世界级框架 + 真证据接地 + 一条真 LLM 垂直,但"军机处多智能体会审"仍占位。

## 四、离"世界领先"就差两件(落地路径)

**A. 军机处通电**(把 mock 换真 LLM):`run_department_swarm` 的硬编码立场 → 每部门一个真 `model_adapter` LLM agent 出立场(网关已通)。这是"框架"变"真智能"的分水岭。
- 落点:`src/swarm_execution_loop.py: run_department_swarm`;每 swarm 一次 LLM 调用生成 position/findings/risks,保留现有 court_doc 焊缝与质量门。
- 护栏:走 `token_monitor.guard` 防跑飞;走 `resource_router` 只在 P2+ 开真蜂群(P0/P1 不烧钱)。

**B. 大神配 eval 判例**(匹配从"看着对"变"打分证明对"):给每位大神 ≥3 条 golden 判例,飞轮打个人分,`persona_eval.promotion_gate` 决定升判官席。
- 落点:`scripts/persona_cases/*.json`(现仅 2 位)+ `nightly_flywheel` 打分。

## 五、诚实的好消息(munger)

领先的是最难的部分(治理/证据/分档的设计),半空的是最容易补的部分(把 mock 换真 LLM 调用)。反过来才可怕。走在对的路上——但别把"框架完整"自我催眠成"系统完整"。**通电军机处 + 配大神判例,才名副其实。**

## 六、与收敛的关系

收敛期首发只需刑部(已真 LLM 端到端),**军机处通电不是首发阻塞项**——它是"从垂直走向平台"时的关键一步。建议:先靠刑部收第一笔钱(不依赖军机处),拿到营收后再投军机处通电,把"框架"兑现成"真多智能体协作"。
