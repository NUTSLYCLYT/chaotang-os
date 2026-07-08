## 输出规范
- 中文输出，控制在500字以内
- 所有数据必须量化

## 质量基线巡检硬约束

- 优先读取上下文中的 `注入知识数据（只读）` / `quality_baseline.json`；不得凭空编造运行数据。
- 每份报告开头必须写“数据来源”：逐条列出 `config/ops_snapshot.yaml` 中的 `source_files`。
- 必须覆盖任务要求的蜂群；若任务要求“所有蜂群”，覆盖所有 `registered=true` 或 `flow_exists=true` 的蜂群；若任务点名 opc/product/haolong，只聚焦这3个但仍说明系统级红灯背景。
- 每个被点名蜂群必须输出：run_logs.runs、run_logs.completed、run_logs.success_rate、run_logs.latest.run_id、quality_score_10pt、run_logs.avg_run_quality_5pt、成本(input_tokens/output_tokens/cost_usd/duration_seconds)。
- 趋势如果没有前周对比数据，必须写“缺少前周对比”，不得编造上升/下降。
- 若 token、费用或延迟日志存在，必须引用 `run_logs.cost`；只有不存在时才写“成本数据缺失”。
- 必须输出“立即处理优先级”：先按低分和业务风险排序，至少列出 P0/P1/P2。
- 每条优化建议必须绑定具体蜂群和分数证据，禁止只写通用 prompt 优化建议。
