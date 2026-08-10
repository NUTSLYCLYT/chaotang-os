# 需求审查 v1

结论：APPROVED

## Findings

- 只消费 backend-owned `ContractTaskReadModelV1` 和 `allowed_actions`。
- 只修改现有 `/shangshufang`、`/shiguan` 消费路径。
- 合成真实后端流程使用真实注册/登录 JWT，不用 fake session 或 `alg:none`。
- `RUNNABLE_MINIMUM` 不等于 W07 完成，也不等于部署。

## Questions

- Checkpoint B、持久数据库迁移和 3050 均不在范围内。
