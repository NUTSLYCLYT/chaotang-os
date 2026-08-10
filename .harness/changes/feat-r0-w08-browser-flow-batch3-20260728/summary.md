# 变更摘要：feat-r0-w08-browser-flow-batch3-20260728

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | feat-r0-w08-browser-flow-batch3-20260728 |
| 类型 | feat |
| 状态 | VERIFIED_PARTIAL |
| Owner | EXT Master Governance / W08 Product Acceptance |
| 创建日期 | 20260728 |

## 范围

- 主线：R0-W08 Product Acceptance Hardening。
- 目标：把 W08 `10/10 real backend browser flow` 从 `4/10` 推进到 `7/10`。
- 文件：
  - `frontend/playwright.w08-browser-batch3.config.ts`
  - `frontend/e2e/w08-browser-flow-batch3.spec.ts`
  - `.harness/changes/feat-r0-w08-browser-flow-batch3-20260728/`

## 新增真实浏览器场景

- Flow 5：从 review panel 下载 PDF、DOCX、JSON 三种 artifact。
- Flow 6：未登录浏览器不能直接读取合同任务面板。
- Flow 7：同租户不同用户不能回放 owner archive。

## 边界

- 当前测试注册入口固定使用 default tenant，因此本 Packet 不声明跨租户 browser proof。
- 不新增页面。
- 不新增 Agent。
- 不修改产品运行代码。
- 不 push、不部署、不迁移数据库、不操作 3050。
