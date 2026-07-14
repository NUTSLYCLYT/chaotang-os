# 任务拆解

## 任务 1

- 目标：让当前前端不再生产、接受或渲染 legacy `feed_flywheel`。
- 输入：CourtDoc 类型/mock、archive-doc adapter、ArchiveCard。
- 输出：三动作 allowlist，仅保留 `open_annals / trace_evidence / export_amulet`。
- 验收：旧 payload 被过滤；无 RefreshCw/按钮分支；test/type/build 全绿。
- 依赖：backend K0C-1 409 tripwire；canonical promotion 仍为 PLANNED。
