# 共享观测字段

每次 harness 运行建议保留以下字段，方便史馆归档、御史审计和看板汇总：

- `run_id`
- `harness_id`
- `case_id`
- `block_id`
- `status`
- `owner`
- `quality_score`
- `traceability`
- `grounding`
- `signoff_required`
- `failure_reason`
- `next_action`

写入文件、JSONL、数据库或 Web API 时可以扩展字段，但不要丢失这些基本语义。
