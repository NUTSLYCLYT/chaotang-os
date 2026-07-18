"""find_memorial_contract_violations 自身要能真的抓到缺字段,不只是在合法
数据上不报错——2026-07-18 的教训是"回归测试用手写 fixture 巧合掩盖了真实
缺陷",这里反过来验证校验器本身对已知会让前端崩的缺陷保持敏感。"""

from __future__ import annotations

from src.shangshufang_memorial_contract import find_memorial_contract_violations

_VALID_MEMORIAL = {
    "title": "门下省封驳纪要",
    "verdict": "已封驳",
    "summary": "summary",
    "ministry_outputs": [],
    "conflict_summary": [
        {"type": "human_signoff", "summary": "s", "departments": [], "source_label": "FALLBACK"}
    ],
    "evidence_gaps": [],
    "risk_flags": ["门下省封驳"],
    "decision_options": [],
    "next_best_action": "await_human_signoff",
    "source_label": "FALLBACK",
    "quality_gate": {
        "passed": False,
        "status": "blocked",
        "reasons": ["门下省封驳"],
        "human_signoff_required": True,
    },
}


def test_valid_memorial_has_no_violations():
    assert find_memorial_contract_violations(_VALID_MEMORIAL) == []


def test_missing_top_level_field_is_caught():
    memorial = {k: v for k, v in _VALID_MEMORIAL.items() if k != "decision_options"}
    violations = find_memorial_contract_violations(memorial)
    assert any("decision_options" in v for v in violations)


def test_missing_conflict_summary_departments_is_caught():
    # 2026-07-18 真实复现过的崩溃:unique(item.departments).map(...) on undefined
    memorial = {
        **_VALID_MEMORIAL,
        "conflict_summary": [{"type": "human_signoff", "summary": "s", "source_label": "FALLBACK"}],
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("conflict_summary[0]" in v and "departments" in v for v in violations)


def test_missing_quality_gate_passed_is_caught():
    # 2026-07-18 真实复现过的问题:explicitGate() 只认 passed,不认 status，
    # 漏填 passed 会让 overallSignal 判成 'unknown' 而不是真实的阻断/通过。
    memorial = {
        **_VALID_MEMORIAL,
        "quality_gate": {
            "status": "blocked",
            "reasons": ["x"],
            "human_signoff_required": True,
        },
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("passed" in v for v in violations)


def test_missing_quality_gate_required_string_field_is_caught():
    memorial = {
        **_VALID_MEMORIAL,
        "quality_gate": {"passed": False, "human_signoff_required": True},
    }
    violations = find_memorial_contract_violations(memorial)
    assert any("quality_gate" in v and "status" in v for v in violations)
    assert any("quality_gate" in v and "reasons" in v for v in violations)
