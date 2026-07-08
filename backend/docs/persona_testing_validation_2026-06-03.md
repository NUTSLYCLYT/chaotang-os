# 大神评审团 · 蜂群能力测试 & 结果验证方法论（2026-06-03）

> 问题：(1) 怎么真正测试蜂群"能力"？(2) 怎么验证结果质量是真好而非看起来好？
> 阵容：Karpathy / 芒格 / 塔勒布 / 马斯克 / 贝佐斯（persona-panel，5 并行 + Opus 综合）。
> 总裁决：**压倒性反对当前"跑任务→LLM 打分→≥4.0=A"做法**。免责：persona 为公开言论推断。

## 一句话总论

> 你眼下不是"评测不准"的问题，而是**用一把测不出差别的尺子，给一个可能不该存在的架构发 A**。
> 先修标尺（确定性硬约束 + 人工锚 + 真北 KPI），再用修好的尺子老实回答那个你不想问的问题：
> **这 4.5 倍延迟到底买到了单模型给不了的什么？**
> —— Karpathy: *"If you can't measure the delta, you don't have a swarm, you have a slow API call."*

## 共识（多位大神都指向，最该信）

1. **你的 eval 不是 eval，是 self-report。** QA 是 flow 第 5 步，deepseek 给 deepseek 打分（judge 与 generator 同分布甚至同一次 forward 延续）= train-on-test。`total_score≥4.0` 只测"7 个字段填没填满"，不测"对不对"。
2. **关键词覆盖度是 substring 检测器，分辨率太低 → 蜂群和单模型必然"打平"。** `kw in text` 测的是 lexical recall 不是 correctness。"打平不是蜂群无用的证据，是尺子太钝的证据。"
3. **`human_score` 列全是 null = 整个评分体系没有 ground truth 锚点。**
4. **储能的真北是物理和钱，可零标注做确定性硬约束 eval。** -40℃ 选常温电芯=错；BOM 加到 1200万 超 800万 预算=错；100MWh/2h 配 25MW PCS（应 50MW）=错。100 行 Python + 行业参数表的 unit test，确定性、零成本、可回归。
5. **唯一不撒谎的真北 = 会赔钱的指标：客户采纳率 / 签单额。** yaml 的 `truth_note` 自己写了，却放在最低优先级。
6. **opc 蜂群很可能根本不该存在 → 当成 null hypothesis 让 eval 去推翻。** findings.md 已记录：零改 prompt、仅换 R1，3.64→4.0、fail→pass、26 秒、还自己发现 BOM 矛盾。

## 大神找到的具体 bug（不是泛泛而谈）

- **Karpathy**：`baseline_compare` 旧版 swarm 侧被 QA 的"每字段≤200 字"压成 854 字 vs baseline 3803 字 → "打平"是 metric 饱和 + 截断 artifact，不是真打平。（已修：现按全步骤产出比对）
- **Karpathy**：`swarm_test_report.json` 里 court/ai_ops/sdlc `quality=0.0` 却 `status=PASS` —— harness 连 JSON 解析失败都判通过。
- **马斯克**：白痴指数 = 耗时4.5倍 ÷ 质量1.0倍 ≈ 4.5，且产出还少 77%。

## 怎么测"能力"（问题 1）

- **拆成 unit test，不是 e2e project test**：opc 5 步 = 5 类 micro-eval，每步喂人工冻结的黄金中间产物做固定输入，只测这一步的可定位准确率（像画 per-layer gradient，不是盯总 loss）。
- **Step-ablation（leave-one-step-out 消融）**：逐步去掉一步看分数变化，拿不出 per-step lift 的步骤就是包袱。
- **盲对照专家挑选**：专家不知哪份是蜂群，挑出蜂群那份并说出为什么——挑不出来，蜂群无能力增量，**当场删**。
- **能力-成本曲线**：同一 component 用 quick/R1/opus 各跑，画能力-延迟曲线。

## 怎么验"结果质量"（问题 2）

- **deprecate `total_score≥4.0=A`**：降级为纯冒烟测试（只答"有没有跑挂"），不再做能力判断。
- **确定性硬约束求解器**：把 `spec_must_hit` 从"-40 字符出现没"升级成"方案在 -40℃ 下物理成立"——正则/数值抽取 + 只问单个窄事实的 LLM verifier（输出 true/false+依据，不输出分数）。
- **真北 KPI**：查最近 50 个真实询价里蜂群方案的采纳率/签单额，提到最高优先级。
- **meta-eval**：judge 与人工 `human_score` 做相关性，ρ<0.6 = judge 在撒谎。

## 必须正视的失败路径

1. **Goodhart**：去"修蜂群让它在坏 eval 上赢"而非"修 eval 让它看见真相"——三个月后把 854 字调成 3803 字、覆盖度刷满，客户采纳率纹丝不动。
2. **两个错误互相掩护（马斯克最尖锐）**：keyword 命中 + 自评 LLM 永远不告诉你蜂群在做无用功 → 继续扩蜂群，"6 个月后你有 20 个蜂群、一套绿油油的 QA 仪表盘、和一个比单模型全面更差的系统。"
3. **火鸡问题（塔勒布）**：用 10 个自己出的温室样本相关性给全体蜂群发"可信"通行证。真实市场是刁钻/残缺/自相矛盾的询价；尾部失明（-40℃ 配 -20℃ 电芯、漏消防）不是扣 0.5 分，是整单作废。

## 下周一可启动的三步

1. **先修标尺，别碰 prompt**：(a) judge × 10 个人工 human_score 做相关性；(b) 人眼并排读 10 对原文（data 比 metric 诚实）；(c) 写 100 行确定性约束求解器（预算/温度/PCS 功率）。同时 deprecate total_score。
2. **测"每步是否配活着"**：step-ablation 消融 + 盲对照；把"opc 该被单模型替换"当 null hypothesis 让 eval 去推翻。
3. **锚定真北 + 防火鸡**：真实询价采纳率/签单额提到最高优先级；用真实询价（含对抗样本）喂评测集；**在 opc 跑赢单模型前冻结新建蜂群**（jinyiwei/libu/shiguan/tianjian）。

## 元提醒

本次会审共识异常一致——**这本身要警惕"评审团回声室"**；但五个独立视角同时指向同一结论，可信度高。校准回路是必要条件不是充分条件。
