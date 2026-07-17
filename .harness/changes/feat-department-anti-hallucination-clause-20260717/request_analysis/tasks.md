# 任务：feat-department-anti-hallucination-clause-20260717

## 任务 1

- 目标：为六部 Agent 接入统一反幻觉条款。
- 前置条件：`minister_personas.py` 是六部 council prompt 事实源。
- 输入：六部既有专属 persona prompt。
- 输出：共享 `DEPARTMENT_ANTI_HALLUCINATION_CLAUSE`，自动追加到六部 prompt。
- 涉及文件：`backend/src/minister_personas.py`、`backend/tests/test_minister_personas.py` 及本 change 证据。
- 状态 / 数据变化：仅内存 prompt 文本变化，无数据库/外部副作用。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_minister_personas.py`（12 passed）。
- 回滚边界：删除共享常量与六部追加循环即可恢复原 prompt。
- 完成定义：六部均含同一份条款，明确职责外拒答、缺口标注、证据/工具要求。
