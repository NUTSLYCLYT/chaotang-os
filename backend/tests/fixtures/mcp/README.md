# MCP fixture provenance

These files are permanent offline contract fixtures. They are **synthetic,
sanitized JSON-RPC contract samples**, reconstructed from a bounded authenticated
read-only structure observation on 2026-07-23. They are not verbatim Tencent
WeStock responses, do not contain real prices or credentials, and are not a vendor
guarantee that the live service will continue returning these schemas or fields.

## Research record

- Prepared and reviewed: 2026-07-23.
- Initial read-only local research on 2026-07-22 and 2026-07-23 used the installed
  WorkBuddy `connector-westock-mcp/SKILL.md`; no WorkBuddy credential or private
  runtime log was read or copied.
- On 2026-07-23 the administrator separately completed official OAuth for the
  chaotang service account. Bounded live `initialize`, `tools/list`, `data_search`
  `data_quote` and `data_minute` structure checks then verified the endpoint, exact public tool
  schemas and result container/key shapes.
- Verified endpoint:
  `https://stockbuddy.qq.com/cgi/cgi-bin/openai/mcp/mcp`.
- Transport contract represented: MCP Streamable HTTP, protocol version
  `2025-03-26`.
- Verified tool names:
  `data_search`, `data_minute` and `data_quote`.

## Synthetic fields

The `tools/list` descriptions and input schemas match the bounded observation.
Search shape `{ok,data:[{code,name,type}]}` and quote shape
`{ok,data:{code:{code,symbol,name,market_type,market_name,price,time}}}` match the
observed structure. The minute fixture reconstructs the observed
`{ok,data:{code:{data:{data:[string],date:YYYYMMDD}}}}` container with synthetic
four-token rows; it is not a saved live response. Fixture values, prices, dates and response IDs are synthetic or
sanitized, and the raw authenticated responses were not saved or committed.
Future live discovery must still compare against the approval fingerprint and fail
closed on drift.

## Sanitization boundary

The fixtures contain no access or refresh token, authorization header, cookie,
session identifier, account identifier, portfolio, alert, order, user identifier,
device identifier, or runtime user data. Prices and timestamps are synthetic test
values. Raw authenticated responses must not be committed here.
