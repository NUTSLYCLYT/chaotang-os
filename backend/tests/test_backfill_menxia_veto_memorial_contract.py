"""backfill_menxia_veto_memorial_contract.py 的核心补丁逻辑要能真的修好
2026-07-18 之前写入的坏数据，不是靠"现在数据库里没有坏行"侥幸过关。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.backfill_menxia_veto_memorial_contract import _patch_known_gaps
from src.shangshufang_memorial_contract import find_memorial_contract_violations


def test_patches_pre_fix_shape_into_a_valid_one():
    # 这是 2026-07-18 修复前真实会写出的形状：conflict_summary 缺 departments，
    # quality_gate 缺 passed。
    pre_fix_memorial = {
        "title": "门下省封驳纪要",
        "verdict": "已封驳",
        "summary": "s",
        "ministry_outputs": [],
        "conflict_summary": [
            {"type": "human_signoff", "summary": "s", "source_label": "FALLBACK"}
        ],
        "evidence_gaps": [],
        "risk_flags": ["门下省封驳"],
        "decision_options": [],
        "next_best_action": "await_human_signoff",
        "source_label": "FALLBACK",
        "quality_gate": {
            "status": "blocked",
            "reasons": ["门下省封驳"],
            "human_signoff_required": True,
        },
    }
    assert find_memorial_contract_violations(pre_fix_memorial), "fixture 得真的违反契约才有测的意义"

    changed = _patch_known_gaps(pre_fix_memorial)

    assert changed is True
    assert pre_fix_memorial["conflict_summary"][0]["departments"] == []
    # 这个脚本的查询范围只圈 review_status == "menxia_veto_pending" 的行，
    # 这类行 gate 只可能是"没通过"，所以 passed 直接给 False，不从 status
    # 字符串反推(反推方向很容易搞反——status=="blocked" 映成 passed=True
    # 就是个真实犯过的错，被这条断言锁住)。
    assert pre_fix_memorial["quality_gate"]["passed"] is False
    assert find_memorial_contract_violations(pre_fix_memorial) == []


def test_already_valid_memorial_is_left_unchanged():
    valid = {
        "title": "t", "verdict": "v", "summary": "s",
        "ministry_outputs": [], "conflict_summary": [], "evidence_gaps": [],
        "risk_flags": [], "decision_options": [], "next_best_action": "n",
        "source_label": "FALLBACK",
        "quality_gate": {"passed": False, "status": "blocked", "reasons": [], "human_signoff_required": True},
    }
    before = json.dumps(valid, sort_keys=True)
    changed = _patch_known_gaps(valid)
    assert changed is False
    assert json.dumps(valid, sort_keys=True) == before
