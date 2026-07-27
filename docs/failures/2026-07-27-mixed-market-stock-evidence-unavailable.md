# Mixed-market stock evidence returned data insufficient

## Summary

On 2026-07-27, a decree asking for BYD prices on both `002594.SZ` and
`1211.HK`, plus PE, PB, and a 30-day trend, returned HTTP 200 but rendered
“数据不足”. The persisted investigation was `UNAVAILABLE` with zero evidence.

## Root Cause

The MCP source applies the overseas-market guard to the complete request
question for every market fact. Because the question contained `1211.HK`, the
first otherwise-supported Shenzhen last-price fact failed locally with
`market_out_of_scope`; no MCP discovery or tool call occurred.

The approved Westock contract currently covers only mainland China
`LAST_PRICE` and `INTRADAY_SERIES`. It does not cover Hong Kong instruments,
PE, PB, or a 30-day trend, so the full request could not have been resolved
under the current approval even without the mixed-request gate.

The merge also left the Shiguan evidence source calling
`find_similar_archives()` without its newly required `owner_user_id`. That
exception is intentionally swallowed at the source boundary and persisted as
`shiguan_unavailable`, making the historical-evidence fallback unavailable.

Finally, the currently running backend did not explicitly select the valid
local OAuth credential store or enable external Jinyiwei network access. This
did not cause this investigation, which failed before credential or network
checks, but it would block a subsequent supported mainland request.

## Prevention

- Partition mixed-market requests by fact and apply market scope to each fact,
  rather than rejecting supported mainland facts because another requested
  fact is overseas.
- Reject or clearly classify unsupported metrics before starting an
  investigation, and report partial support instead of presenting an
  undifferentiated data shortage.
- Propagate the authenticated owner through the evidence session into Shiguan
  recall.
- Start local runtime services with an explicit, validated credential source
  and external-network policy; fail readiness when an enabled authenticated
  source cannot be used.

## Detection

Add deterministic tests covering one request with a supported SZSE last price
and an unsupported HK price, asserting that the SZSE fact still reaches the
approved MCP adapter while the HK fact fails closed. Add a source integration
test that constructs the production Shiguan recall adapter with an owner and
fails if `shiguan_unavailable` is caused by a signature mismatch.

Runtime smoke checks should query only redacted credential status and assert
that an enabled Westock source has an explicitly selected provider and network
policy. Investigation diagnostics must inspect persisted `source_attempts`;
HTTP 200 alone is not evidence that market data was obtained.

## Evidence

- `backend/app/jinyiwei/sources/mcp.py`: `_instrument_inputs()` applies the
  out-of-scope check to `query.request.question`.
- `backend/config/jinyiwei_mcp.yaml`: approved Westock metrics are limited to
  mainland `LAST_PRICE` and `INTRADAY_SERIES`.
- `backend/app/jinyiwei/sources/shiguan.py`: `_default_recall()` omits the
  required owner argument.
- `backend/app/shiguan/recall.py`: `find_similar_archives()` requires
  `owner_user_id`.
- `backend/data/jinyiwei.sqlite3`: investigation
  `936f9780-ceb9-42d5-ad37-350cf5d99bde` persisted
  `UNAVAILABLE`, `market_out_of_scope`, zero call audits, and five unresolved
  facts.
- ADR 0024 defines the mainland A-share identity and provider boundary.
