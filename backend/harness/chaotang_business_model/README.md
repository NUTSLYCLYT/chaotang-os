# Chaotang Business Model Harness

This harness turns the Chaotang OS commercial design into deterministic checks.
It validates whether pricing, Chaobi consumption, enterprise cash flow, user
delight, and investor narrative stay aligned with the product trust model.

Core loop:

`subscription -> chaobi usage -> visible value -> merit proof -> renewal/upgrade -> enterprise cash flow`

## Commands

```bash
python harness/chaotang_business_model/scripts/run_business_model.py --no-ledger
pytest -q tests/test_chaotang_business_model.py
```

## Non-Negotiables

- Revenue cannot buy `圣君`, task score, yushi approval, verified ROI, rank, or archive truth.
- Paid value must map to visible capability, not artificial friction.
- Enterprise cash flow must include annual contracts, governance, audit, and budget control.
- Investor content must show market pain, product magic, business loop, moat, proof, and risk control.
