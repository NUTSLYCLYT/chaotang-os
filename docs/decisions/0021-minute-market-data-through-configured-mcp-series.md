# ADR 0021：通过配置化 MCP 序列获取分钟行情

## Status

Accepted — 2026-07-23

## Context

腾讯自选股 `data_quote` 的价格快照只提供交易日，无法证明分钟或秒级新鲜度。只读结构审查
确认 `data_minute` 返回按证券代码分组的当日分时序列：日期为 `YYYYMMDD`，每行是四个由
ASCII 空格分隔的 token，其中首项为 `HHMM`，第二项为价格。现有固定字段路径不能安全表达
“验证整个有序序列、选择最后一行、分词并组合日期时间”，而把请求时间当作行情时间会制造
虚假新鲜度。

## Decision

- 管理员批准只读 `data_minute`，优先级高于 date-only `data_quote`；证券名称仍先通过
  `data_search` 精确解析为已批准市场的证券代码。
- MCP 映射增加 provider-agnostic 的 `delimited_series` 子契约。它只允许固定枚举：
  `LAST`、`STRICT_ASCENDING`、`ASCII_SPACE`、`BASIC_ISO_DATE`、`HHMM_24H` 和
  `FINITE_DECIMAL`，不接受任意正则、格式字符串、脚本或表达式。
- 映射必须验证数组非空、全部行类型和 token 数、全部时间严格递增、日期和时间合法、全部
  value token 是有限十进制；验证完成后才采用最后一行。来源日期、分钟和管理员批准的 UTC
  offset 组合为 `as_of`，并标记 `as_of_precision=minute`。
- `subject_from_record_key` 只复用 `record_by_subject_path` 已按解析代码精确选中的 key，并与
  `subject_path` 互斥。`delimited_series` 与 `value_path`/`as_of_path` 互斥。
- 价格仍受正值、单位、发布者、HTTPS 来源、未来时间、schema fingerprint 和 freshness
  门禁约束。核心 Python 不增加腾讯或 `data_minute` 条件分支。
- MCP 来源按优先级检查候选：映射成功但不满足请求 freshness 的文档只作为最佳过期候选
  暂存，并继续尝试较低优先级工具；遇到新鲜文档才停止。如果全部候选均过期，则返回时间
  最新的过期文档，由协调器统一形成 `fact_stale`。

## Consequences

交易时段内，锦衣卫可以用真实市场分钟时间解决满足 freshness 的当前价格事实；史馆仍然
优先，史馆缺失或过期后才调用 MCP。休市、序列过期、乱序、重复分钟、格式漂移或未来时间
仍然失败关闭，`data_quote` 只作为保守回退。

代价是每种类似文本序列必须经过单独结构审查、脱敏 fixture、审批版本和指纹更新。分钟精度
不是逐笔或交易所秒级实时数据；请求若要求更严格时效，仍可能保持 `fact_stale`。

## Verification

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_registry.py tests/test_jinyiwei_mcp_smoke.py tests/test_jinyiwei_westock.py tests/test_chancellor_graph.py -q
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m ruff check .
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
```
