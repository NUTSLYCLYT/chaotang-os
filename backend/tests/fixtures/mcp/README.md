# MCP fixture provenance

These files are permanent offline contract fixtures. They are **synthetic,
sanitized JSON-RPC contract samples**, not verbatim Tencent WeStock responses,
not an authenticated `tools/list` capture, and not a vendor guarantee that the live
service currently returns these exact schemas or result fields.

## Research record

- Prepared and reviewed: 2026-07-23.
- Read-only local observation source on 2026-07-22 and 2026-07-23: the installed
  WorkBuddy `connector-westock-mcp/SKILL.md`. No credential or private WorkBuddy
  runtime log was read or copied.
- Endpoint and tool names recorded by that local skill:
  `https://stockbuddy.qq.com/cgi/cgi-bin/openai/mcp/mcp`.
- Transport contract represented: MCP Streamable HTTP, protocol version
  `2025-03-26`.
- Tool names represented by the local skill:
  `data_search` and `data_quote`.
- The endpoint, tool names, and conceptual input fields are local contract research
  only. They have not been verified against an authenticated live `initialize`,
  `tools/list`, or `tools/call` response in Task 7.

## Synthetic fields

The initialize/server metadata, `tools/list` input schemas, search result fields
(`name`, `security_type`, `jurisdiction`, `market`, `instrument_id`), and quote
fields (`price`, `currency`, `as_of`, `publisher`, `source_url`) are deliberately
minimal synthetic samples created for deterministic offline tests. Authenticated
live verification is explicitly deferred to Task 9. It may run only after the user
separately authorizes the read-only smoke and a legitimate dedicated service account
is configured. That smoke must compare live discovery schemas with the repository
approval fingerprint and fail closed on drift.

## Sanitization boundary

The fixtures contain no access or refresh token, authorization header, cookie,
session identifier, account identifier, portfolio, alert, order, user identifier,
device identifier, or runtime user data. Prices and timestamps are synthetic test
values. Raw authenticated responses must not be committed here.
