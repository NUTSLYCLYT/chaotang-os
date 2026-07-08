# Chaotang Merit System Harness

This harness defines the first backend version of the Chaotang progression and
economy loop:

`task -> yushi verdict -> score -> merit -> title -> department growth -> battle report -> optional purchase`

It is intentionally a harness layer. It does not replace `chaotang_department_protocol`
or `chaotang-commercial-loop`; it consumes their outputs later and keeps the
economy safe before UI or payment integration exists.

## Design Rules

- Titles are earned by verified merit, never purchased.
- `gongye` is the honor ledger. It cannot be bought, transferred, or cashed out.
- `chaobi` is a platform wallet credit for in-product digital services only.
- `shangyin` is promotional credit. It must be labeled as reward/promotional.
- Purchases cannot change task score, yushi approval, verified ROI, archives, or ranks.
- Paid random rewards are disabled in v1.
- Mobile app sales of digital services, virtual currency, skins, or app features must
  use the applicable platform billing flow.

## Commands

```bash
python harness/chaotang_merit_system/scripts/run_merit.py --no-ledger
pytest -q tests/test_chaotang_merit_system.py
```

## Output

The runner writes:

- `artifacts/latest.json`
- `artifacts/latest.md`
- `artifacts/ledger.jsonl`

Runtime artifacts are intentionally ignored by git.
