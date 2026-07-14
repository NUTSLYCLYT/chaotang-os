# Hubu Investment Swarm Gate

Purpose: prevent the Hubu investment swarm from turning research into unsafe or
unsupported investment advice.

This gate consumes candidate Hubu outputs and checks whether they comply with
the `hubu-bottleneck-investing` skill distilled from the Serenity research
case.

## Run

```bash
node backend/harness/hubu-investment-swarm-gate/evaluators/run-hubu-investment-gate.mjs
# or: cd backend && node harness/hubu-investment-swarm-gate/evaluators/run-hubu-investment-gate.mjs
```

The evaluator resolves inputs relative to its own file. Runtime reports are
written to the ignored `artifacts/` directory; `baselines/reference.*` preserves
the reviewed reference result without making every run dirty the worktree.

## Gate

The gate requires:

- non-personalized investment advice disclaimer;
- status is one of `observe`, `needs_evidence`, `defer`, `reject`;
- source ledger and timestamps;
- downside and invalidation;
- liquidity and manipulation risk;
- manual review;
- no buy/sell/position-size instruction;
- no certainty language.

## Scope

This is a research safety gate only. It does not execute trades, rank portfolios,
or produce user-specific investment decisions.

## Finance Intel Loop Addendum

2026-07-01 added the Shangshufang -> Jinyiwei -> Hu Bu -> jiqun finance swarm
closed-loop harness for public-company financial source review.

This is still a safety harness, not an investment-advice product. The loop may
create an internal watchlist or decision brief, but it must not create a real
trade order, payment instruction, buy/sell instruction, or position-size
recommendation.

### Contract

The browser uses the typed frontend adapter to call the backend-owned
`POST /api/shangshufang/finance-intel-loop/complete` contract. The backend then
builds the finance swarm request with:

- `entry_swarm: "finance"`
- `source_label: "LIVE"`
- `intelligence_pack.sourceUrls` containing the official SEC URLs
- `intelligence_pack.financialSources` preserving the same URLs as evidence
- `evidence_bound_run` preserving `missing_evidence` and `forbidden_outputs`

Backend must persist a replayable session available at
`GET /api/swarm/sessions/{session_id}`. The session must include:
The session must include:

- `session_type: "finance_intel_loop"`
- `finance_intel_loop.memorial.previewOnly: true`
- `finance_intel_loop.memorial.executionAllowed: false`
- `finance_intel_loop.memorial.sideEffects: "none"`
- `finance_intel_loop.sourceUrls` with the same SEC URLs
- `finance_intel_loop.qualityGate.checks.missing_evidence_clear: true` only
  when the required official source evidence is complete

There is no frontend BFF enforcement point. The backend contract owns the gate:
missing official sources keep the case at `awaiting_jinyiwei_evidence`; no
authorized decision, decree, execution, or archive may be produced. Frontend
code may display that state but cannot upgrade it.

### Harness Commands

The following UI/build commands are cross-line checks owned by `frontend/`;
run them from that directory. They complement this backend safety evaluator but
do not replace it.

Focused type and unit checks:

```bash
cd frontend
pnpm exec tsc --noEmit
npx --yes tsx --test src/lib/intel/signal-dispatch.nodetest.ts
```

Production build gate:

```bash
cd frontend
NEXT_PUBLIC_API_MODE=real pnpm build
```

Browser UI closed-loop smoke with fake jiqun:

```bash
cd frontend
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3050 \
FINANCE_INTEL_LOOP_UI=1 \
FINANCE_INTEL_LOOP_FAKE_JIQUN=1 \
FINANCE_INTEL_LOOP_FAKE_JIQUN_PORT=19081 \
JIQUN_API_URL=http://127.0.0.1:19081 \
pnpm exec playwright test e2e/finance-intel-loop-ui.spec.ts --project=chromium
```

API closed-loop smoke with fake jiqun:

```bash
cd frontend
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3050 \
FINANCE_INTEL_LOOP_SMOKE=1 \
FINANCE_INTEL_LOOP_FAKE_JIQUN=1 \
FINANCE_INTEL_LOOP_FAKE_JIQUN_PORT=19081 \
JIQUN_API_URL=http://127.0.0.1:19081 \
pnpm exec playwright test e2e/finance-intel-loop-smoke.spec.ts --project=chromium
```

Fake jiqun session IDs used by the harness must match the real jiqun trace
shape:

```text
YYYYMMDD_HHMMSS_alphanumeric
```

Do not weaken `SourceLabelGuard` to make a fake fixture pass. Fix the fixture.

## PACK Shangshufang Entry Addendum

2026-07-01 added the real Shangshufang "旨/密" entry harness for PACK swarm
assessment. This flow deliberately does not use the shortcut
"三方全链路闭环 / 跑通闭环" console. The browser must operate the same UI path a
user operates:

1. Open `/court-briefing`.
2. Select `旨` or `密`.
3. Enter the PACK assessment decree.
4. Generate the polished decree draft.
5. Confirm the decree.
6. Read the resulting scroll for 上书房, 锦衣卫, 户部, 工部, 钦天监.

### PACK Contract

The browser calls the backend-owned
`POST /api/shangshufang/pack-swarm-loop` contract through its typed adapter.
The backend dispatches the `pack_rd` swarm request with:

- `entry_swarm: "pack_rd"`
- `courtos_departments: ["jinyiwei", "hubu", "gongbu", "qintianjian"]`
- `courtos_swarm_bundles` for collection, budget/valuation, build plan, and
  strategy/risk
- `evidence_bound_run` containing the Jinyiwei collection checklist, data
  structure, scoring rubric, validation method, missing evidence, and forbidden
  outputs

When no real customer/process/cost/delivery/aftercare/market evidence is
provided, the loop must mark the result as evidence-gated and require human
intervention before budget, valuation, external delivery date, ROI, or customer
commitments are treated as final.

### PACK Harness Command

Browser UI closed-loop smoke with fake jiqun:

```bash
cd frontend
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3050 \
PACK_SWARM_SHANGSHUFANG_E2E=1 \
PACK_SWARM_FAKE_JIQUN_PORT=19082 \
JIQUN_API_URL=http://127.0.0.1:19082 \
pnpm exec playwright test e2e/pack-swarm-shangshufang-entry.spec.ts --project=chromium
```

Expected UI effect:

- the final scroll title is `PACK 蜂群协同评估`;
- it displays 锦衣卫采集清单, 数据结构, 评分口径, 验证方式;
- it shows 户部, 工部, 锦衣卫, 钦天监 responsibilities;
- fake jiqun receives one `pack_rd` swarm run with the evidence-bound missing
  evidence list.
