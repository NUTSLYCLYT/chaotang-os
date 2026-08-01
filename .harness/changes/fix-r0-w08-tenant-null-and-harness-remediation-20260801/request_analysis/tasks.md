# 任务：fix-r0-w08-tenant-null-and-harness-remediation-20260801

## 任务 1：tenant-null 合同入口

- 目标：合同 draft/confirm 对缺失 tenant fail-closed。
- 前置条件：EXT exact-H 与用户 amendment 批准。
- 输入：tenantless user 或 tenantless DecisionTask。
- 输出：明确拒绝；不创建/不推进任务。
- 涉及文件：`backend/web/routers/shangshufang.py`、`backend/tests/test_shangshufang_loop_api.py`。
- 状态 / 数据变化：无 schema、无持久生产库变化。
- 验证命令与证据：focused 3 passed；后端全量 3408 passed。
- 回滚边界：仅回滚隔离候选提交。
- 完成定义：安全回归绿且正常 tenant 合同测试绿。

## 任务 2：测试与 Harness 漂移

- 目标：更新真实 tenant fixtures、CourtReview writer baseline、P0-B swarm GET probes、前端 runner/validator/guard。
- 涉及文件：仅本 Packet diff 中列出的测试、清单、前端脚本/YAML文件。
- 验证命令与证据：前端 node 1118/1118、core 397/397、build PASS、doctor 0/0。
- 完成定义：不存在通过删测试、放宽运行时授权或改变 canonical schema 来造绿。
