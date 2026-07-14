# 任务：fix-restore-v1-taxonomy-fact-source-20260714

## 任务 1：程序化重建事实锚点

- 目标：恢复缺失的 v1 taxonomy 外部锚点文件，消除长期红测试。
- 前置条件：确认缺失非有意删除的产品决策（git log 显示随 20260709 文档清理连带消失，无单独说明）。
- 输入：`backend/harness/chaotang_department_protocol/departments.yaml` 的 `v1_taxonomy` 块。
- 输出：`docs/chaotang-v1-taxonomy.json`，含 `generated_from` 溯源字段。
- 涉及文件：仅该 json。
- 状态 / 数据变化：无运行时影响，纯文档/测试锚点。
- 验证命令与证据：`pytest -q tests/test_chaotang_department_protocol.py` → 13 passed。
- 回滚边界：删除该文件即回到原状（测试恢复失败）。
- 完成定义：测试套件全绿。
