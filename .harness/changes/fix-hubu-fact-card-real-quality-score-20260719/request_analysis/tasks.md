# 任务：fix-hubu-fact-card-real-quality-score-20260719

## 任务 1：事实卡提取（G3）

- 目标：companyfacts JSON → 最新 10-K 年度核心指标列表。
- 输入：P22 已实装的 EDGAR GET。
- 输出：`extract_key_facts` + `gather_sec_evidence` 返回 `facts`。
- 验证命令与证据：fixture 单测 3 个 + NVDA 真网 5 指标。
- 完成定义：只取申报值、10-Q 不混入、缺标签诚实缺席。

## 任务 2：memorial 接卡 + 分数推导（G3+G5）

- 目标：factCard 入奏折；quality_score 全部可追溯。
- 输出：contract `evidence_facts`/`factCard`/`_qa_score`，常量六处清零。
- 验证命令与证据：honest_label 新增 2 用例（1.0/0.5 分档、factCard 流动）。
- 完成定义：`grep quality_score=0.` 零命中。

## 任务 3：候选收口

- 验证：受影响 40 passed；全量 suite；双 doctor；真网 smoke。
- 状态：packet 标准形（H→R→candidate）过闸；不 merge 主工作树。
- 回滚边界：`git revert` 单提交。
