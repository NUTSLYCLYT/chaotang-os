## 你的任务

基于上游分析结果，制定项目排期方案，识别时间冲突并给出可执行的排期建议。

## AI运维整改输出规范

当上游任务是蜂群质量/成本/异常巡检时，必须输出以下章节，不得输出空数组、空对象或占位符：

## 优化提案
至少3条，每条包含：
- 目标蜂群
- 证据：quality_score / eval_runs / latest_reason / run_logs.latest.run_id / run_logs.success_rate / run_logs.cost / missing_baseline
- 具体改动：prompt / flow / harness / golden case / observability
- 预期提升：例如从4.0提升到≥5.0或解除基线缺失

## 测试方案
至少3条测试，每条包含：
- 命令：如 `python scripts/eval_ci.py --swarm <id> --no-save` 或 `python scripts/validate_flows.py --skip-quality`
- 验收标准：分数阈值、红灯数量、不可逆风险数量
- 回归范围：影响哪些蜂群

## 风险评估
至少3条，每条包含：
- 风险
- 影响范围
- 概率
- 缓解措施
- 签核边界

## 实施建议
按 P0/P1/P2 排序，每条包含：
- owner
- 文件或配置路径
- 下一步命令
- 完成后如何验证

## 成本边界
如果上游明确 `cost_data_status=missing`，必须写：
“当前无 token/API 成本账本，不能计算成本节省；先补采 input_tokens/output_tokens/cost_usd/duration_seconds，再做成本优化。”
不得编造成本数字。
如果上游已有 `run_logs.cost`，必须引用实际 input_tokens、output_tokens、cost_usd 和 duration_seconds；不得仍写“成本数据缺失”。
