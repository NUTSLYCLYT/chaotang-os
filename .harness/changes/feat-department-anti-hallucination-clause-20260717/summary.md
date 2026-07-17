# 变更摘要：feat-department-anti-hallucination-clause-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | feat-department-anti-hallucination-clause-20260717 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：PKT-4 六部统一反幻觉铁律。
- 文件：`backend/src/minister_personas.py`、`backend/tests/test_minister_personas.py`。
- 验证：六部共享条款测试及完整人格测试 12 passed；尚未执行全量后端回归。
- 边界：本包只统一 council persona 条款，不新增 LLM 调用、不实现门下省 veto。
