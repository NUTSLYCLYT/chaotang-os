# 蜂群单 agent 范式 · 团队 Playbook

> 大神会审路线 B 的可量产落地。**实证结论**：单一"对答案负责"的 agent，在财务/法务/战略/技术四个领域都 ≥4.5 好用；塞进 11 部三院官制只有 2.58 不合格。**聚焦 + 负责 + 真数据 > 官僚多跳。**

## 0. 范式五要素（缺一不可）
1. **单 agent**：一个直接回答老板问题的 agent，不走三院/丞相多跳。
2. **数据源适配**：`buildContext()` 把"事实"喂给 agent。现读结构化数据文件，**生产换真实 API**（见 §3）。
3. **算分离**：所有比率/同比/优先级分在**代码里确定性算好**喂给 LLM，LLM 只**分析**不**心算**（杜绝算术幻觉→拉满 accuracy）。
4. **对答案负责 schema**：输出强制 `{answer, reasoning, evidence[], assumptions[], confidence}`——把"无依据黑箱"变成 schema 上跑不通的非法输出。
5. **内容 rubric 验收**：DeepSeek-judged 5 维(relevance/accuracy/completeness/actionability/traceability)，**≥3.5 才放行扩张**。

## 1. 资产地图
```
tests/swarm-eval/
├ run-agent.mjs              # 通用单 agent 运行器（--dept X | --all）
├ agents/<dept>.config.mjs   # 每个部门一个配置 = 角色prompt + buildContext(数据源适配) + questions
├ data/<dept>-*.json         # 结构化数据源（生产换真实 API）
├ judge.mjs                  # LLM-judge 评分（内容 rubric）
├ scorecard.mjs              # 汇总卡
└ brain-check.mjs            # 大脑体检（DeepSeek 是否在跑）
```

## 2. 加一个大臣（3 步，~半天）
1. **写数据源** `data/<dept>-*.json`：该部门做判断需要的全部事实（含同比/对照）。
2. **写配置** `agents/<dept>.config.mjs`，导出 `{ deptName, deptCode, role, buildContext, questions }`：
   - `role`：领域人设 + "只引用给定事实、禁编造、算好的别心算"。
   - `buildContext()`：读数据源 + **在 JS 里算好该领域的关键指标**，返回"事实+预计算"文本。
   - `questions`：4 个该部门真实业务问题。
3. **跑验收**：`node run-agent.mjs --dept <dept>` → `judge.mjs` → `scorecard.mjs`，**≥3.5 才合并**。

## 3. 数据源适配：文件 → 真实 API（生产链路）
`buildContext` 就是适配点。把"读文件"换成"调真实 API"即上生产。已落地范例（户部 `hu_bu.config.mjs` 的 `liveSnapshot()`）：实时拉后端 `/api/court/hubu/overview`（预算池/ROI/现金储备）并入 context，失败静默降级。
- 户部 → ERP/财报 API；刑部 → 合同库/合规库 API；兵部 → 竞品情报 API；工部 → Jira/Sentry/CI 度量 API。
- **铁律**：API 拉来的也要经"算分离"——别让 LLM 对 API 原始数字心算。

## 4. 拆 rubric（别用一把尺子量两层）
- **分诊/路由层**（如 `decree/draft`：意图识别+召哪些大臣+置信度）→ 用 **routing-accuracy（召对了吗）+ calibration（置信度准吗）** 评，**不要**用内容 completeness 量它（它本就不该出内容，否则逼出幻觉）。
- **内容/执行层**（单 agent 真答案）→ 用本套 5 维内容 rubric。
- 混用会让总分误导、并逼分诊台撒谎填空（实测教训：官制 draft 层 completeness 低是 spec 不是 bug）。

## 5. 验收门槛
| 均分 | 判定 | 动作 |
|---|---|---|
| ≥4.2 | 🟢 好用 | 可接真实用户 |
| ≥3.5 | 🟡 可用 | 可扩下一个大臣 |
| <3.5 | 🔴 不合格 | 先修(多半是数据缺口/算分离没做/schema 没强制)，不准扩张 |
> accuracy 或 traceability ≤2 直接不合格（决策系统底线）。

## 5.5 严口径放行（大神会审 #1+#2 · 把营销数字换成能力数字）
- **#1 accuracy<4 一票否决**（不看被华丽辞藻稀释的加权均分）。
- **#2 数字接地=100%**：answer/reasoning 里每个有意义数字必须能在 context 逐字 grep 到（`lib/number-verifier.mjs`），找不到 → `run-agent` 自动打回重写一次，仍无依据的留痕成 `hallucinations/`（护城河语料：模型在哪些衍生量上幻觉）。
- 跑 `node gate.mjs` 看真·放行率。实测：加权 4.68"好用" → 严口径真放行 **82%**（accuracy 一票否决 88% × 接地 94%）。**4.68 是范式上限/营销数字，严口径才是能力数字。**
- #3 协作：每个 agent 输出 `conflicts` 字段声明"会被谁的什么数据推翻"，**绝不让 agent 裁决 agent**（出现协调 agent = 重新发明门下省）。真人专家盲评 + 事后真实结果留痕的尖刺待接（破回音壁）。

## 6. 一条龙命令
```bash
node tests/swarm-eval/brain-check.mjs                 # 大脑必须 🟢(decree/draft source=llm)
DEEPSEEK_API_KEY=sk-... node tests/swarm-eval/run-agent.mjs --all
JUDGE_API_URL=https://api.deepseek.com/v1/chat/completions JUDGE_API_KEY=sk-... JUDGE_MODEL=deepseek-chat node tests/swarm-eval/judge.mjs
node tests/swarm-eval/scorecard.mjs --out tests/swarm-eval/scorecard.md
```

## 7. 已验收战绩（真 DeepSeek + DeepSeek-judged）
| 部门 | 领域 | 均分 |
|---|---|---|
| 刑部 | 法务/合规 | 4.95 🟢 |
| 兵部 | 竞品/战略 | 4.60 🟢 |
| 户部 | 财务（+实时API） | 4.50 🟢 |
| 工部 | 产品/技术 | 待跑 |
| 官制(11部三院) | — | 2.58 🔴 |
