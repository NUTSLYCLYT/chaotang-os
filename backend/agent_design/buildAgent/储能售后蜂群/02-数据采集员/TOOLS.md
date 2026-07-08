# TOOLS.md - 数据采集员

## 依赖外部平台

### storage_platform (MCP server)

| 能力 | 用途 | 必需参数 |
|---|---|---|
| `query_telemetry` | 拉 BMS/PCS 运行数据 | device_id, start, end, metrics[] |
| `query_alarm_history` | 拉告警库 | device_id, start, end |

### 工具路由

- step 级显式声明 `tools:` 才会触发 formal tool_call（见 `src/tool_router.py`）
- 全局白名单需在 settings 中包含 `storage_platform` server
- 草稿审批：本 step 仅做**读**操作，不入审批队列

## 错误处理

- 超时 → 重试 1 次（继承 default_retry.max_retries=2）
- 权限不足 → 标 [missing] + 在「数据完整度评估」写明权限链路
- 数据为空 → 标 [missing]，不补默认值
