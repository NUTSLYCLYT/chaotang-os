from scripts.validate_advisor_protocols import validate


def test_all_flows_have_advisor_protocols():
    errors, summary = validate()

    assert errors == []
    assert summary["flows"] == summary["swarms"]
    assert summary["profiles"] >= 8


def test_protocol_has_required_decision_levels():
    errors, summary = validate()

    assert errors == []
    assert set(summary["levels"]) == {"design", "irreversible", "routine", "substantial"}
