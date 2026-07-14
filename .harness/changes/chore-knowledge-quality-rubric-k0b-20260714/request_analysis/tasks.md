# 任务：chore-knowledge-quality-rubric-k0b-20260714

## 任务 1：K0B 冻结知识质量与可信结果 rubric

- 目标：把 launch S7、知识检索、30条真实结果和证据生命周期变成不可静默放宽的机器门。
- 前置条件：K0A 已完成；只实施 K0B；不进入 K0C/K1，不创建假案例或 outcome。
- 输入：launch blueprint S7/S9、知识飞轮蓝图、当前 `authenticated_ratio=0` 事实。
- 输出：`knowledge-quality-rubric.v1`、JSON Schema、确定性 evaluator、manifest/doctor 登记和正反例测试。
- 涉及文件：`.harness/contracts/knowledge-quality-rubric.schema.json`、`.harness/manifest/knowledge-quality-rubric.v1.json`、`.harness/manifest/project-harness.json`、`scripts/knowledge-quality-rubric*.mjs`、root docs/change/plan。
- 状态 / 数据变化：只有根 harness 契约变化；不写数据库、Vault、Qdrant、知识索引或发布状态。当前 evidence 保持 `NO_DATA`。
- 验证命令与证据：见 `../ci_result/ci_summary.md`。
- 回滚边界：撤销 rubric/登记/evaluator/test/docs 即可，无运行数据恢复。
- 完成定义：阈值、owner、evidence path、expiry、retest trigger 全冻结；PASS/FAIL/NO_DATA/EXPIRED 与数据完整性正反例通过；doctor 通过。
