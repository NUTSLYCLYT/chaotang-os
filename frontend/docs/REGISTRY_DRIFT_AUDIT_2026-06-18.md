# Department Registry Drift Audit - 2026-06-18

## Result

No blocking department naming drift found.

The current model intentionally uses two layers:

| User-facing department | Runtime id | Protocol id / implementation namespace |
|---|---|---|
| 锦衣卫 | `jinyiwei` | `jinyiwei_intelligence` |
| 户部 | `finance` | `hubu_cfo` |
| 兵部 | `war` | `bingbu_sales` |
| 吏部 | `personnel` | `libu_hr_admin` |
| 刑部 | `justice` | `xingbu_legal_risk` |
| 礼部 | `ritual` | `rites_brand_comms` |
| 工部 | `works` | `gongbu_delivery` |

This is acceptable only because `config/departments.registry.yaml` is the single registry that maps runtime ids to protocol ids. New code must not invent parallel mappings.

## Fixed Meaning

- Use `ritual` when selecting/running the 礼部 department in the unified loop.
- Use `rites_brand_comms` for 礼部 protocol files, loops, schemas, prompts, and skill names.
- Use `justice` when selecting/running the 刑部 department in the unified loop.
- Use `xingbu_legal_risk` / `xingbu` for 刑部 protocol files, loops, schemas, prompts, and skill names.
- Use `jinyiwei` as both runtime id and primary namespace for 锦衣卫.

## Passing Gates

- `npm run eval:hubu`: passed, 16 files / 5 golden cases.
- `npm run eval:libu`: passed, 20 files / 20 golden cases.
- `npm run eval:libu:adaptive`: passed, 6 files / 20 golden cases / 5 modes / 8 escalation rules.
- `npm run eval:rites`: passed, 19 files / 20 golden cases.
- `npm run eval:rites:adaptive`: passed, 6 files / 20 golden cases / 5 modes / 9 escalation rules.
- `npm run eval:jinyiwei`: passed, 24 files / 20 golden cases.
- `npm run eval:jinyiwei:adaptive`: passed, 12 files / 20 golden cases.
- `npm run eval:bingbu`: passed, 23 files / 20 golden cases.
- `npm run eval:bingbu:adaptive`: passed, 12 files / 21 golden cases.
- `npm run eval:xingbu`: passed, 21 files / 20 golden cases.
- `npm run eval:xingbu:adaptive`: passed, 7 files / 20 golden cases / 5 modes / 11 escalation rules.
- `npm run eval:gongbu`: passed, 21 files / 20 golden cases.
- `npm run eval:courtos:core`: passed, 15 files / 5 golden cases.

## Guardrail

Any future department addition must update, in this order:

1. `config/departments.registry.yaml`
2. protocol-specific registry under `config/`
3. loop under `dev/contracts/loops/`
4. schema under `dev/contracts/schemas/`
5. implementation under `src/core/courtos/<protocol>/`
6. eval script and golden cases

Do not add a new special review loop such as `five_department_review_loop`, `xingbu_special_review`, or `rites_special_review`. The unified court loop remains the orchestrator.
