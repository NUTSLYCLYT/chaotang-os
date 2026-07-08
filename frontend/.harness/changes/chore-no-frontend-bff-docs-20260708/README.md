# Change: no frontend BFF docs

## Intent

Record the durable project boundary that `chaotang-web-lyt` no longer needs or owns a BFF layer.

## Decision

- Do not add or restore `src/app/api/**` runtime route handlers.
- Do not treat `/chaotang/api/**` as the frontend-to-backend integration path.
- Connect frontend runtime data to explicit backend services such as `jiqun_ai` through documented adapters and environment-controlled base URLs.

## Operational Note

For local frontend servers on 3002 or 3003 that need backend 8081, configure the dev-server environment, for example:

- `JIQUN_API_URL=http://127.0.0.1:8081`
- `NEXT_PUBLIC_JIQUN_API_URL=http://127.0.0.1:8081`
- `NEXT_PUBLIC_CHAOTANG_API_URL=http://127.0.0.1:8081`
- `NEXT_PUBLIC_API_MODE=real`

Connectivity problems should be fixed in env configuration, backend reachability, CORS/auth expectations, or typed client adapters. They should not be fixed by reintroducing a frontend BFF.

## Verification

- Documentation-only change.
