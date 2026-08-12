# Backend DeepSeek egress blocked

## Summary

The production Chancellor consultation returned its generic unavailable response even though `DEEPSEEK_API_KEY` was present. The backend container could not resolve or connect to `api.deepseek.com`.

## Root Cause

The backend was attached only to the Compose `app` network, which is intentionally marked `internal: true`. That correctly prevented public ingress but also removed all backend DNS and HTTPS egress, so DeepSeek requests failed before authentication.

## Prevention

Keep the internal `app` network for frontend-to-backend traffic and attach only the backend to a separate unprivileged `egress` bridge. Continue to use `expose: ["8000"]` without a host `ports` mapping and keep `JINYIWEI_EXTERNAL_NETWORK_ENABLED=false`.

## Detection

`node scripts/check_deployment.mjs` verifies that the backend has the dedicated outbound network and that it is declared as an ordinary bridge. Production acceptance must also resolve `api.deepseek.com` from inside the backend container, verify the DeepSeek models endpoint without printing credentials, and confirm that port 8000 is not published.

## Evidence

- Deployment contract: `deploy/compose.yaml`
- Automated check: `scripts/check_deployment.mjs`
- Regression coverage: `scripts/check_deployment.test.mjs`
- Governance baseline: `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`
