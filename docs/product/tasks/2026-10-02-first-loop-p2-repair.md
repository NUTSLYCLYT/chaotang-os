# 首个真实流程 P2 编排修复

- 任务 ID：`CHAOTANG-FIRST-LOOP-P2-REPAIR-20261002`
- 基线：`ceef5e0f81c9f5298e8723e39b95a13e11e1aac9`
- 目标：在既有 orchestration contracts 上提供 owner/task/attempt 绑定的首个单部门流程适配器。
- 产品文件范围：
  - `backend/app/orchestration/__init__.py`
  - `backend/app/orchestration/first_loop.py`
  - `backend/tests/test_first_loop.py`
- 非目标：不修改 UI、权限/ADR、预算账本、任务账本、部署、模型调用或发布配置。
- 验收：compileall、pytest `tests/test_first_loop.py`、ruff 三文件均通过；失败时保留原因并回退到基线。
- 回退：删除本任务子提交并回到基线；不触碰用户数据或其他工作区改动。
