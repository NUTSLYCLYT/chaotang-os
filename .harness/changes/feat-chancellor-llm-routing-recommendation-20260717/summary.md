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
- **提交披露（已核实证据，非归因猜测）**：`20d50e6` 的 parent 有两个
  （`8f7aef2` + `0d2feb9`），`0d2feb9` 系列 5 个 commit 主题是 legacy forecast
  router 遥测/隔离，与本变更无关。`git reflog` 显示 `20d50e6` 的动作类型是
  `commit (merge)`——这只能证明：本会话执行 `git commit` 时 `MERGE_HEAD` 已经
  存在（即之前有别的操作跑过 `git merge` 但没自动提交），本会话的 `git commit`
  客观上把它一并收尾了。**reflog 不记录是谁/什么进程创建的 `MERGE_HEAD`**，
  本会话没有主动执行过 `git merge`，但无法进一步确认具体源头，此处不做超出
  证据的归因。旁证：`b87113e`（00:30:36，同样在本会话工作期间出现，但不是
  本会话提交的）也是同样的 `commit (merge)` 动作类型，说明这不是一次性偶发，
  而是这条分支上反复出现的模式，本会话只是两次都不巧撞上了收尾提交。
  提交信息本身只写了修复内容，未披露实际带入的另一条工作，未重写历史，
  此处补充披露。
