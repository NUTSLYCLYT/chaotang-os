# 需求审查 v1

结论：PASSED

## Findings

- 后端唯一真实主动能力是 `/api/intel/brief`，必须直接接入。
- `/api/court/intel/signals` 当前不可用时只能展示明确 fallback。
- 兼容派发端点返回 FALLBACK，不应包装成真实锦衣卫能力。

## Questions

- 无。

