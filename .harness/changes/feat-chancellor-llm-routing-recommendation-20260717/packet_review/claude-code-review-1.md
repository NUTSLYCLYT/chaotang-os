# 独立复审：feat-chancellor-llm-routing-recommendation-20260717

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Code（本会话），只读复审 |
| 被审 commit | `c271f5a feat: add chancellor route recommendation layer` |
| 结论 | **GO（范围内；不修复也不继承 PKT-2/3 的锦衣卫缺口，纯属正交）** |

## 复审要点

- `merge_decision_level`/`recommend_route` 不引用 `CANONICAL_MINISTRY_IDS`、
  `runtime_projection`，跟 PKT-2/PKT-3 的锦衣卫缺口无关——不会引入同类回归，
  但也不会修复它（该层只在硬门/departments 已经算出之后再叠加建议）。
- `chancellor_router.decide()` 里 `recommend_route(command)` 调用未传
  `call_fn`，生产路径目前必然走 `call_fn is None` 的 degraded 分支——这层
  当前在生产中是**无操作占位**，ci_summary 如实披露（"provider 未配置时如实
  标记 degraded"），未夸大为已生效。
- 回归测试直接用本次调查的起点原句"我要去美国看世界杯决赛"验证
  `unsupported_scope` 结构化输出，闭环了本文档第0节的问题场景。
- `test_hard_risk_gate_wins_over_llm_and_user` 验证硬门优先级正确
  （D2 > 任何 LLM/用户建议）。

## Blocker

无。

## 待办（非本 commit 范围）

真实 provider 接入、`call_fn` 实际调用点还未接线——这是该 packet 自己
ci_summary 里已披露的已知未完成项，不是复审新发现。
