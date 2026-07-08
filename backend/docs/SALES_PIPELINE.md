# 销售蜂群 · 端到端管道

> 2026-06-04 整理。把分散的销售相关蜂群整合为一条事件驱动的端到端管道。

## 主链（事件 binding 自动串接,见 config/swarm_orchestrator.yaml）

```
获客 haolong ──┐
              ▼ haolong_completed
           OPC 方案 opc ──┐
                         ▼ opc_completed (≥4.0 也归档 ima)
                  产品规划 product ──┬─→ 电芯 sourcing (≥3.5)
                                    ├─→ 知识归档 ima (≥4.0)
                                    ▼ product_completed (≥3.5)
                            报价 quotation ──▼ quotation_completed (≥4.0)
                          （接5年真实合同 + 质量门）   知识归档 ima
                                                   （成交报价沉淀→喂回未来报价检索·学习闭环）
```

## 报价蜂群 quotation（销售核心,本次重点整改）

5 步：报价分析师 → 成本核算师 → 商务经理 → 技术方案工程师 → 质量检查QA。

**A. 接通真实合同数据**（本次新增）
- `knowledge_pre_retrieval.enabled: true` → 每次报价先从 chroma 检索相似历史合同
- 报价分析师 / 成本核算师 `knowledge_scope: [购销合同]` → 按合同域精准召回
- 报价分析师铁律#5：**历史成交价优先于行业估算,绝不无视检索到的真实合同凭空报价**
- 数据源：Windows 桌面 189 份购销合同 + 2 份销售统计表,经 markitdown/OCR(RapidOCR) 灌入 chroma（domain=购销合同）

**B. 质量门**（本次开启）
- `repair.enabled: true`,min_score 3.5,六维 QA 低分自动重做

**C. 管道整合**（本次）
- 既有 binding 已把 产品规划→报价 串通；新增 报价→归档 闭环
- 直接客户 RFQ 可跳过前置链,直接跑报价：`python scripts/run_flow.py config/flow_quotation.yaml "<客户需求>"`
- 报价输出含「合同条款」字段,run_flow 自动生成 HTML 报价单(可发客户/转PDF,见 scripts/export_report.py)

## 模型 / 高可用
所有销售 flow 走 providers.yaml 的 active（DeepSeek 主力 + 本地 Ollama 兜底,无 key/挂了自动落本地,永不黑屏）。

## 待办（OCR 灌库完成后）
- [ ] 跑通报价端到端,验证检索到真实历史合同价并被引用
- [ ] rag_eval 量化报价检索召回（需标 gold）
- [ ] 视需要把 sourcing/product 也接 knowledge_pre_retrieval
