# Chaotang UI/UX System Harness

This harness defines the first testable UI/UX contract for Chaotang OS pages.
It does not implement a frontend. It validates future page designs against the
product standard:

`clear first viewport -> visible state -> trusted evidence -> one next action -> restrained delight`

## Core Design Trio

- `朝堂气象`: global status strip that answers whether the system is stable.
- `圣旨战报`: the memorable task-completion report with score, merit, yushi verdict, archive, and next action.
- `钦天监伴读`: contextual help that teaches only the current page and next action.

## Commands

```bash
python harness/chaotang_uiux_system/scripts/run_uiux.py --no-ledger
pytest -q tests/test_chaotang_uiux_system.py
```

Runtime artifacts are written under `artifacts/` and ignored by git.

