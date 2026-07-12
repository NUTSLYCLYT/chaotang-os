# 需求说明：feat-jinyiwei-evidence-fill-gap-20260712

## 背景

阶段1/2建好了持久情报池和六部读写穿透，但"证据不足"这个决策阶段(`awaiting_evidence`)本身仍然是个死路。用户处理一个 `awaiting_evidence` 任务时，唯一能做的是重新点 `recheck` 让整个蜂群会审重跑一遍，无法针对具体某一条缺口单独让锦衣卫去核实。

## 范围

- `POST /api/intel/evidence/fill-gap`：`{task_id, gap}` → 校验状态 → 真实检索+分级 → 写回共享池 → 原样返回结果。

## 非目标

- 不建自动化流水线(明确排除)。
- 不改 `recheck` 既有流程。
- 前端接线视用户决定。

## 验收标准

- 校验 `task_id` 存在且 `status == "awaiting_evidence"`，否则拒绝并给出明确错误信息。
- 校验 `task_id`/`gap` 非空。
- 成功路径：结果原样返回，且能通过 `GET /api/intel/evidence` 查到，`originTaskId` 字段正确关联。
- 全量 `pytest` 无新增失败；三层 `harness:doctor` 全绿。

## 验证计划

`python3 -m pytest -q tests/test_jinyiwei_endpoint.py`、全量 `python3 -m pytest -q`、`python3 scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`(根级)。
