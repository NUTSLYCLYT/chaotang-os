# 任务：refactor-department-router-canonical-consolidation-20260717

## 任务 1

- 目标：统一 `departments.yaml`、`shangshufang_loop.py`、`chaotang_department_router.py` 的部门关键词事实源。
- 前置条件：既有 `department_identity` SSOT 投影。
- 输入：canonical taxonomy 的 runtime_code/routing_keywords。
- 输出：上书房中文部门规则由 canonical 投影生成；兼容路由 API 保留。
- 涉及文件：YAML、上书房路由、兼容路由、定向测试及本 change 证据。
- 状态 / 数据变化：扩充 YAML 关键词并消除第二份手写规则；无数据库变化。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_shangshufang_loop_api.py backend/tests/test_chaotang_department_router.py backend/tests/test_department_identity_ssot.py`（29 passed）。
- 回滚边界：恢复 YAML 关键词与 `DEPARTMENT_RULES` 投影前版本；不删除兼容路由。
- 完成定义：golden routes、SSOT tests 全绿，显式部门点名优先，旧调用方继续可用。
