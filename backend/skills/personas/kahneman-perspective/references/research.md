# 卡尼曼思想体系调研(源料 · 供 RAG 接地)

> 建档:2026-06-30。来源为公开权威资料,见文末。本档供朝堂大神发言时检索接地,
> 凡引用结论须能回链到此处来源;检索未命中则该结论降权/不采纳(观点席纪律)。

## 1. 双系统:System 1 与 System 2

《Thinking, Fast and Slow》核心框架:大脑用两套系统做判断。

- **System 1(快)**:快速、自动、无意识、情绪化,几乎不费力,持续运转,负责绝大多数日常判断。
- **System 2(慢)**:缓慢、刻意、需要专注与努力,负责复杂运算、逻辑推理与自我监控;天生"懒",容易把工作甩回给 System 1。

System 1 不断生成印象与直觉,System 2 通常照单全收,只在察觉异常时才被调动。绝大多数偏误来自 System 1 的自动反应未被 System 2 校验。

## 2. 前景理论(Prospect Theory)与损失厌恶

Kahneman 与 Amos Tversky 提出,1979 年发表,2002 年获诺贝尔经济学奖(Tversky 已故未能同获)。

- 人不按"绝对结果"评估,而是相对一个**参照点**(通常是现状)评估得失。
- **损失厌恶**:同等金额,损失带来的痛苦约为收益带来的快乐的 2 倍多。
- 风险态度在"收益域"与"损失域"反转:面对收益时倾向规避风险,面对损失时倾向冒险("捞回来")。
- 推翻了古典经济学"理性人"假设。

## 3. WYSIATI:What You See Is All There Is(眼见即全部)

System 1 只用"手头已有的信息"构建一个连贯的故事,对"已知的未知"与"未知的未知"几乎无视。

- 由此产生**过度自信**:故事越连贯,人越自信,而连贯性与真实性无关。
- 信息少反而更容易编出自洽故事,于是更自信——这是危险的错觉。

## 4. 认知偏误库(精选)

- **锚定效应(Anchoring)**:先出现的数字(哪怕随机)会拉偏后续所有估计。
- **可得性启发(Availability)**:用"例子有多容易想起"来判断概率;近期、戏剧化、情绪化事件被高估。
- **代表性启发(Representativeness)**:用"像不像典型"替代真实概率,忽视基率(base rate)。
- **过度自信 / 规划谬误**:对项目工期、成本、风险系统性过度乐观。
- **框架效应(Framing)**:同一事实换个说法(救活率 vs 死亡率)就改变选择。
- **峰终定律(Peak-End Rule)**:对一段体验的记忆,取决于"峰值"和"结尾",而非整体平均。

## 5. 噪声(Noise:A Flaw in Human Judgment, 2021)

与 Olivier Sibony、Cass Sunstein 合著。

- **定义**:噪声是"对同一问题本应一致的判断中,不该有的随机变异"(undesirable variability in judgments of the same problem)。
- **噪声 ≠ 偏差**:偏差(bias)是系统性、可预测的偏离(总往一个方向偏);噪声是随机、混乱、不可预测的散布(同一案子不同人、甚至同一人不同时刻给出不同结论)。
- 噪声广泛存在于司法量刑、医疗诊断、招聘、保险定价、绩效打分等"本应一致"的判断中,危害常被低估。
- 治理手段:**判断卫生(decision hygiene)**——结构化、分维度独立打分、聚合、用算法/检查表约束直觉。

## 6. 关键纠偏工具

- **事前验尸(Premortem)**:在决策前假设"这事已经失败了,为什么?",逼出被乐观掩盖的风险。
- **采用外部视角(Outside View)**:用同类案例的基率,而不是只盯自己这个案子的内部故事,治规划谬误。
- **延缓直觉、分维独立评估**:先各维度独立打分再聚合,最后才允许整体直觉,降低光环效应与噪声。

## 7. 在朝堂自我进化系统中的映射

- 御史红线 = "用结构化判断挡住偏误与噪声":决策前先过偏误清单,别让连贯故事冒充真相。
- 事前验尸 = 不可逆决策(钦天监)前置参谋的一环:先假设失败再倒推风险。
- 分维独立评分 + 聚合 = eval/评分要拆维度独立打,降低光环效应与打分噪声。
- 外部视角(基率)= 估工期/成本/胜率时先看同类历史,别只信本案的内部故事。
- 双系统 = 区分"可让 System 1 直出"的小事与"必须调 System 2/钦天监"的不可逆大事。

---

## 来源(Sources)

- [Thinking, Fast and Slow — Wikipedia](https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow)
- [System 1 and System 2 Thinking — The Decision Lab](https://thedecisionlab.com/reference-guide/philosophy/system-1-and-system-2-thinking)
- [Thinking Fast and Slow: Kahneman explained — SUE Behavioural Design](https://www.suebehaviouraldesign.com/en/blog/kahneman-thinking-fast-and-slow/)
- [Noise: A Flaw in Human Judgment — Wikipedia](https://en.wikipedia.org/wiki/Noise:_A_Flaw_in_Human_Judgment)
- [Daniel Kahneman on 'noise' — The Conversation](https://theconversation.com/daniel-kahneman-on-noise-the-flaw-in-human-judgement-harder-to-detect-than-cognitive-bias-160525)
- [Anchoring Bias and Adjustment Heuristic — Simply Psychology](https://www.simplypsychology.org/what-is-the-anchoring-bias.html)
</content>
</invoke>
