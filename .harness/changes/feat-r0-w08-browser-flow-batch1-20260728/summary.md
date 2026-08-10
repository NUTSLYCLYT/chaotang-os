# 变更摘要：feat-r0-w08-browser-flow-batch1-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-browser-flow-batch1-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 目标：登记 W08 `10/10 real backend browser flow` 的第 1 条真实后端浏览器闭环基线。
- 使用既有 `frontend/playwright.w07.config.ts` 与 `frontend/e2e/w07-contract-runnable-minimum.spec.ts`，作为 W08 browser flow baseline 复用证据。
- 不修改产品代码。

## 已验证闭环

- 隔离后端：`127.0.0.1:8081`，临时 SQLite/test schema。
- 前端：`127.0.0.1:3002`。
- 真实认证：注册并登录真实 JWT 用户。
- 用户路径：`/shangshufang` 打开合同任务。
- 生成：`POST /api/artifacts/deliveries` 返回 `201`。
- 下载：浏览器下载 JSON artifact。
- 裁决：`POST /api/shangshufang/tasks/task-w07-runnable-minimum/decision` 返回 `200`。
- 审计回放：打开 `/shiguan?taskId=task-w07-runnable-minimum`，并用 exact `archiveId` 回读。
- PARTIAL 状态：刷新后仍保持 `PARTIAL`，无 resume/decide 误开放。

## 边界

- 这是 `1/10` browser flow evidence，不是 W08 完成。
- 本 Packet 不证明生产已切换。
- 不 push、不部署、不迁移数据库、不操作 3050。
