# ADR 0020：MCP 工具结果采用配置化严格归一化

## Status

Accepted — 2026-07-23

## Context

真实腾讯自选股 MCP 使用标准 `content[0].text` 返回 JSON；搜索结果为候选数组，行情结果为
以证券代码为键的对象。行情记录没有重复提供发布者、币种和来源 URL，日期字段也只有交易日
精度。原有 sanitized fixture 假设存在 `structuredContent.matches/quote` 及完整 provenance，
因此真实 OAuth 成功后仍会在确定性映射阶段失败关闭。

直接增加腾讯专用 Python 分支、JSONPath、动态字符串插值、模糊名称匹配或把日期伪装成上游
精确时刻，都会破坏 ADR 0018 的管理员审批、供应商无关和失败关闭边界。

## Decision

- MCP Client 仅在结果没有原生 `structuredContent`、且恰有一个 `type=text` 内容项时，尝试
  用严格 JSON 解析器提升顶层 object；重复键、非有限数、64 位整数溢出和超过 64 层嵌套
  不提升，原始 `content` 保留并继续参与响应哈希。
- 映射路径仍是无表达式、无通配符的 literal path。可选 `record_by_subject_path` 只能取得
  object，并只能用已经严格解析的 `resolved_subject` 选择一条记录。
- 候选缺少地域字段时，地域只能由管理员登记、互斥的证券代码正则推导；市场与币种继续由
  `markets_by_jurisdiction` 和 `units_by_market` 决定。名称保持 NFKC 后精确匹配，多候选、
  无候选、类型或代码不符均失败关闭。
- 远端缺少 publisher/source URL 时，可以使用纳入审批指纹的管理员 literal；literal 仍需
  通过发布者 allowlist、HTTPS origin 和路径正则。远端额外同名字段不覆盖管理员值。
- 当前行情工具只返回交易日。映射只能按管理员批准的固定 UTC offset 将当地日初转换为
  UTC，并在 metadata 标记原始日期和 `as_of_precision=date`；不得把 `retrieved_at` 冒充
  上游精确行情时刻。未来日期失败关闭，秒级 freshness 会保守地拒绝 date-only 行情。
- 对经过结构审查的有序文本序列，管理员可以配置固定 `delimited_series` 子契约：只支持
  `LAST`、单 ASCII 空格、固定 token 数、`BASIC_ISO_DATE`、`HHMM_24H`、严格递增时间和
  `FINITE_DECIMAL`。解析器验证全部行后，才采用最后一行的批准 value token，并把来源日期、
  分钟和固定 UTC offset 组合为市场时刻；metadata 标记 `as_of_precision=minute`。该契约与
  `value_path`/`as_of_path` 互斥，不引入表达式、任意格式串或供应商分支。
- 当响应记录本身没有重复证券代码时，`subject_from_record_key` 可以复用已经严格解析并用于
  `record_by_subject_path` 精确选中的 key；它与 `subject_path` 二选一。
- 成功 envelope 可配置 `success_path`，其值必须严格为布尔 `true`。
- 所有新增原语均属于通用契约并纳入 approval fingerprint；核心 Python 不出现 westock、
  Tencent 或 stockbuddy 条件分支。

## Consequences

真实 `data_search → data_minute` 和 `data_search → data_quote` 可以在不信任响应正文、不放宽路径语言和不硬编码供应商的
前提下生成可审计证据。管理员配置明确区分远端字段与批准的来源属性，schema 或映射漂移会
改变指纹并阻止调用。

代价是每种新响应形状仍需先做只读结构审查、补充脱敏 fixture、更新审批版本和指纹。腾讯
`data_minute` 可以在交易时段提供分钟精度的“当前价格”事实；是否满足请求仍由
`max_age_seconds` 与市场时间决定，休市、过期或畸形序列继续失败关闭。`data_quote` 的
date-only 响应仍不能满足秒级 freshness。名称别名仍可能解析失败，不得用模糊匹配静默绕过。

## Verification

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/test_jinyiwei_mcp_client.py tests/test_jinyiwei_mcp_mapping.py tests/test_jinyiwei_mcp_registry.py tests/test_jinyiwei_mcp_smoke.py tests/test_jinyiwei_westock.py -q
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m ruff check .
cd ..
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
```
