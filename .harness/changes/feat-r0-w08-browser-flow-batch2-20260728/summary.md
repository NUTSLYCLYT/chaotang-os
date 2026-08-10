# 变更摘要：feat-r0-w08-browser-flow-batch2-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-browser-flow-batch2-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 目标：把 W08 `10/10 real backend browser flow` 从 `1/10` 推进到 `4/10`。
- 文件：
  - `frontend/playwright.w08-browser-batch2.config.ts`
  - `frontend/e2e/w08-browser-flow-batch2.spec.ts`
  - `.harness/changes/feat-r0-w08-browser-flow-batch2-20260728/`

## 新增真实浏览器场景

- Flow 2：`/shangshufang` 合同任务生成 artifact、下载 JSON、裁决归档，并从 `/shiguan` 重开 exact lineage。
- Flow 3：`/shiguan` 拒绝篡改的 `archiveId`。
- Flow 4：PARTIAL artifact 刷新后保持不可裁决、不可 resume。

## 边界

- 复用隔离 W07 runnable backend launcher，但 task id、测试归属和证据均登记为 W08 Batch 2。
- 不新增页面。
- 不新增 Agent。
- 不修改产品运行代码。
- 不 push、不部署、不迁移数据库、不操作 3050。
