# 任务：兵部 CRM 护照前端可见性

## Status

Implemented

## Product Definition

兵部导入销售事实页展示鸿胪寺签发的 CRM 能力护照状态。用户能看到 provider 是否已审查、是否只读以及凭据边界；页面不提供连接、写回或凭据输入。

## Acceptance Criteria

- [x] 前端通过认证 BFF 查询 CRM 能力护照，并严格校验响应字段。
- [x] Twenty 已审查时显示“已准入·只读”；护照缺失或服务失败时显示阻断，并保持兵部不发起 CRM 读取的语义。
- [x] BFF 只转发 HttpOnly 会话对应的后端 Bearer，不暴露凭据或 provider secret。
- [x] 类型检查、全量前端测试和 lint 通过。

## Delivery Constraints

只允许修改审批清单中的前端 client、BFF route、兵部导入视图、样式和本任务文档；不新增外部连接、SDK、CRM 写入或凭据表单。

## Affected Modules

- 模块：frontend backendClient、capabilities BFF、兵部导入页。
- 允许路径：见 `.harness/approvals/BINGBU-CRM-PASSPORT-UI-20261008.json` 的 `productPaths`。

## Technical Plan

1. 在前端 client 增加严格的 CRM 护照解析和读取函数。
2. 新增认证 BFF 路由，映射 401/404/503 为固定脱敏响应。
3. 在兵部导入入口展示护照状态和只读凭据边界。
4. 运行 typecheck、npm test、lint、diff check 和 Harness check。

## Implementation Report

- 新增前端 `CrmProviderPassport` 严格解析、认证 BFF 查询路由和兵部导入页护照状态卡。
- 阻断状态只展示固定脱敏文案，不显示后端错误、凭据或连接细节。
- 前端不增加 CRM 连接按钮、写回动作或凭据输入。

## Acceptance Review

- 验收结果：Accepted for offline candidate。
- 真实 CRM 连接仍由鸿胪寺后续审查，前端没有放行任何外部动作。
