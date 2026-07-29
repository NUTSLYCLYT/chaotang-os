from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "harness" / "manifest.json"


def test_w08_participant_task_card_is_backend_doctor_required() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    true_loop = next(
        item for item in manifest["primaryHarnesses"] if item["id"] == "chaotang-true-loop"
    )

    assert (
        "product_acceptance/user_acceptance/participant_task_card.zh-CN.md"
        in true_loop["required"]
    )
