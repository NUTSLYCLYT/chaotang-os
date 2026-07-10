# 规格说明：fix-shangshufang-confirm-edict-record-flow-20260710

## 背景

用户明确要求当前流程为：点击下旨后生成下旨记录，而不是在本次请求里等待会审回奏。此前确认下旨接口会同步启动蜂群执行，可能导致 Next 代理侧 `socket hang up`，并在页面语义上表现为等待回奏。

## 范围

- 后端 `confirm-edict` 非直发分支改为记录态：`edict_recorded`。
- 返回体增加 `decree_record`，移除同步 `swarm_run` 返回。
- 前端确认下旨成功后停止自动调用 `swarm-deepen`。
- 更新后端测试，使断言匹配“生成记录，不同步回奏”的新契约。

## 非目标

- 不增加 BFF 层。
- 不调整上书房 UI 布局。
- 不移除后续由用户主动进入军机处或状态页查看/推进的能力。

## 验收标准

- `POST /api/shangshufang/confirm-edict` 成功返回 `status=edict_recorded`。
- 返回体包含 `decree_record.status=edict_recorded`。
- 返回体不要求 `swarm_run`。
- 前端下旨成功后不再立即启动 `shangshufangSwarmDeepen`。
- 后端接口测试和前端类型检查通过。

## 验证计划

- 运行 `python -m pytest -q tests/test_shangshufang_loop_api.py`。
- 运行 `npx tsc --noEmit`。
- 重启本地 8081 后端并真实请求 `draft-edict -> confirm-edict`。
