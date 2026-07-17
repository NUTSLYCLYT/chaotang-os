# 任务：feat-chancellor-llm-routing-recommendation-20260717

## 任务 1

- 目标：为丞相路由增加可验证的结构化推荐层。
- 前置条件：PKT-2 canonical 部门边界、PKT-3 门下省前置保护。
- 输入：任务文本与可注入 provider call。
- 输出：candidate_departments、D0/D1/D2、confidence、unsupported_scope、降级状态。
- 涉及文件：推荐模块、`chancellor_router.py`、测试及 change 证据。
- 状态 / 数据变化：路由返回增加 recommendation 与 decision_level；无数据库迁移。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_chancellor_router.py backend/tests/test_chancellor_llm_recommendation.py`（17 passed）。
- 回滚边界：删除返回字段/模块即可回到确定性路由；硬门不变。
- 完成定义：世界杯可结构化为 unsupported_scope；非法 provider 明确降级；D2 硬门不可被覆盖。
