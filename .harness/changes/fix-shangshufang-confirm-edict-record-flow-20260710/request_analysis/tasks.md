# 任务：fix-shangshufang-confirm-edict-record-flow-20260710

## 任务 1

- 目标：拆开“确认下旨”和“同步回奏”。
- 输入：`backend/web/routers/shangshufang.py`。
- 输出：确认下旨写入 `edict_recorded` 记录态并返回 `decree_record`。
- 验收：后端测试确认 `confirm-edict` 不再依赖 `swarm_run`。

## 任务 2

- 目标：前端消费记录态，不再确认后自动拉起回奏。
- 输入：`frontend/src/features/shangshufang/ShangshufangPage.tsx`。
- 输出：删除确认后 `shangshufangSwarmDeepen` 自动调用。
- 验收：前端类型检查通过。

## 任务 3

- 目标：验证运行时 500 已消失。
- 输入：本地 8081 后端。
- 输出：真实接口链路返回 `edict_recorded`。
- 验收：`draft-edict -> confirm-edict` 返回成功，无同步 `swarm_run`。
