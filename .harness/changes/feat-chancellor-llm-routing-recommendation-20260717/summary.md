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

## 追加修复（2026-07-18，Claude 会话）

- `merge_decision_level` 边界缺陷：`LEVELS.get(level, 0)` 曾把不认识的等级
  （含空字符串）静默当 D0 处理，违反"硬门永远拥有最终裁决权"。改为遇到不认识
  的等级直接 raise ValueError。提交 `20d50e6`、`630421e`。
- `decision["decision_level"]`/`decision["route_recommendation"]`（`chancellor_router.py`）
  算出来后没有任何下游消费者读取——纯死数据，未修，需要产品侧先定义这两个
  字段该驱动什么行为，不是单纯 bug fix 的范围。
- **提交披露**：`20d50e6` 提交时本地分支已被并发会话推进（`0d2feb9` 系列 5
  个 commit，主题是 legacy forecast router 遥测/隔离，与本变更无关），
  `git commit` 在没有额外操作的情况下变成了 merge commit，提交信息只写了
  本次修复内容，未披露实际带入的另一条并发工作。未重写历史，此处补充披露。
