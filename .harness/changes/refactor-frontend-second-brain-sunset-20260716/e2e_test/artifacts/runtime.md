# P4 browser smoke runtime

## Scope

This is a fixture-driven UI projection smoke, not proof of backend swarm or quality-gate quality. The fixture follows the canonical
Shangshufang status envelope and is used only to prove that the frontend renders backend-owned facts and writes the selected
decision back to the canonical decision endpoint.

- Code under test: `task/p4-frontend-second-brain-sunset@9432178`
- Runtime: Next.js `16.2.6` production build, Chromium `150`, port `3060`
- Case: `task_p4_browser_smoke_001`
- Recorded: 2026-07-16, Asia/Shanghai

## Runtime command

```bash
BASE_PATH=/chaotang \
NEXT_PUBLIC_BASE_PATH=/chaotang \
NEXT_PUBLIC_API_MODE=real \
CHAOTANG_BACKEND_API_URL=http://127.0.0.1:8081 \
pnpm exec next start -p 3060
```

The clean Playwright CLI session was `p4e1final`. Onboarding was skipped before tracing. After tracing started, the session:

1. routed `**/api/shangshufang/tasks/task_p4_browser_smoke_001/status` to `canonical-status.fixture.json`;
2. routed `**/api/shangshufang/tasks/task_p4_browser_smoke_001/decision` to `request-evidence.fixture.json`;
3. opened `/chaotang/junjichu?taskId=task_p4_browser_smoke_001`;
4. took the blocked-state screenshot and accessibility snapshot;
5. clicked `补证`, asserted exactly one `补证已提交`, and took the two submitted-state screenshots;
6. stopped tracing and closed the browser.

The earlier route experiment against `/api/court/...` did not match the transport-normalized URL and was discarded. The committed
trace starts only after the correct `/api/shangshufang/...` routes were installed.

## Observed contract

- `GET /chaotang/api/shangshufang/tasks/task_p4_browser_smoke_001/status` → `200`
- `POST /chaotang/api/shangshufang/tasks/task_p4_browser_smoke_001/decision` → `200`
- accessibility snapshot: `LIVE_SWARM` 8 occurrences; the Gongbu opinion appears in the left and right projections;
- quality gate: `质量门阻断`, `不可采纳`, adoption disabled, supplemental evidence enabled;
- after the click: exactly one `补证已提交`.

The trace deliberately retains the unmocked `GET /api/chaotang/tasks`, task-detail, and stream `401` responses. They do not populate
the canonical projection and are expected in this fixture-scoped smoke; they are recorded rather than hidden.

## Artifacts

| File | Purpose | SHA-256 |
| --- | --- | --- |
| `canonical-status.fixture.json` | canonical backend-shaped status response | `ef1c5bdac211622b8e8165e45adc3f1e17f12491b2d58596fb60dd6e1babfcb4` |
| `request-evidence.fixture.json` | canonical decision acknowledgement | `1a3894461e83088431ab324aadf290485f54801c8ce1a1b18a5451d4e659b7d4` |
| `01-canonical-blocked.png` | LIVE_SWARM, department opinions, missing evidence, blocked adoption | `ff02ce224e29ccabb1913ce01ce9ab0e491cabf36509aae43327515bddf85eb3` |
| `02-request-evidence-submitted.png` | full page after supplemental-evidence submission | `83096b257159c99b80ac685be337fc1f0c075a7fd941f544c164874d0ae64f93` |
| `03-request-evidence-feedback.png` | five-key decision control and `补证已提交` feedback | `e374af5416020a93459363410ebfb889310c69ac8e2e4b2ae3b9003015e5a0c7` |
| `trace.zip` | clean Playwright trace, network log, stacks, and referenced resources | `2f4d4bcd2e637b026d2f0a1a1f593846c26294f14cee58b6d0aeebb3c1d59610` |

Archive check:

```text
python3 -m zipfile -t trace.zip
Done testing
```

## Gongbu and Xingbu SHADOW clauses

```bash
cd frontend
pnpm exec tsx --test src/lib/p4-shadow-capabilities.nodetest.ts
```

```text
ok 1 - jinyiwei client radar is explicitly SHADOW and decision-ineligible
ok 2 - gongbu client evaluation is labelled as non-canonical advice
ok 3 - xingbu client scan is a SHADOW first-pass and never claims low risk
ok 4 - frontend governance gate declares its client-only shadow boundary
# pass 4
# fail 0
```
