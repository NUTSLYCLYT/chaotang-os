# TOOLS.md - 处置工单生成器

## 依赖外部平台

### workorder_system (MCP server)

| 能力 | 用途 | 写权限 | 草稿审批 |
|---|---|---|---|
| `create_workorder_draft` | 写工单草稿 | ⚠️ 写 | ✅ 必经 |

### email (MCP server)

| 能力 | 用途 | 写权限 | 草稿审批 |
|---|---|---|---|
| `prepare_email_draft` | 写邮件草稿 | ⚠️ 写 | ✅ 必经 |

## 草稿审批规则

- 本 step 所有 tool_call **必须**走 `/api/drafts/...` 队列
- `draft_id` 必须落入 `runs/<run_id>/drafts/` 与 step_log 一同存档
- 售后负责人在 Web 控制台「待审批」点批准 → 真实下发
- 拒绝/修改也都留痕，回流到 prompt 优化

## 错误处理

- 草稿创建失败 → 在工单内容里以 markdown 形式 fallback 显示，标 `[draft_creation_failed]`
- 即便工具失败，markdown 文本输出必须完整（不能为空）
