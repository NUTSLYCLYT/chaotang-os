# 专署·锦衣卫唯一入口设计

## Decision

`/zhuanshu/jinyiwei` is the sole route for the 专署·锦衣卫 experience. It is a protected, read-only Jinyiwei audit desk. `/zhuanshu`, `/jinyiwei`, and the prior signal-detail route are removed; none redirects.

## User experience

The court header’s 专署 navigation item opens `/zhuanshu/jinyiwei`. The page identifies itself as “专署·锦衣卫” and renders the existing read-only evidence workflow: summary, investigation cards, and an in-page selected investigation detail. No action may initiate an investigation or mutate evidence.

## Architecture and data flow

The route performs the existing server-side session guard before rendering. Its client controller communicates only with the existing same-origin, GET-only Jinyiwei BFF endpoints. It must not access FastAPI directly or expose backend configuration. The old path-specific page files are deleted so there is no second entry or compatibility layer.

## Error handling and accessibility

Existing loading, empty, unavailable, and narrow-screen behavior remains available. Status must continue to be communicated in text rather than color alone. A removed legacy path returns the framework’s not-found response.

## Documentation and verification

ADR 0028 and frontend route documentation will name `/zhuanshu/jinyiwei` as the one read-only audit-desk route. Tests first demonstrate the navigation target, sole entry, session guard, and absence of legacy pages. Verification runs the focused tests, frontend lint/typecheck/test/build, relevant HTTP smoke check, the harness, and `git diff --check`.

## Self-review

- No placeholders or undecided routes remain.
- The route change is explicit and does not introduce a write capability.
- Scope is limited to the route consolidation and its governing documentation.
