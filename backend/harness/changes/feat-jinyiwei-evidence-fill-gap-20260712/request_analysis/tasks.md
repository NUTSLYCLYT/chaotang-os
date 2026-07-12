# 任务拆解：feat-jinyiwei-evidence-fill-gap-20260712

## 任务 1 —— 端点实现

- 目标：`POST /api/intel/evidence/fill-gap`。
- 输出：`web/routers/jinyiwei.py` 新增端点；`_persist_brief_items` 加 `origin_task_id` 参数。
- 验收：状态校验、空值校验、成功路径均按预期。

## 任务 2 —— 测试

- 目标：覆盖拒绝路径与成功路径。
- 输出：`tests/test_jinyiwei_endpoint.py` 新增 4 个测试。
- 验收：全部通过。

## 任务 3 —— 回归验证

- 目标：证明没有引入回归。
- 输出：全量 `pytest`、三层 harness doctor 的运行结果。
- 验收：无新增失败；三层 doctor 全绿。
