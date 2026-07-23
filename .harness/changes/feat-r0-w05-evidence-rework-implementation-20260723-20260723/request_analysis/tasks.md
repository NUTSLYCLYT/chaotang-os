# 任务：feat-r0-w05-evidence-rework-implementation-20260723-20260723

## 任务 1：补证立即关闭旧奏折裁决资格

- 目标：补证后旧正式奏折不能再被 adopt。
- 前置条件：R0-W05 authority GO。
- 输入：已 formalized 的任务和公共 `request_evidence` 裁决。
- 输出：旧奏折进入 `awaiting_evidence`，后续 adopt fail closed。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_final_memorial_gate.py`。
- 状态 / 数据变化：仅将当前 `ready_for_decision` 奏折推进为 `awaiting_evidence`。
- 验证命令与证据：CI summary 中的 RED/GREEN 命令。
- 回滚边界：撤销状态更新；无 migration。
- 完成定义：新增公共 API 测试和两个相邻回归全绿。
