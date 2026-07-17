# 变更摘要：feat-chancellor-llm-routing-recommendation-20260717

| 字段 | 值 |
| --- | --- |
| Change ID | feat-chancellor-llm-routing-recommendation-20260717 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260717 |

## 范围

- 主线：PKT-5 丞相结构化 LLM 路由推荐层。
- 文件：`backend/src/chancellor_llm_recommendation.py`、`backend/src/chancellor_router.py`、对应测试。
- 验证：推荐层与丞相路由测试 17 passed；全量后端回归待收口。
- 边界：推荐层只提供候选部门/D 级建议，确定性风险硬门拥有最终裁决权。
