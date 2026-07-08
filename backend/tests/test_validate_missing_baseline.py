"""⑦b 缺基线门控单测 — 防"全绿说谎":有 golden_cases 却无 L2 基线分必须被检出。

会审结论(2026-06-22)第①刀:旧 validate_flows 只罚已有分者(score<7),对无分蜂群静默放行,
导致 1/3 注册蜂群质量是暗区却显示全绿。本测试锁定 find_missing_baseline 的判定边界。
"""

from __future__ import annotations

import json

from scripts.validate_flows import find_missing_baseline


def _write_golden(golden_dir, sid):
    (golden_dir / f"{sid}.json").write_text(
        json.dumps([{"task": "t", "reference": "r"}], ensure_ascii=False),
        encoding="utf-8",
    )


def test_golden_without_baseline_is_flagged(tmp_path):
    """有 golden 文件但 baseline 无分 → 必须被列为缺基线。"""
    _write_golden(tmp_path, "product")
    swarms = [{"id": "product"}]
    assert find_missing_baseline(swarms, {}, tmp_path) == ["product"]


def test_scored_swarm_is_not_flagged(tmp_path):
    """有 golden 且 baseline 有分 → 不算缺基线。"""
    _write_golden(tmp_path, "finance")
    baseline = {"finance": {"quality_score": 7.0}}
    assert find_missing_baseline([{"id": "finance"}], baseline, tmp_path) == []


def test_score_none_is_treated_as_missing(tmp_path):
    """baseline 里有 key 但 quality_score=None(旧逻辑会 continue 放行)→ 仍算缺基线。"""
    _write_golden(tmp_path, "tianjian")
    baseline = {"tianjian": {"quality_score": None, "case_count": 2}}
    assert find_missing_baseline([{"id": "tianjian"}], baseline, tmp_path) == [
        "tianjian"
    ]


def test_no_golden_file_is_not_flagged(tmp_path):
    """没写 golden_cases 的蜂群不在本门管辖(本门只罚'写了却没验证')。"""
    assert find_missing_baseline([{"id": "voice_sales"}], {}, tmp_path) == []


def test_result_is_sorted_and_multi(tmp_path):
    for sid in ("lipu", "libu_personnel", "jinyiwei"):
        _write_golden(tmp_path, sid)
    swarms = [{"id": "lipu"}, {"id": "libu_personnel"}, {"id": "jinyiwei"}]
    assert find_missing_baseline(swarms, {}, tmp_path) == [
        "jinyiwei",
        "libu_personnel",
        "lipu",
    ]


def test_handles_empty_and_malformed_inputs(tmp_path):
    assert find_missing_baseline([], {}, tmp_path) == []
    assert find_missing_baseline(None, None, tmp_path) == []
    # baseline entry 非 dict 不应崩溃,视为无分
    _write_golden(tmp_path, "court")
    assert find_missing_baseline([{"id": "court"}], {"court": "garbage"}, tmp_path) == [
        "court"
    ]
