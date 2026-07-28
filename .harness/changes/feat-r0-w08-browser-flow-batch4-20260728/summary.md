# 变更摘要：feat-r0-w08-browser-flow-batch4-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-browser-flow-batch4-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 目标：把 W08 `10/10 real backend browser flow` 从 `7/10` 收满到 `10/10`。
- 文件：
  - `frontend/playwright.w08-browser-batch4.config.ts`
  - `frontend/e2e/w08-browser-flow-batch4.spec.ts`
  - `.harness/changes/feat-r0-w08-browser-flow-batch4-20260728/`

## 新增真实浏览器场景

- Flow 8：重复点击生成交付只发送一次 command，并保持 `READY`。
- Flow 9：`READY` 交付刷新后仍可下载 PDF、DOCX、JSON。
- Flow 10：归档任务通过 `/shiguan` 重新打开为只读审计案卷，旧生成/裁决操作不再暴露。

## 边界

- W08 browser flow 已达到 `10/10`。
- W08 总体验收仍未关闭；还需要非开发用户验收与 final closeout。
- 不新增页面。
- 不新增 Agent。
- 不修改产品运行代码。
- 不 push、不部署、不迁移数据库、不操作 3050。
