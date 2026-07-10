# 任务拆解

## 任务 1：归一化归档响应

- 目标：在 API 数据边界输出稳定的 `ArchiveRecord[]`。
- 输入：当前 `{ success, data: { memorials, decisions } }` 及旧 `{ success, data: ArchiveRecord[] }`。
- 输出：纯函数 adapter 与接入后的 SWR hook。
- 验收：三类响应均有回归测试，页面消费端无需防御性散点修改。
- 依赖：`ArchivePayload`、`backendFetch`、当前后端 archive 契约。

