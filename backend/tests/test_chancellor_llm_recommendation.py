import pytest

from src.chancellor_llm_recommendation import merge_decision_level, recommend_route


def test_unsupported_scope_is_structured():
    result = recommend_route(
        "我要去美国看世界杯决赛",
        call_fn=lambda _: '{"candidate_departments": [], "d_level": "D0", "confidence": 0.98, "unsupported_scope": true, "reason": "超出六部职责"}',
    )
    assert result["status"] == "ok"
    assert result["unsupported_scope"] is True
    assert result["candidate_departments"] == []


def test_invalid_provider_output_is_explicit_degradation():
    result = recommend_route("合同审查", call_fn=lambda _: "not-json")
    assert result["status"] == "degraded"
    assert "降级为确定性规则" in result["reason"]


def test_hard_risk_gate_wins_over_llm_and_user():
    assert merge_decision_level("D2", "D0", "D0") == "D2"
    assert merge_decision_level("D0", "D1", "D0") == "D1"


def test_unrecognized_level_raises_instead_of_silently_downgrading():
    # 之前 LEVELS.get(level, 0) 会把拼错的 hard_gate 静默当 D0 处理，
    # 违反"硬门永远拥有最终裁决权"——现在必须显式炸，不能悄悄放行。
    with pytest.raises(ValueError):
        merge_decision_level("d2", "D0", "D0")


def test_empty_string_level_raises_instead_of_silently_defaulting():
    # `llm_level or "D0"` 会把空字符串也当"没传"处理，悄悄降级成 D0——
    # 空字符串是明确传了个无效值，不是真的"没提供"，必须跟乱码字符串一样炸。
    with pytest.raises(ValueError):
        merge_decision_level("D0", "", "D0")
    with pytest.raises(ValueError):
        merge_decision_level("D0", "D0", "")


def test_none_level_still_defaults_to_d0():
    # None 才是合法的"没提供"，走默认值，不该跟空字符串一样炸。
    assert merge_decision_level("D0", None, None) == "D0"
