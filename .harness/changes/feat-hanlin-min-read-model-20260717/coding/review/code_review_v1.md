# P9 implementation self-review v1

## 结论

`READY_FOR_EXTERNAL_REVIEW`。本文件不是独立审查 GO。

## Stop-gate 检查

- 单一事实源：复用 `src.truth_ledger`，未复制账本或创建 Hanlin store。
- 真实性：非确定性-only、缺失、损坏、未知来源均降级；默认页面无本地样例。
- 权限：授权在 FastAPI；客户端 `x-hanlin-role` 不参与后端决定。
- 二阶影响：router 全局收紧后，已将全部现有 Hanlin API 消费者迁移到 Bearer transport，并加静态回归门。
- 重试/陈旧态：沿用 `backendFetch` 的一次 401 refresh；任一相关请求失败即清空本次投影并降级，旧成功数据不会在错误态继续显示。
- 回滚：无 schema/data 变化；权限不得回滚为匿名。

## 已知非阻塞项

- 验证夹具使用依赖覆盖提供 admin 身份，真实 401/403 权限行为由 FastAPI 集成测试证明。
- 页面壳层在浏览器夹具 token 下请求 `/api/chaotang/tasks` 返回 401；Hanlin 请求为 200 且带 Bearer。该噪音不来自本 diff，未顺手修改。
- 其他 Hanlin 写控件仍对应缺失契约，已明确 deferred；本 change 只保证它们使用正确认证 transport，不声称功能可用。
