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

## 任务 2：补证绑定精确 current content hash

- 目标：旧页面、缺版本或伪造版本的补证请求不能改变 current task/final。
- 前置条件：任务 1 GREEN，status API 已公开 `formal_memorial.content_hash`。
- 输入：`expected_final_memorial_content_hash`。
- 输出：匹配时进入补证；missing/stale 时 fail closed。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_final_memorial_gate.py`。
- 状态 / 数据变化：校验发生在 EmperorDecision 与状态写入前；拒绝请求无持久化变化。
- 验证命令与证据：missing RED→GREEN、stale RED→GREEN，相关回归 5 passed。
- 回滚边界：撤销请求字段与前置校验；无 migration。
- 完成定义：正确 hash 保持纵切 1 行为，missing/stale hash 均失败且 stale 状态不变。
