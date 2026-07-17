# 任务：feat-gongbu-storage-pipeline-engine-20260717

## 任务 1

- 目标：将储能售后蜂群五阶段设计接入工部真实引擎注册表。
- 前置条件：复用现有 court_doc 契约、unknown_gaps 和安全灯号。
- 输入：储能/BMS/PCS/PACK/售后故障文本。
- 输出：分诊、数据采集、BMS 诊断、现场失效分析、处置工单五阶段草稿。
- 涉及文件：`backend/src/real_department_engines.py`、`backend/tests/test_real_department_engines.py`。
- 状态 / 数据变化：新增纯确定性适配器与 L3/L4 映射；不写数据库、不写外部工单。
- 验证命令与证据：`python3 -m pytest -q backend/tests/test_real_department_engines.py`（48 passed）；`python3 .claude/skills/dept-capability-map/scripts/audit.py`；两级 harness doctor。
- 回滚边界：删除 `adapt_gongbu` 注册及实现，保留测试恢复旧契约即可。
- 完成定义：工部储能任务返回五阶段 court_doc，冒烟/漏液/热失控强制 P0，其余非工部任务返回 None。
